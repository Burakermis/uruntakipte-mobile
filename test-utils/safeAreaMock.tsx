import React, { useContext } from 'react';

// react-native-safe-area-context'in resmi jest mock'u her zaman 320x640/0 inset
// veriyor ve `initialMetrics`i sadece o Provider'a doğrudan verilirse kullanıyor.
// App.tsx kendi SafeAreaProvider'ını içeride kuruyor — bu yüzden testlerin
// "hangi cihazda" sorusunu global olarak ayarlayabilmesi için değiştirilebilir
// bir mevcut-cihaz değeri tutuyoruz. (Hook'lar ve context'ler gerçek.)
interface Metrics {
  frame: { x: number; y: number; width: number; height: number };
  insets: { top: number; bottom: number; left: number; right: number };
}

const DEFAULT_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
};

let current: Metrics = DEFAULT_METRICS;

export function setMockDeviceMetrics(next: Metrics | null) {
  current = next ?? DEFAULT_METRICS;
}

const actual = jest.requireActual('react-native-safe-area-context');

export default {
  ...actual,
  initialWindowMetrics: DEFAULT_METRICS,
  useSafeAreaInsets: () => useContext(actual.SafeAreaInsetsContext) ?? current.insets,
  useSafeAreaFrame: () => useContext(actual.SafeAreaFrameContext) ?? current.frame,
  SafeAreaProvider: ({ children, initialMetrics }: { children: React.ReactNode; initialMetrics?: Metrics }) => (
    <actual.SafeAreaFrameContext.Provider value={initialMetrics?.frame ?? current.frame}>
      <actual.SafeAreaInsetsContext.Provider value={initialMetrics?.insets ?? current.insets}>
        {children}
      </actual.SafeAreaInsetsContext.Provider>
    </actual.SafeAreaFrameContext.Provider>
  ),
};
