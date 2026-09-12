// Bu dosya, kullanıcının Tailwind ile tasarladığı 4 mockup'ın (Ürünlerim,
// Ürün Ekle, Premium, Profil) tailwind.config'lerindeki renk/spacing/radius/
// typography tokenlarının RN karşılığı. Tüm mockup'larda aynı token seti
// tekrarlanıyordu, burada tek yerde toplandı — ekranlar sadece buradan okur.
//
// lightColors/darkColors: aynı anahtar kümesi, iki paletli. TypeScript
// `ColorTokens` tipi ikisinin de aynı şekle sahip olmasını zorunlu kılıyor.
// darkColors el ile ayarlandı (MD3 karanlık tema kuralları: yüzeyler
// koyulaşır, metin açılır, primary/secondary/tertiary tonları tersine döner)
// — mekanik bir dönüşüm değil, görsel QA gerektirir (bkz. ThemeProvider
// doğrulama adımları).
export const lightColors = {
  onSurface: '#181c1c',
  surfaceContainer: '#ebefed',
  background: '#f7faf8',
  surfaceCard: '#FFFFFF',
  outline: '#6e7977',
  onSecondaryContainer: '#004f7b',
  surfaceVariant: '#e0e3e1',
  onBackground: '#181c1c',
  surfaceContainerLowest: '#ffffff',
  inverseOnSurface: '#eef1f0',
  tertiary: '#7f4025',
  onSurfaceVariant: '#3e4947',
  secondary: '#006399',
  onTertiary: '#ffffff',
  secondaryFixedDim: '#94ccff',
  onSecondary: '#ffffff',
  statusError: '#DC2626',
  errorContainer: '#ffdad6',
  primary: '#005c55',
  inversePrimary: '#80d5cb',
  onErrorContainer: '#93000a',
  error: '#ba1a1a',
  outlineVariant: '#bdc9c6',
  tertiaryContainer: '#9c573a',
  secondaryContainer: '#7bc2ff',
  borderSubtle: '#E2E8F0',
  onPrimaryContainer: '#a3faef',
  surfaceContainerHighest: '#e0e3e1',
  surfaceDim: '#d7dbd9',
  onError: '#ffffff',
  onTertiaryContainer: '#ffe5db',
  surfaceBright: '#f7faf8',
  surface: '#f7faf8',
  onPrimary: '#ffffff',
  priceDrop: '#15803D',
  surfaceContainerHigh: '#e5e9e7',
  statusWarning: '#EA580C',
  neutralBg: '#F8FAFC',
  primaryContainer: '#0f766e',
  inverseSurface: '#2d3130',
  statusSuccess: '#16A34A',
  secondaryFixed: '#cde5ff',
  priceRise: '#B91C1C',
  surfaceContainerLow: '#f1f4f3',

  // Alan-amaçlı takma adlar — component kodunda "hangi renk neyi ifade
  // ediyor" niyeti okunsun diye (hepsi yukarıdaki paletten).
  stockInStock: '#16A34A',
  stockLowStock: '#16A34A',
  stockComingSoon: '#DC2626',
  stockOutOfStock: '#DC2626',
  dangerBackground: '#ffdad6',

  // Native Switch'in thumb rengi — açık/koyu temada BİLİNÇLİ olarak aynı
  // (her iki OS'in kendi anahtar bileşeni de beyaz thumb kullanır), tema
  // token'ı olarak burada tutuluyor ki component kodunda hardcoded hex
  // görünmesin.
  switchThumb: '#ffffff',
};

export type ColorTokens = typeof lightColors;

export const darkColors: ColorTokens = {
  onSurface: '#e2e6e4',
  surfaceContainer: '#1c211f',
  background: '#101413',
  surfaceCard: '#1a1f1e',
  outline: '#889390',
  onSecondaryContainer: '#cde5ff',
  surfaceVariant: '#3f4947',
  onBackground: '#e2e6e4',
  surfaceContainerLowest: '#0a0f0e',
  inverseOnSurface: '#2d3130',
  tertiary: '#ffb599',
  onSurfaceVariant: '#bcc8c5',
  secondary: '#7bc2ff',
  onTertiary: '#4a2314',
  secondaryFixedDim: '#94ccff',
  onSecondary: '#003353',
  statusError: '#f2867a',
  errorContainer: '#93000a',
  primary: '#80d5cb',
  inversePrimary: '#005c55',
  onErrorContainer: '#ffdad6',
  error: '#ffb4ab',
  outlineVariant: '#3f4947',
  tertiaryContainer: '#5c2e18',
  secondaryContainer: '#004d76',
  borderSubtle: '#2a3230',
  onPrimaryContainer: '#a3faef',
  surfaceContainerHighest: '#323735',
  surfaceDim: '#101413',
  onError: '#690005',
  onTertiaryContainer: '#ffe5db',
  surfaceBright: '#363a39',
  surface: '#101413',
  onPrimary: '#00382f',
  priceDrop: '#5fd68a',
  surfaceContainerHigh: '#272b2a',
  statusWarning: '#ffb37c',
  neutralBg: '#12181a',
  primaryContainer: '#00504a',
  inverseSurface: '#e2e6e4',
  statusSuccess: '#7bdb9b',
  secondaryFixed: '#cde5ff',
  priceRise: '#f2867a',
  surfaceContainerLow: '#181d1c',

  stockInStock: '#5fd68a',
  stockLowStock: '#5fd68a',
  stockComingSoon: '#f2867a',
  stockOutOfStock: '#f2867a',
  dangerBackground: '#5c1a1a',

  switchThumb: '#ffffff',
};

// Tailwind'deki "spacing" ölçeği px cinsinden birebir. Renkten bağımsız,
// tema değişince değişmez.
export const spacing = {
  base: 4,
  inlineGap: 8,
  containerMargin: 16,
  stackGap: 12,
  cardPadding: 16,
  lg: 24,
  xl: 32,
};

// Tailwind borderRadius ölçeği (rem -> px, 1rem=16px varsayımıyla).
// "full" mockup'ta 12px olarak tanımlı (tam yuvarlak değil) — pill/toggle
// gibi öğelerde yükseklik <= 24px olduğu için görsel olarak tam yuvarlanmış
// gibi durur. Gerçek daire gereken yerlerde (avatar vb.) component kendi
// içinde size/2 kullanır, bu tokeni kullanmaz.
export const radii = {
  sm: 2, // DEFAULT
  md: 4, // lg
  lg: 8, // xl
  full: 12, // full
};

// NOT: Mockup'lar Hanken Grotesk / Inter / JetBrains Mono kullanıyor.
// Şu an sistem fontuyla (undefined = platform varsayılanı) aynı boyut/
// ağırlık/letter-spacing ölçeğini uyguluyoruz — görsel hiyerarşi birebir
// aynı, sadece harf biçimi farklı. Google Fonts'u (expo-font +
// @expo-google-fonts/*) eklemek istersen tek değişiklik yeri burası:
// her `fontFamily: undefined` alanını yüklenen font adına çevirmek yeterli.
export const typography = {
  headlineLg: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const, fontFamily: undefined },
  headlineMd: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, fontFamily: undefined },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, fontFamily: undefined },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, fontFamily: undefined },
  // NOT: textTransform:'uppercase' KASITLI OLARAK burada yok — CSS'in
  // uppercase dönüşümü Türkçe'ye özgü değil ("i" → yanlış "I" yerine doğrusu
  // "İ"). Metni bu token'ı kullanmadan ÖNCE src/utils/text.ts'teki
  // toTurkishUpper() ile büyütüp öyle geçirin (bkz. SectionTitle.tsx).
  labelCaps: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.6, // 0.05em * 12px
    fontFamily: undefined,
  },
  displayPrice: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.64, // -0.02em * 32px
    fontFamily: undefined,
  },
  dataMono: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    fontFamily: undefined, // JetBrains Mono eklenene kadar 'monospace' Platform'a göre de verilebilir
  },
};
