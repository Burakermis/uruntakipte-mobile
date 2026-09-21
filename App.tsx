import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { registerDevice } from './src/api';
import { DialogHost } from './src/dialog/DialogHost';
import { registerForPushNotificationsAsync } from './src/notifications';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { getOrCreateDeviceId } from './src/utils/deviceId';
import { retryTransient } from './src/utils/retry';
import { configurePurchases } from './src/purchases';
import { PremiumScreen } from './src/screens/PremiumScreen';
import { ProductVariantScreen } from './src/screens/ProductVariantScreen';
import { ProductsScreen } from './src/screens/ProductsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

// Prototip navigasyonu: gerçek uygulamada react-navigation kullanılacak
// (özellikle share-intent'ten gelen deep link'i doğrudan "add" ekranına
// yönlendirmek için). Burada tek ekranlık state makinesi akışı göstermeye yetiyor.
// "settings" artık Profil'le birleşti — kendi başına kök sekme (bkz. BottomTabBar).
type ScreenName = 'products' | 'add' | 'premium' | 'settings';

export default function App() {
  // useTheme() bir Provider içinde çalışmalı — asıl uygulama gövdesi
  // (AppContent) bu yüzden ayrı bir bileşene taşındı. SafeAreaProvider en
  // dışta: Header/BottomTabBar gibi paylaşılan bileşenler useSafeAreaInsets()
  // ile çentik/Dynamic Island/home indicator boşluğunu buradan okuyor —
  // cihaza özel bir sabit değer yazmıyoruz, her cihazda otomatik doğru.
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { colors, resolvedScheme } = useTheme();
  const [screen, setScreen] = useState<ScreenName>('products');
  const [refreshToken, setRefreshToken] = useState(0);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateDeviceId().then((id) => {
      setDeviceId(id);
      // RevenueCat API key tanımlı değilse (bkz. src/purchases.ts) no-op —
      // web preview/hesap kurulmadan önce güvenle çağrılabilir.
      configurePurchases(id);
    });
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    // Açılışta push izni + token kaydı — kullanıcı Profil ekranına hiç
    // gitmeden de fiyat düşüşü/stok bildirimlerini alabilsin diye (önceden
    // sadece Profil'deki "Bildirim Ayarları" butonuyla manuel tetikleniyordu,
    // yani hiç oraya girmeyen bir kullanıcı asla bildirim alamıyordu).
    // İzin daha önce verilmiş/reddedilmişse expo-notifications OS düzeyinde
    // yeniden sormuyor, bu yüzden her açılışta çağırmak güvenli ve ucuz.
    (async () => {
      const result = await registerForPushNotificationsAsync();
      if (result.status === 'granted') {
        try {
          // Anlık ağ aksaklığında sessizce yeniden denenir; yine olmazsa bir sonraki açılışta
          // ya da Ayarlar > Bildirim Ayarları'ndan (orada nedeni de gösterilir) tekrar denenir.
          await retryTransient(() => registerDevice(deviceId, result.token, Platform.OS));
        } catch {
          // Açılışta kullanıcıyı bir uyarıyla kesmiyoruz.
        }
      }
    })();
  }, [deviceId]);

  if (!deviceId) {
    // AsyncStorage okuması asenkron — cihaz kimliği gelene kadar hiçbir
    // ekran userId olmadan render edilemez.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  let content: React.ReactNode;

  if (screen === 'add') {
    content = (
      <ProductVariantScreen
        userId={deviceId}
        onClose={() => setScreen('products')}
        onTracked={() => {
          setRefreshToken((t) => t + 1);
          setScreen('products');
        }}
      />
    );
  } else if (screen === 'premium') {
    content = (
      <PremiumScreen
        userId={deviceId}
        onClose={() => setScreen('settings')}
        onOpenProducts={() => setScreen('products')}
        onOpenSettings={() => setScreen('settings')}
      />
    );
  } else if (screen === 'settings') {
    content = (
      <SettingsScreen
        userId={deviceId}
        onOpenProducts={() => setScreen('products')}
        onOpenPremium={() => setScreen('premium')}
      />
    );
  } else {
    content = (
      <ProductsScreen
        userId={deviceId}
        refreshToken={refreshToken}
        onAddProduct={() => setScreen('add')}
        onOpenPremium={() => setScreen('premium')}
        onOpenSettings={() => setScreen('settings')}
      />
    );
  }

  return (
    <>
      {content}
      {/* Aktif ekranın ÜSTÜNDE, tek sefer monte edilir — showAlert/confirmAsync
          hangi ekrandan çağrılırsa çağrılsın aynı diyaloğu burada gösterir. */}
      <DialogHost />
      {/* StatusBar "style" içerik (metin/ikon) rengini belirtir, arka planı
          değil — koyu temada AÇIK içerik gerekiyor, bu yüzden ters. */}
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
