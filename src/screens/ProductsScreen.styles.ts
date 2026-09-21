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
    // padding yerine minWidth/minHeight kullanılıyor — dokunma hedefi ikon
    // boyutundan (20px) bağımsız olarak her cihazda en az 44x44pt (Apple HIG
    // / Material erişilebilirlik alt sınırı) garanti ediyor.
    toolbarIconButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    toolbarIconButtonActive: {
      backgroundColor: withAlpha(colors.primary, 0.12),
    },
    toolbarBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    toolbarBrandText: {
      ...typography.headlineMd,
      color: colors.onSurface,
    },
    // Bağlantı hatası uyarısı — başlığın hemen altında, kaydırılsa da sabit kalır.
    // Dar ekranda "Tekrar dene" alt satıra iner (flexWrap), metin taşmaz.
    connectionBanner: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: 8,
      rowGap: 4,
      marginHorizontal: 16,
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radii.lg,
      backgroundColor: colors.errorContainer,
    },
    connectionBannerBody: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 180,
      gap: 8,
    },
    connectionBannerText: {
      flexShrink: 1,
      gap: 2,
    },
    connectionBannerTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.onErrorContainer,
    },
    connectionBannerSubtitle: {
      fontSize: 12,
      color: colors.onErrorContainer,
    },
    connectionRetry: {
      minHeight: 36,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
    },
    connectionRetryText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.onErrorContainer,
      textDecorationLine: 'underline',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radii.full * 4,
      backgroundColor: colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.onSurface,
      padding: 0,
    },
    content: {
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
      padding: 16,
      gap: 12,
      paddingBottom: 96,
    },
    cooldownCard: {
      gap: 8,
      backgroundColor: colors.surfaceContainerLow,
      borderColor: 'transparent',
    },
    cooldownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    cooldownLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    cooldownTimer: {
      ...typography.displayPrice,
      color: colors.onSurface,
      textAlign: 'center',
    },
    cooldownSubtext: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      alignSelf: 'center',
      maxWidth: 280,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    // SectionTitle'ın varsayılan margin'leri (Profil bağlamına göre) burada
    // sıfırlanıyor — bu ekranda başlık zaten padded bir ScrollView içinde,
    // sectionHeaderRow'un kendi flex/marginBottom düzeniyle konumlanıyor.
    sectionTitle: {
      marginTop: 0,
      marginBottom: 0,
      marginHorizontal: 0,
    },
    usageBadge: {
      backgroundColor: colors.surfaceContainerLow,
      borderRadius: radii.sm,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    usageBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
    },
    list: {
      gap: 12,
    },
    gridList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    empty: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 24,
    },
    emptyTitle: {
      ...typography.headlineMd,
      color: colors.onSurface,
      marginTop: 4,
    },
    emptyText: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      maxWidth: 280,
    },
    howToCard: {
      marginTop: 16,
      padding: 16,
      gap: 12,
      width: '100%',
    },
    howToTitle: {
      ...typography.headlineMd,
      color: colors.onSurface,
    },
    howToStep: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    howToStepNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.primary, 0.15),
    },
    howToStepNumberText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    howToStepText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurfaceVariant,
    },
    fab: {
      position: 'absolute',
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: radii.full * 4,
      backgroundColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 4,
    },
    fabText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
