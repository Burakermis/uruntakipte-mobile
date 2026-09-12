import type { Availability } from '../types';
import type { ColorTokens } from '../theme';

// ProductListItem ve ProductGridItem'ın ikisi de aynı stok durumu ->
// etiket/renk/ikon eşlemesini kullanıyor — tek yerde tutulup component
// içinde useMemo'yla tema değişince yeniden üretiliyor (modül seviyesinde
// sabit bir harita donmuş/soğuk yüklenir olurdu).
export function stockMeta(
  colors: ColorTokens
): Record<Availability, { label: string; color: string; icon: 'check_circle' | 'cancel' }> {
  return {
    in_stock: { label: 'Stokta', color: colors.stockInStock, icon: 'check_circle' },
    low_stock: { label: 'Az sayıda ürün', color: colors.stockLowStock, icon: 'check_circle' },
    coming_soon: { label: 'Yakında', color: colors.stockComingSoon, icon: 'cancel' },
    out_of_stock: { label: 'Tükendi', color: colors.stockOutOfStock, icon: 'cancel' },
  };
}
