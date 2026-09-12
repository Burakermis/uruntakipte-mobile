import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

// Mockup'lar Google "Material Symbols Outlined" font ligature isimleri
// kullanıyor (örn. "check_circle", "arrow_downward"). Klasik MaterialIcons
// yerine @expo/vector-icons'ta ZATEN bedava gelen MaterialCommunityIcons
// (MDI) kullanılıyor — daha geniş, daha "premium" hisseden bir glif seti
// (ör. gerçek bir taç ikonu, ışık huzmesi vb.), yeni bağımlılık gerekmiyor.
// Bilmediğimiz/farklı olan isimler için burada açık bir eşleme tablosu
// tutuyoruz.
const SYMBOL_TO_MATERIAL_ICON: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  inventory_2: 'package-variant',
  person: 'account',
  add: 'plus',
  check_circle: 'check-circle',
  cancel: 'close-circle',
  arrow_downward: 'arrow-down',
  link: 'link-variant',
  content_paste: 'content-paste',
  sell: 'tag',
  bolt: 'lightning-bolt',
  workspace_premium: 'crown',
  shopping_bag: 'shopping',
  speed: 'speedometer',
  stars: 'star',
  notifications: 'bell',
  logout: 'logout',
  chevron_right: 'chevron-right',
  monitoring: 'chart-line',
  close: 'close',
  // Görünüm (tema) seçici — bkz. SettingsScreen "Görünüm" bölümü.
  light_mode: 'white-balance-sunny',
  dark_mode: 'weather-night',
  theme_system: 'theme-light-dark',
  // Ayarlar ekranı (bkz. SettingsScreen) ve Ürünlerim üst araç çubuğu.
  history: 'history',
  shield: 'shield-outline',
  article: 'file-document-outline',
  info: 'information-outline',
  fingerprint: 'fingerprint',
  chevron_left: 'chevron-left',
  view_list: 'view-list',
  grid_view: 'view-grid-outline',
  search: 'magnify',
  settings: 'cog-outline',
  // Premium "Planını Seç" ekranındaki özellik rozetleri ve plan seçim radyoları.
  timer: 'timer-outline',
  all_inclusive: 'all-inclusive',
  radio_unchecked: 'radiobox-blank',
  radio_checked: 'radiobox-marked',
};

interface IconProps {
  name: keyof typeof SYMBOL_TO_MATERIAL_ICON;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color }: IconProps) {
  const { colors } = useTheme();
  const mappedName = SYMBOL_TO_MATERIAL_ICON[name] ?? (name as any);
  return <MaterialCommunityIcons name={mappedName} size={size} color={color ?? colors.onSurface} />;
}
