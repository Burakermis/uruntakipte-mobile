import React, { useMemo, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { resolveProduct } from '../api';
import { Card } from '../components/Card';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../theme/ThemeProvider';
import { SUPPORTED_BRANDS } from '../utils/brands';
import { describeError } from '../utils/errors';
import { retryTransient } from '../utils/retry';
import { extractUrlFromPastedText } from '../utils/url';
import type { ResolvedProduct } from '../types';
import { makeStyles } from './AddProductUrlScreen.styles';

interface AddProductUrlScreenProps {
  onClose: () => void;
  onResolved: (product: ResolvedProduct) => void;
}

// Ürün Ekle akışının İLK adımı: sadece URL alıp çözüyor. Ürün bulununca
// ProductVariantScreen (kapsayıcı) ikinci adıma — renk/beden seçim
// ekranına — geçiyor; bu iki adım artık ayrı, kendi başlarına birer ekran
// (önceden tek, uzun bir kaydırmalı sayfaydı).
export function AddProductUrlScreen({ onClose, onResolved }: AddProductUrlScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [url, setUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  // Klavyedeki "Git" tuşuna art arda basmak (düğme pasifken bile) aynı sayfa için birden çok
  // pahalı tarama başlatıyordu — state güncellemesini beklemeyen bir bayrakla tekilleştiriliyor.
  const inFlight = useRef(false);

  async function handleResolve(targetUrl: string) {
    // Kullanıcı native "yapıştır" ile (üstteki yapıştır butonunu değil,
    // TextInput'un kendi paste'ini) kullanıp önündeki ürün adını
    // temizlemeden "Ürün Getir"e basmış olabilir — burada da temizliyoruz.
    const trimmed = extractUrlFromPastedText(targetUrl);
    if (!trimmed || inFlight.current) return;
    inFlight.current = true;
    setResolving(true);
    setResolveError(null);
    try {
      // Anlık bir ağ/sunucu aksaklığı kullanıcıya yansımadan yeniden denenir (bkz. utils/retry.ts).
      const resolved = await retryTransient(() => resolveProduct(trimmed));
      onResolved(resolved);
    } catch (e) {
      // Neden başarısız olduğu söylenir: "Bağlantı kurulamadı…", desteklenmeyen site, sayfa okunamadı…
      setResolveError(describeError(e));
    } finally {
      inFlight.current = false;
      setResolving(false);
    }
  }

  async function handlePaste() {
    const clipboardText = await Clipboard.getStringAsync();
    if (!clipboardText) return;
    // Bazı marka uygulamaları (Bershka, Zara vb.) paylaşılan metnin başına
    // ürün adını ekliyor (ör. "Şardonlu bermuda - Bershka https://...") —
    // kutuyu her zaman gerçek URL ile dolduruyoruz.
    // Sadece kutuyu doldur — aramayı otomatik BAŞLATMA. Kullanıcı yapıştırdığı
    // URL'i gözden geçirip/düzenleyip "Ürün Getir"e kendisi basmalı.
    setUrl(extractUrlFromPastedText(clipboardText));
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ürün Ekle" onClose={onClose} />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Ürün bağlantısını yapıştırın</Text>
          <Text style={styles.heroSubtitle}>{SUPPORTED_BRANDS.join(', ')} ürün sayfasının bağlantısını girin.</Text>
        </View>

        <View style={styles.urlRow}>
          <View style={styles.urlInputWrap}>
            <Icon name="link" size={18} color={colors.outline} />
            <TextInput
              style={styles.urlInput}
              placeholder="https://www.zara.com/tr/..."
              placeholderTextColor={colors.outline}
              value={url}
              onChangeText={setUrl}
              onSubmitEditing={() => handleResolve(url)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              testID="url-input"
            />
          </View>
          <Pressable style={styles.pasteButton} onPress={handlePaste} testID="paste-button">
            <Icon name="content_paste" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <PrimaryButton
          title="Ürünü Getir"
          onPress={() => handleResolve(url)}
          disabled={!url.trim()}
          loading={resolving}
          testID="fetch-product-button"
        />

        {resolveError ? (
          <View style={styles.errorBanner} testID="unsupported-site-banner">
            <Text style={styles.errorText}>{resolveError}</Text>
          </View>
        ) : null}

        <Card style={styles.sitesCard}>
          <Text style={styles.sitesTitle}>Desteklenen Siteler</Text>
          <View style={styles.sitesChips}>
            {SUPPORTED_BRANDS.map((brand) => (
              <View key={brand} style={styles.siteChip}>
                <Text style={styles.siteChipText}>{brand.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
