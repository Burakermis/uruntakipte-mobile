import { StyleSheet } from 'react-native';
import type { ColorTokens } from '../theme';
import { makeRowShellStyles } from './rowShell.styles';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    ...makeRowShellStyles(colors),
    textWrap: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.onSurface,
    },
    subtitle: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
  });
