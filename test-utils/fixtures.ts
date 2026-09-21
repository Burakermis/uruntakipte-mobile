import type { Availability, ColorGroup, ResolvedProduct, SizeOption, TrackedProduct, UserLimits } from '../src/types';

export const ZARA_URL = 'https://www.zara.com/tr/tr/oversize-gomlek-p01887320.html';
export const MANGO_URL = 'https://shop.mango.com/tr/kadin/elbise/keten-elbise_17021231.html';

export function size(sizeLabel: string, availability: Availability = 'in_stock', price = 1299.9): SizeOption {
  return {
    size: sizeLabel,
    sku: `sku-${sizeLabel.toLowerCase().replace(/\W+/g, '-')}`,
    price,
    currency: 'TRY',
    availability,
  };
}

// sku'lar renk bazında benzersiz olmalı (backend'de de öyle) — renk adı öne ekleniyor.
export function color(name: string, sizes: SizeOption[]): ColorGroup {
  return {
    name,
    sizes: sizes.map((s) => ({ ...s, sku: `${name.toLowerCase().replace(/\W+/g, '-')}:${s.sku}` })),
  };
}

export function resolvedProduct(overrides: Partial<ResolvedProduct> = {}): ResolvedProduct {
  return {
    brand: 'zara',
    brandLabel: 'ZARA',
    productId: '01887320',
    name: 'Oversize Gömlek',
    imageUrl: 'https://static.example.com/gomlek.jpg',
    canonicalUrl: ZARA_URL,
    checkedAt: '2026-09-21T10:00:00.000Z',
    colors: [
      color('Beyaz', [
        size('S', 'in_stock'),
        size('M', 'low_stock'),
        size('L', 'out_of_stock'),
        size('XL', 'coming_soon'),
      ]),
      color('Siyah', [size('S', 'in_stock'), size('M', 'in_stock')]),
    ],
    ...overrides,
  };
}

// Takip edilen satır (backend her (ürün, sku) çifti için ayrı satır döndürüyor).
export function trackedProduct(overrides: Partial<TrackedProduct> & { id: number }): TrackedProduct {
  return {
    userId: 'test-device',
    brand: 'zara',
    productId: '01887320',
    name: 'Oversize Gömlek',
    imageUrl: 'https://static.example.com/gomlek.jpg',
    canonicalUrl: ZARA_URL,
    color: 'Beyaz',
    size: 'M',
    sku: 'beyaz:sku-m',
    lastPrice: 1299.9,
    currency: 'TRY',
    lastAvailability: 'in_stock',
    notifyOnPriceDrop: true,
    notifyOnBackInStock: false,
    createdAt: '2026-09-20T10:00:00.000Z',
    lastCheckedAt: new Date().toISOString(),
    priceChangePercent: null,
    ...overrides,
  };
}

export function userLimits(overrides: Partial<UserLimits> = {}): UserLimits {
  return {
    userId: 'test-device',
    isPremium: false,
    activeCount: 0,
    maxActiveProducts: 3,
    checkIntervalMs: 300_000,
    cooldownRemainingMs: 0,
    ...overrides,
  };
}
