import React, { useMemo } from 'react';
import { Switch, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../utils/color';
import { Icon } from './Icon';
import { IconCircle } from './IconCircle';
import { makeStyles } from './ToggleRow.styles';

interface ToggleRowProps {
  icon: React.ComponentProps<typeof Icon>['name'];
  iconBackground: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  showBorder?: boolean;
}

export function ToggleRow({
  icon,
  iconBackground,
  iconColor,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  showBorder = true,
}: ToggleRowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.row, showBorder && styles.rowBorder, disabled && styles.rowDisabled]}>
      <View style={styles.left}>
        <IconCircle name={icon} size={32} backgroundColor={iconBackground} iconColor={iconColor} />
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primaryContainer, false: withAlpha(colors.primaryContainer, 0.2) }}
        thumbColor={colors.switchThumb}
      />
    </View>
  );
}
