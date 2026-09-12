import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import type { Availability } from '../types';
import type { ColorTokens } from '../theme';
import { makeStyles } from './SizeSquare.styles';

// Modül seviyesinde sabit bir renk haritası donmuş (soğuk yüklenir) olurdu —
// tema değişince güncellenmesi için component içinde useMemo'ya taşındı.
function availabilityDotColor(colors: ColorTokens): Record<Availability, string> {
  return {
    in_stock: colors.stockInStock,
    low_stock: colors.stockLowStock,
    coming_soon: colors.stockComingSoon,
    out_of_stock: colors.stockOutOfStock,
  };
}

interface SizeSquareProps {
  label: string;
  selected: boolean;
  availability: Availability;
  onPress: () => void;
  disabled?: boolean;
}

// Mockup sadece seçili/seçili-değil durumunu gösteriyordu; stok takibi bu
// uygulamanın temel amacı olduğu için sağ-alt köşeye küçük bir stok
// noktası ekledik (seçim rozetiyle çakışmasın diye karşı köşede).
export function SizeSquare({ label, selected, availability, onPress, disabled }: SizeSquareProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dotColor = useMemo(() => availabilityDotColor(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.square,
        selected ? styles.squareSelected : styles.squareUnselected,
        disabled && styles.squareDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.stockDot, { backgroundColor: dotColor[availability] }]} />
      {selected ? (
        <View style={styles.badge}>
          <Icon name="check_circle" size={14} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}
