import React, { useMemo } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { makeStyles } from './Card.styles';

interface CardProps {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Ekranlar arasında ayrı ayrı tanımlanan "beyaz/surfaceCard kutu + kenarlık +
// radius" deseninin tek, standart hali — SettingsScreen/PremiumScreen/
// ProductVariantScreen artık hepsi aynı köşe yuvarlaklığını (radii.lg)
// kullanıyor.
export function Card({ children, padded = false, style, testID }: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, padded && styles.padded, style]} testID={testID}>
      {children}
    </View>
  );
}
