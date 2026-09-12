import { StyleSheet } from 'react-native';
import type { ColorTokens } from '../theme';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      minHeight: 64,
      paddingTop: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.surfaceContainer,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
    },
    tab: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 4,
      borderRadius: 12,
    },
    tabActive: {
      backgroundColor: colors.primaryContainer,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
      color: colors.onSurfaceVariant,
    },
    labelActive: {
      color: colors.onPrimaryContainer,
    },
  });
