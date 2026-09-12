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
      flexGrow: 1,
      maxWidth: 560,
      width: '100%',
      alignSelf: 'center',
      padding: 16,
      gap: 16,
    },
    hero: {
      gap: 8,
      paddingTop: 8,
      paddingBottom: 8,
    },
    heroTitle: {
      ...typography.headlineLg,
      color: colors.onSurface,
    },
    heroSubtitle: {
      ...typography.bodyMd,
      color: colors.onSurfaceVariant,
    },
    urlRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 8,
    },
    urlInputWrap: {
      flex: 1,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: radii.full * 4,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceBright,
      minWidth: 0,
    },
    urlInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.onSurface,
    },
    pasteButton: {
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceContainerLow,
    },
    errorBanner: {
      backgroundColor: colors.errorContainer,
      borderRadius: radii.sm,
      padding: 12,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
    },
    sitesCard: {
      padding: 16,
      gap: 10,
    },
    sitesTitle: {
      ...typography.headlineMd,
      color: colors.onSurface,
    },
    sitesChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    siteChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radii.full * 4,
      marginRight: 8,
      marginBottom: 8,
      backgroundColor: withAlpha(colors.primary, 0.1),
    },
    siteChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
  });
