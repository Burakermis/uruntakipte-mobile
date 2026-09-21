// Gerçek cihazların mantıksal (dp/pt) ekran ölçüleri ve safe-area boşlukları.
// Uygulama hiçbir yerde sabit cihaz ölçüsü kullanmıyor — yerleşim flex'ten ve
// SafeAreaProvider'dan geliyor; bu tablo, o değerlerin uç noktalarında (en dar
// telefon, çentikli, home-indicator'lı, 3 tuşlu Android, tablet) aynı kodun
// doğru davrandığını doğrulamak için kullanılıyor.
export interface DeviceProfile {
  name: string;
  width: number;
  height: number;
  insets: { top: number; bottom: number; left: number; right: number };
}

const insets = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0 });

export const DEVICES = {
  galaxyFoldFolded: { name: 'Galaxy Z Fold (kapalı)', width: 280, height: 653, insets: insets(24, 0) },
  iphoneSE1: { name: 'iPhone SE (1. nesil) / 5s', width: 320, height: 568, insets: insets(20, 0) },
  iphoneSE3: { name: 'iPhone SE (3. nesil) / 8', width: 375, height: 667, insets: insets(20, 0) },
  iphone13Mini: { name: 'iPhone 13 mini', width: 375, height: 812, insets: insets(50, 34) },
  galaxyS23: { name: 'Galaxy S23 (3 tuşlu gezinme)', width: 360, height: 780, insets: insets(32, 48) },
  iphone15Pro: { name: 'iPhone 15 Pro (Dynamic Island)', width: 393, height: 852, insets: insets(59, 34) },
  pixel7: { name: 'Pixel 7 (hareketli gezinme)', width: 412, height: 915, insets: insets(24, 24) },
  iphone15ProMax: { name: 'iPhone 15 Pro Max', width: 430, height: 932, insets: insets(59, 34) },
  ipadMini: { name: 'iPad mini', width: 744, height: 1133, insets: insets(24, 20) },
  ipadPro13: { name: 'iPad Pro 13"', width: 1032, height: 1376, insets: insets(24, 20) },
} satisfies Record<string, DeviceProfile>;

export type DeviceKey = keyof typeof DEVICES;

// Telefon sınıfı (en dar → en geniş) — grid/yerleşim testleri bunların hepsi için koşuyor.
export const PHONES: DeviceProfile[] = [
  DEVICES.galaxyFoldFolded,
  DEVICES.iphoneSE1,
  DEVICES.galaxyS23,
  DEVICES.iphoneSE3,
  DEVICES.iphone15Pro,
  DEVICES.pixel7,
  DEVICES.iphone15ProMax,
];

export const TABLETS: DeviceProfile[] = [DEVICES.ipadMini, DEVICES.ipadPro13];
