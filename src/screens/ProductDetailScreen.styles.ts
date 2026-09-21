import { StyleSheet } from 'react-native';
import { radii, typography } from '../theme';
import type { ColorTokens } from '../theme';

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
      gap: 4,
      paddingBottom: 32,
    },
    productRow: {
      flexDirection: 'row',
      gap: 16,
    },
    productImage: {
      width: 72,
      height: 96,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceContainer,
    },
    productImagePlaceholder: {},
    productInfo: {
      flex: 1,
      gap: 4,
      justifyContent: 'center',
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
      fontSize: 15,
      fontWeight: '600',
      color: colors.onSurface,
      lineHeight: 20,
    },
    sectionTitle: {
      marginHorizontal: 0,
    },
    trackedCard: {
      gap: 8,
    },
    trackedList: {
      gap: 10,
    },
    trackedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    trackedLabel: {
      ...typography.bodyMd,
      color: colors.onSurface,
    },
    trackedLabelRemoving: {
      color: colors.onSurfaceVariant,
      textDecorationLine: 'line-through',
    },
    trackedLabelAdding: {
      color: colors.primary,
      fontWeight: '600',
    },
    trackedPrice: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onSurface,
    },
    emptyTrackedText: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
    },
    trackedHint: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
    },
    loadErrorBox: {
      alignItems: 'center',
      gap: 4,
      marginTop: 12,
      paddingHorizontal: 8,
    },
    loadErrorTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.onSurface,
      textAlign: 'center',
    },
    loadErrorText: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    loadErrorRetry: {
      minHeight: 44,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadErrorRetryText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      backgroundColor: colors.background,
    },
  });
