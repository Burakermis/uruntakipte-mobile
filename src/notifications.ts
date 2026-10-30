import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { showAlert } from './dialog/dialogStore';

export type PushRegistrationResult =
  | { status: 'granted'; token: string }
  // prompted: izin bu çağrıda İLK KEZ soruldu (OS penceresi kesin açıldı) ve kullanıcı reddetti.
  // false ise izin daha önce reddedilmiş — kullanıcı bunu bilmiyor olabilir, bilgilendirilmeli.
  | { status: 'denied'; prompted: boolean }
  // Bu ortamda push hiç çalışmaz (web, simülatör, Android Expo Go). Kullanıcı bir şey yapamaz.
  | { status: 'unsupported'; reason: string }
  // Ortam desteklese de şu an token alınamadı (yapılandırma/ağ/Expo servisi). Tekrar denenebilir.
  | { status: 'error'; reason: string };

// expo-notifications'ın foreground'da da bildirimi göstermesi için (varsayılan
// davranış: uygulama açıkken push'u sessizce yutar).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// EAS proje kimlikleri UUID'dir. app.json'daki "REPLACE_WITH_EAS_PROJECT_ID" gibi yer
// tutucular geçerli sayılmaz: expo-notifications projectId'yi yine app.json'dan okuyup
// Expo sunucusuna gönderiyor ve sunucu reddediyor.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveProjectId(): string | undefined {
  // expo-notifications ile aynı sıra: önce EAS build'in yazdığı, sonra app.json.
  return [Constants.easConfig?.projectId, Constants.expoConfig?.extra?.eas?.projectId].find(
    (id): id is string => typeof id === 'string' && UUID.test(id)
  );
}

// Kullanıcıya teknik hata metni (sunucu gövdesi, kod adı…) gösterilmez; ayrıntı konsola gider.
function describePushTokenFailure(err: unknown): string {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  const raw = err instanceof Error ? err.message : String(err);
  if (code === 'ERR_NOTIFICATIONS_NETWORK_ERROR' || /network request failed|timed? ?out/i.test(raw)) {
    return 'Bildirim servisine ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.';
  }
  return 'Bildirimler şu an açılamadı. Biraz sonra tekrar dene.';
}

/**
 * Bu ortamda push hiç çalışmıyorsa nedenini, çalışıyorsa null döndürür. Web'de, simülatörde ve
 * Android Expo Go'da push desteklenmez (Expo'nun kendi kısıtı, bizim eksiğimiz değil).
 */
export function pushUnsupportedReason(): string | null {
  if (Platform.OS === 'web') {
    return 'Push bildirimleri web önizlemesinde desteklenmiyor. iOS/Android cihazda dene.';
  }
  if (!Device.isDevice) {
    return 'Push bildirimleri sadece gerçek cihazlarda çalışır, simülatörde/emülatörde çalışmaz.';
  }
  // SDK 53'ten beri Android'de Expo Go uzaktan push desteklemiyor (development build gerekir).
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'Android\'de Expo Go push bildirimlerini desteklemiyor. Uygulamanın development build\'i ile dene.';
  }
  return null;
}

/**
 * İzin ister ve bir Expo push token alır. Desteklenmeyen ortamlar (bkz. pushUnsupportedReason)
 * izin penceresi açılmadan "unsupported" döner; geçici/yapılandırma kaynaklı başarısızlıklar "error".
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  const unsupported = pushUnsupportedReason();
  if (unsupported) return { status: 'unsupported', reason: unsupported };

  if (Platform.OS === 'android') {
    // Android 13+: en az bir bildirim kanalı oluşturulmadan sistem izin penceresi HİÇ
    // görünmüyor (bkz. Expo notifications dokümanı) — yani kullanıcı izin veremiyor, bildirim
    // gelmiyor. Kanal izin/token isteğinden ÖNCE oluşturulmalı; Expo push'un varsayılan
    // kanal kimliği "default".
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Fiyat ve stok bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
      });
    } catch {
      // Kanal oluşturulamadıysa da izin/token akışı denenir.
    }
  }

  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;
  let prompted = false;
  if (existing.status !== 'granted') {
    // canAskAgain === false: OS izin penceresini bir daha açmaz, istemek boşuna.
    if (existing.canAskAgain !== false) {
      // Pencerenin gerçekten açıldığı yalnızca ilk sormada kesin. Daha önce reddedilmişse
      // (özellikle Android) istek pencere açmadan "reddedildi" dönebilir; o durumda kullanıcı
      // hiçbir şey görmediğinden kapalı olduğundan haberi yoktur ve bilgilendirilir.
      prompted = existing.status === 'undetermined';
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  }
  if (finalStatus !== 'granted') {
    return { status: 'denied', prompted };
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    // Geçerli bir EAS projectId yokken Expo sunucusuna gitmenin anlamı yok (reddedilir).
    console.warn(
      '[notifications] Geçerli bir EAS projectId bulunamadı: app.json > expo.extra.eas.projectId yer tutucu ya da boş. ' +
        '`npx eas-cli init` çalıştırıp oluşan projectId\'yi app.json\'a yaz; aksi halde push token alınamaz.'
    );
    return {
      status: 'error',
      reason: 'Bildirim servisi bu uygulama sürümünde henüz yapılandırılmamış. Uygulamayı güncelleyip tekrar dene.',
    };
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: tokenResponse.data };
  } catch (err) {
    console.warn('[notifications] Push token alınamadı:', err);
    return { status: 'error', reason: describePushTokenFailure(err) };
  }
}

/**
 * Bildirimler kapalıyken kullanıcıyı bilgilendirir ve cihazın uygulama ayarlarına
 * (Bildirimler anahtarının olduğu sayfa) götürür — OS izin penceresini bir kez
 * reddettikten sonra uygulama içinden tekrar açılamadığı için tek yol bu.
 */
export function showNotificationsOffAlert() {
  showAlert(
    'Bildirimler kapalı',
    'Fiyat düştüğünde ve ürün stoğa girdiğinde haber verebilmemiz için bildirimleri açman gerekiyor.',
    [
      { text: 'Şimdi Değil', style: 'cancel' },
      {
        text: 'Ayarları Aç',
        style: 'default',
        onPress: () => {
          Linking.openSettings().catch(() => {
            showAlert('Ayarlar açılamadı', 'Cihaz Ayarları > Uygulamalar > ÜrünTakipte > Bildirimler yolundan açabilirsin.');
          });
        },
      },
    ]
  );
}

/**
 * Uygulama açıldığında bildirimler kapalıysa (işletim sistemi izni yok ya da kullanıcı
 * Ayarlar'dan kapatmış) bilgilendirir ve uygulamadaki Ayarlar sekmesine götürür; bildirimi
 * açmanın tek yeri oradaki anahtar (izin reddedilmişse oradan cihaz ayarlarına da yönlendirilir).
 */
export function showNotificationsOffAtLaunchAlert(onGoToSettings: () => void) {
  showAlert(
    'Bildirimler kapalı',
    'Bildirimler kapalı olduğu için fiyat düştüğünde ya da ürün stoğa girdiğinde sana haber veremiyoruz. Ayarlar sekmesinden açabilirsin.',
    [
      { text: 'Şimdi Değil', style: 'cancel' },
      { text: 'Ayarlara Git', style: 'default', onPress: onGoToSettings },
    ]
  );
}
