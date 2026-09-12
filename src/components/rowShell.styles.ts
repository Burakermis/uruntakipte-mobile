import { StyleSheet } from 'react-native';
import type { ColorTokens } from '../theme';

// ToggleRow ve SettingsRow birebir aynı satır iskeletini (ikon dairesi +
// metin bloğu solda, kontrol/chevron sağda, isteğe bağlı alt çizgi)
// paylaşıyor — bu ortak kısım burada tek yerde tanımlanıyor, her iki
// component de kendi .styles.ts'inde `...makeRowShellStyles(colors)` ile
// spread edip üzerine sadece kendine özgü stilleri (trailing control,
// metin tipografisi) ekliyor.
export const makeRowShellStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    rowDisabled: {
      opacity: 0.6,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
      paddingRight: 12,
    },
  });
