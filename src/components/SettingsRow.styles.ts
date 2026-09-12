import { StyleSheet } from 'react-native';
import type { ColorTokens } from '../theme';
import { typography } from '../theme';
import { makeRowShellStyles } from './rowShell.styles';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    ...makeRowShellStyles(colors),
    // Kart (Card) padded değil, bu yüzden satır kendi yatay boşluğunu
    // kendi tanımlıyor — SectionTitle ve card marginHorizontal'ıyla (16)
    // hizalı, hem sol ikon hem sağ chevron/tik kart kenarına yapışmasın diye.
    row: {
      ...makeRowShellStyles(colors).row,
      paddingHorizontal: 16,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      ...typography.bodyLg,
      color: colors.onSurface,
    },
    labelDanger: {
      color: colors.error,
      fontWeight: '500',
    },
    statusText: {
      ...typography.bodyMd,
      fontSize: 12,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    badge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    // textTransform:'uppercase' burada bilerek yok — bkz. SettingsRow.tsx'te
    // toTurkishUpper() ile metin büyütülüyor.
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.onPrimary,
    },
  });
