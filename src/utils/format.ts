export function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return '—';
  const formatted = price.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'TRY' ? `${formatted} TL` : `${formatted} ${currency ?? ''}`.trim();
}

// "2s önce", "1g önce" gibi kısa göreli zaman — mockup'taki data-mono
// zaman etiketiyle birebir aynı format.
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes}dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}s önce`;
  const days = Math.floor(hours / 24);
  return `${days}g önce`;
}

// "18 saat", "2 gün 4 saat" gibi bir süreyi okunur hâle getirir — ücretsiz
// plan bekleme süresi rozetinde kullanılıyor (bkz. ProductsScreen).
export function formatDuration(ms: number): string {
  if (ms <= 0) return '';
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours} saat`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days} gün ${remHours} saat` : `${days} gün`;
}

// "24:11:23" gibi HH:MM:SS geri sayım — saat kısmı 24'ü aşabilir (gün
// sınırında sarmıyor), takip hakkı bekleme süresi banner'ında canlı olarak
// saniyede bir güncellenir (bkz. ProductsScreen useCooldownCountdown).
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
