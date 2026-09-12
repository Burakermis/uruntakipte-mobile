import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { makeStyles } from './BrandHeader.styles';

// Uygulamanın marka damgası — ikon + isim. Önceden ProductsScreen kendi uzak
// (googleusercontent.com) placeholder logosunu, SettingsScreen ise farklı bir
// renkte aynı metni ayrı ayrı çiziyordu; artık ikisi de bu tek component'i
// kullanıyor, tek doğru kaynak burası (isim değişirse tek satır güncellenir).
export function BrandHeader() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Icon name="monitoring" size={22} color={colors.primary} />
      <Text style={styles.title}>ÜrünTakipte</Text>
    </View>
  );
}
