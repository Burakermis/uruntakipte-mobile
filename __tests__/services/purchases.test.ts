import { Platform } from 'react-native';

// purchases.ts API anahtarını ve Platform'u MODÜL YÜKLENİRKEN okuyor — bu yüzden
// her senaryoda modül izole ve doğru ortamla yeniden yükleniyor.
type PurchasesModule = typeof import('../../src/purchases');

function loadPurchases({ iosKey, os = 'ios' }: { iosKey?: string; os?: 'ios' | 'web' } = {}) {
  let mod!: PurchasesModule;
  let sdk!: {
    configure: jest.Mock;
    getOfferings: jest.Mock;
    purchasePackage: jest.Mock;
    restorePurchases: jest.Mock;
  };
  const previous = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  if (iosKey === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  else process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = iosKey;

  // RN'in Platform'u index.js'te tembel bir getter — isolateModules bittikten sonra
  // (isPurchasesAvailable çağrılırken) ana kayıttaki Platform'a bakıyor; bu yüzden
  // OS ikisinde de ayarlanıyor.
  Platform.OS = os;
  jest.isolateModules(() => {
    require('react-native').Platform.OS = os;
    sdk = require('react-native-purchases').default;
    mod = require('../../src/purchases');
  });

  if (previous === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  else process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = previous;
  return { ...mod, sdk };
}

afterEach(() => {
  Platform.OS = 'ios';
});

const activeCustomer = { entitlements: { active: { premium: {} } } };
const inactiveCustomer = { entitlements: { active: {} } };
const pkg = { identifier: '$rc_monthly' } as any;

describe('RevenueCat henüz kurulmamışken (API anahtarı yok)', () => {
  it('kullanılamaz görünür; hiçbir SDK çağrısı yapılmaz ve ekranlar çökmez', async () => {
    const p = loadPurchases({ iosKey: undefined });

    expect(p.isPurchasesAvailable()).toBe(false);
    p.configurePurchases('device-1');
    expect(p.sdk.configure).not.toHaveBeenCalled();

    await expect(p.getPremiumPackages()).resolves.toEqual({ weekly: null, monthly: null, annual: null });
    expect(p.sdk.getOfferings).not.toHaveBeenCalled();

    await expect(p.purchasePackage(pkg)).resolves.toMatchObject({ success: false, message: expect.stringMatching(/native uygulama/) });
    await expect(p.restorePurchases()).resolves.toMatchObject({ success: false, message: expect.stringMatching(/native uygulama/) });
  });

  it('anahtar olsa bile web\'de kullanılamaz (StoreKit/Play Billing yok)', () => {
    expect(loadPurchases({ iosKey: 'appl_key', os: 'web' }).isPurchasesAvailable()).toBe(false);
  });
});

describe('RevenueCat kuruluyken', () => {
  it('cihaz kimliğini App User ID yapar; aynı kimlikle tekrar çağrılınca yeniden yapılandırmaz', () => {
    const p = loadPurchases({ iosKey: 'appl_key' });

    p.configurePurchases('device-1');
    p.configurePurchases('device-1');
    expect(p.sdk.configure).toHaveBeenCalledTimes(1);
    expect(p.sdk.configure).toHaveBeenCalledWith({ apiKey: 'appl_key', appUserID: 'device-1' });

    p.configurePurchases('device-2'); // kimlik değişirse satın alma yeni kullanıcıya bağlanmalı
    expect(p.sdk.configure).toHaveBeenCalledTimes(2);
  });

  it('paketleri dashboard\'daki güncel offering\'den okur; tanımlı olmayan süre null kalır', async () => {
    const p = loadPurchases({ iosKey: 'appl_key' });
    p.sdk.getOfferings.mockResolvedValue({ current: { weekly: null, monthly: { id: 'm' }, annual: { id: 'a' } } });

    await expect(p.getPremiumPackages()).resolves.toEqual({ weekly: null, monthly: { id: 'm' }, annual: { id: 'a' } });

    p.sdk.getOfferings.mockResolvedValue({ current: null });
    await expect(p.getPremiumPackages()).resolves.toEqual({ weekly: null, monthly: null, annual: null });
  });

  it('satın alma yalnızca AKTİF bir entitlement oluştuysa başarılı sayılır', async () => {
    const p = loadPurchases({ iosKey: 'appl_key' });

    p.sdk.purchasePackage.mockResolvedValue({ customerInfo: activeCustomer });
    await expect(p.purchasePackage(pkg)).resolves.toEqual({ success: true });

    p.sdk.purchasePackage.mockResolvedValue({ customerInfo: inactiveCustomer });
    await expect(p.purchasePackage(pkg)).resolves.toEqual({ success: false });
  });

  it('kullanıcı ödeme sayfasını kapatırsa hata değil "iptal" olarak döner (uyarı gösterilmesin)', async () => {
    const p = loadPurchases({ iosKey: 'appl_key' });
    p.sdk.purchasePackage.mockRejectedValue({ userCancelled: true, message: 'Purchase was cancelled.' });

    await expect(p.purchasePackage(pkg)).resolves.toEqual({ success: false, cancelled: true });
  });

  it('satın alma hatasını Türkçe ve NEDENİYLE döner: bağlantı yok → "Bağlantı kurulamadı", mağaza sorunu → açıklama; bilinmeyen → genel metin (ham İngilizce mesaj gösterilmez)', async () => {
    const p = loadPurchases({ iosKey: 'appl_key' });

    p.sdk.purchasePackage.mockRejectedValue({ code: '10', message: 'The network connection failed' }); // NETWORK_ERROR
    await expect(p.purchasePackage(pkg)).resolves.toEqual({
      success: false,
      message: 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.',
    });

    p.sdk.purchasePackage.mockRejectedValue({ code: '2' }); // STORE_PROBLEM
    await expect(p.purchasePackage(pkg)).resolves.toEqual({
      success: false,
      message: 'Mağazaya şu an ulaşılamıyor. Lütfen daha sonra tekrar dene.',
    });

    p.sdk.purchasePackage.mockRejectedValue({ message: 'Your card was declined' });
    await expect(p.purchasePackage(pkg)).resolves.toEqual({
      success: false,
      message: 'Satın alma tamamlanamadı. Lütfen daha sonra tekrar dene.',
    });
  });

  it('geri yükleme: aktif abonelik bulunursa başarılı, bulunamazsa/hata olursa başarısız', async () => {
    const p = loadPurchases({ iosKey: 'appl_key' });

    p.sdk.restorePurchases.mockResolvedValue(activeCustomer);
    await expect(p.restorePurchases()).resolves.toEqual({ success: true });

    p.sdk.restorePurchases.mockResolvedValue(inactiveCustomer);
    await expect(p.restorePurchases()).resolves.toEqual({ success: false });

    p.sdk.restorePurchases.mockRejectedValue({ code: '35' }); // OFFLINE_CONNECTION_ERROR
    await expect(p.restorePurchases()).resolves.toEqual({
      success: false,
      message: 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.',
    });

    p.sdk.restorePurchases.mockRejectedValue(new Error('boom'));
    await expect(p.restorePurchases()).resolves.toEqual({
      success: false,
      message: 'Satın alımlar geri yüklenemedi. Lütfen daha sonra tekrar dene.',
    });
  });
});
