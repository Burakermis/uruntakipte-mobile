import { ApiRequestError, createTrackedProduct, deleteTrackedProduct } from '../api';
import type { CreateTrackedProductInput } from '../api';
import { retryTransient } from './retry';

// Takip ekleme/çıkarma, kullanıcının "istediği işlemi yapabilmesi" için geçici aksaklıklara
// (ağ dalgalanması, sunucunun anlık 5xx yanıtı, hız sınırı) dayanıklı: hızlıca başarısız
// olan geçici hatalar kullanıcıya yansımadan yeniden denenir (bkz. utils/retry.ts).

/** Ekleme tekrarlanabilir: backend takipteki bedene `alreadyTracked` döndürüyor (çift kayıt olmaz). */
export function addTrackedProduct(input: CreateTrackedProductInput) {
  return retryTransient(() => createTrackedProduct(input));
}

/**
 * Silme de tekrarlanabilir: kayıt zaten yoksa (ilk deneme sunucuda tamamlanıp yanıtı
 * kaybolduysa ya da başka cihazdan silindiyse) 404 alınır — hedef durum (kayıt yok) sağlandığı
 * için bu başarı sayılır.
 */
export async function removeTrackedProduct(id: number, userId: string): Promise<void> {
  try {
    await retryTransient(() => deleteTrackedProduct(id, userId));
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return;
    throw error;
  }
}
