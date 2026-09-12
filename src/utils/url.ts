// Bazı marka uygulamaları (Bershka, Zara vb.) "paylaş"tan kopyalanan metnin
// başına ürün adını ekliyor, ör: "Şardonlu bermuda - Bershka https://...".
// Tüm markalarda aynı sorun olduğu için (marka bazlı özel bir çözüm yerine)
// metinde ilk "http(s)://" nereden başlıyorsa oradan itibaren alıyoruz; bir
// eşleşme yoksa metni olduğu gibi (trim'lenmiş) döndürüyoruz.
export function extractUrlFromPastedText(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/https?:\/\/\S+/i);
  return match ? match[0] : trimmed;
}
