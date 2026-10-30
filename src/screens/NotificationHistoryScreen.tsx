import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { clearNotifications, listNotifications } from '../api';
import { Icon } from '../components/Icon';
import { IconCircle } from '../components/IconCircle';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { showAlert } from '../dialog/dialogStore';
import { useTheme } from '../theme/ThemeProvider';
import type { NotificationItem } from '../types';
import { withAlpha } from '../utils/color';
import { describeError } from '../utils/errors';
import { formatNotificationTime } from '../utils/format';
import { retryTransient } from '../utils/retry';
import { makeStyles } from './NotificationHistoryScreen.styles';

interface NotificationHistoryScreenProps {
  userId: string;
  onClose: () => void;
  // Bir kayda dokunulunca ilgili ürünün detayı açılır (bildirime dokunmakla aynı yol).
  onOpenProduct: (productUrl: string) => void;
}

const TYPE_ICON: Record<NotificationItem['type'], React.ComponentProps<typeof Icon>['name']> = {
  price_drop: 'sell',
  back_in_stock: 'inventory_2',
  tracking_failed: 'info',
};

// Gönderilen fiyat/stok bildirimlerinin KISA ömürlü geçmişi. Sunucu kayıtları `retentionDays` gün sonra
// otomatik siler ve kullanıcı başına sınırlı tutar (bkz. backend/store/notificationStore.js); ekran bunu
// kullanıcıya açıkça söyler ve istenirse tümünü elle temizletir.
export function NotificationHistoryScreen({ userId, onClose, onOpenProduct }: NotificationHistoryScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await retryTransient(() => listNotifications(userId));
      setItems(result.items);
      setRetentionDays(result.retentionDays);
    } catch (e) {
      setError(describeError(e));
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  function confirmClear() {
    if (clearing) return;
    showAlert('Geçmiş temizlensin mi?', 'Tüm bildirim kayıtların silinir. Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Temizle', style: 'destructive', onPress: runClear },
    ]);
  }

  async function runClear() {
    setClearing(true);
    try {
      await retryTransient(() => clearNotifications(userId));
      setItems([]);
    } catch (e) {
      showAlert('Geçmiş temizlenemedi', describeError(e));
    } finally {
      setClearing(false);
    }
  }

  let body: React.ReactNode;
  if (error && items === null) {
    body = (
      <View style={styles.center}>
        <Text style={styles.centerText}>{error}</Text>
        <PrimaryButton title="Tekrar Dene" onPress={load} testID="history-retry-button" />
      </View>
    );
  } else if (items === null) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <View style={styles.center}>
        <IconCircle name="history" size={64} backgroundColor={colors.surfaceContainerLow} iconColor={colors.primary} />
        <Text style={styles.centerText}>Henüz bir bildirim yok. Fiyat düşünce veya stoğa girince burada göreceksin.</Text>
      </View>
    );
  } else {
    body = (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={styles.item}
            disabled={!item.productUrl}
            onPress={() => item.productUrl && onOpenProduct(item.productUrl)}
            testID="notification-item"
          >
            <IconCircle
              name={TYPE_ICON[item.type] ?? 'notifications'}
              size={40}
              backgroundColor={withAlpha(colors.primaryContainer, 0.12)}
              iconColor={colors.primary}
            />
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemText}>{item.body}</Text>
              <Text style={styles.itemTime}>{formatNotificationTime(item.createdAt)}</Text>
            </View>
          </Pressable>
        ))}
        <Text style={styles.note}>Bildirim kayıtların {retentionDays ?? 30} gün sonra otomatik silinir.</Text>
        <Pressable style={styles.clear} onPress={confirmClear} disabled={clearing} testID="clear-history-button">
          <Text style={styles.clearText}>{clearing ? 'Temizleniyor…' : 'Geçmişi Temizle'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Bildirim Geçmişi" onClose={onClose} closeIcon="chevron_left" closeLabel="Geri" />
      {body}
    </View>
  );
}
