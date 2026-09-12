import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { getBrandLabel } from '../utils/brands';
import { withAlpha } from '../utils/color';
import { formatPrice, formatRelativeTime } from '../utils/format';
import { stockMeta } from '../utils/stock';
import { Icon } from './Icon';
import type { TrackedProductGroup } from '../types';
import { makeStyles } from './ProductListItem.styles';

interface ProductListItemProps {
  group: TrackedProductGroup;
  onPress: () => void;
  onDeleteAll: () => void;
  // Ürün detayı açılmadan önce ProductsScreen o ürünün güncel verisini
  // çekiyor (bkz. ProductsScreen handleOpenDetail) — detay ekranı içeride
  // ayrıca bir yükleniyor durumu göstermesin diye bu bekleme, ekran hiç
  // açılmadan, dokunulan kartın ÜZERİNDE gösteriliyor.
  loading?: boolean;
}

// Aynı ürünün (canonicalUrl) farklı renk/bedenleri artık ayrı kartlar değil,
// TEK kart içinde beden rozetleri olarak gösteriliyor — kullanıcı bir üründe
// birden fazla beden takip ediyorsa (bkz. ProductVariantScreen'deki çoklu
// seçim) burada da tek "ürün" olarak görünsün istedi. Fiyat/fiyat-değişimi/
// son-kontrol zamanı grubun İLK öğesinden okunuyor — bunlar backend'de aynı
// trackedTarget'a ait olduğu için (bkz. routes/products.js toApiShape)
// lastCheckedAt zaten grup genelinde birebir aynı; fiyat nadiren bedenler
// arası farklı olabilir ama bu durumda bile "temsili" bir değer göstermek
// (her beden için ayrı fiyat satırı açmak yerine) daha sade bir kart üretiyor.
export function ProductListItem({ group, onPress, onDeleteAll, loading }: ProductListItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const stock = useMemo(() => stockMeta(colors), [colors]);

  const first = group.items[0];
  const hasPriceChange = first.priceChangePercent != null && first.priceChangePercent !== 0;
  const priceDropped = (first.priceChangePercent ?? 0) < 0;
  // Aynı üründe birden fazla renk de takip ediliyorsa (iki ayrı "ekle"
  // işleminden) rozetlerde karışmasın diye renk de gösteriliyor; tek renkse
  // sadece beden yeterli — daha az gürültü.
  const showColor = new Set(group.items.map((i) => i.color)).size > 1;

  return (
    <Pressable style={styles.card} onPress={loading ? undefined : onPress} testID="product-card">
      {first.imageUrl ? (
        <Image source={{ uri: first.imageUrl }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.info}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>{getBrandLabel(group.brand)}</Text>
        </View>

        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={2}>
            {first.name}
          </Text>
          <Text style={styles.price}>{formatPrice(first.lastPrice, first.currency)}</Text>
        </View>

        <View style={styles.badgeRow}>
          {group.items.map((item) => (
            <View key={item.id} style={styles.sizeBadge}>
              <View style={[styles.sizeDot, { backgroundColor: stock[item.lastAvailability].color }]} />
              <Text style={styles.sizeBadgeText}>{showColor ? `${item.color} ${item.size}` : item.size}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.leftMeta}>
            {hasPriceChange ? (
              <View
                style={[
                  styles.changeBadge,
                  { backgroundColor: withAlpha(priceDropped ? colors.priceDrop : colors.priceRise, 0.12) },
                ]}
              >
                <Icon
                  name={priceDropped ? 'arrow_downward' : 'cancel'}
                  size={12}
                  color={priceDropped ? colors.priceDrop : colors.priceRise}
                />
                <Text style={[styles.changeText, { color: priceDropped ? colors.priceDrop : colors.priceRise }]}>
                  {Math.abs(first.priceChangePercent ?? 0)}%
                </Text>
              </View>
            ) : null}
            <Text style={styles.timeLabel}>{formatRelativeTime(first.lastCheckedAt ?? first.createdAt)}</Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={onDeleteAll}
        style={styles.deleteButton}
        accessibilityLabel="Tüm bedenleri takipten çıkar"
        hitSlop={8}
      >
        <Icon name="close" size={16} color={colors.outline} />
      </Pressable>
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}
