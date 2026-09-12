import { StyleSheet } from 'react-native';
import { radii } from '../theme';
import type { ColorTokens } from '../theme';
import { withAlpha } from '../utils/color';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      padding: 16,
      gap: 12,
      paddingBottom: 24,
    },
    hero: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 24,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.onSurface,
      marginTop: 4,
    },
    heroSubtitle: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      maxWidth: 260,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: radii.full * 4,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceContainerLow,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
      color: colors.onSurfaceVariant,
    },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surfaceContainerLow,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    columnHeader: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    columnHeaderPremium: {
      color: colors.primary,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    rowFeature: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.onSurface,
    },
    rowCellFree: {
      width: 72,
      alignItems: 'center',
    },
    rowCellPremium: {
      width: 88,
      alignItems: 'center',
    },
    mono: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.onSurfaceVariant,
    },
    premiumPill: {
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radii.md,
    },
    premiumPillText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.onPrimaryContainer,
    },
    featureRow: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      alignItems: 'flex-start',
    },
    featureText: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.onSurface,
    },
    featureSubtitle: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginTop: 4,
    },
    footer: {
      padding: 16,
      gap: 12,
    },
    restoreLink: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    restoreLinkText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },

    // "Planını Seç" adımı (bkz. PremiumScreen'in step==='plans' dalı)
    headerIconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plansScrollContent: {
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      padding: 16,
      gap: 20,
      paddingBottom: 24,
    },
    plansHero: {
      alignItems: 'center',
      gap: 6,
    },
    plansTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.onSurface,
    },
    plansSubtitle: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
    },
    planList: {
      gap: 12,
    },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceCard,
    },
    planCardSelected: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.05),
    },
    planCardBody: {
      flex: 1,
      gap: 4,
    },
    planCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    planCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.onSurface,
    },
    planBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
      backgroundColor: colors.primaryContainer,
    },
    planBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: colors.onPrimaryContainer,
    },
    planBadgeHighlight: {
      backgroundColor: colors.primary,
    },
    planBadgeTextHighlight: {
      color: colors.onPrimary,
    },
    planCardSubtitle: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
    },
    planCardPriceWrap: {
      alignItems: 'flex-end',
    },
    planCardPrice: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.onSurface,
    },
    planCardOriginalPrice: {
      fontSize: 12,
      color: colors.outline,
      textDecorationLine: 'line-through',
    },
    plansEmpty: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    plansEmptyText: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    plansDevActivateText: {
      marginTop: 12,
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      textAlign: 'center',
    },
    planFeatureRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    planFeature: {
      alignItems: 'center',
      gap: 6,
    },
    planFeatureText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
      textAlign: 'center',
    },
    plansDisclaimer: {
      fontSize: 11,
      color: colors.outline,
      textAlign: 'center',
    },
  });
