// JS'in standart toUpperCase()'i Türkçe'ye özgü değil: küçük noktalı "i"yi
// noktasız "I"ya çevirir (doğrusu noktalı "İ"). RN'in `textTransform:
// 'uppercase'` CSS özelliği de aynı (locale'siz) motoru kullanıyor — "Renk
// Seçin" → "RENK SEÇIN" gibi yanlış sonuçlar üretiyor. Hermes'in
// toLocaleUpperCase('tr') için gerekli ICU/Intl verisi her zaman gömülü
// olmayabildiği için, güvenilir/taşınabilir çözüm: "i"yi elle "İ"ye çevirip
// gerisini standart toUpperCase()'e bırakmak (ı/ç/ş/ö/ü/ğ zaten varsayılan
// motorda doğru büyüyor, sorun sadece i/İ çifti).
export function toTurkishUpper(text: string): string {
  return text.replace(/i/g, 'İ').toUpperCase();
}
