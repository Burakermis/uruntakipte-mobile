import { StyleSheet } from 'react-native';
import type { ColorTokens } from '../theme';

// İçerik yüksekliği (HEADER_CONTENT_HEIGHT) safe-area boşluğundan (insets.top)
// AYRI tutuluyor — önceki sürümde ikisi aynı View'e karışmıştı, bu da çentik/
// Dynamic Island payı büyüdükçe içerik satırının sıkışmasına yol açıyordu.
// Artık toplam yükseklik her zaman insets.top + HEADER_CONTENT_HEIGHT, içerik
// satırı hiçbir cihazda küçülmüyor.
export const HEADER_CONTENT_HEIGHT = 60;

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },
    content: {
      height: HEADER_CONTENT_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    },
    bordered: {
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
    },
    side: {
      minWidth: 40,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sideRight: {
      justifyContent: 'flex-end',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
