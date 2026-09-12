import { StyleSheet } from 'react-native';
import { radii } from '../theme';
import type { ColorTokens } from '../theme';

function withOpacity(hex: string) {
  // metin için basit bir soluklaştırma — buton disabled görünümünde kullanılır
  return hex + '80';
}

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pill: {
      borderRadius: radii.full * 4, // görsel olarak tam yuvarlak (buton yüksekliği ~48px)
    },
    rect: {
      borderRadius: radii.lg,
    },
    enabled: {
      backgroundColor: colors.primary,
    },
    disabled: {
      backgroundColor: colors.surfaceContainerHighest,
    },
    text: {
      fontSize: 16,
      fontWeight: '700',
    },
    textEnabled: {
      color: colors.onPrimary,
    },
    textDisabled: {
      color: withOpacity(colors.onSurfaceVariant),
    },
  });
