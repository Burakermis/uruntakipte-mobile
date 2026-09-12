// Backend'in gerçekten desteklediği markalar (id -> görünen ad) — kaynak:
// backend/scraper/registry.js BRANDS listesi (her adaptörün id/label alanı).
// Mobil, backend kodunu import edemediği için burada elle senkron tutuluyor;
// yeni bir marka backend'e eklendiğinde bu harita da güncellenmeli.
export const BRAND_LABELS: Record<string, string> = {
  zara: 'Zara',
  hm: 'H&M',
  pullandbear: 'Pull&Bear',
  bershka: 'Bershka',
  mango: 'Mango',
  massimodutti: 'Massimo Dutti',
  stradivarius: 'Stradivarius',
  oysho: 'Oysho',
};

export const SUPPORTED_BRANDS = Object.values(BRAND_LABELS);

export function getBrandLabel(brandId: string): string {
  return BRAND_LABELS[brandId] ?? brandId;
}
