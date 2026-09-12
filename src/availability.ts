import type { Availability } from './types';

// Backend'in döndürdüğü ortak enum (bkz. backend/scraper/brands/zara.js) burada
// tek yerde Türkçe etiket + renge çevriliyor. Yeni bir marka farklı bir ham
// değer üretse bile backend normalize ettiği için burası değişmiyor.
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: 'Stokta',
  low_stock: 'Az sayıda ürün',
  coming_soon: 'Yakında',
  out_of_stock: 'Stok yok',
};

// "Stoğa girince bildir" sadece şu an satın ALINAMAYAN durumlarda anlamlı.
// Backend'deki NOT_CURRENTLY_PURCHASABLE ile birebir aynı mantık (bkz.
// backend/routes/products.js) — sunucu zaten bunu zorunlu kılıyor, burada
// aynı kuralı UI'da da uyguluyoruz ki kullanıcı önce sunucudan "hayır" cevabı
// almak yerine, toggle zaten kapalı/pasif görsün.
export function canNotifyOnBackInStock(availability: Availability): boolean {
  return availability === 'out_of_stock' || availability === 'coming_soon';
}
