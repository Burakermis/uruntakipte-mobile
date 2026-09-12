import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { makeStyles } from './PrimaryButton.styles';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  shape?: 'pill' | 'rect';
  icon?: React.ReactNode;
  testID?: string;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  shape = 'pill',
  icon,
  testID,
}: PrimaryButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={[styles.button, shape === 'pill' ? styles.pill : styles.rect, isDisabled ? styles.disabled : styles.enabled]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, isDisabled ? styles.textDisabled : styles.textEnabled]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
