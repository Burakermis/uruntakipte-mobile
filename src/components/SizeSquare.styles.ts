import { StyleSheet } from 'react-native';
import { radii } from '../theme';
import type { ColorTokens } from '../theme';
import { withAlpha } from '../utils/color';

// Sabit 40x40 bir kare "S (US S)" gibi uzun beden etiketlerini içine
// sığdıramıyordu — metin kutunun içinde iki satıra bölünüp taşıyor ve
// ızgarayı bozuyordu. Artık genişlik içeriğe göre esniyor (min. 40px), metin
// hep tek satırda kalıyor; yükseklik sabit kalmaya devam ediyor ki satır tek
// tip görünsün.
const MIN_SIZE = 40;

export const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    square: {
      minWidth: MIN_SIZE,
      maxWidth: '100%',
      height: MIN_SIZE,
      paddingHorizontal: 10,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      marginBottom: 8,
    },
    squareUnselected: {
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    squareSelected: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.05),
    },
    squareDisabled: {
      opacity: 0.5,
    },
    label: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors.onSurfaceVariant,
    },
    labelSelected: {
      color: colors.primary,
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.surfaceCard,
      borderRadius: 8,
    },
    stockDot: {
      position: 'absolute',
      bottom: -3,
      right: -3,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.surfaceCard,
    },
  });
