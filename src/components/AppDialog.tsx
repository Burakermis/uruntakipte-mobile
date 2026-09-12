import React, { useEffect, useMemo } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { DialogButton } from '../dialog/dialogStore';
import { makeStyles } from './AppDialog.styles';

interface AppDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
  onDismiss: () => void;
}

// Alert.alert (native OS pop-up) ve web'in window.confirm'i YERİNE — iOS,
// Android ve web'de BİREBİR AYNI görünen, uygulamanın kendi tasarım diline
// (Card/PrimaryButton ile aynı renk/radius/typography token'ları) uyan tek
// diyalog. src/dialog/dialogStore.ts'teki showAlert/confirmAsync bunu
// tetikler, DialogHost App.tsx kökünde tek sefer monte edilir.
export function AppDialog({ visible, title, message, buttons, onDismiss }: AppDialogProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="none" />
      <Pressable style={styles.card} onPress={() => {}}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.buttonRow}>
          {buttons.map((button, index) => {
            const variantStyle =
              button.style === 'cancel'
                ? styles.buttonCancel
                : button.style === 'destructive'
                ? styles.buttonDestructive
                : styles.buttonDefault;
            const variantTextStyle =
              button.style === 'cancel'
                ? styles.buttonTextCancel
                : button.style === 'destructive'
                ? styles.buttonTextDestructive
                : styles.buttonTextDefault;
            return (
              <Pressable
                key={`${button.text}-${index}`}
                style={[styles.button, variantStyle]}
                onPress={button.onPress}
                accessibilityRole="button"
              >
                <Text style={[styles.buttonText, variantTextStyle]}>{button.text}</Text>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </View>
  );
}
