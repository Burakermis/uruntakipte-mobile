import { StyleSheet } from 'react-native';
import { radii, typography } from '../theme';
import type { ColorTokens } from '../theme';
import { withAlpha } from '../utils/color';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
      padding: 16,
      gap: 16,
      paddingBottom: 32,
    },
    errorBanner: {
      backgroundColor: colors.errorContainer,
      borderRadius: radii.sm,
      padding: 12,
      marginTop: 8,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
    },
    productRow: {
      flexDirection: 'row',
      gap: 16,
    },
    productImage: {
      width: 96,
      height: 128,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceContainer,
    },
    productImagePlaceholder: {},
    productInfo: {
      flex: 1,
      gap: 4,
    },
    brandTag: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.onSurfaceVariant,
      backgroundColor: colors.surfaceContainerLow,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.sm,
    },
    productName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onSurface,
      lineHeight: 22,
    },
    productPrice: {
      ...typography.displayPrice,
      color: colors.onSurface,
      marginTop: 2,
    },
    selectorBlock: {
      marginTop: 16,
      gap: 10,
    },
    selectorLabel: {
      marginTop: 0,
      marginBottom: 0,
      marginHorizontal: 0,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    availabilityHint: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      marginTop: -4,
    },
    alreadyTrackedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: withAlpha(colors.primary, 0.08),
      borderRadius: radii.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    alreadyTrackedText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      backgroundColor: colors.background,
    },
  });
