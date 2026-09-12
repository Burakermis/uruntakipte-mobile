import React, { useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiRequestError, createTrackedProduct, listTrackedProducts } from '../api';
import { AVAILABILITY_LABEL, canNotifyOnBackInStock } from '../availability';
import { AddProductUrlScreen } from './AddProductUrlScreen';
import { Card } from '../components/Card';
import { ColorChip } from '../components/ColorChip';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionTitle } from '../components/SectionTitle';
import { SizeSquare } from '../components/SizeSquare';
import { ToggleRow } from '../components/ToggleRow';
import { useTheme } from '../theme/ThemeProvider';
import { withAlpha } from '../utils/color';
import { formatPrice } from '../utils/format';
import type { ResolvedProduct, SizeOption } from '../types';
import { makeStyles } from './ProductVariantScreen.styles';

interface ProductVariantScreenProps {
  userId: string;
  onClose: () => void;
  onTracked: () => void;
}

// Ürün Ekle akışı iki AYRI ekrandan oluşuyor: (1) URL girme (bkz.
// AddProductUrlScreen.tsx), (2) renk/beden seçip takibe alma (bu dosyanın
// asıl gövdesi). Bu component ikisini birbirine bağlayan kapsayıcı — `product`
// state'i null olduğu sürece adım 1'i, dolduktan sonra adım 2'yi gösteriyor.
// Bu, App.tsx'teki "gerçek navigasyon yerine yerel state ile ekran değiştirme"
// deseniyle birebir aynı (bkz. App.tsx'in üstündeki yorum) — burada da ayrı
// bir navigator kurmadan aynı fikir bir seviye aşağıda tekrarlanıyor.
export function ProductVariantScreen({ userId, onClose, onTracked }: ProductVariantScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<ResolvedProduct | null>(null);

  const [selectedColorName, setSelectedColorName] = useState<string | null>(null);
  // Beden seçimi çoklu (Set<sku>) — kullanıcı tek seferde birden fazla beden
  // işaretleyip hepsini birden takibe alabilir. Renk seçimi tek-seçim (radio).
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Kullanıcının BU ürün sayfasında zaten takip ettiği sku'lar — "Takibe Al"
  // butonunun aynı renk/bedeni sessizce tekrar eklemesini engellemek için.
  const [trackedSkus, setTrackedSkus] = useState<Set<string>>(new Set());

  const selectedColor = useMemo(
    () => product?.colors.find((c) => c.name === selectedColorName) ?? null,
    [product, selectedColorName]
  );

  const selectedSizeObjects = useMemo(
    () => selectedColor?.sizes.filter((s) => selectedSkus.has(s.sku)) ?? [],
    [selectedColor, selectedSkus]
  );
  // Fiyat gösterimi için: birden fazla beden seçiliyken ilk seçileni referans
  // al (bedenler arasında fiyat genelde aynı, sadece stok değişir).
  const priceReference = selectedSizeObjects[0] ?? selectedColor?.sizes[0] ?? null;

  async function handleResolved(resolved: ResolvedProduct) {
    setProduct(resolved);
    const firstColor = resolved.colors[0] ?? null;
    setSelectedColorName(firstColor?.name ?? null);
    setSelectedSkus(new Set());

    // Kullanıcının bu ürünü hangi renk/bedenlerde zaten takip ettiğini
    // öğren — liste isteği başarısız olsa bile ürün eklemeyi engellemeyelim,
    // sadece "zaten takipte" uyarısını gösteremeyiz (backend yine de
    // alreadyTracked ile son bir güvenlik ağı sağlıyor, bkz. handleTrack).
    try {
      const tracked = await listTrackedProducts(userId);
      const skusForThisProduct = tracked
        .filter((t) => t.canonicalUrl === resolved.canonicalUrl)
        .map((t) => t.sku);
      setTrackedSkus(new Set(skusForThisProduct));
    } catch {
      setTrackedSkus(new Set());
    }
  }

  function handleSelectColor(colorName: string) {
    setSelectedColorName(colorName);
    setSelectedSkus(new Set());
  }

  function toggleSku(sku: string) {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  // Seçili bedenlerden HERHANGİ biri şu an satın alınamıyorsa "stoğa girince
  // bildir" toggle'ı anlamlı — tek bir bedenin durumuna değil, tüm seçime
  // bakıyor (farklı bedenler farklı stok durumunda olabilir).
  const backInStockAllowed = selectedSizeObjects.some((s) => canNotifyOnBackInStock(s.availability));
  const canTrack = !!product && !!selectedColor && selectedSizeObjects.length > 0;

  async function handleTrack() {
    if (!product || !selectedColor || selectedSizeObjects.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    const succeeded: SizeOption[] = [];
    const failed: { sizeOption: SizeOption; message: string }[] = [];

    // Sırayla (Promise.all DEĞİL) — findOrCreateTarget'ta ilk-kez-görülen bir
    // URL için eşzamanlı istekleri birleştiren bir kilit yok. Sıralı gönderim,
    // ilk çağrının sayfayı tarayıp trackedTarget'ı oluşturmasını, sonraki
    // bedenlerin ise bunu hızlı bir önbellek isabetiyle bulmasını garantiler
    // (bkz. backend/routes/products.js findOrCreateTarget). Bildirim
    // tercihleri artık gönderilmiyor — backend bunları stok durumundan
    // türetip zorunlu kılıyor (bkz. routes/products.js).
    for (const sizeOption of selectedSizeObjects) {
      try {
        const result = await createTrackedProduct({
          userId,
          url: product.canonicalUrl,
          sku: sizeOption.sku,
        });
        succeeded.push(sizeOption);
        if (result.alreadyTracked) {
          setTrackedSkus((prev) => new Set(prev).add(sizeOption.sku));
        }
      } catch (e) {
        failed.push({
          sizeOption,
          message: e instanceof ApiRequestError ? e.message : 'Bilinmeyen hata',
        });
      }
    }

    setSubmitting(false);

    if (failed.length === 0) {
      onTracked();
      return;
    }

    // Kısmi/tam başarısızlık: ekrandan çıkma, sonucu gizleme — başarılı
    // olanları takip listesine işaretle, başarısız olanları tekrar deneme
    // için seçili bırak.
    setTrackedSkus((prev) => {
      const next = new Set(prev);
      succeeded.forEach((s) => next.add(s.sku));
      return next;
    });
    setSelectedSkus(new Set(failed.map((f) => f.sizeOption.sku)));
    setSubmitError(
      succeeded.length > 0
        ? `${succeeded.length} beden eklendi. Eklenemeyenler: ${failed.map((f) => f.sizeOption.size).join(', ')}.`
        : `Hiçbir beden eklenemedi: ${failed.map((f) => f.sizeOption.size).join(', ')}.`
    );
  }

  const trackButtonTitle =
    selectedSkus.size > 1 ? `${selectedSkus.size} Bedeni Takibe Al` : 'Takibe Al';

  if (!product) {
    return <AddProductUrlScreen onClose={onClose} onResolved={handleResolved} />;
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ürün Ekle" onClose={onClose} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card padded>
          <View style={styles.productRow}>
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={[styles.productImage, styles.productImagePlaceholder]} />
            )}
            <View style={styles.productInfo}>
              <Text style={styles.brandTag}>{product.brandLabel}</Text>
              <Text style={styles.productName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.productPrice}>
                {formatPrice(priceReference?.price ?? null, priceReference?.currency ?? null)}
              </Text>

              <View style={styles.selectorBlock}>
                <SectionTitle style={styles.selectorLabel}>Renk Seçin</SectionTitle>
                <View style={styles.chipRow}>
                  {product.colors.map((color) => (
                    <ColorChip
                      key={color.name}
                      label={color.name}
                      selected={color.name === selectedColorName}
                      disabled={submitting}
                      onPress={() => handleSelectColor(color.name)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.selectorBlock}>
                <SectionTitle style={styles.selectorLabel}>Beden Seçin</SectionTitle>
                <View style={styles.chipRow}>
                  {selectedColor?.sizes.map((sizeOption) => (
                    <SizeSquare
                      key={sizeOption.size}
                      label={sizeOption.size}
                      selected={selectedSkus.has(sizeOption.sku)}
                      availability={sizeOption.availability}
                      disabled={trackedSkus.has(sizeOption.sku) || submitting}
                      onPress={() => toggleSku(sizeOption.sku)}
                    />
                  ))}
                </View>
                {selectedSizeObjects.length === 1 ? (
                  <Text style={styles.availabilityHint}>
                    {AVAILABILITY_LABEL[selectedSizeObjects[0].availability]}
                  </Text>
                ) : null}
                {selectedColor?.sizes.some((s) => trackedSkus.has(s.sku)) ? (
                  <View style={styles.alreadyTrackedBanner} testID="already-tracked-banner">
                    <Icon name="check_circle" size={16} color={colors.primary} />
                    <Text style={styles.alreadyTrackedText}>
                      Soluk görünen bedenleri zaten takip ediyorsun
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Card>

        <Card padded>
          {/* Bu iki bildirim tercihi artık kullanıcı tarafından
              kapatılamıyor — ikisini birden kapatıp hiçbir bildirim almayan
              bir takip yaratmak anlamsız olurdu. Değerler seçili
              bedenlerin stok durumundan türetiliyor (backend de aynı kuralı
              zorunlu kılıyor, bkz. routes/products.js): satın alınabiliyorsa
              sadece fiyat düşüşü, alınamıyorsa (stok yok/yakında) ikisi de
              açık. */}
          <ToggleRow
            icon="sell"
            iconBackground={withAlpha(colors.statusWarning, 0.1)}
            iconColor={colors.statusWarning}
            title="Fiyat düşünce bildir"
            subtitle="İndirime girdiğinde bildirim al"
            value
            onValueChange={() => {}}
            disabled
          />
          <ToggleRow
            icon="inventory_2"
            iconBackground={colors.surfaceContainer}
            iconColor={colors.onSurfaceVariant}
            title="Stoğa girince bildir"
            subtitle={
              backInStockAllowed
                ? 'Seçtiğin bedenler yeniden satışa çıkınca haber ver'
                : selectedSizeObjects.length > 0
                ? 'Seçtiğin bedenler zaten satın alınabiliyor, bu bildirime gerek yok'
                : 'Önce en az bir beden seç'
            }
            value={backInStockAllowed}
            onValueChange={() => {}}
            disabled
            showBorder={false}
          />
        </Card>

        {submitError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <PrimaryButton
          title={trackButtonTitle}
          onPress={handleTrack}
          disabled={!canTrack}
          loading={submitting}
          testID="track-button"
        />
      </View>
    </View>
  );
}
