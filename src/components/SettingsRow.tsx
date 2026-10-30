import React, { useMemo } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { IconCircle } from './IconCircle';
import { withAlpha } from '../utils/color';
import { toTurkishUpper } from '../utils/text';
import { makeStyles } from './SettingsRow.styles';

interface SettingsRowProps {
  icon: React.ComponentProps<typeof Icon>['name'];
  iconBackground: string;
  iconColor: string;
  label: string;
  badge?: string;
  statusText?: string;
  danger?: boolean;
  showChevron?: boolean;
  showBorder?: boolean;
  checked?: boolean;
  onPress?: () => void;
  // Verilirse satırın sağında chevron/tik yerine bir aç/kapat anahtarı çıkar; satırın
  // tamamına dokunmak da anahtarı çevirir (onPress yok sayılır).
  switchValue?: boolean;
  onSwitchChange?: (next: boolean) => void;
  disabled?: boolean;
}

// SettingsScreen'deki her satır (Premium, Görünüm, Bildirim Ayarları,
// Yardım, Hakkında) bu component'i kullanıyor — ToggleRow ile aynı satır
// iskeletini (bkz. rowShell.styles.ts) paylaşıyor ama trailing control'ü
// (chevron/badge/anahtar) ve metin şekli (label/statusText) farklı olduğu için ayrı
// bir component; ToggleRow'un kendisi değişmiyor.
export function SettingsRow({
  icon,
  iconBackground,
  iconColor,
  label,
  badge,
  statusText,
  danger,
  showChevron = true,
  showBorder = true,
  checked = false,
  onPress,
  switchValue = false,
  onSwitchChange,
  disabled = false,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const hasSwitch = onSwitchChange !== undefined;

  return (
    <Pressable
      style={[styles.row, showBorder && styles.rowBorder, disabled && styles.rowDisabled]}
      disabled={disabled}
      onPress={hasSwitch ? () => onSwitchChange(!switchValue) : onPress}
    >
      <View style={styles.left}>
        <IconCircle name={icon} size={40} backgroundColor={iconBackground} iconColor={iconColor} />
        <View style={styles.textWrap}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, danger && styles.labelDanger]}>{label}</Text>
            {badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{toTurkishUpper(badge)}</Text>
              </View>
            ) : null}
          </View>
          {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
        </View>
      </View>
      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ true: colors.primaryContainer, false: withAlpha(colors.primaryContainer, 0.2) }}
          thumbColor={colors.switchThumb}
        />
      ) : checked ? (
        <Icon name="check_circle" size={22} color={colors.primary} />
      ) : showChevron ? (
        <Icon name="chevron_right" size={22} color={colors.onSurfaceVariant} />
      ) : null}
    </Pressable>
  );
}
