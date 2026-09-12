import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Header } from './Header';
import { Icon } from './Icon';
import { makeStyles } from './ScreenHeader.styles';

interface ScreenHeaderProps {
  title: string;
  onClose: () => void;
  icon?: React.ComponentProps<typeof Icon>['name'];
  closeIcon?: React.ComponentProps<typeof Icon>['name'];
  closeLabel?: string;
}

// "Alt ekran" rolündeki header — kapat/geri ikonu solda, başlık ortada
// (isteğe bağlı bir ikonla). PremiumScreen ve ProductVariantScreen kullanır.
// İkisi de aynı headlineMd başlık boyutunu kullanıyor — önceden Premium
// 16/700, Ürün Ekle 20/700 gibi farklı boyutlardaydı, aynı role için tek
// standarda indirildi. `bordered` burada da sabit true (Premium'un daha önce
// border'sız kalması gözden kaçmış bir tutarsızlıktı).
export function ScreenHeader({ title, onClose, icon, closeIcon = 'close', closeLabel = 'Kapat' }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Header
      bordered
      left={
        <Pressable
          onPress={onClose}
          accessibilityLabel={closeLabel}
          hitSlop={10}
          style={styles.closeButton}
          testID="close-button"
        >
          <Icon name={closeIcon} size={24} color={colors.onSurface} />
        </Pressable>
      }
      center={
        <View style={styles.center}>
          {icon ? <Icon name={icon} size={22} color={colors.primary} /> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
      }
    />
  );
}
