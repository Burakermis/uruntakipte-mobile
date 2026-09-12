import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Icon } from './Icon';
import { makeStyles } from './IconCircle.styles';

interface IconCircleProps {
  name: React.ComponentProps<typeof Icon>['name'];
  size?: number;
  backgroundColor: string;
  iconColor: string;
}

export function IconCircle({ name, size = 40, backgroundColor, iconColor }: IconCircleProps) {
  const styles = useMemo(() => makeStyles(size), [size]);
  return (
    <View style={[styles.circle, { backgroundColor }]}>
      <Icon name={name} size={Math.round(size * 0.45)} color={iconColor} />
    </View>
  );
}
