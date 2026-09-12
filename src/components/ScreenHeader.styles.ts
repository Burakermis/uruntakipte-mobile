import { StyleSheet } from 'react-native';
import { typography } from '../theme';
import type { ColorTokens } from '../theme';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    // hitSlop tek başına yeterli değil — kendi bir dokunma hedefi olmadan
    // sadece 24px'lik ikonun sınırları kadar tıklanabilir kalıyordu. En az
    // 44x44pt garanti etmek için minWidth/minHeight eklendi (bkz. Products
    // toolbar'ındaki aynı desen).
    closeButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      ...typography.headlineMd,
      color: colors.onSurface,
    },
  });
