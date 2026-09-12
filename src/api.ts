import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ApiError, ResolvedProduct, TrackedProduct, UserLimits } from './types';

const API_PORT = 4000;

// Gerçek cihazda (Expo Go/development build) "localhost" telefonun kendisini
// işaret eder, elle bir LAN IP yazmaya da gerek yok: Expo, Metro'ya hangi
// adresten bağlandığını zaten biliyor (telefon JS bundle'ını oradan indirdi)
// ve bunu Constants.expoConfig.hostUri'de tutuyor — aynı host'u API için de
// kullanıyoruz. IP değişse (DHCP) bile otomatik doğru kalır, .env'i elle
// güncellemek gerekmez.
function resolveDefaultHost(): string {
  if (Platform.OS === 'web') return 'localhost';
  const devServerHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return devServerHost || '10.0.2.2'; // son çare: Android emülatörü
}

// EXPO_PUBLIC_API_URL sadece prod/staging build'lerinde (EAS env, bkz.
// eas.json) gerçek bir domain'e sabitlemek için kullanılıyor — yerel
// geliştirmede boş bırakılmalı, aksi halde yukarıdaki otomatik tespiti
// (ve DHCP ile değişen IP'yi) ezip eski/yanlış bir adrese saplanabilir.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || `http://${resolveDefaultHost()}:${API_PORT}/api`;

class ApiRequestError extends Error {
  code: string;
  cooldownRemainingMs?: number;
  constructor(payload: ApiError) {
    super(payload.message);
    this.code = payload.error;
    this.cooldownRemainingMs = payload.cooldownRemainingMs;
  }
}

// Ulaşılamayan bir adrese (ör. yanlış yapılandırılmış LAN IP) atılan bir
// fetch, native tarafta OS'un kendi TCP zaman aşımına kadar (onlarca saniye,
// bazen dakikalar) hiç dönmeyebilir — bu da ekranda "sonsuz yükleniyor"
// olarak görünür. AbortController ile üst sınır koyup hatayı hızlıca
// çağırana (ör. ProductsScreen'in catch bloğu) düşürüyoruz.
const REQUEST_TIMEOUT_MS = 10000;

// Ürün çözümleme/ekleme/manuel kontrol uçları backend'de gerçek bir sayfa
// taraması (Playwright) tetikleyebilir — bu, backend/queue/scrapeQueue.js'deki
// SCRAPE_JOB_TIMEOUT_MS (30sn) kadar sürebilir. Genel REQUEST_TIMEOUT_MS bu
// istekler için kullanılırsa, backend hâlâ çalışırken istemci erkenden
// "bağlantı hatası" gösterip vazgeçer — bu yüzden bu uçlara backend'in kendi
// üst sınırından biraz daha geniş, ayrı bir zaman aşımı tanınıyor.
const SCRAPE_TIMEOUT_MS = 35000;

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`İstek zaman aşımına uğradı (${API_BASE_URL}). Backend çalışıyor mu, doğru adrese mi bağlanıyorsun?`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const data = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(data as ApiError);
  }
  return data as T;
}

function postJson<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) }, timeoutMs);
}

function getJson<T>(path: string): Promise<T> {
  return request<T>(path);
}

function deleteRequest(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' });
}

export function resolveProduct(url: string): Promise<ResolvedProduct> {
  return postJson<ResolvedProduct>('/products/resolve', { url }, SCRAPE_TIMEOUT_MS);
}

// Backend artık renk/beden/fiyat gibi verileri kendi çekip doğruladığı
// trackedTarget'tan alıyor (bkz. backend/routes/products.js) — istemcinin
// göndermesi gereken tek şey hangi ürün sayfasını (url) ve hangi varyantı
// (sku) takip etmek istediği. Resolve adımında çekilen ham HTML de artık
// telefondan geçmiyor: sunucu onu kendi tarafında (Redis) tutuyor, biz de
// ~1 MB'lık gövdeyi yüklemekten kurtuluyoruz (bkz. backend/store/htmlCache.js).
export interface CreateTrackedProductInput {
  userId: string;
  url: string;
  sku: string;
}

export interface CreateTrackedProductResult extends TrackedProduct {
  // true: kullanıcı bu renk/bedeni zaten aktif olarak takip ediyordu, bu
  // istek sadece tercihlerini güncelledi (yeni kayıt oluşmadı).
  alreadyTracked: boolean;
}

export function createTrackedProduct(
  input: CreateTrackedProductInput
): Promise<CreateTrackedProductResult> {
  return postJson<CreateTrackedProductResult>('/products', input, SCRAPE_TIMEOUT_MS);
}

export function listTrackedProducts(userId: string): Promise<TrackedProduct[]> {
  return getJson<TrackedProduct[]>(`/products?userId=${encodeURIComponent(userId)}`);
}

export function deleteTrackedProduct(id: number, userId: string): Promise<void> {
  return deleteRequest(`/products/${id}?userId=${encodeURIComponent(userId)}`);
}

export interface CheckNowResult {
  id: number;
  ok: boolean;
  price?: number | null;
  availability?: string;
  events?: Array<{ type: string }>;
  reason?: string;
}

export function checkTrackedProductNow(id: number, userId: string): Promise<CheckNowResult> {
  return postJson<CheckNowResult>(`/products/${id}/check-now`, { userId }, SCRAPE_TIMEOUT_MS);
}

export function registerDevice(userId: string, expoPushToken: string, platform: string): Promise<void> {
  return postJson('/devices', { userId, expoPushToken, platform });
}

export function getUserLimits(userId: string): Promise<UserLimits> {
  return getJson<UserLimits>(`/users/${encodeURIComponent(userId)}/limits`);
}

// DEV/DEMO: gerçek App Store/Play Store satın alma akışının yerine geçiyor
// (bkz. backend/routes/users.js) — RevenueCat kurulu değilken (web preview,
// hesap henüz yok) PremiumScreen bu yola düşer. Prod'da backend bunu 403'ler.
export function setPremium(userId: string, isPremium: boolean): Promise<{ userId: string; isPremium: boolean }> {
  return postJson(`/users/${encodeURIComponent(userId)}/premium`, { isPremium });
}

// Native satın alma/geri yükleme SONRASI çağrılır — backend'e istemcinin
// kendi beyanını değil, RevenueCat'in sunucu API'sinden doğrulanmış gerçek
// durumu sorup senkronlamasını söyler (bkz. backend/routes/users.js
// POST /:userId/sync-premium). setPremium'un aksine prod'da da açık.
export function syncPremiumStatus(userId: string): Promise<{ userId: string; isPremium: boolean }> {
  return postJson(`/users/${encodeURIComponent(userId)}/sync-premium`, {});
}

export { ApiRequestError };
