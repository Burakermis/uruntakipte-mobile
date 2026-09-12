import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { makeStyles } from './BottomTabBar.styles';

export type TabKey = 'products' | 'settings';

interface BottomTabBarProps {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}

const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof Icon>['name'] }[] = [
  { key: 'products', label: 'Ürünlerim', icon: 'inventory_2' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings' },
];

export function BottomTabBar({ active, onSelect }: BottomTabBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // insets.bottom: home indicator'lı iPhone'larda ~34px, fiziksel home
  // tuşlu/Android gesture çubuksuz cihazlarda 0 — sabit paddingBottom yerine
  // buradan okunuyor ki sekmeler home indicator'ın altına gizlenmesin.
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(8, insets.bottom) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Icon name={tab.icon} size={24} color={isActive ? colors.onPrimaryContainer : colors.onSurfaceVariant} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
