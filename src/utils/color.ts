// Tailwind'in "bg-primary-container/10" gibi opaklık modifiyerlerinin RN
// karşılığı yok — StyleSheet renk + opaklığı ayrı ayrı ister. Bu yardımcı
// hex renk + 0-1 arası alpha alıp rgba() string'i üretir.
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
