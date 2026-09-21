import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { setPremium, syncPremiumStatus } from '../api';
import { BottomTabBar } from '../components/BottomTabBar';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { IconCircle } from '../components/IconCircle';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { showAlert } from '../dialog/dialogStore';
import {
  getPremiumPackages,
  isPurchasesAvailable,
  purchasePackage,
  restorePurchases,
} from '../purchases';
import type { PremiumPackages } from '../purchases';
import { describeError, describePurchaseError } from '../utils/errors';
import { useTheme } from '../theme/ThemeProvider';
import type { ColorTokens } from '../theme';
import { makeStyles } from './PremiumScreen.styles';

interface PremiumScreenProps {
  userId: string;
  onClose: () => void;
  onOpenProducts: () => void;
  onOpenSettings: () => void;
}

type Step = 'intro' | 'plans';
type PlanTier = 'weekly' | 'monthly' | 'annual';

const PLAN_ORDER: PlanTier[] = ['weekly', 'monthly', 'annual'];
const PLAN_TITLE: Record<PlanTier, string> = {
  weekly: 'Haftalık',
  monthly: 'Aylık',
  annual: 'Yıllık',
};
const PERIOD_UNIT_LABEL: Record<string, string> = {
  DAY: 'gün',
  WEEK: 'hafta',
  MONTH: 'ay',
  YEAR: 'yıl',
};

interface PlanMeta {
  badge?: string;
  badgeHighlight: boolean;
  subtitle?: string;
  priceString: string;
  originalPriceString?: string;
}

// Fiyat/deneme metinleri RevenueCat'ten gelen GERÇEK paket verisinden
// türetiliyor — hiçbir yerde sabit "₺X" yazmıyoruz, dashboard'da tanımlı
// olmayan bir değer olduğu gibi (undefined) bırakılıyor.
function getPlanMeta(tier: PlanTier, pkg: PurchasesPackage, monthlyPkg: PurchasesPackage | null): PlanMeta {
  const { product } = pkg;
  const intro = product.introPrice;
  const isFreeTrial = !!intro && intro.price === 0;

  if (tier === 'weekly') {
    if (isFreeTrial) {
      const unit = PERIOD_UNIT_LABEL[intro!.periodUnit] ?? intro!.periodUnit.toLowerCase();
      return {
        badge: `${intro!.periodNumberOfUnits} ${unit} ücretsiz deneme!`,
        badgeHighlight: true,
        priceString: intro!.priceString,
        originalPriceString: product.priceString,
      };
    }
    return { badgeHighlight: false, priceString: product.priceString };
  }

  if (tier === 'monthly') {
    return {
      badge: 'EN POPÜLER',
      badgeHighlight: false,
      subtitle: 'Her ay otomatik yenilenir',
      priceString: product.priceString,
    };
  }

  // annual — mümkünse aylığa göre gerçek tasarruf yüzdesini hesaplıyoruz,
  // aylık paket yoksa (dashboard'da tanımlı değilse) genel bir etiketle
  // yetiniyoruz.
  let subtitle = 'En tasarruflu seçenek';
  if (monthlyPkg) {
    const annualEquivalentOfMonthly = monthlyPkg.product.price * 12;
    if (annualEquivalentOfMonthly > 0) {
      const savings = Math.round((1 - product.price / annualEquivalentOfMonthly) * 100);
      if (savings > 0) subtitle = `Aylığa göre %${savings} tasarruf`;
    }
  }
  return { badgeHighlight: false, subtitle, priceString: product.priceString };
}

interface ComparisonRowProps {
  feature: string;
  free: string | 'check' | 'cancel';
  premium: string | 'check';
  styles: ReturnType<typeof makeStyles>;
  colors: ColorTokens;
}

function ComparisonRow({ feature, free, premium, styles, colors }: ComparisonRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowFeature}>{feature}</Text>
      <View style={styles.rowCellFree}>
        {free === 'check' ? (
          <Icon name="check_circle" size={20} color={colors.primary} />
        ) : free === 'cancel' ? (
          <Icon name="cancel" size={20} color={colors.outlineVariant} />
        ) : (
          <Text style={styles.mono}>{free}</Text>
        )}
      </View>
      <View style={styles.rowCellPremium}>
        {premium === 'check' ? (
          <Icon name="check_circle" size={20} color={colors.primary} />
        ) : (
          <View style={styles.premiumPill}>
            <Text style={styles.premiumPillText}>{premium}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function PremiumScreen({ userId, onClose, onOpenProducts, onOpenSettings }: PremiumScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState<Step>('intro');
  const [activating, setActivating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [packages, setPackages] = useState<PremiumPackages | null>(null);
  const [selectedTier, setSelectedTier] = useState<PlanTier>('monthly');

  // "Planları Gör" HER ZAMAN "Planını Seç" adımına geçer — asla sessizce
  // dev-toggle'a düşüp ekranı kapatmaz (önceki bir sürümde isPurchasesAvailable()
  // false olduğunda — web'de ya da RevenueCat hesabı henüz kurulmamış native'de
  // — böyle yapıyordu; kullanıcı butona basıp hiçbir şey görmeden Ayarlar'a
  // geri dönüyordu). getPremiumPackages() zaten isPurchasesAvailable() değilse
  // güvenle boş obje döner (bkz. src/purchases.ts) — bu durumda "Planını Seç"
  // ekranı kendi boş durumunu (hasAnyPlan) gösterir, ORADA da geliştirme
  // modunda etkinleştirme seçeneği sunulur.
  async function handleSeePlans() {
    setLoadingPlans(true);
    try {
      const pkgs = await getPremiumPackages();
      setPackages(pkgs);
      setSelectedTier(pkgs.monthly ? 'monthly' : pkgs.weekly ? 'weekly' : 'annual');
      setStep('plans');
    } catch (e) {
      showAlert('Planlar yüklenemedi', describePurchaseError(e, 'Planlar şu an yüklenemiyor. Lütfen daha sonra tekrar dene.'));
    } finally {
      setLoadingPlans(false);
    }
  }

  async function handleDevActivate() {
    setActivating(true);
    try {
      await setPremium(userId, true);
      showAlert('Premium aktif', 'Artık sınırsız ürün takip edebilir, 1 dakikada bir kontrol alabilirsin.');
      onClose();
    } catch (e) {
      showAlert('Premium aktifleştirilemedi', describeError(e, 'Premium aktifleştirilemedi. Lütfen daha sonra tekrar dene.'));
    } finally {
      setActivating(false);
    }
  }

  // Seçili paketi satın alır — RevenueCat/Apple/Google satın almayı zaten
  // doğrulamış oluyor, backend'i buna göre senkronluyoruz (syncPremiumStatus,
  // istemcinin beyanına değil RevenueCat'in sunucu API'sine dayanır). Bu
  // senkron adımı başarısız olsa bile satın alma GEÇERLİ (webhook birkaç
  // saniye içinde zaten aynı senkronu yapacak) — o yüzden ayrı, sessiz catch.
  async function handleSubscribe() {
    const pkg = packages?.[selectedTier];
    if (!pkg) return;
    setActivating(true);
    try {
      const result = await purchasePackage(pkg);
      if (result.cancelled) return;
      if (!result.success) {
        showAlert('Satın alma tamamlanamadı', result.message ?? 'Lütfen tekrar dene.');
        return;
      }
      try {
        await syncPremiumStatus(userId);
      } catch {
        // yut — webhook zaten arkadan senkronlayacak
      }
      showAlert('Premium aktif', 'Artık sınırsız ürün takip edebilir, 1 dakikada bir kontrol alabilirsin.');
      onClose();
    } catch (e) {
      showAlert('Abonelik tamamlanamadı', describeError(e, 'Abonelik tamamlanamadı. Lütfen daha sonra tekrar dene.'));
    } finally {
      setActivating(false);
    }
  }

  // App Store/Play Store'un zorunlu kıldığı akış: uygulama silinip yeniden
  // yüklenince deviceId sıfırlanır (bkz. Faz 3) — bu, Apple/Google
  // hesabındaki gerçek aboneliği bulup yeni deviceId'ye yeniden bağlar.
  async function handleRestorePurchases() {
    if (!isPurchasesAvailable()) {
      showAlert('Desteklenmiyor', 'Satın alımları geri yükleme native uygulamada kullanılabilir.');
      return;
    }
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (!result.success) {
        showAlert('Aktif abonelik bulunamadı', result.message ?? 'Bu hesapla ilişkili bir abonelik bulunamadı.');
        return;
      }
      try {
        await syncPremiumStatus(userId);
      } catch {
        // yut — webhook zaten arkadan senkronlayacak
      }
      showAlert('Geri yüklendi', 'Premium aboneliğin bu cihaza yeniden bağlandı.');
      onClose();
    } catch (e) {
      showAlert('Satın alımlar geri yüklenemedi', describeError(e, 'Satın alımlar geri yüklenemedi. Lütfen daha sonra tekrar dene.'));
    } finally {
      setRestoring(false);
    }
  }

  if (step === 'plans') {
    const hasAnyPlan = !!(packages?.weekly || packages?.monthly || packages?.annual);

    return (
      <View style={styles.container}>
        <Header
          left={
            <Pressable
              onPress={() => setStep('intro')}
              accessibilityLabel="Geri"
              hitSlop={10}
              style={styles.headerIconButton}
              testID="plans-back-button"
            >
              <Icon name="chevron_left" size={24} color={colors.onSurface} />
            </Pressable>
          }
          right={
            <Pressable
              onPress={onClose}
              accessibilityLabel="Kapat"
              hitSlop={10}
              style={styles.headerIconButton}
              testID="plans-close-button"
            >
              <Icon name="close" size={24} color={colors.onSurface} />
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={styles.plansScrollContent}>
          <View style={styles.plansHero}>
            <Text style={styles.plansTitle}>Planını Seç</Text>
            <Text style={styles.plansSubtitle}>İstediğin zaman iptal edebilirsin.</Text>
          </View>

          {hasAnyPlan ? (
            <View style={styles.planList}>
              {PLAN_ORDER.map((tier) => {
                const pkg = packages?.[tier];
                if (!pkg) return null;
                const meta = getPlanMeta(tier, pkg, packages?.monthly ?? null);
                const selected = selectedTier === tier;
                return (
                  <Pressable
                    key={tier}
                    onPress={() => setSelectedTier(tier)}
                    style={[styles.planCard, selected && styles.planCardSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    testID={`plan-${tier}`}
                  >
                    <Icon
                      name={selected ? 'radio_checked' : 'radio_unchecked'}
                      size={22}
                      color={selected ? colors.primary : colors.outlineVariant}
                    />
                    <View style={styles.planCardBody}>
                      <View style={styles.planCardTitleRow}>
                        <Text style={styles.planCardTitle}>{PLAN_TITLE[tier]}</Text>
                        {meta.badge ? (
                          <View style={[styles.planBadge, meta.badgeHighlight && styles.planBadgeHighlight]}>
                            <Text style={[styles.planBadgeText, meta.badgeHighlight && styles.planBadgeTextHighlight]}>
                              {meta.badge}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {meta.subtitle ? <Text style={styles.planCardSubtitle}>{meta.subtitle}</Text> : null}
                    </View>
                    <View style={styles.planCardPriceWrap}>
                      <Text style={styles.planCardPrice}>{meta.priceString}</Text>
                      {meta.originalPriceString ? (
                        <Text style={styles.planCardOriginalPrice}>{meta.originalPriceString}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.plansEmpty}>
              <Text style={styles.plansEmptyText}>
                {loadingPlans ? 'Planlar yükleniyor…' : 'Şu an satın alınabilir bir plan bulunamadı.'}
              </Text>
              {!loadingPlans ? (
                // RevenueCat henüz kurulmadıysa (hesap yok / web önizleme)
                // gösterecek gerçek bir paket yok — test/demo amaçlı, ayrı ve
                // AÇIKÇA ikincil bir yol olarak burada bırakılıyor (bkz.
                // handleDevActivate; gerçek satın alma akışını hiç etkilemiyor).
                <Pressable onPress={handleDevActivate} disabled={activating} testID="dev-activate-button">
                  <Text style={styles.plansDevActivateText}>
                    {activating ? 'Etkinleştiriliyor…' : 'Geliştirme modunda etkinleştir'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.planFeatureRow}>
            <View style={styles.planFeature}>
              <Icon name="timer" size={22} color={colors.primary} />
              <Text style={styles.planFeatureText}>1dk kontrol</Text>
            </View>
            <View style={styles.planFeature}>
              <Icon name="all_inclusive" size={22} color={colors.primary} />
              <Text style={styles.planFeatureText}>Sınırsız takip</Text>
            </View>
            <View style={styles.planFeature}>
              <Icon name="bolt" size={22} color={colors.primary} />
              <Text style={styles.planFeatureText}>Sınırsız hak</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            title="Abone Ol"
            onPress={handleSubscribe}
            loading={activating}
            disabled={!packages?.[selectedTier]}
            shape="rect"
            testID="subscribe-button"
          />
          <Pressable
            style={styles.restoreLink}
            onPress={handleRestorePurchases}
            disabled={restoring}
            testID="restore-purchases-button"
          >
            <Text style={styles.restoreLinkText}>
              {restoring ? 'Geri yükleniyor…' : 'Satın Alımları Geri Yükle'}
            </Text>
          </Pressable>
          <Text style={styles.plansDisclaimer}>
            Abonelik otomatik olarak yenilenir. İstediğin zaman iptal edebilirsin.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Premium" icon="workspace_premium" onClose={onClose} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <IconCircle
            name="shopping_bag"
            size={64}
            backgroundColor={colors.surfaceContainerLow}
            iconColor={colors.primary}
          />
          <Text style={styles.heroTitle}>Premium'a Geç</Text>
          <Text style={styles.heroSubtitle}>
            Dakikada bir kontrol, sınırsız takip — fırsatları kaçırma!
          </Text>
          <View style={styles.badge}>
            <Icon name="bolt" size={18} color={colors.statusWarning} />
            <Text style={styles.badgeText}>500+ KULLANICI STOK TAKİBİ YAPIYOR</Text>
          </View>
        </View>

        <Card>
          <View style={styles.tableHeader}>
            <Text style={styles.rowFeature} />
            <Text style={[styles.columnHeader, styles.rowCellFree]}>ÜCRETSİZ</Text>
            <Text style={[styles.columnHeader, styles.rowCellPremium, styles.columnHeaderPremium]}>
              PREMIUM
            </Text>
          </View>

          <ComparisonRow styles={styles} colors={colors} feature="Kontrol sıklığı" free="5 dk" premium="1 dk" />
          <ComparisonRow styles={styles} colors={colors} feature="Ürün takibi" free="3 ürün" premium="Sınırsız" />
          <ComparisonRow styles={styles} colors={colors} feature="Fiyat bildirimi" free="check" premium="check" />
          <ComparisonRow styles={styles} colors={colors} feature="Stok bildirimi" free="check" premium="check" />
          <ComparisonRow styles={styles} colors={colors} feature="Bekleme süresi yok" free="cancel" premium="check" />
          <ComparisonRow styles={styles} colors={colors} feature="Sınırsız takip" free="cancel" premium="check" />
        </Card>

        <Card>
          <View style={styles.featureRow}>
            <Icon name="speed" size={20} color={colors.statusWarning} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>5x daha hızlı kontrol</Text>
              <Text style={styles.featureSubtitle}>
                Ürünlerin dakikada bir kontrol edilir — ücretsizde 5 dakikada bir.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          title="Planları Gör"
          onPress={handleSeePlans}
          loading={loadingPlans || activating}
          shape="rect"
          testID="activate-premium-button"
        />
      </View>

      <BottomTabBar active="settings" onSelect={(tab) => (tab === 'products' ? onOpenProducts() : onOpenSettings())} />
    </View>
  );
}
