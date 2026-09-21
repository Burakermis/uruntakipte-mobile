import React from 'react';
import { renderAsync } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DialogHost } from '../src/dialog/DialogHost';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { DEVICES, type DeviceProfile } from './devices';
import { setMockDeviceMetrics } from './safeAreaMock';

// Uygulamanın gerçek kök sarmalayıcılarıyla (SafeArea + Tema + tek DialogHost)
// bir ekranı çizer — showAlert/confirmAsync diyalogları gerçek AppDialog olarak
// görünüp dokunulabilir. `device` safe-area boşluklarını (çentik, home indicator)
// belirler. Sarmalayıcı RNTL `wrapper` seçeneğiyle verildiği için
// `rerenderAsync(<Ekran ... />)` de sağlayıcıları korur.
export function metricsFor(device: DeviceProfile) {
  return {
    frame: { x: 0, y: 0, width: device.width, height: device.height },
    insets: device.insets,
  };
}

export async function renderScreen(ui: React.ReactElement, { device = DEVICES.iphone15Pro }: { device?: DeviceProfile } = {}) {
  setMockDeviceMetrics(metricsFor(device));
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider initialMetrics={metricsFor(device)}>
      <ThemeProvider>
        {children}
        <DialogHost />
      </ThemeProvider>
    </SafeAreaProvider>
  );
  return renderAsync(ui, { wrapper: Wrapper });
}
