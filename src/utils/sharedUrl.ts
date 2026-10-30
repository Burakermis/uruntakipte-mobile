import { extractUrlFromPastedText } from './url';

// Başka bir uygulamadan (Zara, H&M, tarayıcı...) "Paylaş > ÜrünTakipte" ile gelen içerikten ürün
// bağlantısını çıkarır. iOS çoğu zaman bağlantıyı ayrıca `webUrl` olarak verir; Android'de ve bazı
// uygulamalarda (ör. "Şardonlu bermuda - Bershka https://...") yalnızca ham metin gelir — metnin
// içindeki ilk http(s) bağlantısı alınır. Bağlantı yoksa null (dosya/görsel/düz metin paylaşımı).
export function urlFromShare(intent: { webUrl?: string | null; text?: string | null }): string | null {
  const candidate = intent.webUrl || intent.text;
  if (!candidate) return null;
  const url = extractUrlFromPastedText(candidate);
  return /^https?:\/\/\S+$/i.test(url) ? url : null;
}
