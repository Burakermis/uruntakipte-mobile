import React, { useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiRequestError, createTrackedProduct, deleteTrackedProduct } from '../api';
import { Card } from '../components/Card';
import { ColorChip } from '../components/ColorChip';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { SizeSquare } from '../components/SizeSquare';
import { showAlert } from '../dialog/dialogStore';
import { getBrandLabel } from '../utils/brands';
import { confirmAsync } from '../utils/confirm';
import { formatPrice } from '../utils/format';
import { useTheme } from '../theme/ThemeProvider';
import type { ResolvedProduct, SizeOption, TrackedProductGroup } from '../types';
import { makeStyles } from './ProductDetailScreen.styles';

interface ProductDetailScreenProps {
  userId: string;
  group: TrackedProductGroup;
  // Ürünün GÜNCEL renk/beden verisi — ProductsScreen bunu ekran AÇILMADAN
  // ÖNCE çekiyor (bkz. ProductsScreen handleOpenDetail) ki bu ekran hep
  // hazır içerikle açılsın, kendi içinde ayrıca bir yükleniyor durumu
  // göstermesin. Çekim başarısız olduysa `resolved` null, `loadError` dolu
  // gelir — ekran yine de açılır, sadece "ekle" ızgarası gösterilmez.
  resolved: ResolvedProduct | null;
  loadError: string | null;
  onClose: () => void;
  onChanged: () => void;
}

interface DisplayRow {
  key: string;
  sku: string;
  color: string;
  size: string;
  price: number | null;
  currency: string | null;
  status: 'kept' | 'removing' | 'adding';
}

// Ürünlerim'deki bir karta dokununca açılır. Renk/beden seçimi
// ProductVariantScreen ile AYNI ızgara deseniyle yapılıyor (seçili = takip
// edilecek) ama artık her dokunuş ANINDA sunucuya gitmiyor — bu sadece
// YEREL bir taslak; kullanıcı seçimini tamamlayıp "Kaydet"e basınca TEK
// seferde (gereken ekleme/çıkarma istekleri toplu) uygulanıyor.
export function ProductDetailScreen({
  userId,
  group,
  resolved,
  loadError,
  onClose,
  onChanged,
}: ProductDetailScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const originalSkus = useMemo(() => new Set(group.items.map((i) => i.sku)), [group.items]);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(() => new Set(originalSkus));
  const [saving, setSaving] = useState(false);
  const [selectedColorName, setSelectedColorName] = useState<string | null>(() => {
    const initial = group.items[0]?.color ?? null;
    if (resolved && initial && resolved.colors.some((c) => c.name === initial)) return initial;
    return resolved?.colors[0]?.name ?? initial;
  });

  const dirty = useMemo(() => {
    if (selectedSkus.size !== originalSkus.size) return true;
    for (const sku of selectedSkus) if (!originalSkus.has(sku)) return true;
    return false;
  }, [selectedSkus, originalSkus]);

  const sizeOptionBySku = useMemo(() => {
    const map = new Map<string, SizeOption>();
    resolved?.colors.forEach((c) => c.sizes.forEach((s) => map.set(s.sku, s)));
    return map;
  }, [resolved]);

  // "Takip Edilen Bedenler" kartı taslağın TAMAMINI yansıtıyor — orijinalde
  // vardı ama şimdi çıkarılmış olanlar üstü çizili, henüz kaydedilmemiş yeni
  // eklemeler ayrı bir rozetle, Kaydet'e basmadan önce ne olacağını net
  // göstersin diye.
  const displayRows = useMemo<DisplayRow[]>(() => {
    const rows: DisplayRow[] = group.items.map((item) => ({
      key: `existing-${item.id}`,
      sku: item.sku,
      color: item.color,
      size: item.size,
      price: item.lastPrice,
      currency: item.currency,
      status: selectedSkus.has(item.sku) ? 'kept' : 'removing',
    }));
    for (const sku of selectedSkus) {
      if (originalSkus.has(sku)) continue;
      const option = sizeOptionBySku.get(sku);
      if (!option) continue;
      const colorName = resolved?.colors.find((c) => c.sizes.some((s) => s.sku === sku))?.name ?? '';
      rows.push({
        key: `new-${sku}`,
        sku,
        color: colorName,
        size: option.size,
        price: option.price,
        currency: option.currency,
        status: 'adding',
      });
    }
    return rows;
  }, [group.items, selectedSkus, originalSkus, sizeOptionBySku, resolved]);

  function toggleSku(sku: string) {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  async function handleClose() {
    if (dirty) {
      const confirmed = await confirmAsync(
        'Kaydedilmemiş değişiklikler var',
        'Değişiklikleri kaydetmeden çıkmak istiyor musun?'
      );
      if (!confirmed) return;
    }
    onClose();
  }

  // Taslakla (selectedSkus) orijinal takip (originalSkus) arasındaki farkı
  // hesaplayıp gereken TÜM ekleme/çıkarma isteklerini tek seferde, paralel
  // gönderir.
  async function handleSave() {
    const toRemove = group.items.filter((i) => !selectedSkus.has(i.sku));
    const toAddSkus = Array.from(selectedSkus).filter((sku) => !originalSkus.has(sku));
    if (toRemove.length === 0 && toAddSkus.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      await Promise.all([
        ...toRemove.map((item) => deleteTrackedProduct(item.id, userId)),
        // Bildirim tercihleri artık backend'de stok durumundan türetiliyor
        // (bkz. routes/products.js) — burada göndermeye gerek yok.
        ...toAddSkus.map((sku) =>
          createTrackedProduct({
            userId,
            url: group.canonicalUrl,
            sku,
          })
        ),
      ]);
      onChanged();
      onClose();
    } catch (e) {
      showAlert('Hata', e instanceof ApiRequestError ? e.message : 'Değişiklikler kaydedilemedi, tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  const first = group.items[0];
  const selectedColor = resolved?.colors.find((c) => c.name === selectedColorName) ?? null;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ürün Detayı" onClose={handleClose} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card padded>
          <View style={styles.productRow}>
            {first?.imageUrl ? (
              <Image source={{ uri: first.imageUrl }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={[styles.productImage, styles.productImagePlaceholder]} />
            )}
            <View style={styles.productInfo}>
              <Text style={styles.brandTag}>{getBrandLabel(group.brand)}</Text>
              <Text style={styles.productName} numberOfLines={3}>
                {group.name}
              </Text>
            </View>
          </View>
        </Card>

        <SectionTitle style={styles.sectionTitle}>Takip Edilen Bedenler</SectionTitle>
        <Card padded style={styles.trackedCard}>
          {displayRows.length === 0 ? (
            <Text style={styles.emptyTrackedText}>Bu üründen hiçbir beden takip edilmiyor.</Text>
          ) : (
            <View style={styles.trackedList}>
              {displayRows.map((row) => (
                <View key={row.key} style={styles.trackedRow}>
                  <Text
                    style={[
                      styles.trackedLabel,
                      row.status === 'removing' && styles.trackedLabelRemoving,
                      row.status === 'adding' && styles.trackedLabelAdding,
                    ]}
                  >
                    {row.status === 'adding' ? '+ ' : ''}
                    {row.color} · {row.size}
                  </Text>
                  <Text style={styles.trackedPrice}>{formatPrice(row.price, row.currency)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        {loadError ? (
          <Text style={styles.loadErrorText}>{loadError}</Text>
        ) : resolved ? (
          <>
            <SectionTitle style={styles.sectionTitle}>Renk/Beden Ekle ya da Çıkar</SectionTitle>
            <Card padded>
              <View style={styles.chipRow}>
                {resolved.colors.map((color) => (
                  <ColorChip
                    key={color.name}
                    label={color.name}
                    selected={color.name === selectedColorName}
                    onPress={() => setSelectedColorName(color.name)}
                    disabled={saving}
                  />
                ))}
              </View>
              <View style={styles.chipRow}>
                {selectedColor?.sizes.map((sizeOption) => (
                  <SizeSquare
                    key={sizeOption.sku}
                    label={sizeOption.size}
                    selected={selectedSkus.has(sizeOption.sku)}
                    availability={sizeOption.availability}
                    disabled={saving}
                    onPress={() => toggleSku(sizeOption.sku)}
                  />
                ))}
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <PrimaryButton
          title="Kaydet"
          onPress={handleSave}
          disabled={!dirty}
          loading={saving}
          shape="rect"
          testID="save-detail-button"
        />
      </View>
    </View>
  );
}
