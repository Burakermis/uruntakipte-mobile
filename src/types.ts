export type Availability = 'in_stock' | 'low_stock' | 'coming_soon' | 'out_of_stock';

export interface SizeOption {
  size: string;
  sku: string;
  price: number | null;
  currency: string | null;
  availability: Availability;
}

export interface ColorGroup {
  name: string;
  sizes: SizeOption[];
}

export interface ResolvedProduct {
  brand: string;
  brandLabel: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  canonicalUrl: string;
  checkedAt: string;
  colors: ColorGroup[];
  htmlSource?: string;
}

export interface ApiError {
  error: string;
  message: string;
  cooldownRemainingMs?: number;
}

export interface UserLimits {
  userId: string;
  isPremium: boolean;
  activeCount: number;
  maxActiveProducts: number | null; // null = sınırsız (premium)
  checkIntervalMs: number;
  cooldownRemainingMs: number;
}

export interface TrackedProduct {
  id: number;
  userId: string;
  brand: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  canonicalUrl: string;
  color: string;
  size: string;
  sku: string;
  lastPrice: number | null;
  currency: string | null;
  lastAvailability: Availability;
  notifyOnPriceDrop: boolean;
  notifyOnBackInStock: boolean;
  createdAt: string;
  lastCheckedAt: string;
  priceChangePercent: number | null;
}

// Ürünlerim listesinde aynı ürünün (canonicalUrl) farklı renk/bedenleri artık
// ayrı ayrı kartlar değil, TEK kart içinde beden rozetleri olarak gösteriliyor
// — backend hâlâ (target,sku) başına bir TrackedProduct satırı döndürüyor,
// gruplama sadece mobil tarafta (bkz. ProductsScreen.tsx groupTrackedProducts).
export interface TrackedProductGroup {
  canonicalUrl: string;
  brand: string;
  name: string;
  imageUrl: string | null;
  items: TrackedProduct[];
}
