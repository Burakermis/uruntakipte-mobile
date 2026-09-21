import React from 'react';
import { act, fireEvent, fireEventAsync, screen, waitFor } from '@testing-library/react-native';
import { PremiumScreen } from '../../src/screens/PremiumScreen';
import * as purchases from '../../src/purchases';
import { installFakeBackend, type FakeBackend } from '../../test-utils/fakeBackend';
import { renderScreen } from '../../test-utils/render';

// Satın alma katmanının kendi davranışı __tests__/services/purchases.test.ts'te;
// burada ekranın o katmanın sonuçlarına nasıl tepki verdiği test ediliyor.
jest.mock('../../src/purchases', () => ({
  isPurchasesAvailable: jest.fn(),
  getPremiumPackages: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
}));

const isAvailable = jest.mocked(purchases.isPurchasesAvailable);
const getPackages = jest.mocked(purchases.getPremiumPackages);
const purchase = jest.mocked(purchases.purchasePackage);
const restore = jest.mocked(purchases.restorePurchases);

const USER = 'test-device';
const callbacks = { onClose: jest.fn(), onOpenProducts: jest.fn(), onOpenSettings: jest.fn() };
let backend: FakeBackend;

function rcPackage(id: string, price: number, priceString: string, introPrice: any = null) {
  return { identifier: id, product: { price, priceString, introPrice } } as any;
}

const WEEKLY = rcPackage('$rc_weekly', 49.99, '₺49,99', {
  price: 0,
  priceString: '₺0,00',
  periodUnit: 'DAY',
  periodNumberOfUnits: 3,
});
const MONTHLY = rcPackage('$rc_monthly', 99.99, '₺99,99');
const ANNUAL = rcPackage('$rc_annual', 599.99, '₺599,99');

async function renderPremium() {
  return renderScreen(<PremiumScreen userId={USER} {...callbacks} />);
}

async function openPlans() {
  await fireEventAsync.press(screen.getByTestId('activate-premium-button'));
  await screen.findByText('Planını Seç');
}

const isSelected = (tier: 'weekly' | 'monthly' | 'annual') =>
  screen.getByTestId(`plan-${tier}`).props.accessibilityState.selected;
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || el.props.disabled === true;

beforeEach(() => {
  backend = installFakeBackend({ userId: USER });
  isAvailable.mockReturnValue(true);
  getPackages.mockResolvedValue({ weekly: WEEKLY, monthly: MONTHLY, annual: ANNUAL });
  purchase.mockResolvedValue({ success: true });
  restore.mockResolvedValue({ success: true });
});

describe('tanıtım adımı', () => {
  it('ücretsiz ve premium planın farkını (kontrol sıklığı, ürün sayısı) gösterir', async () => {
    await renderPremium();

    expect(screen.getByText("Premium'a Geç")).toBeTruthy();
    expect(screen.getByText('5 dk')).toBeTruthy();
    expect(screen.getByText('1 dk')).toBeTruthy();
    expect(screen.getByText('3 ürün')).toBeTruthy();
    expect(screen.getByText('Sınırsız')).toBeTruthy();
  });

  it('"Planları Gör" RevenueCat paketlerini yükleyip plan seçimine geçer', async () => {
    await renderPremium();
    await openPlans();

    expect(getPackages).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('plan-weekly')).toBeTruthy();
    expect(screen.getByTestId('plan-monthly')).toBeTruthy();
    expect(screen.getByTestId('plan-annual')).toBeTruthy();
  });

  it('paketler bağlantı yüzünden yüklenemezse "Bağlantı kurulamadı" der ve tanıtım adımında kalır', async () => {
    getPackages.mockRejectedValue(Object.assign(new Error('The network connection failed'), { code: '10' })); // RevenueCat NETWORK_ERROR
    await renderPremium();

    await fireEventAsync.press(screen.getByTestId('activate-premium-button'));

    expect(await screen.findByText('Planlar yüklenemedi')).toBeTruthy();
    expect(screen.getByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(screen.getByText("Premium'a Geç")).toBeTruthy();
  });

  it('paketler başka bir nedenle yüklenemezse ham İngilizce hata yerine anlaşılır bir metin gösterir', async () => {
    getPackages.mockRejectedValue(new Error('There was a problem with the store'));
    await renderPremium();

    await fireEventAsync.press(screen.getByTestId('activate-premium-button'));

    expect(await screen.findByText('Planlar şu an yüklenemiyor. Lütfen daha sonra tekrar dene.')).toBeTruthy();
    expect(screen.queryByText(/store/i)).toBeNull();
  });

  it('alt sekmeler: Ürünlerim ve Ayarlar\'a geçiş', async () => {
    await renderPremium();
    fireEvent.press(screen.getByText('Ürünlerim'));
    fireEvent.press(screen.getByText('Ayarlar'));
    expect(callbacks.onOpenProducts).toHaveBeenCalledTimes(1);
    expect(callbacks.onOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe('plan seçimi ve fiyat metinleri (RevenueCat\'in gerçek paket verisinden)', () => {
  it('varsayılan olarak AYLIK seçilidir; başka bir plana dokunmak seçimi taşır', async () => {
    await renderPremium();
    await openPlans();

    expect(isSelected('monthly')).toBe(true);
    expect(isSelected('annual')).toBe(false);

    fireEvent.press(screen.getByTestId('plan-annual'));
    expect(isSelected('annual')).toBe(true);
    expect(isSelected('monthly')).toBe(false);
  });

  it('aylık paket tanımlı değilse haftalığı, o da yoksa yıllığı varsayılan seçer', async () => {
    getPackages.mockResolvedValue({ weekly: null, monthly: null, annual: ANNUAL });
    await renderPremium();
    await openPlans();
    expect(isSelected('annual')).toBe(true);
    expect(screen.queryByTestId('plan-weekly')).toBeNull(); // tanımsız paket hiç gösterilmez
    expect(screen.queryByTestId('plan-monthly')).toBeNull();
  });

  it('ücretsiz denemeli haftalık plan: deneme süresi rozeti + deneme fiyatı, asıl fiyat üstü çizili', async () => {
    await renderPremium();
    await openPlans();

    expect(screen.getByText('3 gün ücretsiz deneme!')).toBeTruthy();
    expect(screen.getByText('₺0,00')).toBeTruthy();
    expect(screen.getByText('₺49,99')).toBeTruthy();
  });

  it('yıllık plan aylığa göre GERÇEK tasarruf yüzdesini hesaplar', async () => {
    await renderPremium();
    await openPlans();

    // 99,99 * 12 = 1199,88 → 599,99 ≈ %50 tasarruf
    expect(screen.getByText('Aylığa göre %50 tasarruf')).toBeTruthy();
    expect(screen.getByText('EN POPÜLER')).toBeTruthy();
    expect(screen.getByText('Her ay otomatik yenilenir')).toBeTruthy();
  });

  it('yıllık plan aylıktan ucuz DEĞİLSE uydurma tasarruf yüzdesi yazmaz', async () => {
    getPackages.mockResolvedValue({ weekly: null, monthly: rcPackage('m', 40, '₺40'), annual: rcPackage('a', 480, '₺480') });
    await renderPremium();
    await openPlans();

    expect(screen.getByText('En tasarruflu seçenek')).toBeTruthy();
    expect(screen.queryByText(/tasarruf$/)).toBeNull();
  });

  it('aylık paket yoksa yıllık için yüzde hesaplayamaz, genel etiketi gösterir', async () => {
    getPackages.mockResolvedValue({ weekly: null, monthly: null, annual: ANNUAL });
    await renderPremium();
    await openPlans();
    expect(screen.getByText('En tasarruflu seçenek')).toBeTruthy();
  });

  it('geri düğmesi tanıtıma döner, kapat düğmesi ekrandan çıkar', async () => {
    await renderPremium();
    await openPlans();

    fireEvent.press(screen.getByTestId('plans-back-button'));
    expect(screen.getByText("Premium'a Geç")).toBeTruthy();

    await openPlans();
    fireEvent.press(screen.getByTestId('plans-close-button'));
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('abone olma', () => {
  it('SEÇİLİ paketi satın alır, backend\'i RevenueCat doğrulamasıyla senkronlar ve kapanır', async () => {
    await renderPremium();
    await openPlans();
    fireEvent.press(screen.getByTestId('plan-annual'));

    await fireEventAsync.press(screen.getByTestId('subscribe-button'));

    expect(purchase).toHaveBeenCalledWith(ANNUAL);
    expect(backend.callsTo('POST /users/*').map((c) => c.path)).toEqual([`/users/${USER}/sync-premium`]);
    expect(await screen.findByText('Premium aktif')).toBeTruthy();
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });

  it('senkron adımı ağ hatasıyla düşse bile satın alma geçerlidir (webhook tamamlar) — kullanıcı hata görmez', async () => {
    backend.networkDown('POST /users/*');
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('subscribe-button'));

    expect(await screen.findByText('Premium aktif')).toBeTruthy();
    expect(screen.queryByText('Hata')).toBeNull();
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });

  it('kullanıcı ödemeyi iptal ederse hiçbir uyarı/senkron/kapanma olmaz ve tekrar denenebilir', async () => {
    purchase.mockResolvedValue({ success: false, cancelled: true });
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('subscribe-button'));

    expect(screen.queryByText('Satın alma tamamlanamadı')).toBeNull();
    expect(backend.calls).toHaveLength(0);
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(isDisabled(screen.getByTestId('subscribe-button'))).toBe(false);
  });

  it('satın alma başarısızsa mağazanın mesajını gösterir; mesaj yoksa genel metni; premium olarak işaretlemez', async () => {
    purchase.mockResolvedValue({ success: false, message: 'Ödeme yöntemi reddedildi.' });
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('subscribe-button'));
    expect(await screen.findByText('Ödeme yöntemi reddedildi.')).toBeTruthy();
    expect(callbacks.onClose).not.toHaveBeenCalled();
    expect(backend.calls).toHaveLength(0);
    fireEvent.press(screen.getByText('Tamam'));

    purchase.mockResolvedValue({ success: false });
    await fireEventAsync.press(screen.getByTestId('subscribe-button'));
    expect(await screen.findByText('Lütfen tekrar dene.')).toBeTruthy();
  });

  it('satın alma sürerken "Abone Ol" pasiftir (çift ödeme yok)', async () => {
    let finish!: (v: { success: boolean }) => void;
    purchase.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await renderPremium();
    await openPlans();

    await act(async () => {
      fireEvent.press(screen.getByTestId('subscribe-button'));
    });
    expect(isDisabled(screen.getByTestId('subscribe-button'))).toBe(true);
    await act(async () => {
      fireEvent.press(screen.getByTestId('subscribe-button'));
    });
    expect(purchase).toHaveBeenCalledTimes(1);

    await act(async () => finish({ success: true }));
    await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1));
  });
});

describe('satın alımları geri yükleme (mağaza zorunluluğu)', () => {
  it('aktif abonelik bulunursa backend\'i senkronlar, bilgi verir ve kapanır', async () => {
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('restore-purchases-button'));

    expect(await screen.findByText('Geri yüklendi')).toBeTruthy();
    expect(backend.callsTo('POST /users/*')[0].path).toBe(`/users/${USER}/sync-premium`);
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });

  it('abonelik bulunamazsa açıklayıcı uyarı verir ve kapanmaz', async () => {
    restore.mockResolvedValue({ success: false });
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('restore-purchases-button'));

    expect(await screen.findByText('Aktif abonelik bulunamadı')).toBeTruthy();
    expect(screen.getByText('Bu hesapla ilişkili bir abonelik bulunamadı.')).toBeTruthy();
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it('native satın alma yoksa (web/hesap kurulmamış) mağazaya hiç gitmeden "desteklenmiyor" der', async () => {
    isAvailable.mockReturnValue(false);
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('restore-purchases-button'));

    expect(await screen.findByText('Desteklenmiyor')).toBeTruthy();
    expect(restore).not.toHaveBeenCalled();
  });
});

describe('RevenueCat kurulu değilken (plan yok)', () => {
  beforeEach(() => {
    isAvailable.mockReturnValue(false);
    getPackages.mockResolvedValue({ weekly: null, monthly: null, annual: null });
  });

  it('boş durumu açıklar, "Abone Ol" pasif kalır; sessizce Ayarlar\'a atmaz', async () => {
    await renderPremium();
    await openPlans();

    expect(screen.getByText('Şu an satın alınabilir bir plan bulunamadı.')).toBeTruthy();
    expect(isDisabled(screen.getByTestId('subscribe-button'))).toBe(true);
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });

  it('geliştirme etkinleştirmesi kullanıcıyı backend\'de premium yapar ve kapanır', async () => {
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('dev-activate-button'));

    expect(await screen.findByText('Premium aktif')).toBeTruthy();
    expect(backend.callsTo('POST /users/*')[0]).toMatchObject({ path: `/users/${USER}/premium`, body: { isPremium: true } });
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
  });

  it('etkinleştirme başarısızsa hata verir ve ekranda kalır', async () => {
    backend.failWith('POST /users/*', 403, 'FORBIDDEN', 'Bu uç nokta üretimde kapalı.');
    await renderPremium();
    await openPlans();

    await fireEventAsync.press(screen.getByTestId('dev-activate-button'));

    expect(await screen.findByText('Bu uç nokta üretimde kapalı.')).toBeTruthy();
    expect(callbacks.onClose).not.toHaveBeenCalled();
  });
});
