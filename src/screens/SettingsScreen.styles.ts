import { StyleSheet } from 'react-native';
import { typography } from '../theme';
import type { ColorTokens } from '../theme';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
      paddingBottom: 32,
    },
    card: {
      marginHorizontal: 16,
    },
    footer: {
      alignItems: 'center',
      marginTop: 32,
    },
    footerBrand: {
      ...typography.bodyMd,
      fontWeight: '600',
      color: colors.onSurfaceVariant,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 32,
    },
    placeholderText: {
      ...typography.bodyMd,
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      maxWidth: 280,
    },
  });
