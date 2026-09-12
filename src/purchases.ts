import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

// RevenueCat web'de çalışmıyor (StoreKit/Play Billing native API'lerinin
// üzerine kurulu) ve API key henüz tanımlı değilse (RevenueCat hesabı
// kurulmadıysa, bkz. .env.example) hiçbir şey yapmaz — PremiumScreen bu
// durumda dev-toggle'a (setPremium) düşer, çökmez.
const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

let configuredForDeviceId: string | null = null;

export function isPurchasesAvailable(): boolean {
  return Platform.OS !== 'web' && !!REVENUECAT_API_KEY;
}

// deviceId'yi (bkz. utils/deviceId.ts) RevenueCat'in App User ID'sine
// bağlar — login yok, bu yüzden RevenueCat kimliği de Faz 3'teki anonim
// cihaz kimliğiyle aynı olmak zorunda (aksi halde satın alma hangi
// kullanıcıya ait bilinmez).
export function configurePurchases(deviceId: string): void {
  if (!isPurchasesAvailable() || configuredForDeviceId === deviceId) return;
  Purchases.configure({ apiKey: REVENUECAT_API_KEY!, appUserID: deviceId });
  configuredForDeviceId = deviceId;
}

function hasActiveEntitlement(customerInfo: CustomerInfo): boolean {
  return Object.keys(customerInfo.entitlements.active).length > 0;
}

interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  message?: string;
}

export interface PremiumPackages {
  weekly: PurchasesPackage | null;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

// PremiumScreen'in "Planını Seç" ekranı haftalık/aylık/yıllık üç seçeneği
// RevenueCat dashboard'unda tanımlı GERÇEK paketlerden (fiyat, deneme süresi
// dahil) okuyup gösteriyor — sabit/uydurma fiyat yazılmıyor, dashboard'da
// tanımlı olmayan bir paket null döner ve o satır ekranda hiç gösterilmez.
export async function getPremiumPackages(): Promise<PremiumPackages> {
  if (!isPurchasesAvailable()) return { weekly: null, monthly: null, annual: null };
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  return {
    weekly: current?.weekly ?? null,
    monthly: current?.monthly ?? null,
    annual: current?.annual ?? null,
  };
}

// Kullanıcının "Planını Seç" ekranında işaretlediği paketi satın alır —
// hangi süre (haftalık/aylık/yıllık) olduğuna bu katman karışmıyor, seçim
// PremiumScreen'de yapılıyor, burada sadece StoreKit/Play Billing akışı var.
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!isPurchasesAvailable()) {
    return { success: false, message: 'Satın alma bu ortamda desteklenmiyor (native uygulama gerekiyor).' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: hasActiveEntitlement(customerInfo) };
  } catch (e: any) {
    if (e?.userCancelled) return { success: false, cancelled: true };
    return { success: false, message: e?.message ?? 'Satın alma başarısız oldu.' };
  }
}

// Kullanıcı uygulamayı silip yeniden yükleyince (ya da telefon değiştirince)
// deviceId sıfırlanır (bkz. Faz 3) — bu buton, Apple/Google hesabındaki
// GERÇEK aktif aboneliği bulup YENİ deviceId'yi ona yeniden bağlar. App
// Store/Play Store bu butonu zorunlu kılıyor.
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isPurchasesAvailable()) {
    return { success: false, message: 'Bu ortamda desteklenmiyor (native uygulama gerekiyor).' };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: hasActiveEntitlement(customerInfo) };
  } catch (e: any) {
    return { success: false, message: e?.message ?? 'Satın alımlar geri yüklenemedi.' };
  }
}
