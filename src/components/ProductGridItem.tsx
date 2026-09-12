import React, { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { getBrandLabel } from '../utils/brands';
import { formatPrice } from '../utils/format';
import { stockMeta } from '../utils/stock';
import { Icon } from './Icon';
import type { TrackedProductGroup } from '../types';
import { makeStyles } from './ProductGridItem.styles';

interface ProductGridItemProps {
  group: TrackedProductGroup;
  onPress: () => void;
  onDeleteAll: () => void;
  // Piksel cinsinden ölçülmüş kart genişliği (bkz. ProductsScreen'in
  // gridList onLayout'u). '%'+gap kombinasyonu her ekran genişliğinde tam
  // oturmuyor (bkz. görüntüleme modu değişikliği yorumu) — gerçek konteyner
  // genişliği ölçülüp 2 sütuna göre bölünerek her cihazda pikselinde tam
  // oturan bir genişlik veriliyor. İlk render'da (henüz ölçülmeden) undefined
  // gelir, o an styles.card'daki '%' geri düşüş (fallback) olarak kullanılır.
  width?: number;
  loading?: boolean;
}

// Görüntüleme modu "Izgara" iken ProductListItem yerine kullanılan kompakt
// kart — hızlı göz atma içindir, bu yüzden beden rozetlerini göstermiyor.
// Dokununca ProductDetailScreen açılır (renk/beden ekleme/çıkarma orada
// yapılır); köşedeki X ise grubu bir bütün olarak takipten çıkarır (bkz.
// ProductsScreen handleDeleteGroup).
export function ProductGridItem({ group, onPress, onDeleteAll, width, loading }: ProductGridItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const stock = useMemo(() => stockMeta(colors), [colors]);
  const first = group.items[0];

  return (
    <Pressable
      style={[styles.card, width ? { width } : null]}
      onPress={loading ? undefined : onPress}
      testID="product-card"
    >
      <View style={styles.imageWrap}>
        {first.imageUrl ? (
          <Image source={{ uri: first.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <View style={[styles.stockDot, { backgroundColor: stock[first.lastAvailability].color }]} />
        <Pressable
          onPress={onDeleteAll}
          style={styles.deleteButton}
          accessibilityLabel="Tüm bedenleri takipten çıkar"
          hitSlop={8}
        >
          <Icon name="close" size={13} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.info}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>{getBrandLabel(group.brand)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {first.name}
        </Text>
        <View style={styles.bottomRow}>
          <Text style={styles.price}>{formatPrice(first.lastPrice, first.currency)}</Text>
          <Text style={styles.sizeCount}>{group.items.length} beden</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}
