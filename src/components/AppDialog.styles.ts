import { StyleSheet } from 'react-native';
import { radii, typography } from '../theme';
import type { ColorTokens } from '../theme';

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      zIndex: 1000,
      elevation: 1000,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.surfaceCard,
      borderRadius: radii.lg,
      padding: 20,
      gap: 6,
    },
    title: {
      ...typography.headlineMd,
      color: colors.onSurface,
    },
    message: {
      ...typography.bodyMd,
      color: colors.onSurfaceVariant,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    button: {
      flex: 1,
      minHeight: 44,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    buttonCancel: {
      backgroundColor: colors.surfaceContainer,
    },
    buttonDefault: {
      backgroundColor: colors.primary,
    },
    buttonDestructive: {
      backgroundColor: colors.error,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: '700',
    },
    buttonTextCancel: {
      color: colors.onSurface,
    },
    buttonTextDefault: {
      color: colors.onPrimary,
    },
    buttonTextDestructive: {
      color: colors.onError,
    },
  });
