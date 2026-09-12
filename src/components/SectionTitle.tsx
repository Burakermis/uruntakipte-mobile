import React, { useMemo } from 'react';
import { Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { toTurkishUpper } from '../utils/text';
import { makeStyles } from './SectionTitle.styles';

interface SectionTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

// SettingsScreen'in "HESAP AYARLARI" ve ProductsScreen'in "Aktif Takipler"
// başlıkları önceden farklı boyut/harf-biçiminde tanımlıydı (aynı "bölüm
// etiketi" rolü için tutarsız iki stil) — artık ikisi de bu tek component'i,
// dolayısıyla theme.ts'in typography.labelCaps token'ını kullanıyor.
// Varsayılan margin'ler Ayarlar'ın (kart dışı, tam genişlik) bağlamına göre;
// kart içi kullanımlarda (ör. ProductVariantScreen'in alan etiketleri)
// `style` ile ezilir.
export function SectionTitle({ children, style }: SectionTitleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // CSS textTransform yerine metni burada büyütüyoruz — Türkçe "i" doğru
  // şekilde "İ" olsun diye (bkz. utils/text.ts).
  const content = typeof children === 'string' ? toTurkishUpper(children) : children;
  return <Text style={[styles.title, style]}>{content}</Text>;
}
