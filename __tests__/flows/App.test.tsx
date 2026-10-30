import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, type AppStateStatus, Linking } from 'react-native';
import { act, fireEvent, fireEventAsync, renderAsync, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { installFakeBackend, seedSession, tokenFor, type FakeBackend } from '../../test-utils/fakeBackend';
import { resolvedProduct, trackedProduct, ZARA_URL } from '../../test-utils/fixtures';
import { setMockDeviceMetrics } from '../../test-utils/safeAreaMock';
import { DEVICES } from '../../test-utils/devices';
import { metricsFor } from '../../test-utils/render';

// Gerçek App kökü: cihaz kimliği, push kaydı, ekranlar arası gezinme ve
// backend (sahte, bellekte) birlikte çalışıyor — modül mock'u yok.
let backend: FakeBackend;

const cards = () => screen.queryAllByTestId('product-card');

async function launchApp() {
  setMockDeviceMetrics(metricsFor(DEVICES.iphone15Pro));
  return renderAsync(<App />);
}

beforeEach(() => {
  backend = installFakeBackend({ catalog: [resolvedProduct()] });
});

describe('açılış', () => {
  it('cihaz kimliği gelene kadar yükleniyor gösterir, sonra Ürünlerim\'i açar', async () => {
    await launchApp();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(screen.getByTestId('add-product-button')).toBeTruthy();
  });

  it('ilk açılışta üretilen cihaz kimliği kalıcıdır: yeniden açılışta aynı kimlikle istek atılır', async () => {
    await launchApp();
    await screen.findByText('Henüz ürün eklemediniz');
    const firstUserId = backend.callsTo('GET /products')[0].query.get('userId');
    expect(firstUserId).toBe(backend.userId); // kimliği sunucu üretti
    expect(JSON.parse((await SecureStore.getItemAsync('session'))!).userId).toBe(firstUserId);

    await screen.unmountAsync();
    backend.calls.length = 0;
    await launchApp();
    await screen.findByText('Henüz ürün eklemediniz');

    expect(backend.callsTo('GET /products')[0].query.get('userId')).toBe(firstUserId);
    expect(backend.registrations).toBe(1); // ikinci açılışta yeniden kayıt YOK
    expect(backend.callsTo('GET /products')[0].headers.authorization).toBe(`Bearer ${tokenFor(firstUserId!)}`);
  });

  it('bildirim izni verilmişse token\'ı, Profil ekranına hiç girmeden, cihaz kimliğiyle backend\'e kaydeder', async () => {
    await launchApp();

    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(1));
    const deviceId = JSON.parse((await SecureStore.getItemAsync('session'))!).userId;
    expect(backend.callsTo('POST /devices')[0].body).toEqual({
      userId: deviceId,
      expoPushToken: 'ExponentPushToken[test]',
      platform: 'ios',
    });
  });

  it('izin reddedilirse token kaydı denenmez ve uygulama normal açılır', async () => {
    jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ status: 'denied' } as any);
    await launchApp();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(backend.callsTo('POST /devices')).toHaveLength(0);
  });

  it('push için geçerli bir EAS projectId yoksa (app.json yer tutucusu) uygulama normal açılır; kullanıcı hata görmez', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (Constants as any).expoConfig = { extra: { eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' } } };
    await launchApp();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(backend.callsTo('POST /devices')).toHaveLength(0);
    expect(screen.queryByText('Desteklenmiyor')).toBeNull();
    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
    warn.mockRestore();
  });

  it('kalıcı depo okunamasa bile açılış ekranında takılmaz, uygulama açılır', async () => {
    // Yalnızca oturum okuması düşüyor (mock jest.fn: özgün gerçekleme sonunda geri konuyor)
    const getItem = jest.mocked(SecureStore.getItemAsync);
    const original = getItem.getMockImplementation()!;
    getItem.mockImplementation(async (key: string) => {
      if (key === 'session') throw new Error('keychain hatası');
      return original(key);
    });
    try {
      await launchApp();

      expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    } finally {
      getItem.mockImplementation(original);
    }
  });

  it('anlık bir ağ aksaklığında push kaydı sessizce yeniden denenir; kullanıcı hiçbir uyarı görmez', async () => {
    backend.networkDown('POST /devices');
    await launchApp();

    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(2));
    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(screen.queryByText('Bildirimler açıldı')).toBeNull();
  });

  it('token kaydı hiç yapılamasa bile (sunucu kapalı) uygulama çökmez, açılışta kullanıcıyı uyarıyla kesmez', async () => {
    backend.networkDown('POST /devices', { times: 3 });
    await launchApp();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(3));
    expect(screen.queryByText('Bildirimler açıldı')).toBeNull();
  });
});

// Bildirimler kapalıyken (OS izni yok ya da kullanıcı Ayarlar'dan kapatmış) kullanıcı fiyat düşüşünü
// kaçırır. Açılışta diyalogla bilgilendirilir ve uygulamadaki Ayarlar sekmesine yönlendirilir.
describe('açılışta bildirimler kapalıysa', () => {
  const getPermissions = jest.mocked(Notifications.getPermissionsAsync);
  const requestPermissions = jest.mocked(Notifications.requestPermissionsAsync);
  const openSettings = jest.mocked(Linking.openSettings);
  // App ve (açıksa) Ayarlar ekranı kendi AppState dinleyicisini ekler: hepsi tutulur, hepsi tetiklenir.
  let appStateListeners: Array<(state: AppStateStatus) => void>;
  let removeListener: jest.Mock;

  beforeEach(() => {
    appStateListeners = [];
    removeListener = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: AppStateStatus) => void) => {
      appStateListeners.push(listener);
      return { remove: removeListener };
    }) as any);
    openSettings.mockResolvedValue(undefined);
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false } as any);
  });
  afterEach(() => {
    jest.mocked(AppState.addEventListener).mockRestore();
  });

  const comeBackToApp = () => act(async () => appStateListeners.forEach((listener) => listener('active')));
  const notificationRow = () => screen.getByText('Bildirim Ayarları');

  it('izin daha önce reddedilmişse diyalogla bilgilendirir; "Ayarlara Git" cihaz ayarlarını değil uygulamadaki Ayarlar sekmesini açar', async () => {
    await launchApp();

    expect(await screen.findByText('Bildirimler kapalı')).toBeTruthy();
    expect(screen.getByText(/Ayarlar sekmesinden açabilirsin/)).toBeTruthy();
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(backend.callsTo('POST /devices')).toHaveLength(0);

    fireEvent.press(screen.getByText('Ayarlara Git'));

    expect(await screen.findByText('HESAP AYARLARI')).toBeTruthy();
    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
    expect(openSettings).not.toHaveBeenCalled();
    expect(await screen.findByText('Kapalı — cihaz ayarlarından aç')).toBeTruthy();
  });

  it('"Şimdi Değil" uyarıyı kapatır, Ayarlar sekmesine gitmez; uygulama normal kullanılır', async () => {
    await launchApp();
    await screen.findByText('Bildirimler kapalı');

    fireEvent.press(screen.getByText('Şimdi Değil'));

    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
    expect(screen.queryByText('HESAP AYARLARI')).toBeNull();
    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
  });

  it('kullanıcı izin penceresinde AZ ÖNCE "İzin verme"ye bastıysa (ilk soruş) hemen ardından ikinci bir uyarı çıkmaz', async () => {
    getPermissions.mockResolvedValue({ status: 'undetermined' } as any);
    requestPermissions.mockResolvedValue({ status: 'denied' } as any);
    await launchApp();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    await waitFor(() => expect(requestPermissions).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
  });

  // Android: daha önce reddedilmiş izin için istek, pencere açmadan "reddedildi" dönebilir —
  // kullanıcı hiçbir şey görmediği için kapalı olduğundan haberi yoktur.
  it('izin daha önce reddedilmiş ve istek pencere açmadan reddedilirse (Android) yine bilgilendirir', async () => {
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true } as any);
    requestPermissions.mockResolvedValue({ status: 'denied' } as any);
    await launchApp();

    expect(await screen.findByText('Bildirimler kapalı')).toBeTruthy();
    expect(screen.getByText('Ayarlara Git')).toBeTruthy();
  });

  it('izin verilmişse uyarı çıkmaz', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    await launchApp();

    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(1));
    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
  });

  it('simülatörde/web\'de (push zaten yok) kapalı uyarısı göstermez', async () => {
    (Device as any).isDevice = false;
    await launchApp();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
    expect(screen.queryByText('Desteklenmiyor')).toBeNull();
  });

  // Kullanıcı Ayarlar'daki anahtarı kapattıysa sunucu token'ı sildi: açılışta yeniden kaydetmek kapatmayı
  // sessizce geri alırdı. Ama kapalı olduğu hatırlatılır ve anahtarın olduğu yere yönlendirilir.
  it('kullanıcı bildirimleri uygulama içinden KAPATTIYSA: uyarır ve Ayarlar sekmesine yönlendirir; token yeniden kaydedilmez, izin istenmez', async () => {
    await AsyncStorage.setItem('notificationsOptOut', '1');
    getPermissions.mockResolvedValue({ status: 'granted' } as any);

    await launchApp();

    expect(await screen.findByText('Bildirimler kapalı')).toBeTruthy();
    await comeBackToApp();
    expect(backend.callsTo('POST /devices')).toHaveLength(0);
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(requestPermissions).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Ayarlara Git'));

    expect(await screen.findByText('HESAP AYARLARI')).toBeTruthy();
    expect(await screen.findByText('Kapalı')).toBeTruthy();
    expect(screen.getByLabelText('Bildirim Ayarları').props.value).toBe(false);
  });

  it('kapatmış kullanıcıya, işletim sistemi izni de kapalıysa TEK uyarı gösterilir', async () => {
    await AsyncStorage.setItem('notificationsOptOut', '1');
    // beforeEach: getPermissions -> denied, canAskAgain=false

    await launchApp();

    expect(await screen.findAllByText('Bildirimler kapalı')).toHaveLength(1);
  });

  it('kapatmış kullanıcı simülatördeyse (açılabilecek bir şey yok) uyarı gösterilmez', async () => {
    await AsyncStorage.setItem('notificationsOptOut', '1');
    (Device as any).isDevice = false;

    await launchApp();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
  });

  it('uçtan uca: uyarı → Ayarlar sekmesi → anahtar → cihaz ayarları → izin verip dönünce token HEMEN kaydedilir ve anahtar "Açık" olur', async () => {
    await launchApp();
    fireEvent.press(await screen.findByText('Ayarlara Git'));
    await screen.findByText('Kapalı — cihaz ayarlarından aç');

    // İzin OS düzeyinde reddedilmiş: anahtarı çevirince cihaz ayarlarına yönlendiren ikinci diyalog çıkar.
    await fireEventAsync.press(notificationRow());
    fireEvent.press(await screen.findByText('Ayarları Aç'));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(backend.callsTo('POST /devices')).toHaveLength(0);

    getPermissions.mockResolvedValue({ status: 'granted' } as any); // kullanıcı cihaz ayarlarından açtı
    await comeBackToApp();

    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(1));
    expect(backend.callsTo('POST /devices')[0].body).toMatchObject({ expoPushToken: 'ExponentPushToken[test]' });
    // Ayarlar ekranı da ön plana dönüşte durumu yeniden okur (not: "Açık" Görünüm'deki tema seçeneğiyle de eşleşir).
    await waitFor(() => expect(screen.getByLabelText('Bildirim Ayarları').props.value).toBe(true));
    expect(screen.queryByText('Kapalı — cihaz ayarlarından aç')).toBeNull();
    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
  });

  it('izni açmadan geri dönerse uyarı BİR DAHA çıkmaz (her ön plana gelişte rahatsız etmez)', async () => {
    await launchApp();
    await screen.findByText('Bildirimler kapalı');
    fireEvent.press(screen.getByText('Şimdi Değil'));

    await comeBackToApp();

    expect(screen.queryByText('Bildirimler kapalı')).toBeNull();
    expect(backend.callsTo('POST /devices')).toHaveLength(0);
  });

  it('token zaten kaydedildiyse ön plana her dönüşte yeniden kaydetmez', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    await launchApp();
    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(1));

    await comeBackToApp();
    await comeBackToApp();

    expect(backend.callsTo('POST /devices')).toHaveLength(1);
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it('uygulama kapanırken dinleyici kaldırılır', async () => {
    await launchApp();
    await screen.findByText('Bildirimler kapalı');

    await screen.unmountAsync();

    expect(removeListener).toHaveBeenCalled();
  });
});

describe('ürün ekleme akışı (uçtan uca)', () => {
  it('boş listeden: bağlantı gir → beden seç → takibe al → listede ürünü ve kullanım sayacını gör', async () => {
    await launchApp();
    await screen.findByText('Henüz ürün eklemediniz');

    fireEvent.press(screen.getByTestId('add-product-button'));
    fireEvent.changeText(await screen.findByTestId('url-input'), `Oversize gömlek - ZARA ${ZARA_URL}`);
    await fireEventAsync.press(screen.getByTestId('fetch-product-button'));
    await screen.findByText('RENK SEÇİN');
    fireEvent.press(screen.getByText('S'));
    fireEvent.press(screen.getByText('M'));
    await fireEventAsync.press(screen.getByText('2 Bedeni Takibe Al'));

    // Liste ekranına dönmüş ve yeni takibi göstermeli
    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(screen.getByText('Oversize Gömlek')).toBeTruthy();
    expect(screen.getByText('1/3 ürün')).toBeTruthy();
    expect(screen.queryByText('Henüz ürün eklemediniz')).toBeNull();
    // Her iki beden de TEK kartta
    expect(backend.products).toHaveLength(2);
  });

  it('akıştan vazgeçince (kapat) hiçbir şey eklenmeden Ürünlerim\'e dönülür', async () => {
    await launchApp();
    await screen.findByText('Henüz ürün eklemediniz');

    fireEvent.press(screen.getByTestId('add-product-button'));
    fireEvent.press(await screen.findByTestId('close-button'));

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(backend.callsTo('POST /products')).toHaveLength(0);
  });
});

describe('oturum', () => {
  it('ilk açılışta sunucuya ulaşılamazsa "Tekrar Dene" gösterir; bağlantı gelince uygulama açılır', async () => {
    backend.networkDown('POST /auth/register');
    await launchApp();

    expect(await screen.findByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(backend.callsTo('GET /products')).toHaveLength(0);

    await fireEventAsync.press(screen.getByTestId('session-retry-button'));

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(backend.registrations).toBe(1);
  });

  it('sunucu kayıtlı token’ı reddederse (401) oturum silinip yenisi alınır ve liste yeni kimlikle yüklenir', async () => {
    await SecureStore.setItemAsync('session', JSON.stringify({ userId: 'eski', token: 'gecersiz-token' }));
    await launchApp();

    await waitFor(() => expect(backend.registrations).toBe(1));
    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(JSON.parse((await SecureStore.getItemAsync('session'))!).userId).toBe(backend.userId);
    expect(backend.callsTo('GET /products').at(-1)!.headers.authorization).toBe(`Bearer ${tokenFor(backend.userId)}`);
  });
});

describe('ücretsiz limit → Premium → ekleme (uçtan uca)', () => {
  it('limit dolunca Premium\'a yönlendirir; premium olunca aynı kullanıcı yeni ürün ekleyebilir', async () => {
    await seedSession('test-device');
    backend = installFakeBackend({
      catalog: [resolvedProduct()],
      products: [1, 2, 3].map((i) =>
        trackedProduct({ id: i, name: `Ürün ${i}`, canonicalUrl: `https://x.com/${i}`, sku: `s${i}` })
      ),
    });
    await launchApp();
    await screen.findByText('3/3 ürün');

    // 1) Limit dolu → uyarı → Premium ekranı
    fireEvent.press(screen.getByTestId('add-product-button'));
    fireEvent.press(await screen.findByText("Premium'a Bak"));
    await fireEventAsync.press(await screen.findByTestId('activate-premium-button'));

    // 2) RevenueCat kurulu değil → geliştirme etkinleştirmesi (backend'de premium yapar)
    await fireEventAsync.press(await screen.findByTestId('dev-activate-button'));
    expect(await screen.findByText('Premium aktif')).toBeTruthy();
    fireEvent.press(screen.getByText('Tamam'));

    // 3) Ekran Ayarlar'a döner ve plan durumunu güncel gösterir
    expect(await screen.findByText('Premium üye')).toBeTruthy();

    // 4) Ürünlerim'de artık limit rozeti yok ve ekleme akışı açılıyor
    fireEvent.press(screen.getByText('Ürünlerim'));
    await waitFor(() => expect(cards()).toHaveLength(3));
    expect(screen.queryByTestId('usage-badge')).toBeNull();

    fireEvent.press(screen.getByTestId('add-product-button'));
    expect(await screen.findByTestId('url-input')).toBeTruthy();
    expect(screen.queryByText('Ürün limiti doldu')).toBeNull();
  });
});

describe('sekmeler', () => {
  it('Ürünlerim ↔ Ayarlar arasında gidip gelir; veri korunur', async () => {
    await seedSession('test-device');
    backend = installFakeBackend({ products: [trackedProduct({ id: 1 })] });
    await launchApp();
    await waitFor(() => expect(cards()).toHaveLength(1));

    fireEvent.press(screen.getByText('Ayarlar'));
    expect(await screen.findByText('HESAP AYARLARI')).toBeTruthy();
    expect(screen.getByText('test-device')).toBeTruthy(); // Cihaz ID

    fireEvent.press(screen.getByText('Ürünlerim'));
    await waitFor(() => expect(cards()).toHaveLength(1));
  });

  it('ürün detayındaki "kaydedilmemiş değişiklik" onayı, kökteki tek DialogHost üzerinden açılır', async () => {
    await seedSession('test-device');
    backend = installFakeBackend({ catalog: [resolvedProduct()], products: [trackedProduct({ id: 1, sku: 'beyaz:sku-s', size: 'S' })] });
    await launchApp();
    await waitFor(() => expect(cards()).toHaveLength(1));

    fireEvent.press(cards()[0]);
    await screen.findByText('Ürün Detayı');
    fireEvent.press(screen.getByText('M')); // taslağı kirlet
    fireEvent.press(screen.getByTestId('close-button'));

    expect(await screen.findByText('Kaydedilmemiş değişiklikler var')).toBeTruthy();
  });
});
