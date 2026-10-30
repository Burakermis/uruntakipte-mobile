import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CONNECTION_MESSAGE, registerDevice, setAuthToken, setUnauthorizedHandler } from './src/api';
import { PrimaryButton } from './src/components/PrimaryButton';
import { DialogHost } from './src/dialog/DialogHost';
import { pushUnsupportedReason, registerForPushNotificationsAsync, showNotificationsOffAtLaunchAlert } from './src/notifications';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { clearSession, getOrCreateSession, type Session } from './src/utils/session';
import { isNotificationsOptedOut } from './src/utils/notificationPreference';
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
  const [session, setSession] = useState<Session | null>(null);
  const [sessionFailed, setSessionFailed] = useState(false);
  const deviceId = session?.userId ?? null;

  // Oturum (sunucunun verdiği userId + token, bkz. utils/session.ts). İlk açılışta kayıt
  // için internet gerekir; ulaşılamazsa "Tekrar dene" gösterilir.
  const startSession = useCallback(async () => {
    setSessionFailed(false);
    try {
      const next = await getOrCreateSession();
      setAuthToken(next.token);
      setSession(next);
      // RevenueCat API key tanımlı değilse (bkz. src/purchases.ts) no-op —
      // web preview/hesap kurulmadan önce güvenle çağrılabilir.
      configurePurchases(next.userId);
    } catch {
      setSessionFailed(true);
    }
  }, []);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Sunucu token'ı reddederse (401) kayıtlı oturum silinip yenisi alınır.
  useEffect(() => {
    let renewing = false;
    setUnauthorizedHandler(() => {
      if (renewing) return;
      renewing = true;
      setAuthToken(null);
      clearSession()
        .then(startSession)
        .finally(() => {
          renewing = false;
        });
    });
    return () => setUnauthorizedHandler(null);
  }, [startSession]);

  useEffect(() => {
    if (!deviceId) return;
    // Açılışta push izni + token kaydı — kullanıcı Profil ekranına hiç
    // gitmeden de fiyat düşüşü/stok bildirimlerini alabilsin diye (önceden
    // sadece Profil'deki "Bildirim Ayarları" butonuyla manuel tetikleniyordu,
    // yani hiç oraya girmeyen bir kullanıcı asla bildirim alamıyordu).
    // İzin daha önce verilmiş/reddedilmişse expo-notifications OS düzeyinde
    // yeniden sormuyor, bu yüzden her açılışta çağırmak güvenli ve ucuz.
    //
    // Bildirimler KAPALIYSA (işletim sistemi izni yok ya da kullanıcı Ayarlar'dan kapatmış)
    // kullanıcı bunu bilmeden fiyat düşüşünü kaçırır; açılışta bir diyalogla bilgilendirilir ve
    // uygulamadaki Ayarlar sekmesine (anahtarın olduğu yer) yönlendirilir. Tek istisna: izin
    // bu açılışta İLK KEZ soruldu ve az önce OS penceresinde reddedildi — ardından ikinci bir
    // uyarı gereksiz, bir sonraki açılışta bilgilendirilir.
    const userId = deviceId;
    let running = false;
    let registered = false;
    const announceOff = () => showNotificationsOffAtLaunchAlert(() => setScreen('settings'));

    async function setUpPush(announceIfOff: boolean) {
      if (running) return;
      running = true;
      try {
        // Kullanıcı Ayarlar'dan bildirimleri KAPATTIYSA token yeniden kaydedilmez (kapatma
        // sessizce geri alınırdı); yalnızca kapalı olduğu hatırlatılır. Push'un hiç çalışmadığı
        // ortamda (simülatör, web, Android Expo Go) açılabilecek bir şey olmadığından hatırlatılmaz.
        if (await isNotificationsOptedOut()) {
          if (announceIfOff && !pushUnsupportedReason()) announceOff();
          return;
        }
        const result = await registerForPushNotificationsAsync();
        if (result.status === 'granted') {
          registered = true;
          try {
            // Anlık ağ aksaklığında sessizce yeniden denenir; yine olmazsa bir sonraki açılışta
            // ya da Ayarlar > Bildirim Ayarları'ndan (orada nedeni de gösterilir) tekrar denenir.
            await retryTransient(() => registerDevice(userId, result.token, Platform.OS));
          } catch {
            // Açılışta kullanıcıyı bir uyarıyla kesmiyoruz.
          }
        } else if (result.status === 'denied' && !result.prompted && announceIfOff) {
          announceOff();
        }
      } finally {
        running = false;
      }
    }

    setUpPush(true);

    // Kullanıcı cihaz ayarlarından bildirimi açıp uygulamaya dönünce
    // token'ı hemen kaydet — yoksa bir sonraki soğuk açılışa kadar bildirim gelmez.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !registered) setUpPush(false);
    });
    return () => subscription.remove();
  }, [deviceId]);

  if (!deviceId) {
    // Oturum gelene kadar hiçbir ekran userId olmadan render edilemez.
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 32 }}>
        {sessionFailed ? (
          <>
            <Text style={{ color: colors.onBackground, textAlign: 'center', marginBottom: 16 }}>{CONNECTION_MESSAGE}</Text>
            <PrimaryButton title="Tekrar Dene" onPress={startSession} testID="session-retry-button" />
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
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
