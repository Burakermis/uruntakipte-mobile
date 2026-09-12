import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '../theme';
import type { ColorTokens } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedScheme: 'light' | 'dark';
  colors: ColorTokens;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'themeMode';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // useColorScheme() işletim sisteminin AN'lık şemasını takip eder (canlı
  // değişikliklere de tepki verir). "system" modundayken kullanılan bu.
  const systemScheme = useColorScheme();

  // Soğuk başlangıçta yanlış tema flaşı olmasın diye ilk state DOĞRUDAN
  // senkron Appearance.getColorScheme() ile kuruluyor — AsyncStorage okuması
  // asenkron olduğu için bir "mode" tahmini gerekiyor, en iyi tahmin
  // "system" (zaten çoğu kullanıcının varsayılanı budur).
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      })
      .catch(() => {
        // Depo okunamazsa varsayılan "system" ile devam — bildirimdeki gibi
        // sessizce yutuluyor, kullanıcıyı engellememeli.
      });
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  // Appearance.getColorScheme()/useColorScheme() 'light' | 'dark' | null |
  // 'unspecified' (bazı Android sürümlerinde) döndürebiliyor — sadece
  // gerçekten 'dark' ise koyu, aksi hâlde açık kabul ediyoruz.
  const systemIsDark = (systemScheme ?? Appearance.getColorScheme()) === 'dark';
  const resolvedScheme: 'light' | 'dark' = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode;

  const colors = resolvedScheme === 'dark' ? darkColors : lightColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedScheme, colors, setMode }),
    [mode, resolvedScheme, colors, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme, ThemeProvider içinde kullanılmalı');
  }
  return ctx;
}
