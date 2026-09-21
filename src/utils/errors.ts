import { ApiRequestError, CONNECTION_MESSAGE, ConnectionError } from '../api';
import { isTransientError } from './retry';

// Uygulamanın TEK hata dili: bir işlem başarısız olduğunda kullanıcıya ne olduğu (ağ mı,
// sunucu mu, kural mı) ve ne yapabileceği söylenir; ham istisna metni ya da geliştirici
// dili ("Backend çalışıyor mu?") gösterilmez.

export const GENERIC_ERROR_MESSAGE = 'Bir sorun oluştu. Lütfen daha sonra tekrar dene.';
export const SERVER_BUSY_MESSAGE = 'Sunucu şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.';

export function isConnectionError(error: unknown): error is ConnectionError {
  return error instanceof ConnectionError;
}

/**
 * Bir ya da birden çok başarısızlığın (ör. 3 bedenden 2'si eklenemedi) TEK, anlaşılır
 * nedenini üretir. Öncelik: kesin ret (sunucunun kendi gerekçesi — limit doldu, geçersiz
 * beden…) → bağlantı sorunu ("Bağlantı kurulamadı…") → geçici sunucu sorunu ("sonra tekrar
 * deneyin"). Kesin bir retten sonra "sonra deneyin" demek yanıltıcı olurdu.
 */
export function explainFailure(errors: unknown[]): string {
  const definitive = errors.find((e): e is ApiRequestError => e instanceof ApiRequestError && !isTransientError(e));
  if (definitive) return definitive.message || GENERIC_ERROR_MESSAGE;

  const connection = errors.find(isConnectionError);
  if (connection) return connection.message;

  const transient = errors.find((e): e is ApiRequestError => e instanceof ApiRequestError);
  if (transient) {
    // Sunucunun kendi gerekçesi korunur; "sonra tekrar deneyin" yönlendirmesi eksikse eklenir
    // (ör. FETCH_FAILED mesajı zaten içeriyor).
    const message = transient.message?.trim();
    if (!message) return SERVER_BUSY_MESSAGE;
    if (/tekrar dene/i.test(message)) return message;
    return `${/[.!?]$/.test(message) ? message : `${message}.`} Lütfen daha sonra tekrar deneyin.`;
  }
  return GENERIC_ERROR_MESSAGE;
}

/** Tek bir hata için kullanıcıya gösterilecek metin (bkz. explainFailure). */
export function describeError(error: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (error instanceof ApiRequestError || error instanceof ConnectionError) return explainFailure([error]);
  return fallback;
}

// RevenueCat (react-native-purchases) hata kodları (PurchasesError.code). Enum'u import
// etmek yerine değerler burada sabit: modül native değilken de (test/web) yüklenebilsin.
const RC_CONNECTION_CODES = new Set(['10', '32', '35']); // NETWORK_ERROR, PRODUCT_REQUEST_TIMED_OUT, OFFLINE_CONNECTION_ERROR
const RC_MESSAGES: Record<string, string> = {
  '2': 'Mağazaya şu an ulaşılamıyor. Lütfen daha sonra tekrar dene.', // STORE_PROBLEM
  '3': 'Bu cihazda satın alma yapılamıyor. Cihaz ayarlarından satın almalara izin verildiğini kontrol et.', // PURCHASE_NOT_ALLOWED
  '5': 'Bu plan şu an satın alınamıyor. Lütfen daha sonra tekrar dene.', // PRODUCT_NOT_AVAILABLE_FOR_PURCHASE
  '6': 'Bu aboneliğe zaten sahipsin. "Satın Alımları Geri Yükle"yi dene.', // PRODUCT_ALREADY_PURCHASED
  '7': 'Bu abonelik başka bir hesaba bağlı görünüyor.', // RECEIPT_ALREADY_IN_USE
  '13': 'Bu abonelik başka bir hesaba bağlı görünüyor.', // RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER
  '20': 'Ödemen onay bekliyor. Onaylandığında Premium otomatik olarak aktif olacak.', // PAYMENT_PENDING
};

/** RevenueCat/mağaza hatasını Türkçe, kullanıcıya ne yapacağını söyleyen bir metne çevirir. */
export function describePurchaseError(error: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  if (RC_CONNECTION_CODES.has(code)) return CONNECTION_MESSAGE;
  return RC_MESSAGES[code] ?? fallback;
}
