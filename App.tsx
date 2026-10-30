import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { CONNECTION_MESSAGE, registerDevice, setAuthToken, setUnauthorizedHandler } from './src/api';
import { PrimaryButton } from './src/components/PrimaryButton';
import { DialogHost } from './src/dialog/DialogHost';
import { showAlert } from './src/dialog/dialogStore';
import { pushUnsupportedReason, registerForPushNotificationsAsync, showNotificationsOffAtLaunchAlert } from './src/notifications';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { clearSession, getOrCreateSession, type Session } from './src/utils/session';
import { isNotificationsOptedOut } from './src/utils/notificationPreference';
import { initMonitoring } from './src/monitoring';
import { retryTransient } from './src/utils/retry';
import { urlFromShare } from './src/utils/sharedUrl';
import { configurePurchases } from './src/purchases';
import { PremiumScreen } from './src/screens/PremiumScreen';
import { ProductVariantScreen } from './src/screens/ProductVariantScreen';
import { ProductsScreen } from './src/screens/ProductsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

// Prototip navigasyonu: gerçek uygulamada react-navigation kullanılacak
// (özellikle share-intent'ten gelen deep link'i doğrudan "add" ekranına
// yönlendirmek için). Burada tek ekranlık state makinesi akışı göstermeye yetiyor.
// "settings" artık Profil'le birleşti — kendi başına kök sekme (bkz. BottomTabBar).
type ScreenName = 'products' | 'add' | 'premium' | 'settings';

// Çökme/hata izleme: EXPO_PUBLIC_SENTRY_DSN yoksa ya da geliştirme modunda hiçbir şey yapmaz (bkz. src/monitoring.ts).
initMonitoring();

// "Paylaş > ÜrünTakipte" web'de ve Expo Go'da çalışmaz (native modül yok): oralarda devre dışı.
const SHARE_INTENT_DISABLED =
  Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function App() {
  // useTheme() bir Provider içinde çalışmalı — asıl uygulama gövdesi
  // (AppContent) bu yüzden ayrı bir bileşene taşındı. SafeAreaProvider en
  // dışta: Header/BottomTabBar gibi paylaşılan bileşenler useSafeAreaInsets()
  // ile çentik/Dynamic Island/home indicator boşluğunu buradan okuyor —
  // cihaza özel bir sabit değer yazmıyoruz, her cihazda otomatik doğru.
  // ShareIntentProvider en dışta olmalı (kütüphane şartı): paylaşım soğuk açılışta da bu bağlamdan okunur.
  return (
    <ShareIntentProvider options={{ disabled: SHARE_INTENT_DISABLED, resetOnBackground: true }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}

function AppContent() {
  const { colors, resolvedScheme } = useTheme();
  const [screen, setScreen] = useState<ScreenName>('products');
  const [refreshToken, setRefreshToken] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionFailed, setSessionFailed] = useState(false);
  const deviceId = session?.userId ?? null;
  // Paylaşımla gelen ürün bağlantısı ("Ürün Ekle" ekranı bununla otomatik başlar) ve bildirime
  // dokunulunca açılacak ürün (canonicalUrl). Oturum henüz gelmediyse ikisi de bekler, oturum gelince işlenir.
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);
  const [openProductUrl, setOpenProductUrl] = useState<string | null>(null);

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  useEffect(() => {
    if (!hasShareIntent) return;
    const url = urlFromShare(shareIntent);
    resetShareIntent();
    if (url) {
      setSharedUrl(url);
      setScreen('add');
    } else {
      showAlert(
        'Ürün bağlantısı bulunamadı',
        "Paylaştığın içerikte bir bağlantı yok. Mağaza uygulamasında ürün sayfasından “Paylaş”ı seçip ÜrünTakipte'yi seç."
      );
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  // Bildirime dokunma (uygulama kapalıyken de açıkken de): payload'daki ürün bağlantısını (data.url,
  // bkz. backend/checker.js) ürün detayında aç. Aynı yanıt iki kez işlenmez.
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const handledResponseId = useRef<string | null>(null);
  useEffect(() => {
    if (!lastNotificationResponse) return;
    const id = lastNotificationResponse.notification.request.identifier;
    if (handledResponseId.current === id) return;
    handledResponseId.current = id;
    const url = lastNotificationResponse.notification.request.content.data?.url;
    if (typeof url === 'string' && url) {
      setOpenProductUrl(url);
      setScreen('products');
    }
  }, [lastNotificationResponse]);

  // Oturum (sunucunun verdiği userId + token, bkz. utils/session.ts). İlk açılışta kayıt
  // için internet gerekir; ulaşılamazsa "Tekrar dene" gösterilir.
  const startSession = useCallback(async () => {
    setSessionFailed(false);
    try {
      const next = await getOrCreateSession();
      setAuthToken(next.token);
      setSession(next);
      // RevenueCat API key tanımlı değilse (bkz. src/purchases.ts) no-op —
      // web preview/hesap kurulmadan önce güvenle çağrılabilir.
      configurePurchases(next.userId);
    } catch {
      setSessionFailed(true);
    }
  }, []);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Kayıtlı oturumu siler ve yenisini alır. İki durumda çağrılır: sunucu token'ı reddettiğinde (401) ve
  // kullanıcı hesabını sildiğinde. Eşzamanlı çağrılar tek yenilemeye indirgenir (ör. silmeden hemen sonra
  // uçuştaki bir isteğin 401'i).
  const renewing = useRef(false);
  const renewSession = useCallback(() => {
    if (renewing.current) return;
    renewing.current = true;
    setAuthToken(null);
    setSession(null); // eski kimlikle ekran yenilemesi olmasın; kimlik gelene kadar yükleniyor gösterilir
    clearSession()
      .then(startSession)
      .finally(() => {
        renewing.current = false;
      });
  }, [startSession]);

  useEffect(() => {
    setUnauthorizedHandler(renewSession);
    return () => setUnauthorizedHandler(null);
  }, [renewSession]);

  const handleAccountDeleted = useCallback(() => {
    setScreen('products');
    renewSession();
  }, [renewSession]);

  useEffect(() => {
    if (!deviceId) return;
    // Açılışta push izni + token kaydı — kullanıcı Profil ekranına hiç
    // gitmeden de fiyat düşüşü/stok bildirimlerini alabilsin diye (önceden
    // sadece Profil'deki "Bildirim Ayarları" butonuyla manuel tetikleniyordu,
    // yani hiç oraya girmeyen bir kullanıcı asla bildirim alamıyordu).
    // İzin daha önce verilmiş/reddedilmişse expo-notifications OS düzeyinde
    // yeniden sormuyor, bu yüzden her açılışta çağırmak güvenli ve ucuz.
    //
    // Bildirimler KAPALIYSA (işletim sistemi izni yok ya da kullanıcı Ayarlar'dan kapatmış)
    // kullanıcı bunu bilmeden fiyat düşüşünü kaçırır; açılışta bir diyalogla bilgilendirilir ve
    // uygulamadaki Ayarlar sekmesine (anahtarın olduğu yer) yönlendirilir. Tek istisna: izin
    // bu açılışta İLK KEZ soruldu ve az önce OS penceresinde reddedildi — ardından ikinci bir
    // uyarı gereksiz, bir sonraki açılışta bilgilendirilir.
    const userId = deviceId;
    let running = false;
    let registered = false;
    const announceOff = () => showNotificationsOffAtLaunchAlert(() => setScreen('settings'));

    async function setUpPush(announceIfOff: boolean) {
      if (running) return;
      running = true;
      try {
        // Kullanıcı Ayarlar'dan bildirimleri KAPATTIYSA token yeniden kaydedilmez (kapatma
        // sessizce geri alınırdı); yalnızca kapalı olduğu hatırlatılır. Push'un hiç çalışmadığı
        // ortamda (simülatör, web, Android Expo Go) açılabilecek bir şey olmadığından hatırlatılmaz.
        if (await isNotificationsOptedOut()) {
          if (announceIfOff && !pushUnsupportedReason()) announceOff();
          return;
        }
        const result = await registerForPushNotificationsAsync();
        if (result.status === 'granted') {
          registered = true;
          try {
            // Anlık ağ aksaklığında sessizce yeniden denenir; yine olmazsa bir sonraki açılışta
            // ya da Ayarlar > Bildirim Ayarları'ndan (orada nedeni de gösterilir) tekrar denenir.
            await retryTransient(() => registerDevice(userId, result.token, Platform.OS));
          } catch {
            // Açılışta kullanıcıyı bir uyarıyla kesmiyoruz.
          }
        } else if (result.status === 'denied' && !result.prompted && announceIfOff) {
          announceOff();
        }
      } finally {
        running = false;
      }
    }

    setUpPush(true);

    // Kullanıcı cihaz ayarlarından bildirimi açıp uygulamaya dönünce
    // token'ı hemen kaydet — yoksa bir sonraki soğuk açılışa kadar bildirim gelmez.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !registered) setUpPush(false);
    });
    return () => subscription.remove();
  }, [deviceId]);

  if (!deviceId) {
    // Oturum gelene kadar hiçbir ekran userId olmadan render edilemez.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 32 }}>
        {sessionFailed ? (
          <>
            <Text style={{ color: colors.onBackground, textAlign: 'center', marginBottom: 16 }}>{CONNECTION_MESSAGE}</Text>
            <PrimaryButton title="Tekrar Dene" onPress={startSession} testID="session-retry-button" />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  let content: React.ReactNode;

  if (screen === 'add') {
    content = (
      <ProductVariantScreen
        key={sharedUrl ?? 'manual'}
        userId={deviceId}
        initialUrl={sharedUrl ?? undefined}
        onClose={() => {
          setSharedUrl(null);
          setScreen('products');
        }}
        onTracked={() => {
          setSharedUrl(null);
          setRefreshToken((t) => t + 1);
          setScreen('products');
        }}
      />
    );
  } else if (screen === 'premium') {
    content = (
      <PremiumScreen
        userId={deviceId}
        onClose={() => setScreen('settings')}
        onOpenProducts={() => setScreen('products')}
        onOpenSettings={() => setScreen('settings')}
      />
    );
  } else if (screen === 'settings') {
    content = (
      <SettingsScreen
        userId={deviceId}
        onOpenProducts={() => setScreen('products')}
        onOpenPremium={() => setScreen('premium')}
        onOpenProduct={(url) => {
          setOpenProductUrl(url);
          setScreen('products');
        }}
        onAccountDeleted={handleAccountDeleted}
      />
    );
  } else {
    content = (
      <ProductsScreen
        userId={deviceId}
        refreshToken={refreshToken}
        openUrl={openProductUrl}
        onOpenUrlHandled={() => setOpenProductUrl(null)}
        onAddProduct={() => {
          setSharedUrl(null);
          setScreen('add');
        }}
        onOpenPremium={() => setScreen('premium')}
        onOpenSettings={() => setScreen('settings')}
      />
    );
  }

  return (
    <>
      {content}
      {/* Aktif ekranın ÜSTÜNDE, tek sefer monte edilir — showAlert/confirmAsync
          hangi ekrandan çağrılırsa çağrılsın aynı diyaloğu burada gösterir. */}
      <DialogHost />
      {/* StatusBar "style" içerik (metin/ikon) rengini belirtir, arka planı
          değil — koyu temada AÇIK içerik gerekiyor, bu yüzden ters. */}
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
