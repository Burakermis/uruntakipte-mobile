import { formatCountdown, formatDuration, formatPrice, formatRelativeTime } from '../../src/utils/format';

describe('formatPrice', () => {
  it('TRY fiyatını Türkçe binlik/ondalık ayracıyla "TL" son ekiyle yazar', () => {
    expect(formatPrice(1299.9, 'TRY')).toBe('1.299,90 TL');
    expect(formatPrice(100, 'TRY')).toBe('100,00 TL');
  });

  it('diğer para birimlerinde kodu son ek olarak korur', () => {
    expect(formatPrice(49.99, 'EUR')).toBe('49,99 EUR');
  });

  it('fiyat bilinmiyorsa (stokta olmayan ürün) tire gösterir, "null TL" değil', () => {
    expect(formatPrice(null, 'TRY')).toBe('—');
  });

  it('para birimi bilinmiyorsa sondaki boşluğu bırakmaz', () => {
    expect(formatPrice(10, null)).toBe('10,00');
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-09-21T12:00:00Z').getTime();
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('bir dakikadan yeni kontrolleri "az önce" diye gösterir', () => {
    expect(formatRelativeTime(ago(20_000))).toBe('az önce');
  });

  it('cihaz saati sunucudan geride olsa bile (gelecek tarih) negatif süre göstermez', () => {
    expect(formatRelativeTime(new Date(NOW + 5 * 60_000).toISOString())).toBe('az önce');
  });

  it('dakika → saat → gün sınırlarında birim değiştirir', () => {
    expect(formatRelativeTime(ago(59 * 60_000))).toBe('59dk önce');
    expect(formatRelativeTime(ago(60 * 60_000))).toBe('1s önce');
    expect(formatRelativeTime(ago(23 * 3_600_000 + 59 * 60_000))).toBe('23s önce');
    expect(formatRelativeTime(ago(24 * 3_600_000))).toBe('1g önce');
    expect(formatRelativeTime(ago(3 * 24 * 3_600_000 + 5 * 3_600_000))).toBe('3g önce');
  });
});

describe('formatDuration (ücretsiz plan bekleme süresi rozeti)', () => {
  const HOUR = 3_600_000;

  it('süre bitmişse boş döner', () => {
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(-5000)).toBe('');
  });

  it('kısmi saatleri YUKARI yuvarlar — kullanıcı "0 saat kaldı" görmesin', () => {
    expect(formatDuration(1)).toBe('1 saat');
    expect(formatDuration(90 * 60_000)).toBe('2 saat');
  });

  it('24 saatten itibaren gün + kalan saat gösterir', () => {
    expect(formatDuration(23 * HOUR)).toBe('23 saat');
    expect(formatDuration(24 * HOUR)).toBe('1 gün');
    expect(formatDuration(26 * HOUR)).toBe('1 gün 2 saat');
    expect(formatDuration(47.2 * HOUR)).toBe('2 gün');
  });
});

describe('formatCountdown (takip hakkı bekleme sayacı)', () => {
  it('SS:DD:SS biçiminde, saat 24\'ü aşınca sarmadan yazar', () => {
    expect(formatCountdown(24 * 3_600_000 + 11 * 60_000 + 23_000)).toBe('24:11:23');
    expect(formatCountdown(25 * 3_600_000 + 61_000)).toBe('25:01:01');
  });

  it('tam saniyeye aşağı yuvarlar ve negatif değerde 00:00:00 verir', () => {
    expect(formatCountdown(59_999)).toBe('00:00:59');
    expect(formatCountdown(-1000)).toBe('00:00:00');
  });
});
