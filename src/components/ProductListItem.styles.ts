import { StyleSheet } from 'react-native';
import { radii } from '../theme';
import type { ColorTokens } from '../theme';
import { withAlpha } from '../utils/color';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: 16,
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderRadius: 8,
      padding: 16,
      position: 'relative',
    },
    image: {
      width: 64,
      height: 64,
      borderRadius: 2,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    imagePlaceholder: {},
    info: {
      flex: 1,
      justifyContent: 'space-between',
      paddingRight: 16,
      gap: 8,
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
    // Ad + fiyat yan yana durur; ikisi sığmayacak kadar dar bir kartta (ör. 280dp
    // katlanır telefon ya da 5-6 haneli fiyat) fiyat adın ALTINA sarılır. Eskiden
    // ad `flex: 1` (taban genişlik 0) idi: fiyat sabit genişlikte kalıp adı 10-20dp'ye
    // sıkıştırıyor, ad harf harf alt alta iniyordu.
    topRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      columnGap: 12,
      rowGap: 2,
    },
    name: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 96,
      fontSize: 14,
      color: colors.onSurface,
    },
    price: {
      marginLeft: 'auto',
      fontSize: 16,
      fontWeight: '600',
      color: colors.onSurface,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    sizeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      // Uzun renk adı ("Ekru / Mavi Çizgili Desenli…") rozeti kart genişliğinden
      // taşırmasın — metin rozetin içinde kısalır (bkz. sizeBadgeText).
      maxWidth: '100%',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceContainerLow,
    },
    sizeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    sizeBadgeText: {
      flexShrink: 1,
      fontSize: 11,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    leftMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    changeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    changeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    timeLabel: {
      fontSize: 12,
      color: colors.outline,
    },
    deleteButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      padding: 4,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: withAlpha(colors.surfaceCard, 0.7),
    },
  });
