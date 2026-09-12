import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { makeStyles } from './Header.styles';

interface HeaderProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  bordered?: boolean;
}

// Tüm ekranlarda tekrarlayan üst çubuk iskeleti (yükseklik/hizalama/arka
// plan). İçerik (logo, başlık, kapat butonu vb.) her ekranda farklı olduğu
// için burası sadece slot'ları diziyor, tek bir dev "her şeyi yapan"
// component'e sıkıştırmıyoruz.
export function Header({ left, center, right, bordered = false }: HeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // insets.top: çentik/Dynamic Island/status bar yüksekliği — cihaza göre
  // değişir (ör. iPhone 15 Pro'da Dynamic Island olmayan bir modelden daha
  // büyük), bu yüzden sabit bir değer yerine SafeAreaProvider'dan okunuyor.
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, bordered && styles.bordered, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.side}>{left}</View>
        <View style={styles.center}>{center}</View>
        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    </View>
  );
}
