import { StyleSheet } from 'react-native';
import { radii, spacing, typography } from '../theme';
import type { ColorTokens } from '../theme';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      padding: spacing.containerMargin,
      paddingBottom: 32,
      gap: spacing.stackGap,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    centerText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', maxWidth: 280 },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: spacing.cardPadding,
      backgroundColor: colors.surfaceCard,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    itemBody: { flex: 1, gap: 2 },
    itemTitle: { ...typography.headlineMd, color: colors.onSurface },
    itemText: { ...typography.bodyMd, color: colors.onSurfaceVariant },
    itemTime: { ...typography.bodyMd, fontSize: 12, lineHeight: 16, color: colors.outline, marginTop: 4 },
    note: { ...typography.bodyMd, fontSize: 12, lineHeight: 16, color: colors.onSurfaceVariant, textAlign: 'center' },
    clear: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 },
    clearText: { ...typography.bodyMd, fontWeight: '600', color: colors.error },
  });
