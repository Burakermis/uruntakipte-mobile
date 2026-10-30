import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Platform, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getUserLimits, registerDevice, unregisterDevice } from '../api';
import { BottomTabBar } from '../components/BottomTabBar';
import { Card } from '../components/Card';
import { HomeHeader } from '../components/HomeHeader';
import { Icon } from '../components/Icon';
import { IconCircle } from '../components/IconCircle';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { SettingsRow } from '../components/SettingsRow';
import { showAlert } from '../dialog/dialogStore';
import { pushUnsupportedReason, registerForPushNotificationsAsync, showNotificationsOffAlert } from '../notifications';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeMode } from '../theme/ThemeProvider';
import type { UserLimits } from '../types';
import { withAlpha } from '../utils/color';
import { describeError } from '../utils/errors';
import { isNotificationsOptedOut, setNotificationsOptedOut } from '../utils/notificationPreference';
import { retryTransient } from '../utils/retry';
import { makeStyles } from './SettingsScreen.styles';

interface SettingsScreenProps {
  userId: string;
  onOpenProducts: () => void;
  onOpenPremium: () => void;
}

type SubScreen = 'main' | 'notifications' | 'privacy' | 'terms';
// on: anahtar açık (izin var, kullanıcı kapatmamış) · off: kullanıcı uygulama içinden kapattı ·
// denied: işletim sistemi izni yok · unknown: izin henüz sorulmadı
type NotificationStatus = 'unknown' | 'checking' | 'on' | 'off' | 'denied' | 'unsupported' | 'error';

const NOTIFICATION_STATUS_LABEL: Record<NotificationStatus, string | undefined> = {
  unknown: undefined,
  checking: 'Güncelleniyor…',
  on: 'Açık',
  off: 'Kapalı',
  denied: 'Kapalı — cihaz ayarlarından aç',
  unsupported: 'Bu ortamda desteklenmiyor',
  error: 'Açılamadı — dokunarak tekrar dene',
};

const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  light: 'Açık',
  dark: 'Koyu',
  system: 'Sistem',
};

const THEME_MODE_ICON: Record<ThemeMode, React.ComponentProps<typeof Icon>['name']> = {
  light: 'light_mode',
  dark: 'dark_mode',
  system: 'theme_system',
};

const THEME_MODE_ORDER: ThemeMode[] = ['light', 'dark', 'system'];

const PLACEHOLDER_CONTENT: Record<Exclude<SubScreen, 'main'>, {
  title: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  subtitle: string;
}> = {
  notifications: {
    title: 'Bildirim Geçmişi',
    icon: 'history',
    subtitle: 'Henüz bir bildirim yok. Fiyat düşünce veya stoğa girince burada göreceksin.',
  },
  privacy: {
    title: 'Gizlilik Politikası',
    icon: 'shield',
    subtitle: 'İçerik yakında eklenecek.',
  },
  terms: {
    title: 'Kullanım Koşulları',
    icon: 'article',
    subtitle: 'İçerik yakında eklenecek.',
  },
};

// Ayarlar artık alt sekme çubuğunun bir üyesi (eski Profil sekmesiyle
// birleşti) — Premium/Bildirim İzni/Yardım eskiden ProfileScreen'in "Hesap
// Ayarları" kartındaydı, buraya taşındı. Görünüm tam liste (radio seçim),
// Hakkında bölümü değişmedi. Alt sayfalar (bildirim geçmişi, yasal metinler)
// henüz backend/içerik olmadığı için basit birer "yakında" ekranı; kendi
// state'i içinde, App.tsx'e yeni route eklemeden yönetiliyor.
export function SettingsScreen({ userId, onOpenProducts, onOpenPremium }: SettingsScreenProps) {
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sub, setSub] = useState<SubScreen>('main');
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>('unknown');
  const [limits, setLimits] = useState<UserLimits | null>(null);

  useEffect(() => {
    getUserLimits(userId).then(setLimits).catch(() => {});
  }, [userId]);

  // App.tsx açılışta izni zaten isteyip token'ı kaydetmiş olabilir — bu
  // ekran o kararı OKUYUP gösteriyor, tekrar izin istemiyor (öyle bir şey
  // olsaydı her Ayarlar'a girişte gereksiz bir OS diyaloğu tetiklenirdi).
  // Kullanıcı cihaz ayarlarından izni açıp/kapatıp dönebilir: uygulama ön plana gelince yeniden okunur.
  // İşlem sürerken (checking) ve token hatası gösterilirken (error) ezilmez.
  async function refreshNotificationStatus() {
    let next: NotificationStatus;
    if (pushUnsupportedReason()) next = 'unsupported';
    // Kullanıcı anahtarı kapattıysa işletim sistemi izni hâlâ "verilmiş" olsa da kapalı görünür.
    else if (await isNotificationsOptedOut()) next = 'off';
    else {
      const { status } = await Notifications.getPermissionsAsync();
      next = status === 'granted' ? 'on' : status === 'denied' ? 'denied' : 'unknown';
    }
    setNotificationStatus((prev) => (prev === 'checking' || prev === 'error' ? prev : next));
  }

  useEffect(() => {
    refreshNotificationStatus();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshNotificationStatus();
    });
    return () => subscription.remove();
  }, []);

  // Mağaza kuralları (ör. Apple 4.5.4) uygulama içinden bildirimden çıkış yolu istiyor. İşletim
  // sistemi izni uygulamadan geri alınamadığından kapatma, sunucudan bu cihazın token'larını
  // sildirip tercihi saklayarak yapılır; açma ise izin + token + sunucu kaydıdır.
  async function handleNotificationsToggle(next: boolean) {
    const previous = notificationStatus;
    setNotificationStatus('checking');
    if (next) await turnOnNotifications();
    else await turnOffNotifications(previous);
  }

  async function turnOffNotifications(previous: NotificationStatus) {
    try {
      await retryTransient(() => unregisterDevice(userId));
    } catch (e) {
      // Sunucu hâlâ bildirim gönderebilir → anahtar eski konumunda kalır, nedeni söylenir.
      setNotificationStatus(previous);
      showAlert('Bildirimler kapatılamadı', describeError(e));
      return;
    }
    // Sunucu artık göndermiyor; açılışta token'ın yeniden kaydedilmemesi için tercih saklanır.
    await setNotificationsOptedOut(true);
    setNotificationStatus('off');
  }

  async function turnOnNotifications() {
    // Kullanıcı bildirim İSTEDİ: önceki "kapattım" tercihi kalkar ki izin/kayıt sonradan
    // tamamlansa bile (ör. ayarlardan izin verince) açılışta yeniden kaydolsun.
    await setNotificationsOptedOut(false);
    const result = await registerForPushNotificationsAsync();

    if (result.status === 'granted') {
      try {
        await retryTransient(() => registerDevice(userId, result.token, Platform.OS));
      } catch (e) {
        // İzin verildi ama sunucu bu cihazı bilmiyor → bildirim gelmez. Anahtar "açık" gösterilmez;
        // tekrar çevrilerek yeniden denenebilir (açılışta da kendiliğinden denenir).
        setNotificationStatus('error');
        showAlert(
          'Bildirimler açılamadı',
          `Bildirim izni verildi ama bu cihaz sunucuya kaydedilemedi, bu yüzden bildirim alamazsın. ${describeError(e)}`
        );
        return;
      }
      setNotificationStatus('on');
      return;
    }

    if (result.status === 'denied') {
      setNotificationStatus('denied');
      showNotificationsOffAlert();
      return;
    }

    if (result.status === 'error') {
      // Ortam destekliyor, ama şu an açılamadı → "Desteklenmiyor" demek yanlış olur; tekrar denenebilir.
      setNotificationStatus('error');
      showAlert('Bildirimler açılamadı', result.reason);
      return;
    }

    setNotificationStatus('unsupported');
    showAlert('Desteklenmiyor', result.reason);
  }

  // Gizlilik Politikası / Kullanım Koşulları: yayınlanmış bir sayfa adresi tanımlıysa
  // (EXPO_PUBLIC_PRIVACY_URL / EXPO_PUBLIC_TERMS_URL) tarayıcıda açılır; tanımlı değilse
  // (henüz içerik yok) uygulama içi "yakında" sayfası gösterilir.
  async function openLegal(kind: 'privacy' | 'terms') {
    const raw = kind === 'privacy' ? process.env.EXPO_PUBLIC_PRIVACY_URL : process.env.EXPO_PUBLIC_TERMS_URL;
    const url = raw && /^https?:\/\//i.test(raw) ? raw : null;
    if (!url) {
      setSub(kind);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      showAlert('Sayfa açılamadı', 'Sayfa şu an açılamıyor. İnternet bağlantını kontrol edip tekrar dene.');
    }
  }

  async function handleCopyDeviceId() {
    await Clipboard.setStringAsync(userId);
    showAlert('Kopyalandı', 'Cihaz ID panoya kopyalandı.');
  }

  if (sub !== 'main') {
    const content = PLACEHOLDER_CONTENT[sub];
    return (
      <View style={styles.container}>
        <ScreenHeader title={content.title} onClose={() => setSub('main')} closeIcon="chevron_left" closeLabel="Geri" />
        <View style={styles.placeholder}>
          <IconCircle
            name={content.icon}
            size={64}
            backgroundColor={colors.surfaceContainerLow}
            iconColor={colors.primary}
          />
          <Text style={styles.placeholderText}>{content.subtitle}</Text>
        </View>
        <BottomTabBar active="settings" onSelect={(tab) => tab === 'products' && onOpenProducts()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HomeHeader />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionTitle>Hesap Ayarları</SectionTitle>
        <Card style={styles.card}>
          <SettingsRow
            icon="stars"
            iconBackground={withAlpha(colors.primaryContainer, 0.1)}
            iconColor={colors.primary}
            label="Premium'a Geç"
            badge={limits?.isPremium ? undefined : 'Yeni'}
            statusText={limits ? (limits.isPremium ? 'Premium üye' : 'Ücretsiz plan') : undefined}
            onPress={onOpenPremium}
          />
          <SettingsRow
            icon="notifications"
            iconBackground={withAlpha(colors.primaryContainer, 0.1)}
            iconColor={colors.primary}
            label="Bildirim Ayarları"
            statusText={NOTIFICATION_STATUS_LABEL[notificationStatus]}
            switchValue={notificationStatus === 'on'}
            onSwitchChange={handleNotificationsToggle}
            disabled={notificationStatus === 'checking'}
          />
          <SettingsRow
            icon="history"
            iconBackground={withAlpha(colors.primaryContainer, 0.1)}
            iconColor={colors.primary}
            label="Bildirim Geçmişi"
            statusText="Gönderilen bildirimleri görüntüle"
            showBorder={false}
            onPress={() => setSub('notifications')}
          />
        </Card>

        <SectionTitle>Görünüm</SectionTitle>
        <Card style={styles.card}>
          {THEME_MODE_ORDER.map((m, index) => (
            <SettingsRow
              key={m}
              icon={THEME_MODE_ICON[m]}
              iconBackground={withAlpha(colors.primaryContainer, 0.15)}
              iconColor={colors.primary}
              label={THEME_MODE_LABEL[m]}
              checked={mode === m}
              showChevron={false}
              showBorder={index < THEME_MODE_ORDER.length - 1}
              onPress={() => setMode(m)}
            />
          ))}
        </Card>

        <SectionTitle>Hakkında</SectionTitle>
        <Card style={styles.card}>
          <SettingsRow
            icon="shield"
            iconBackground={withAlpha(colors.secondaryContainer, 0.2)}
            iconColor={colors.secondary}
            label="Gizlilik Politikası"
            onPress={() => openLegal('privacy')}
          />
          <SettingsRow
            icon="article"
            iconBackground={withAlpha(colors.secondaryContainer, 0.2)}
            iconColor={colors.secondary}
            label="Kullanım Koşulları"
            onPress={() => openLegal('terms')}
          />
          <SettingsRow
            icon="info"
            iconBackground={withAlpha(colors.secondaryContainer, 0.2)}
            iconColor={colors.secondary}
            label="Uygulama Versiyonu"
            statusText={Constants.expoConfig?.version ?? '—'}
            showChevron={false}
            onPress={() => {}}
          />
          <SettingsRow
            icon="fingerprint"
            iconBackground={withAlpha(colors.secondaryContainer, 0.2)}
            iconColor={colors.secondary}
            label="Cihaz ID"
            statusText={userId}
            showChevron={false}
            showBorder={false}
            onPress={handleCopyDeviceId}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>ÜrünTakipte</Text>
        </View>
      </ScrollView>

      <BottomTabBar active="settings" onSelect={(tab) => tab === 'products' && onOpenProducts()} />
    </View>
  );
}
