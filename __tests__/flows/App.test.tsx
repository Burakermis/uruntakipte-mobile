import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { fireEvent, fireEventAsync, renderAsync, screen, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { installFakeBackend, type FakeBackend } from '../../test-utils/fakeBackend';
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
    expect(firstUserId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await AsyncStorage.getItem('deviceId')).toBe(firstUserId);

    await screen.unmountAsync();
    backend.calls.length = 0;
    await launchApp();
    await screen.findByText('Henüz ürün eklemediniz');

    expect(backend.callsTo('GET /products')[0].query.get('userId')).toBe(firstUserId);
  });

  it('bildirim izni verilmişse token\'ı, Profil ekranına hiç girmeden, cihaz kimliğiyle backend\'e kaydeder', async () => {
    await launchApp();

    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(1));
    const deviceId = (await AsyncStorage.getItem('deviceId'))!;
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

  it('kalıcı depo okunamasa bile açılış ekranında takılmaz, uygulama açılır', async () => {
    // Yalnızca cihaz kimliği okuması düşüyor (mock jest.fn: özgün gerçekleme sonunda geri konuyor)
    const getItem = jest.mocked(AsyncStorage.getItem);
    const original = getItem.getMockImplementation()!;
    getItem.mockImplementation(async (key: string) => {
      if (key === 'deviceId') throw new Error('disk hatası');
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

describe('ücretsiz limit → Premium → ekleme (uçtan uca)', () => {
  it('limit dolunca Premium\'a yönlendirir; premium olunca aynı kullanıcı yeni ürün ekleyebilir', async () => {
    await AsyncStorage.setItem('deviceId', 'test-device');
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
    await AsyncStorage.setItem('deviceId', 'test-device');
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
    await AsyncStorage.setItem('deviceId', 'test-device');
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
