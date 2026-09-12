import { StyleSheet } from 'react-native';
import { typography } from '../theme';
import type { ColorTokens } from '../theme';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    title: {
      ...typography.labelCaps,
      color: colors.onSurfaceVariant,
      marginTop: 24,
      marginBottom: 8,
      marginHorizontal: 16,
    },
  });
