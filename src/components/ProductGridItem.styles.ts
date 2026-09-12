import { StyleSheet } from 'react-native';
import { radii } from '../theme';
import type { ColorTokens } from '../theme';
import { withAlpha } from '../utils/color';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    card: {
      // Yalnızca ölçüm tamamlanmadan ÖNCEKİ ilk kare için geri düşüş — asıl
      // genişlik ProductGridItem'a `width` prop'uyla piksel cinsinden geliyor
      // (bkz. ProductGridItem.tsx ve ProductsScreen'in gridList onLayout'u).
      width: '47%',
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    imageWrap: {
      position: 'relative',
    },
    image: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: colors.surfaceContainer,
    },
    imagePlaceholder: {},
    stockDot: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.surfaceCard,
    },
    deleteButton: {
      position: 'absolute',
      top: 6,
      right: 6,
      padding: 4,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.surfaceCard, 0.85),
    },
    info: {
      padding: 10,
      gap: 4,
    },
    brandBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.full,
      backgroundColor: withAlpha(colors.primary, 0.12),
    },
    brandBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: colors.primary,
    },
    name: {
      fontSize: 13,
      color: colors.onSurface,
      minHeight: 34,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    price: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onSurface,
    },
    sizeCount: {
      fontSize: 11,
      color: colors.outline,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.surfaceCard, 0.7),
    },
  });
