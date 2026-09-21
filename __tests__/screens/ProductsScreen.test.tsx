import React from 'react';
import { act, fireEvent, fireEventAsync, screen, waitFor, within } from '@testing-library/react-native';
import { ActivityIndicator, ScrollView } from 'react-native';
import { ProductsScreen } from '../../src/screens/ProductsScreen';
import { installFakeBackend, type FakeBackend } from '../../test-utils/fakeBackend';
import { MANGO_URL, resolvedProduct, trackedProduct, ZARA_URL } from '../../test-utils/fixtures';
import { renderScreen } from '../../test-utils/render';

const USER = 'test-device';

// Aynı ürünün iki bedeni (Beyaz S, Beyaz M) + ikinci bir ürün (Mango).
const ZARA_S = trackedProduct({ id: 1, size: 'S', sku: 'beyaz:sku-s', priceChangePercent: -15 });
const ZARA_M = trackedProduct({ id: 2, size: 'M', sku: 'beyaz:sku-m' });
const MANGO = trackedProduct({
  id: 3,
  brand: 'mango',
  productId: '17021231',
  name: 'Keten Elbise',
  canonicalUrl: MANGO_URL,
  color: 'Ekru',
  size: '38',
  sku: 'ekru:sku-38',
  lastPrice: 2499,
  lastAvailability: 'out_of_stock',
});

// Ücretsiz limit ÜRÜN bazında (aynı ürünün bedenleri tek slot) — dolu plan için 3 farklı ürün.
const THIRD = trackedProduct({ id: 4, name: 'Poplin Gömlek', canonicalUrl: 'https://x.com/poplin', sku: 'poplin:s', size: 'S' });
const FULL_PLAN = [ZARA_S, ZARA_M, MANGO, THIRD];

let backend: FakeBackend;
const callbacks = { onAddProduct: jest.fn(), onOpenPremium: jest.fn(), onOpenSettings: jest.fn() };

async function renderProducts(refreshToken = 0) {
  return renderScreen(<ProductsScreen userId={USER} refreshToken={refreshToken} {...callbacks} />);
}

function cards() {
  return screen.queryAllByTestId('product-card');
}

async function confirmDialog(button: 'Onayla' | 'Vazgeç') {
  await fireEventAsync.press(await screen.findByText(button));
}

beforeEach(() => {
  backend = installFakeBackend({
    userId: USER,
    products: [ZARA_S, ZARA_M, MANGO],
    catalog: [resolvedProduct(), resolvedProduct({ brand: 'mango', name: 'Keten Elbise', canonicalUrl: MANGO_URL })],
  });
});

describe('liste yükleme', () => {
  it('yüklenirken "ürün yok" boş durumunu göstermez, sonra ürünleri listeler', async () => {
    const pending = backend.hold('GET /products');

    await renderProducts();
    await pending.arrival;
    expect(screen.queryByText('Henüz ürün eklemediniz')).toBeNull();
    expect(cards()).toHaveLength(0);

    await act(async () => pending.release());
    await waitFor(() => expect(cards()).toHaveLength(2));
  });

  it('aynı ürünün bedenlerini tek kartta toplar; birden fazla renk varsa rozette renk adını da yazar', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));

    const [zara, mango] = cards();
    // Tek renk (Beyaz) → sadece beden
    expect(within(zara).getByText('S')).toBeTruthy();
    expect(within(zara).getByText('M')).toBeTruthy();
    expect(within(zara).getByText('Oversize Gömlek')).toBeTruthy();
    expect(within(zara).getByText('15%')).toBeTruthy(); // fiyat düşüşü rozeti (mutlak değer)
    expect(within(mango).getByText('38')).toBeTruthy();
    expect(within(mango).getByText('2.499,00 TL')).toBeTruthy();
  });

  it('aynı üründe iki farklı renk takip ediliyorsa rozetler renk + beden yazar', async () => {
    backend = installFakeBackend({
      userId: USER,
      products: [ZARA_S, trackedProduct({ id: 9, color: 'Siyah', size: 'S', sku: 'siyah:sku-s' })],
    });
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(1));

    expect(within(cards()[0]).getByText('Beyaz S')).toBeTruthy();
    expect(within(cards()[0]).getByText('Siyah S')).toBeTruthy();
  });

  it('hiç takip yoksa nasıl ürün ekleneceğini adım adım anlatır', async () => {
    backend = installFakeBackend({ userId: USER, products: [] });
    await renderProducts();

    expect(await screen.findByText('Henüz ürün eklemediniz')).toBeTruthy();
    expect(screen.getByText('Nasıl ürün eklerim?')).toBeTruthy();
    expect(screen.getByText(/Paylaş butonuna basın/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('ücretsiz kullanıcıya kullanım rozeti (2/3 ürün) gösterir; premium\'da göstermez', async () => {
    backend = installFakeBackend({ userId: USER, products: [ZARA_S, MANGO] });
    await renderProducts();
    expect(await screen.findByText('2/3 ürün')).toBeTruthy();
  });

  it('premium kullanıcıda kullanım rozeti ve bekleme banner\'ı görünmez', async () => {
    backend = installFakeBackend({
      userId: USER,
      products: [ZARA_S, MANGO],
      limits: { isPremium: true, cooldownRemainingMs: 3_600_000 },
    });
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));

    expect(screen.queryByTestId('usage-badge')).toBeNull();
    expect(screen.queryByTestId('cooldown-banner')).toBeNull();
  });

  it('yalnızca limit isteği düşerse liste yine gösterilir (limit rozeti olmadan) ve veri eksik olduğu için uyarı çıkar', async () => {
    backend.networkDown('GET /users/*');
    await renderProducts();

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByTestId('usage-badge')).toBeNull();
    expect(screen.getByTestId('connection-banner')).toBeTruthy();
  });

  it('refreshToken değişince (yeni ürün eklendikten sonra) listeyi yeniden çeker', async () => {
    const { rerenderAsync } = await renderProducts(0);
    await waitFor(() => expect(cards()).toHaveLength(2));

    backend.products.push(trackedProduct({ id: 50, name: 'Yeni Ürün', canonicalUrl: 'https://x.com/yeni', sku: 'y' }));
    await rerenderAsync(<ProductsScreen userId={USER} refreshToken={1} {...callbacks} />);

    await waitFor(() => expect(cards()).toHaveLength(3));
  });
});

describe('bağlantı hatası uyarısı (veriler doğru gelene kadar görünür, gelince kaybolur)', () => {
  it('bağlantı sağlıklıyken uyarı görünmez', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByTestId('connection-banner')).toBeNull();
  });

  it('ilk yüklemede sunucuya ulaşılamazsa "ürün yok" YERİNE uyarı gösterilir; "Tekrar dene" bağlantı gelince listeyi getirir ve uyarıyı kaldırır', async () => {
    backend.networkDown('GET /products');
    backend.networkDown('GET /users/*');

    await renderProducts();

    expect(await screen.findByTestId('connection-banner')).toBeTruthy();
    expect(screen.getByText(/güncel hali yüklenemedi/)).toBeTruthy();
    expect(screen.queryByText('Henüz ürün eklemediniz')).toBeNull(); // ürünleri yokmuş gibi gösterme
    expect(cards()).toHaveLength(0);

    await fireEventAsync.press(screen.getByTestId('connection-retry-button'));

    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByTestId('connection-banner')).toBeNull();
    expect(await screen.findByText('2/3 ürün')).toBeTruthy(); // limitler de geldi
  });

  it('"Tekrar dene" bağlantı hâlâ yoksa uyarıyı korur ve düğme yeniden denenebilir kalır', async () => {
    backend.networkDown('GET /products', { times: 2 });
    await renderProducts();
    await screen.findByTestId('connection-banner');

    await fireEventAsync.press(screen.getByTestId('connection-retry-button')); // 2. başarısız deneme

    expect(screen.getByTestId('connection-banner')).toBeTruthy();
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
    expect(cards()).toHaveLength(0);
  });

  describe('otomatik yeniden deneme', () => {
    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('uyarı görünürken veri 10 sn\'de bir arka planda yenilenir; bağlantı gelince uyarı kullanıcı bir şey yapmadan kaybolur', async () => {
      backend.networkDown('GET /products', { times: 2 }); // açılış + ilk otomatik deneme başarısız
      await renderProducts();
      await screen.findByTestId('connection-banner');
      expect(backend.callsTo('GET /products')).toHaveLength(1);

      await act(async () => {
        jest.advanceTimersByTime(9_999);
      });
      expect(backend.callsTo('GET /products')).toHaveLength(1); // henüz zamanı gelmedi

      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      await waitFor(() => expect(backend.callsTo('GET /products')).toHaveLength(2));
      expect(screen.getByTestId('connection-banner')).toBeTruthy(); // 2. deneme de düştü → uyarı sürüyor

      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      await waitFor(() => expect(cards()).toHaveLength(2)); // 3. deneme başarılı
      expect(screen.queryByTestId('connection-banner')).toBeNull();
      expect(jest.getTimerCount()).toBe(0); // veri geldi: yeniden deneme döngüsü durdu
    });
  });
});

describe('arama', () => {
  async function openSearch() {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    fireEvent.press(screen.getByTestId('toggle-search-button'));
    return screen.getByTestId('search-input');
  }

  it('ürün adına ve marka adına göre, büyük/küçük harf duyarsız filtreler', async () => {
    const input = await openSearch();

    fireEvent.changeText(input, 'keten');
    expect(cards()).toHaveLength(1);
    expect(within(cards()[0]).getByText('Keten Elbise')).toBeTruthy();

    fireEvent.changeText(input, 'ZARA'); // marka adı
    expect(cards()).toHaveLength(1);
    expect(within(cards()[0]).getByText('Oversize Gömlek')).toBeTruthy();
  });

  it('Türkçe harflerle doğru eşleşir ("Işıklı" aranırken noktalı/noktasız i karışmaz)', async () => {
    backend = installFakeBackend({
      userId: USER,
      products: [trackedProduct({ id: 7, name: 'Işıklı Elbise', canonicalUrl: 'https://x.com/isikli', sku: 'i' })],
    });
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(1));

    fireEvent.press(screen.getByTestId('toggle-search-button'));
    fireEvent.changeText(screen.getByTestId('search-input'), 'ışıklı');
    expect(cards()).toHaveLength(1);
    fireEvent.changeText(screen.getByTestId('search-input'), 'IŞIKLI');
    expect(cards()).toHaveLength(1);
  });

  it('eşleşme yoksa aranan ifadeyle "Sonuç bulunamadı" der; aramayı kapatınca liste eski haline döner', async () => {
    const input = await openSearch();

    fireEvent.changeText(input, 'pantolon');
    expect(screen.getByText('Sonuç bulunamadı')).toBeTruthy();
    expect(screen.getByText('"pantolon" ile eşleşen bir ürün yok.')).toBeTruthy();
    // Arama sonucu yokken "hiç ürün eklemediniz" denmemeli — ürünler duruyor.
    expect(screen.queryByText('Henüz ürün eklemediniz')).toBeNull();

    fireEvent.press(screen.getByTestId('toggle-search-button')); // kapat
    expect(screen.queryByTestId('search-bar')).toBeNull();
    expect(cards()).toHaveLength(2);
  });
});

describe('takipten çıkarma', () => {
  it('onay diyaloğu kaç beden silineceğini söyler; "Vazgeç" hiçbir şeyi silmez', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));

    fireEvent.press(within(cards()[0]).getByLabelText('Tüm bedenleri takipten çıkar'));

    expect(await screen.findByText('Takipten çıkar')).toBeTruthy();
    expect(screen.getByText('Oversize Gömlek takibi (2 beden) bırakılsın mı?')).toBeTruthy();

    await confirmDialog('Vazgeç');

    expect(cards()).toHaveLength(2);
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(0);
  });

  it('onaylanınca kart ANINDA kalkar (iyimser), her beden sunucudan silinir ve kullanım rozeti güncellenir', async () => {
    backend = installFakeBackend({ userId: USER, products: FULL_PLAN });
    await renderProducts();
    expect(await screen.findByText('3/3 ürün')).toBeTruthy();
    const pendingDelete = backend.hold('DELETE /products/1');

    fireEvent.press(within(cards()[0]).getByLabelText('Tüm bedenleri takipten çıkar'));
    await confirmDialog('Onayla');

    // Sunucu daha yanıt vermeden kart gitmiş olmalı
    await waitFor(() => expect(cards()).toHaveLength(2)); // 3 karttan biri gitti
    await pendingDelete.arrival;
    await act(async () => pendingDelete.release());

    await waitFor(() => expect(backend.callsTo('DELETE /products/*')).toHaveLength(2));
    expect(backend.callsTo('DELETE /products/*').map((c) => c.path).sort()).toEqual(['/products/1', '/products/2']);
    // Her silme isteği kimliği userId ile birlikte yolluyor (başkasının kaydı silinemesin)
    expect(backend.callsTo('DELETE /products/*').every((c) => c.query.get('userId') === USER)).toBe(true);
    await waitFor(() => expect(screen.getByText('2/3 ürün')).toBeTruthy());
  });

  it('bağlantı yoksa silinemez: kartı geri getirir ve NEDENİNİ ("Bağlantı kurulamadı…") söyler', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.networkDown('DELETE /products/*', { times: 3 }); // ilk deneme + 2 sessiz yeniden deneme

    fireEvent.press(within(cards()[1]).getByLabelText('Tüm bedenleri takipten çıkar')); // Mango
    await confirmDialog('Onayla');

    expect(await screen.findByText('Takipten çıkarılamadı')).toBeTruthy();
    expect(screen.getByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(3);
    expect(cards()).toHaveLength(2);
    expect(within(cards()[1]).getByText('Keten Elbise')).toBeTruthy();
  });

  it('tek seferlik ağ kesintisi kullanıcıya yansımaz: silme sessizce yeniden denenir', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.networkDown('DELETE /products/*');

    fireEvent.press(within(cards()[1]).getByLabelText('Tüm bedenleri takipten çıkar')); // Mango
    await confirmDialog('Onayla');

    await waitFor(() => expect(backend.products.map((p) => p.id)).toEqual([1, 2])); // yeniden deneme sunucuda tamamlandı
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(2);
    expect(cards()).toHaveLength(1);
    expect(screen.queryByText('Takipten çıkarılamadı')).toBeNull();
  });

  it('kayıt zaten silinmişse (404) başarı sayılır — kart gider, hata gösterilmez', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.failWith('DELETE /products/*', 404, 'NOT_FOUND', 'Takip kaydı bulunamadı.');

    fireEvent.press(within(cards()[1]).getByLabelText('Tüm bedenleri takipten çıkar'));
    await confirmDialog('Onayla');

    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(screen.queryByText('Takipten çıkarılamadı')).toBeNull();
  });

  it('çok bedenli üründe KISMEN silinirse: silinenler gider, silinemeyen beden kartta kalır ve ne olduğu söylenir', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.networkDown('DELETE /products/2', { times: 3 }); // M bedeni silinemiyor, S (id 1) siliniyor

    fireEvent.press(within(cards()[0]).getByLabelText('Tüm bedenleri takipten çıkar'));
    await confirmDialog('Onayla');

    expect(await screen.findByText('Kısmen çıkarıldı')).toBeTruthy();
    expect(screen.getByText('1 beden takipten çıkarıldı, 1 beden çıkarılamadı. Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    // Sunucuyla eşitlendi: yalnızca M kaldı
    await waitFor(() => expect(within(cards()[0]).queryByText('S')).toBeNull());
    expect(within(cards()[0]).getByText('M')).toBeTruthy();
    expect(backend.products.map((p) => p.id)).toEqual([2, 3]);
  });
});

describe('"Ürün Ekle" kapısı (ücretsiz plan kuralları)', () => {
  it('limit dolmadıysa doğrudan ekleme akışına geçer', async () => {
    backend = installFakeBackend({ userId: USER, products: [MANGO] });
    await renderProducts();
    await screen.findByText('1/3 ürün');

    fireEvent.press(screen.getByTestId('add-product-button'));

    expect(callbacks.onAddProduct).toHaveBeenCalledTimes(1);
  });

  it('ücretsiz limit doluysa uyarır ve Premium\'a yönlendirir, ekleme akışını açmaz', async () => {
    backend = installFakeBackend({ userId: USER, products: FULL_PLAN });
    await renderProducts(); // 3/3
    await screen.findByText('3/3 ürün');

    fireEvent.press(screen.getByTestId('add-product-button'));

    expect(await screen.findByText('Ürün limiti doldu')).toBeTruthy();
    expect(screen.getByText(/en fazla 3 ürün takip edebilirsin/)).toBeTruthy();
    expect(callbacks.onAddProduct).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Premium'a Bak"));
    expect(callbacks.onOpenPremium).toHaveBeenCalledTimes(1);
    expect(callbacks.onAddProduct).not.toHaveBeenCalled();
  });

  it('limit uyarısında "İptal" hiçbir yere gitmez', async () => {
    backend = installFakeBackend({ userId: USER, products: FULL_PLAN });
    await renderProducts();
    await screen.findByText('3/3 ürün');

    fireEvent.press(screen.getByTestId('add-product-button'));
    fireEvent.press(await screen.findByText('İptal'));

    expect(callbacks.onOpenPremium).not.toHaveBeenCalled();
    expect(callbacks.onAddProduct).not.toHaveBeenCalled();
    expect(screen.queryByText('Ürün limiti doldu')).toBeNull();
  });

  it('premium kullanıcı ücretsiz limiti aşan sayıda ürünle de ekleyebilir', async () => {
    backend = installFakeBackend({
      userId: USER,
      products: Array.from({ length: 6 }, (_, i) =>
        trackedProduct({ id: i + 1, name: `Ürün ${i + 1}`, canonicalUrl: `https://x.com/${i}`, sku: `s${i}` })
      ),
      limits: { isPremium: true },
    });
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(6));

    fireEvent.press(screen.getByTestId('add-product-button'));

    expect(callbacks.onAddProduct).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ürün limiti doldu')).toBeNull();
  });
});

describe('bekleme süresi (silinen ürünün yerine yeni ürün ekleme kısıtı)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('banner geri sayımı saniyede bir azaltır; bitince banner kalkar ve ekleme yeniden açılır', async () => {
    backend = installFakeBackend({ userId: USER, products: [MANGO], limits: { cooldownRemainingMs: 3_000 } });
    await renderProducts();

    expect(await screen.findByText('00:00:03')).toBeTruthy();
    expect(screen.getByTestId('cooldown-banner')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('00:00:02')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('cooldown-banner')).toBeNull();

    fireEvent.press(screen.getByTestId('add-product-button'));
    expect(callbacks.onAddProduct).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0); // interval kendini durdurmuş olmalı
  });

  it('bekleme sürerken "Ürün Ekle" ve banner butonu diyalog açmadan doğrudan Premium\'a götürür', async () => {
    backend = installFakeBackend({ userId: USER, products: [MANGO], limits: { cooldownRemainingMs: 3_600_000 } });
    await renderProducts();
    await screen.findByText('01:00:00');

    fireEvent.press(screen.getByTestId('add-product-button'));
    expect(callbacks.onOpenPremium).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText('Beklemeden ekle — Premium ol'));
    expect(callbacks.onOpenPremium).toHaveBeenCalledTimes(2);

    expect(callbacks.onAddProduct).not.toHaveBeenCalled();
    expect(screen.queryByText('Ürün limiti doldu')).toBeNull();
  });
});

describe('aşağı çekip yenileme', () => {
  it('görünen HER ürünü hemen yeniden kontrol ettirir (bedenleri için ayrı ayrı değil, ürün başına TEK istek), sonra listeyi tazeler', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.calls.length = 0;
    // Yenileme sırasında backend fiyatı düşürüyor
    backend.products[2] = { ...backend.products[2], lastPrice: 1999 };

    const scroll = screen.UNSAFE_getByType(ScrollView);
    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });

    // Zara'nın iki bedeni (id 1, 2) tek kontrol; Mango (id 3) tek kontrol
    expect(backend.callsTo('POST /products/*').map((c) => c.path).sort()).toEqual(['/products/1/check-now', '/products/3/check-now']);
    expect(backend.callsTo('GET /products')).toHaveLength(1);
    expect(await screen.findByText('1.999,00 TL')).toBeTruthy();
  });

  it('yenileme sırasında liste isteği ağ hatasına düşerse ekrandaki liste SİLİNMEZ, "Bağlantı kurulamadı" uyarısı çıkar; sonraki başarılı yenileme uyarıyı kaldırır', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    expect(screen.queryByTestId('connection-banner')).toBeNull();
    backend.networkDown('GET /products');

    const scroll = screen.UNSAFE_getByType(ScrollView);
    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });

    expect(cards()).toHaveLength(2);
    expect(screen.queryByText('Henüz ürün eklemediniz')).toBeNull();
    expect(scroll.props.refreshControl.props.refreshing).toBe(false);
    expect(screen.getByTestId('connection-banner')).toBeTruthy();
    expect(screen.getByText('Bağlantı kurulamadı')).toBeTruthy();

    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh(); // bağlantı geldi
    });
    expect(screen.queryByTestId('connection-banner')).toBeNull();
    expect(cards()).toHaveLength(2);
  });

  it('bir ürünün kontrolü başarısız olsa bile diğerleri ve liste yenilemesi sürer', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.calls.length = 0;
    backend.networkDown('POST /products/1/check-now');

    const scroll = screen.UNSAFE_getByType(ScrollView);
    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });

    expect(backend.callsTo('POST /products/*')).toHaveLength(2); // ürün başına bir kontrol; biri düşse de diğeri gider
    expect(backend.callsTo('GET /products')).toHaveLength(1);
    expect(scroll.props.refreshControl.props.refreshing).toBe(false);
  });
});

describe('ürün detayına geçiş', () => {
  it('detayı açmadan önce ürünün güncel renk/beden verisini çeker; bu sırada kartın üstünde yükleniyor göstergesi olur', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    const pending = backend.hold('POST /products/resolve');

    fireEvent.press(cards()[0]);
    await pending.arrival;
    expect(within(cards()[0]).UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();
    expect(within(cards()[1]).UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    await act(async () => pending.release());

    expect(await screen.findByText('Ürün Detayı')).toBeTruthy();
    expect(backend.callsTo('POST /products/resolve')).toHaveLength(1);
    expect(backend.callsTo('POST /products/resolve')[0].body).toEqual({ url: ZARA_URL });
    // Detayda güncel katalogdan gelen renkler de seçilebilir
    expect(screen.getByText('Siyah')).toBeTruthy();
  });

  it('güncel veri çekilemese bile detayı açar (takip edilen bedenler çıkarılabilsin) ve nedenini yazar', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.failWith('POST /products/resolve', 502, 'PARSE_FAILED', 'Sayfa okunamadı.');

    fireEvent.press(cards()[0]);

    expect(await screen.findByText('Ürün Detayı')).toBeTruthy();
    expect(screen.getByText('Renk ve bedenler yüklenemedi')).toBeTruthy();
    expect(screen.getByText('Sayfa okunamadı. Lütfen daha sonra tekrar deneyin.')).toBeTruthy();
    expect(screen.getByText('TAKİP EDİLEN BEDENLER')).toBeTruthy();
  });

  it('bağlantı yoksa detay yine açılır, "Bağlantı kurulamadı…" der; bağlantı gelince "Tekrar dene" ızgarayı yükler', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    backend.networkDown('POST /products/resolve');

    fireEvent.press(cards()[0]);

    expect(await screen.findByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(screen.queryByText('RENK/BEDEN EKLE YA DA ÇIKAR')).toBeNull();

    await fireEventAsync.press(screen.getByTestId('detail-retry-button')); // bağlantı geri geldi

    expect(await screen.findByText('RENK/BEDEN EKLE YA DA ÇIKAR')).toBeTruthy();
    expect(screen.queryByTestId('detail-load-error')).toBeNull();
    expect(screen.getByText('Siyah')).toBeTruthy(); // güncel renkler geldi
  });

  it('detayda kısmi kaydetme sonrası liste yenilenir ve ekran güncel bedenleri gösterir (M silindi, eklenemeyen taslakta kalır)', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));
    fireEvent.press(cards()[0]);
    await screen.findByText('Ürün Detayı');
    fireEvent.press(screen.getByText('M')); // Beyaz M'yi çıkar
    fireEvent.press(screen.getByText('Siyah'));
    fireEvent.press(screen.getByText('S')); // Siyah S'yi ekle
    backend.failWith('POST /products', 403, 'PREMIUM_LIMIT_REACHED', 'Limit doldu.');

    await fireEventAsync.press(screen.getByTestId('save-detail-button'));

    expect(await screen.findByText('Kısmen kaydedildi')).toBeTruthy();
    fireEvent.press(screen.getByText('Tamam'));
    await waitFor(() => expect(screen.queryByText('Beyaz · M')).toBeNull()); // liste yenilendi, ekran yansıttı
    expect(screen.getByText('Beyaz · S')).toBeTruthy();
    expect(screen.getByText('+ Siyah · S')).toBeTruthy(); // hâlâ bekleyen işlem
    expect(screen.getByText('Ürün Detayı')).toBeTruthy(); // ekran kapanmadı
  });

  it('detaydan kapatınca listeye döner', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));

    fireEvent.press(cards()[0]);
    await screen.findByText('Ürün Detayı');
    fireEvent.press(screen.getByTestId('close-button'));

    await waitFor(() => expect(cards()).toHaveLength(2));
  });
});

describe('görünüm ve gezinme', () => {
  it('liste/ızgara düğmesi görünümü değiştirir ve erişilebilirlik etiketini günceller', async () => {
    await renderProducts();
    await waitFor(() => expect(cards()).toHaveLength(2));

    expect(screen.getByLabelText('Izgara görünümüne geç')).toBeTruthy();
    fireEvent.press(screen.getByTestId('toggle-view-button'));

    expect(screen.getByLabelText('Liste görünümüne geç')).toBeTruthy();
    expect(cards()).toHaveLength(2);
    // Izgarada beden rozetleri yerine beden sayısı yazar
    expect(within(cards()[0]).getByText('2 beden')).toBeTruthy();
  });

  it('alt sekmeden Ayarlar\'a geçer', async () => {
    await renderProducts();
    fireEvent.press(await screen.findByText('Ayarlar'));
    expect(callbacks.onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
