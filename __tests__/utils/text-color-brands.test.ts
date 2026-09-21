import fs from 'fs';
import path from 'path';
import { canNotifyOnBackInStock } from '../../src/availability';
import { darkColors, lightColors } from '../../src/theme';
import { BRAND_LABELS, getBrandLabel, SUPPORTED_BRANDS } from '../../src/utils/brands';
import { withAlpha } from '../../src/utils/color';
import { stockMeta } from '../../src/utils/stock';
import { toTurkishUpper } from '../../src/utils/text';

describe('toTurkishUpper', () => {
  it('noktalı i\'yi İ yapar (JS toUpperCase "I" üretirdi)', () => {
    expect(toTurkishUpper('Renk Seçin')).toBe('RENK SEÇİN');
    expect(toTurkishUpper('Yeni')).toBe('YENİ');
    expect(toTurkishUpper('Aktif Takipler')).toBe('AKTİF TAKİPLER');
  });

  it('noktasız ı\'yı I yapar, diğer Türkçe harfleri korur', () => {
    expect(toTurkishUpper('ışık çöğüş')).toBe('IŞIK ÇÖĞÜŞ');
  });
});

describe('withAlpha ve tema token\'ları', () => {
  it('6 haneli hex rengi rgba() dizgesine çevirir', () => {
    expect(withAlpha('#005c55', 0.1)).toBe('rgba(0, 92, 85, 0.1)');
    expect(withAlpha('#FFFFFF', 0.85)).toBe('rgba(255, 255, 255, 0.85)');
  });

  // withAlpha ve PrimaryButton'daki `hex + '80'` soluklaştırması yalnızca
  // 6 haneli hex ile doğru çalışıyor — bir token'a rgba()/3 haneli hex
  // yazılırsa sessizce bozuk renk üretir (ör. koyu temada kaybolan buton).
  it.each([
    ['açık', lightColors],
    ['koyu', darkColors],
  ])('%s temadaki tüm renk token\'ları 6 haneli hex', (_name, palette) => {
    for (const [token, value] of Object.entries(palette)) {
      expect({ token, value }).toEqual({ token, value: expect.stringMatching(/^#[0-9a-fA-F]{6}$/) });
    }
  });

  it('açık ve koyu tema aynı token kümesine sahip', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });
});

describe('stok durumu', () => {
  it('"stoğa girince bildir" yalnızca şu an satın alınamayan durumlarda anlamlı', () => {
    expect(canNotifyOnBackInStock('out_of_stock')).toBe(true);
    expect(canNotifyOnBackInStock('coming_soon')).toBe(true);
    expect(canNotifyOnBackInStock('in_stock')).toBe(false);
    expect(canNotifyOnBackInStock('low_stock')).toBe(false);
  });

  it('stockMeta satın alınabilir durumlara yeşil/onay, alınamayanlara kırmızı/iptal verir (her iki temada)', () => {
    for (const palette of [lightColors, darkColors]) {
      const meta = stockMeta(palette);
      expect(meta.in_stock).toMatchObject({ color: palette.stockInStock, icon: 'check_circle' });
      expect(meta.low_stock).toMatchObject({ color: palette.stockLowStock, icon: 'check_circle' });
      expect(meta.out_of_stock).toMatchObject({ color: palette.stockOutOfStock, icon: 'cancel' });
      expect(meta.coming_soon).toMatchObject({ color: palette.stockComingSoon, icon: 'cancel' });
    }
  });
});

describe('markalar', () => {
  it('bilinmeyen marka kimliğini olduğu gibi gösterir (yeni marka eklenip haritaya girilmese bile çökmez)', () => {
    expect(getBrandLabel('hm')).toBe('H&M');
    expect(getBrandLabel('yenimarka')).toBe('yenimarka');
  });

  it('SUPPORTED_BRANDS haritadaki görünen adlarla birebir aynı', () => {
    expect(SUPPORTED_BRANDS).toEqual(Object.values(BRAND_LABELS));
  });

  // brands.ts'teki yorum "backend'e marka eklenince bu harita da güncellenmeli"
  // diyor — unutulursa ürün kartlarında ham id ("massimodutti") görünür ve
  // "Desteklenen Siteler" listesi eksik kalır. Backend monorepoda yan klasörde.
  const backendBrandsDir = path.resolve(__dirname, '../../../backend/scraper/brands');
  const maybe = fs.existsSync(backendBrandsDir) ? it : it.skip;
  maybe('mobil marka haritası backend adaptörlerinin id\'leriyle aynı kümeyi içeriyor', () => {
    const backendIds = fs
      .readdirSync(backendBrandsDir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(path.join(backendBrandsDir, f), 'utf8').match(/^\s{2}id:\s*'([^']+)'/m)?.[1])
      .filter((id): id is string => !!id)
      .sort();

    expect(backendIds.length).toBeGreaterThan(0);
    expect(Object.keys(BRAND_LABELS).sort()).toEqual(backendIds);
  });
});
