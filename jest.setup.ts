// AsyncStorage'ın resmi Jest mock'u (bellekte çalışan gerçek bir depo).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Safe-area: gerçek context'ler + testin seçtiği cihazın çentik/home-indicator
// boşlukları (bkz. test-utils/safeAreaMock.tsx, test-utils/render.tsx).
jest.mock('react-native-safe-area-context', () => require('./test-utils/safeAreaMock').default);

// MaterialCommunityIcons font yükleyip asenkron state güncellemesi yapıyor
// (testlerde "not wrapped in act" gürültüsü) — burada ikon adını testID'ye
// çeviren sade bir View ile değiştiriliyor; böylece testler "hangi ikon
// çizildi" sorusunu da (ör. `icon-check-circle`) doğrulayabiliyor.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MaterialCommunityIcons = ({ name }: { name: string }) =>
    React.createElement(View, { testID: `icon-${name}` });
  return { __esModule: true, MaterialCommunityIcons };
});

// Native modül gerektiren paketler — gerçekleri Node'da çalışmıyor. Varsayılan
// davranışlar aşağıdaki beforeEach'te her testten önce yeniden kuruluyor;
// testler ihtiyaç duyduklarını kendi içinde ezebilir.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  getStringAsync: jest.fn(),
  setStringAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
}));

// expo-constants'ın expoConfig'i getter-only (testte değiştirilemiyor) — düz, değiştirilebilir
// bir nesneyle değiştiriliyor; beforeEach her test için varsayılana döndürüyor.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: null } }));

jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    __esModule: true,
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`),
  };
});

beforeEach(async () => {
  const Clipboard = require('expo-clipboard');
  const Notifications = require('expo-notifications');
  const Device = require('expo-device');
  const Purchases = require('react-native-purchases').default;

  Clipboard.getStringAsync.mockReset().mockResolvedValue('');
  Clipboard.setStringAsync.mockReset().mockResolvedValue(true);
  Notifications.getPermissionsAsync.mockReset().mockResolvedValue({ status: 'undetermined' });
  Notifications.requestPermissionsAsync.mockReset().mockResolvedValue({ status: 'granted' });
  Notifications.getExpoPushTokenAsync.mockReset().mockResolvedValue({ data: 'ExponentPushToken[test]' });
  Notifications.setNotificationChannelAsync.mockReset().mockResolvedValue(undefined);
  Device.isDevice = true;
  // Diyalog deposu modül düzeyinde global — önceki testte açık kalan bir uyarı sonrakine sızmasın.
  const dialogStore = require('./src/dialog/dialogStore');
  if (dialogStore.getState().visible) dialogStore.dismiss();
  // Ekleme istekleri geçici hatada yeniden deneniyor (bkz. src/utils/retry.ts) — testlerde
  // beklemeler sıfır; deneme SAYISI gerçek (2 yeniden deneme). Bekleme süresini ölçen
  // testler (retry.test.ts) kendi değerlerini ayarlıyor.
  Object.assign(require('./src/utils/retry').retryConfig, { delaysMs: [0, 0], slowFailureMs: 10_000 });
  require('./test-utils/safeAreaMock').setMockDeviceMetrics(null);
  require('expo-constants').default.expoConfig = { name: 'ÜrünTakipte', version: '1.0.0', extra: {} };
  Purchases.configure.mockReset();
  Purchases.getOfferings.mockReset();
  Purchases.purchasePackage.mockReset();
  Purchases.restorePurchases.mockReset();

  // Testler arasında AsyncStorage (deviceId, tema tercihi) sızmasın.
  const AsyncStorageModule = require('@react-native-async-storage/async-storage');
  await (AsyncStorageModule.default ?? AsyncStorageModule).clear();
});
