import { ApiRequestError } from '../api';

// Aynı ürünün birden çok bedeni eklenirken tek bir anlık aksaklık (ağ kesintisi,
// sunucunun geçici 5xx yanıtı, hız sınırı) kullanıcıya "eklenemedi" olarak
// yansımasın diye ekleme istekleri sessizce yeniden deneniyor.
//
// `retryConfig` dışarıdan değiştirilebilir bir nesne: testler beklemeleri sıfırlıyor.
export const retryConfig = {
  // Her yeniden deneme öncesi bekleme (ms). Uzunluğu = en fazla yeniden deneme sayısı.
  delaysMs: [600, 1500],
  // Bundan UZUN süren başarısızlık (ör. 30 sn'lik sayfa taraması zaman aşımı)
  // yeniden denenmez — kullanıcıyı bir dakika daha bekletmek yerine mesaj verilir.
  slowFailureMs: 10_000,
};

/**
 * Yeniden denemeye değer bir hata mı? Bağlantı hataları (ağ/zaman aşımı), sunucu
 * hataları (5xx — ör. 502 FETCH_FAILED), bozuk gövde ve hız sınırı geçicidir.
 * Kesin retler (limit doldu, bekleme süresi, geçersiz beden vb. 4xx) tekrar
 * denenirse aynı cevabı alır.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return true; // ConnectionError ve beklenmeyen istisnalar
  return error.status >= 500 || error.code === 'RATE_LIMITED' || error.code === 'BAD_RESPONSE';
}

/**
 * `operation`ı çalıştırır; geçici bir hatayla hızlıca başarısız olursa
 * `retryConfig.delaysMs` kadar (artan beklemeyle) tekrar dener. Yalnızca tekrar
 * çalıştırılması güvenli işlemlerde kullanılmalı — ürün ekleme öyle: backend
 * zaten takipteki bedene `alreadyTracked: true` dönüyor.
 */
export async function retryTransient<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now();
    try {
      return await operation();
    } catch (error) {
      const delay = retryConfig.delaysMs[attempt];
      const failedQuickly = Date.now() - startedAt < retryConfig.slowFailureMs;
      if (delay === undefined || !failedQuickly || !isTransientError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
