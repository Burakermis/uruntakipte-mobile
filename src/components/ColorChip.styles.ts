import { StyleSheet } from 'react-native';
import { radii } from '../theme';
import type { ColorTokens } from '../theme';
import { withAlpha } from '../utils/color';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: radii.full,
      marginRight: 8,
      marginBottom: 8,
    },
    chipSelected: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.05),
    },
    chipUnselected: {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    chipDisabled: {
      opacity: 0.5,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    labelSelected: {
      color: colors.primary,
    },
  });
