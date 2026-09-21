import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkTrackedProductNow, getUserLimits, listTrackedProducts, resolveProduct } from '../api';
import { BottomTabBar } from '../components/BottomTabBar';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { IconCircle } from '../components/IconCircle';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProductGridItem } from '../components/ProductGridItem';
import { ProductListItem } from '../components/ProductListItem';
import { SectionTitle } from '../components/SectionTitle';
import { showAlert } from '../dialog/dialogStore';
import { useTheme } from '../theme/ThemeProvider';
import { getBrandLabel, SUPPORTED_BRANDS } from '../utils/brands';
import { confirmAsync } from '../utils/confirm';
import { describeError, explainFailure } from '../utils/errors';
import { formatCountdown, formatDuration } from '../utils/format';
import { removeTrackedProduct } from '../utils/trackedProducts';
import type { ResolvedProduct, TrackedProduct, TrackedProductGroup, UserLimits } from '../types';
import { ProductDetailScreen } from './ProductDetailScreen';
import { makeStyles } from './ProductsScreen.styles';

interface ProductsScreenProps {
  userId: string;
  refreshToken: number;
  onAddProduct: () => void;
  onOpenPremium: () => void;
  onOpenSettings: () => void;
}

type ViewMode = 'list' | 'grid';

// styles.gridList'teki gap değeriyle birebir aynı olmalı — grid kart
// genişliği bu boşluk düşülerek hesaplanıyor (bkz. onGridLayout).
const GRID_GAP = 12;
const GRID_COLUMNS = 2;

// Bağlantı hatası uyarısı görünürken veri, bu aralıkla arka planda yeniden çekilir —
// bağlantı gelince uyarı kullanıcı bir şey yapmadan kaybolur.
const AUTO_RETRY_MS = 10_000;

const ADD_PRODUCT_STEPS = [
  `${SUPPORTED_BRANDS.join(', ')} uygulamasını açın`,
  'Takip etmek istediğiniz ürünü bulun',
  "Paylaş butonuna basın ve ÜrünTakipte'yi seçin",
];

// Backend hâlâ (target,sku) başına bir satır döndürüyor — aynı ürünün farklı
// renk/bedenleri artık listede ayrı kartlar olarak değil, TEK kartta beden
// rozetleri olarak gösterilsin diye burada, mobil tarafta gruplanıyor.
function groupTrackedProducts(items: TrackedProduct[]): TrackedProductGroup[] {
  const map = new Map<string, TrackedProductGroup>();
  for (const item of items) {
    const existing = map.get(item.canonicalUrl);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(item.canonicalUrl, {
        canonicalUrl: item.canonicalUrl,
        brand: item.brand,
        name: item.name,
        imageUrl: item.imageUrl,
        items: [item],
      });
    }
  }
  return Array.from(map.values());
}

export function ProductsScreen({
  userId,
  refreshToken,
  onAddProduct,
  onOpenPremium,
  onOpenSettings,
}: ProductsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<TrackedProduct[]>([]);
  const [limits, setLimits] = useState<UserLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gridWidth, setGridWidth] = useState(0);
  // Detay ekranı, ürünün sabit bilgilerini (ad, görsel, marka) açılıştaki karttan alır; beden
  // listesi ise HER ZAMAN güncel listeden türetilir — kaydetme kısmen başarısız olup liste
  // yenilendiğinde ekran gerçek durumu gösterir, geride kalan (başarısız) işlemler taslakta kalır.
  const [detailBase, setDetailBase] = useState<Omit<TrackedProductGroup, 'items'> | null>(null);
  const [detailResolved, setDetailResolved] = useState<ResolvedProduct | null>(null);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [openingUrl, setOpeningUrl] = useState<string | null>(null);
  // Son veri çekme (liste VEYA limitler) başarısızsa true — başarılı bir çekimle
  // ikisi de gelene kadar "Bağlantı kurulamadı" uyarısı gösterilir.
  const [loadError, setLoadError] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const groups = useMemo(() => groupTrackedProducts(items), [items]);
  const detailGroup = useMemo<TrackedProductGroup | null>(() => {
    if (!detailBase) return null;
    return groups.find((g) => g.canonicalUrl === detailBase.canonicalUrl) ?? { ...detailBase, items: [] };
  }, [detailBase, groups]);

  // '%' genişlik + `gap` kombinasyonu flexbox'ta yuvarlama yüzünden dar
  // ekranlarda taşabiliyor — bunun yerine konteynerin GERÇEK genişliği
  // ölçülüp 2 sütuna göre pikselinde bölünüyor, her cihazda (ve yön
  // değişikliğinde) tam oturuyor.
  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    setGridWidth(event.nativeEvent.layout.width);
  }, []);
  const gridItemWidth =
    gridWidth > 0 ? (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : undefined;

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLocaleLowerCase('tr');
    if (!trimmed) return groups;
    return groups.filter(
      (group) =>
        group.name.toLocaleLowerCase('tr').includes(trimmed) ||
        getBrandLabel(group.brand).toLocaleLowerCase('tr').includes(trimmed)
    );
  }, [groups, query]);

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
  }

  // Liste ve limit istekleri birbirinden bağımsız; başarısız olan kısım son bilinen
  // değerini korur. Eskiden `Promise.all` + `catch { setItems([]) }` idi: yenileme
  // sırasındaki tek bir ağ hatası (ya da yalnızca limit isteğinin düşmesi) ekrandaki
  // listeyi silip "Henüz ürün eklemediniz" gösteriyordu.
  const fetchList = useCallback(async () => {
    const [list, userLimits] = await Promise.allSettled([listTrackedProducts(userId), getUserLimits(userId)]);
    if (list.status === 'fulfilled') setItems(list.value);
    if (userLimits.status === 'fulfilled') setLimits(userLimits.value);
    setLoadError(list.status === 'rejected' || userLimits.status === 'rejected');
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchList().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchList, refreshToken]);

  // Uyarı görünürken veriyi arka planda yeniden dener (her deneme bitince bir sonrakini
  // zamanlar — istekler üst üste binmez). Başarılı olunca loadError false olur, döngü durur.
  useEffect(() => {
    if (!loadError) return;
    const timer = setTimeout(() => {
      fetchList().finally(() => setRetryTick((t) => t + 1));
    }, AUTO_RETRY_MS);
    return () => clearTimeout(timer);
  }, [loadError, retryTick, fetchList]);

  async function handleRetry() {
    setRetrying(true);
    try {
      await fetchList();
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    setCooldownMs(limits?.cooldownRemainingMs ?? 0);
  }, [limits?.cooldownRemainingMs]);

  // Sunucudan gelen kalan süreyi saniyede bir yerel olarak azaltıp canlı bir
  // geri sayım gösteriyoruz — 0'a ulaşınca interval kendini durduruyor,
  // her tick'te yeniden kurulmuyor (bkz. formatCountdown).
  const cooldownActive = cooldownMs > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const id = setInterval(() => setCooldownMs((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(id);
  }, [cooldownActive]);

  // Aşağı çekip yenileme: worker'ın periyodik turunu (varsayılan 5 dk)
  // beklemeden görünen tüm ürünleri hemen yeniden kontrol eder.
  async function handleRefresh() {
    setRefreshing(true);
    try {
      // Kontrol HEDEF (ürün sayfası) bazında çalışıyor ve tüm bedenleri günceller — bir ürünün
      // N bedeni için N kez aynı sayfayı taratmak yerine ürün başına tek istek yeterli.
      await Promise.allSettled(groups.map((group) => checkTrackedProductNow(group.items[0].id, userId)));
      await fetchList();
    } finally {
      setRefreshing(false);
    }
  }

  // Kartın sağ üstündeki X — ürünün TÜM bedenlerini birden takipten çıkarır.
  async function handleDeleteGroup(group: TrackedProductGroup) {
    const confirmed = await confirmAsync(
      'Takipten çıkar',
      group.items.length > 1
        ? `${group.name} takibi (${group.items.length} beden) bırakılsın mı?`
        : `${group.name} takibi bırakılsın mı?`
    );
    if (!confirmed) return;

    const ids = new Set(group.items.map((i) => i.id));
    const previous = items;
    setItems((cur) => cur.filter((i) => !ids.has(i.id))); // iyimser güncelleme

    // Her beden ayrı istek: biri başarısız olsa da diğerleri silinir; hangisinin gittiği
    // bilinir. Geçici hatalar sessizce yeniden denenir, "zaten silinmiş" (404) başarı sayılır.
    const results = await Promise.allSettled(group.items.map((i) => removeTrackedProduct(i.id, userId)));
    const failures = results.flatMap((r, index) => (r.status === 'rejected' ? [{ item: group.items[index], error: r.reason }] : []));

    if (failures.length === 0) {
      getUserLimits(userId).then(setLimits).catch(() => {});
      return;
    }

    // Silinemeyenler listeye geri döner; sunucuda silinenler gitmiş kalır. Gerçek durumla
    // eşitlemek için liste de yenilenir.
    const failedIds = new Set(failures.map((f) => f.item.id));
    setItems(previous.filter((i) => !ids.has(i.id) || failedIds.has(i.id)));
    void fetchList();

    const reason = explainFailure(failures.map((f) => f.error));
    if (failures.length === group.items.length) {
      showAlert('Takipten çıkarılamadı', reason);
    } else {
      const removed = group.items.length - failures.length;
      showAlert('Kısmen çıkarıldı', `${removed} beden takipten çıkarıldı, ${failures.length} beden çıkarılamadı. ${reason}`);
    }
  }

  // Ürün detayını açmadan önce güncel renk/beden verisini çekiyoruz — ekran
  // hep hazır içerikle "açılsın", içeride ayrıca bir yükleniyor durumu
  // göstermesin diye (bkz. ProductDetailScreen). Çözüm başarısız olsa bile
  // ekranı yine de açıyoruz (loadError ile) — yoksa kullanıcı zaten takip
  // ettiği bedenleri çıkaramaz hale gelir.
  async function handleOpenDetail(group: TrackedProductGroup) {
    setOpeningUrl(group.canonicalUrl);
    try {
      const resolved = await resolveProduct(group.canonicalUrl);
      setDetailResolved(resolved);
      setDetailLoadError(null);
    } catch (e) {
      setDetailResolved(null);
      setDetailLoadError(describeError(e, 'Ürün bilgisi güncellenemedi.'));
    } finally {
      setOpeningUrl(null);
      setDetailBase({
        canonicalUrl: group.canonicalUrl,
        brand: group.brand,
        name: group.name,
        imageUrl: group.imageUrl,
      });
    }
  }

  // Detay ekranındaki "Tekrar dene": renk/beden bilgisini yeniden çeker (ekran kapanmaz).
  async function handleRetryDetail() {
    if (!detailBase) return;
    try {
      setDetailResolved(await resolveProduct(detailBase.canonicalUrl));
      setDetailLoadError(null);
    } catch (e) {
      setDetailLoadError(describeError(e, 'Ürün bilgisi güncellenemedi.'));
    }
  }

  function handleAddPress() {
    // Bekleme süresi banner'ı gösteriliyorken "Ürün Ekle" doğrudan Premium
    // ekranına atar — normal ekleme akışını/uyarı diyaloğunu göstermenin
    // anlamı yok, kullanıcı zaten banner'daki aynı CTA'yı görüyor.
    if (limits && !limits.isPremium && cooldownMs > 0) {
      onOpenPremium();
      return;
    }
    if (limits && !limits.isPremium && limits.activeCount >= (limits.maxActiveProducts ?? Infinity)) {
      showAlert(
        'Ürün limiti doldu',
        `Ücretsiz planda en fazla ${limits.maxActiveProducts} ürün takip edebilirsin.` +
          (limits.cooldownRemainingMs > 0
            ? ` Yeni ürün eklemek için ${formatDuration(limits.cooldownRemainingMs)} kaldı.`
            : ''),
        [
          { text: 'İptal', style: 'cancel' },
          { text: "Premium'a Bak", onPress: onOpenPremium },
        ]
      );
      return;
    }
    onAddProduct();
  }

  if (detailGroup) {
    return (
      <ProductDetailScreen
        userId={userId}
        group={detailGroup}
        resolved={detailResolved}
        loadError={detailLoadError}
        onRetryLoad={handleRetryDetail}
        onClose={() => setDetailBase(null)}
        onChanged={fetchList}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Header
        bordered
        left={
          <Pressable
            onPress={() => setViewMode((m) => (m === 'list' ? 'grid' : 'list'))}
            accessibilityLabel={viewMode === 'list' ? 'Izgara görünümüne geç' : 'Liste görünümüne geç'}
            style={styles.toolbarIconButton}
            testID="toggle-view-button"
          >
            <Icon name={viewMode === 'list' ? 'grid_view' : 'view_list'} size={20} color={colors.onSurfaceVariant} />
          </Pressable>
        }
        center={
          <View style={styles.toolbarBrand}>
            <Text style={styles.toolbarBrandText}>ÜrünTakipte</Text>
          </View>
        }
        right={
          <Pressable
            onPress={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            accessibilityLabel={searchOpen ? 'Aramayı kapat' : 'Ara'}
            accessibilityState={{ selected: searchOpen }}
            style={[styles.toolbarIconButton, searchOpen && styles.toolbarIconButtonActive]}
            testID="toggle-search-button"
          >
            <Icon name={searchOpen ? 'close' : 'search'} size={20} color={searchOpen ? colors.primary : colors.onSurfaceVariant} />
          </Pressable>
        }
      />

      {loadError ? (
        <View style={styles.connectionBanner} accessibilityRole="alert" testID="connection-banner">
          <View style={styles.connectionBannerBody}>
            <Icon name="wifi_off" size={18} color={colors.onErrorContainer} />
            <View style={styles.connectionBannerText}>
              <Text style={styles.connectionBannerTitle}>Bağlantı kurulamadı</Text>
              <Text style={styles.connectionBannerSubtitle}>
                Bilgilerin güncel hali yüklenemedi. Bağlantı gelince otomatik yenilenecek.
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleRetry}
            disabled={retrying}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.connectionRetry}
            testID="connection-retry-button"
          >
            <Text style={styles.connectionRetryText}>{retrying ? 'Deneniyor…' : 'Tekrar dene'}</Text>
          </Pressable>
        </View>
      ) : null}

      {searchOpen ? (
        <View style={styles.searchBar} testID="search-bar">
          <Icon name="search" size={18} color={colors.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün veya marka ara"
            placeholderTextColor={colors.outline}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            testID="search-input"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Aramayı temizle" hitSlop={8}>
              <Icon name="close" size={16} color={colors.outline} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {limits && !limits.isPremium && cooldownMs > 0 ? (
          <Card padded style={styles.cooldownCard} testID="cooldown-banner">
            <View style={styles.cooldownHeader}>
              <Icon name="history" size={16} color={colors.onSurfaceVariant} />
              <Text style={styles.cooldownLabel}>Takip hakkı bekleme süresi</Text>
            </View>
            <Text style={styles.cooldownTimer}>{formatCountdown(cooldownMs)}</Text>
            <Text style={styles.cooldownSubtext}>
              Silinen ürünün yerine yeni ürün eklemek için beklemeniz gerekiyor.
            </Text>
            <PrimaryButton
              title="Beklemeden ekle — Premium ol"
              shape="pill"
              onPress={onOpenPremium}
              icon={<Icon name="bolt" size={16} color={colors.onPrimary} />}
            />
          </Card>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <SectionTitle style={styles.sectionTitle}>Aktif Takipler</SectionTitle>
          {limits && !limits.isPremium ? (
            <Pressable style={styles.usageBadge} onPress={onOpenPremium} testID="usage-badge">
              <Text style={styles.usageBadgeText}>
                {limits.activeCount}/{limits.maxActiveProducts} ürün
              </Text>
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : groups.length === 0 && loadError ? (
          // Liste hiç gelmediyse "Henüz ürün eklemediniz" YANLIŞ olurdu — üstteki uyarı
          // durumu açıklıyor, burada ürün yokmuş gibi bir boş durum gösterilmiyor.
          null
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <IconCircle
              name="shopping_bag"
              size={64}
              backgroundColor={colors.surfaceContainerLow}
              iconColor={colors.primary}
            />
            <Text style={styles.emptyTitle}>Henüz ürün eklemediniz</Text>
            <Text style={styles.emptyText}>
              {SUPPORTED_BRANDS.join(', ')} uygulamasından bir ürün paylaşarak takip etmeye başlayın.
            </Text>

            <Card style={styles.howToCard}>
              <Text style={styles.howToTitle}>Nasıl ürün eklerim?</Text>
              {ADD_PRODUCT_STEPS.map((step, index) => (
                <View key={step} style={styles.howToStep}>
                  <View style={styles.howToStepNumber}>
                    <Text style={styles.howToStepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.howToStepText}>{step}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.empty}>
            <IconCircle
              name="search"
              size={64}
              backgroundColor={colors.surfaceContainerLow}
              iconColor={colors.primary}
            />
            <Text style={styles.emptyTitle}>Sonuç bulunamadı</Text>
            <Text style={styles.emptyText}>"{query}" ile eşleşen bir ürün yok.</Text>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.gridList} onLayout={handleGridLayout}>
            {filteredGroups.map((group) => (
              <ProductGridItem
                key={group.canonicalUrl}
                group={group}
                width={gridItemWidth}
                loading={openingUrl === group.canonicalUrl}
                onPress={() => handleOpenDetail(group)}
                onDeleteAll={() => handleDeleteGroup(group)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredGroups.map((group) => (
              <ProductListItem
                key={group.canonicalUrl}
                group={group}
                loading={openingUrl === group.canonicalUrl}
                onPress={() => handleOpenDetail(group)}
                onDeleteAll={() => handleDeleteGroup(group)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={handleAddPress}
        accessibilityLabel="Ürün Ekle"
        style={[styles.fab, { bottom: 88 + insets.bottom }]}
        testID="add-product-button"
      >
        <Icon name="add" size={20} color={colors.onPrimary} />
        <Text style={styles.fabText}>Ürün Ekle</Text>
      </Pressable>

      <BottomTabBar active="products" onSelect={(tab) => tab === 'settings' && onOpenSettings()} />
    </View>
  );
}
