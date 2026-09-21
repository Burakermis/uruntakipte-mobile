import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, fireEventAsync, screen, waitFor } from '@testing-library/react-native';
import { ProductVariantScreen } from '../../src/screens/ProductVariantScreen';
import { installFakeBackend, type FakeBackend } from '../../test-utils/fakeBackend';
import { resolvedProduct, trackedProduct, ZARA_URL } from '../../test-utils/fixtures';
import { renderScreen } from '../../test-utils/render';

const USER = 'test-device';
const onClose = jest.fn();
const onTracked = jest.fn();
let backend: FakeBackend;

async function renderAddFlow() {
  return renderScreen(<ProductVariantScreen userId={USER} onClose={onClose} onTracked={onTracked} />);
}

async function typeUrlAndFetch(url = ZARA_URL) {
  fireEvent.changeText(screen.getByTestId('url-input'), url);
  await fireEventAsync.press(screen.getByTestId('fetch-product-button'));
}

// Ürün Ekle akışının 1. adımını geçip renk/beden ekranına gelir.
async function reachVariantStep() {
  await renderAddFlow();
  await typeUrlAndFetch();
  await screen.findByText('RENK SEÇİN');
}

// fireEventAsync.press handler'ın döndürdüğü Promise'i de bekler — sunucu yanıtı
// bilerek bekletilen (hold) testlerde kilitlenir. Bu yardımcı basıp sadece
// React'in işini (efektler/state) tamamlamasını bekler, isteğin bitmesini değil.
async function pressWithoutWaiting(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

const trackButton = () => screen.getByTestId('track-button');
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || el.props.disabled === true;

beforeEach(() => {
  backend = installFakeBackend({ userId: USER, catalog: [resolvedProduct()] });
});

describe('1. adım — ürün bağlantısı', () => {
  it('bağlantı boşken "Ürünü Getir" pasif; yazınca açılır', async () => {
    await renderAddFlow();
    expect(isDisabled(screen.getByTestId('fetch-product-button'))).toBe(true);

    fireEvent.changeText(screen.getByTestId('url-input'), 'https://www.zara.com/tr');
    expect(isDisabled(screen.getByTestId('fetch-product-button'))).toBe(false);

    fireEvent.changeText(screen.getByTestId('url-input'), '   ');
    expect(isDisabled(screen.getByTestId('fetch-product-button'))).toBe(true);
  });

  it('yapıştır düğmesi panodaki Paylaş metninden yalnızca URL\'i kutuya koyar ve aramayı OTOMATİK başlatmaz', async () => {
    jest.mocked(Clipboard.getStringAsync).mockResolvedValue(`Oversize gömlek - ZARA ${ZARA_URL}`);
    await renderAddFlow();

    await fireEventAsync.press(screen.getByTestId('paste-button'));

    expect(screen.getByTestId('url-input').props.value).toBe(ZARA_URL);
    expect(backend.calls).toHaveLength(0);
  });

  it('pano boşsa kutuya dokunmaz', async () => {
    await renderAddFlow();
    fireEvent.changeText(screen.getByTestId('url-input'), 'https://x.com/elle-yazildi');

    await fireEventAsync.press(screen.getByTestId('paste-button'));

    expect(screen.getByTestId('url-input').props.value).toBe('https://x.com/elle-yazildi');
  });

  it('kutuya elle yapıştırılan "ürün adı + URL" metnini de temizleyip yalnızca URL\'i backend\'e yollar', async () => {
    await renderAddFlow();

    await typeUrlAndFetch(`Oversize gömlek - ZARA ${ZARA_URL}`);

    await screen.findByText('RENK SEÇİN');
    expect(backend.callsTo('POST /products/resolve')[0].body).toEqual({ url: ZARA_URL });
  });

  it('klavyedeki "Git" tuşu da ürünü getirir', async () => {
    await renderAddFlow();
    fireEvent.changeText(screen.getByTestId('url-input'), ZARA_URL);

    await fireEventAsync(screen.getByTestId('url-input'), 'submitEditing');

    expect(await screen.findByText('RENK SEÇİN')).toBeTruthy();
  });

  it('desteklenmeyen siteyi backend\'in mesajıyla bildirir; düzeltilen bağlantıyla devam edilebilir', async () => {
    await renderAddFlow();

    await typeUrlAndFetch('https://www.ornek-magaza.com/urun/1');
    expect(await screen.findByText('Bu bağlantı desteklenen bir siteye ait değil.')).toBeTruthy();
    expect(screen.queryByText('RENK SEÇİN')).toBeNull();

    await typeUrlAndFetch(ZARA_URL);
    expect(await screen.findByText('RENK SEÇİN')).toBeTruthy();
    expect(screen.queryByText('Bu bağlantı desteklenen bir siteye ait değil.')).toBeNull();
  });

  it('anlık bir ağ kesintisi kullanıcıya yansımaz: ürün getirme sessizce yeniden denenir', async () => {
    await renderAddFlow();
    backend.networkDown('POST /products/resolve');

    await typeUrlAndFetch();

    expect(await screen.findByText('RENK SEÇİN')).toBeTruthy();
    expect(backend.callsTo('POST /products/resolve')).toHaveLength(2);
  });

  it('sunucuya hiç ulaşılamazsa "Bağlantı kurulamadı" der — geliştirici diliyle değil, kullanıcıya ne yapacağını söyleyerek', async () => {
    await renderAddFlow();
    backend.networkDown('POST /products/resolve', { times: 3 });

    await typeUrlAndFetch();

    expect(await screen.findByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(screen.queryByText(/Backend/i)).toBeNull();
    expect(backend.callsTo('POST /products/resolve')).toHaveLength(3);
    // Aynı bağlantıyla yeniden denenebilir
    expect(isDisabled(screen.getByTestId('fetch-product-button'))).toBe(false);
  });

  it('klavyedeki "Git" tuşuna art arda basmak (ürün getirilirken) ikinci bir tarama başlatmaz', async () => {
    await renderAddFlow();
    const pending = backend.hold('POST /products/resolve');
    fireEvent.changeText(screen.getByTestId('url-input'), ZARA_URL);

    await act(async () => {
      fireEvent(screen.getByTestId('url-input'), 'submitEditing');
      fireEvent(screen.getByTestId('url-input'), 'submitEditing');
    });
    await pending.arrival;

    expect(backend.callsTo('POST /products/resolve')).toHaveLength(1);
    await act(async () => pending.release());
    expect(await screen.findByText('RENK SEÇİN')).toBeTruthy();
  });

  it('tarama sürerken düğme yükleniyor durumundadır ve ikinci basış yeni istek başlatmaz', async () => {
    await renderAddFlow();
    const pending = backend.hold('POST /products/resolve');

    fireEvent.changeText(screen.getByTestId('url-input'), ZARA_URL);
    await pressWithoutWaiting(screen.getByTestId('fetch-product-button'));
    await pending.arrival;
    expect(isDisabled(screen.getByTestId('fetch-product-button'))).toBe(true);
    await pressWithoutWaiting(screen.getByTestId('fetch-product-button'));
    expect(backend.callsTo('POST /products/resolve')).toHaveLength(1);

    await act(async () => pending.release());
    expect(await screen.findByText('RENK SEÇİN')).toBeTruthy();
  });

  it('kapat düğmesi akıştan çıkar', async () => {
    await renderAddFlow();
    fireEvent.press(screen.getByTestId('close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('2. adım — renk / beden seçimi', () => {
  it('ürünü, ilk rengi seçili ve o rengin bedenleriyle gösterir; hiçbir beden seçilmeden "Takibe Al" pasiftir', async () => {
    await reachVariantStep();

    expect(screen.getByText('ZARA')).toBeTruthy();
    expect(screen.getByText('Oversize Gömlek')).toBeTruthy();
    expect(screen.getByText('1.299,90 TL')).toBeTruthy();
    for (const label of ['Beyaz', 'Siyah', 'S', 'M', 'L', 'XL']) expect(screen.getByText(label)).toBeTruthy();
    expect(isDisabled(trackButton())).toBe(true);
    expect(screen.getByText('Önce en az bir beden seç')).toBeTruthy();
  });

  it('seçilen bedenin stok durumunu yazar ve "stoğa girince bildir" açıklamasını ona göre değiştirir', async () => {
    await reachVariantStep();

    fireEvent.press(screen.getByText('S')); // stokta
    expect(screen.getByText('Stokta')).toBeTruthy();
    expect(screen.getByText('Seçtiğin bedenler zaten satın alınabiliyor, bu bildirime gerek yok')).toBeTruthy();

    fireEvent.press(screen.getByText('S')); // seçimi kaldır
    fireEvent.press(screen.getByText('L')); // stok yok
    expect(screen.getByText('Stok yok')).toBeTruthy();
    expect(screen.getByText('Seçtiğin bedenler yeniden satışa çıkınca haber ver')).toBeTruthy();
  });

  it('bir beden tükenmişse, satın alınabilenlerle birlikte seçilse de stok bildirimi açık kalır', async () => {
    await reachVariantStep();

    fireEvent.press(screen.getByText('S'));
    fireEvent.press(screen.getByText('XL')); // yakında

    expect(screen.getByText('Seçtiğin bedenler yeniden satışa çıkınca haber ver')).toBeTruthy();
    expect(screen.queryByText('Stokta')).toBeNull(); // tek beden seçili değil → tek tek durum yazılmaz
  });

  it('birden çok beden seçilince düğme sayıyı yazar; tekrar dokunmak seçimi kaldırır', async () => {
    await reachVariantStep();

    fireEvent.press(screen.getByText('S'));
    expect(screen.getByText('Takibe Al')).toBeTruthy();
    fireEvent.press(screen.getByText('M'));
    expect(screen.getByText('2 Bedeni Takibe Al')).toBeTruthy();
    fireEvent.press(screen.getByText('M'));
    expect(screen.getByText('Takibe Al')).toBeTruthy();
  });

  it('renk değiştirince önceki rengin beden seçimi temizlenir (yanlış renge sku gitmesin)', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    fireEvent.press(screen.getByText('M'));

    fireEvent.press(screen.getByText('Siyah'));

    expect(isDisabled(trackButton())).toBe(true);
    expect(screen.queryByText('2 Bedeni Takibe Al')).toBeNull();
    expect(screen.queryByText('XL')).toBeNull(); // Siyah'ın sadece S ve M'si var
    expect(screen.getByText('S')).toBeTruthy();
  });

  it('seçilen bedenler sırayla, doğru renk sku\'larıyla ve kullanıcı kimliğiyle takibe alınır; bitince liste yenilenir', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    fireEvent.press(screen.getByText('M'));
    const firstRequest = backend.hold('POST /products');

    await pressWithoutWaiting(trackButton());
    await firstRequest.arrival;

    // Sıralı: ilk bedenin isteği bitmeden ikincisi başlamamış olmalı (backend'de eşzamanlı ilk-ekleme kilidi yok)
    expect(backend.callsTo('POST /products')).toHaveLength(1);
    expect(onTracked).not.toHaveBeenCalled();
    await act(async () => firstRequest.release());

    await waitFor(() => expect(onTracked).toHaveBeenCalledTimes(1));
    expect(backend.callsTo('POST /products').map((c) => c.body)).toEqual([
      { userId: USER, url: ZARA_URL, sku: 'beyaz:sku-s' },
      { userId: USER, url: ZARA_URL, sku: 'beyaz:sku-m' },
    ]);
    expect(backend.products.map((p) => p.size)).toEqual(['S', 'M']);
  });

  it('gönderim sürerken renk/beden değiştirilemez ve düğme yükleniyor durumundadır', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    const pending = backend.hold('POST /products');

    await pressWithoutWaiting(trackButton());
    await pending.arrival;
    expect(isDisabled(trackButton())).toBe(true);

    fireEvent.press(screen.getByText('Siyah')); // yok sayılmalı
    fireEvent.press(screen.getByText('M'));
    await act(async () => pending.release());

    await waitFor(() => expect(onTracked).toHaveBeenCalledTimes(1));
    expect(backend.callsTo('POST /products')).toHaveLength(1);
  });

  it('kullanıcının zaten takip ettiği bedenler soluk/seçilemez olur ve bilgi bandı çıkar', async () => {
    backend = installFakeBackend({
      userId: USER,
      catalog: [resolvedProduct()],
      products: [trackedProduct({ id: 1, size: 'M', sku: 'beyaz:sku-m' })],
    });
    await reachVariantStep();

    expect(await screen.findByTestId('already-tracked-banner')).toBeTruthy();
    fireEvent.press(screen.getByText('M'));
    expect(isDisabled(trackButton())).toBe(true); // M seçilemedi

    fireEvent.press(screen.getByText('S'));
    expect(screen.getByText('Takibe Al')).toBeTruthy();
    expect(isDisabled(trackButton())).toBe(false);
  });

  it('BAŞKA renkte takip edilen beden bu rengin bedenini etkilemez, bilgi bandı çıkmaz', async () => {
    backend = installFakeBackend({
      userId: USER,
      catalog: [resolvedProduct()],
      products: [trackedProduct({ id: 1, color: 'Siyah', size: 'M', sku: 'siyah:sku-m' })],
    });
    await reachVariantStep();
    await waitFor(() => expect(backend.callsTo('GET /products')).toHaveLength(1));

    expect(screen.queryByTestId('already-tracked-banner')).toBeNull();
    fireEvent.press(screen.getByText('M')); // Beyaz M serbest
    expect(isDisabled(trackButton())).toBe(false);
  });

  // Aynı ürünün bir bedeninin "eklenemedi" olması tek bir anlık aksaklıktan kaynaklanabilir:
  // geçici hatalar kullanıcıya yansımadan sessizce yeniden denenir (bkz. utils/retry.ts).
  it.each([
    ['ağ kesintisi', () => backend.networkDown('POST /products')],
    ['sunucunun geçici 502 yanıtı', () => backend.failWith('POST /products', 502, 'FETCH_FAILED', 'Ürün sayfasına ulaşılamadı, lütfen daha sonra tekrar deneyin.')],
    ['hız sınırı (429 RATE_LIMITED)', () => backend.failWith('POST /products', 429, 'RATE_LIMITED', 'Çok fazla istek gönderildi, lütfen biraz sonra tekrar dene.')],
  ])('tek seferlik %s kullanıcıya yansımaz: istek sessizce yeniden denenir ve beden eklenir', async (_name, injectFailure) => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    fireEvent.press(screen.getByText('M'));
    injectFailure(); // ilk beden (S) ilk denemede düşer

    await fireEventAsync.press(trackButton());

    await waitFor(() => expect(onTracked).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Eklenemeyenler|eklenemedi/)).toBeNull();
    expect(backend.callsTo('POST /products').map((c) => c.body.sku)).toEqual([
      'beyaz:sku-s', // düştü
      'beyaz:sku-s', // yeniden deneme
      'beyaz:sku-m',
    ]);
    expect(backend.products.map((p) => p.size)).toEqual(['S', 'M']);
  });

  it('yeniden denemelere rağmen eklenemezse ekrandan ÇIKMAZ: eklenenleri işaretler, eklenemeyeni seçili bırakır ve sunucu yanıt vermiyorsa "sonra tekrar deneyin" der', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    fireEvent.press(screen.getByText('M'));
    // 2. beden (M) ilk denemede ve iki yeniden denemede de düşer
    backend.failWith('POST /products', 503, 'UNAVAILABLE', 'Sunucu meşgul.', { after: 1, times: 3 });

    await fireEventAsync.press(trackButton());

    // Sunucunun gerekçesi korunur, "sonra tekrar deneyin" yönlendirmesi eklenir
    expect(await screen.findByText('1 beden eklendi. Eklenemeyenler: M. Sunucu meşgul. Lütfen daha sonra tekrar deneyin.')).toBeTruthy();
    expect(backend.callsTo('POST /products').map((c) => c.body.sku)).toEqual([
      'beyaz:sku-s',
      'beyaz:sku-m',
      'beyaz:sku-m',
      'beyaz:sku-m', // toplam 3 deneme
    ]);
    expect(onTracked).not.toHaveBeenCalled();
    // S artık takipte (soluk), M hâlâ seçili → tekrar denenebilir
    expect(screen.getByText('Takibe Al')).toBeTruthy();
    expect(isDisabled(trackButton())).toBe(false);
    expect(screen.getByTestId('already-tracked-banner')).toBeTruthy();
  });

  it('hiçbir beden eklenemezse bunu açıkça söyler; bağlantı yoksa nedeni "Bağlantı kurulamadı" olarak belirtir ve seçimi korur', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    backend.networkDown('POST /products', { times: 3 });

    await fireEventAsync.press(trackButton());

    expect(await screen.findByText('Hiçbir beden eklenemedi: S. Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(backend.callsTo('POST /products')).toHaveLength(3);
    expect(onTracked).not.toHaveBeenCalled();
    expect(isDisabled(trackButton())).toBe(false);
  });

  it('KESİN ret (ör. limit doldu) yeniden denenmez; "sonra deneyin" yerine sunucunun gerekçesi gösterilir', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    backend.failWith('POST /products', 403, 'PREMIUM_LIMIT_REACHED', "Ücretsiz planda en fazla 3 ürün takip edebilirsin. Daha fazlası için Premium'a geç.");

    await fireEventAsync.press(trackButton());

    expect(
      await screen.findByText("Hiçbir beden eklenemedi: S. Ücretsiz planda en fazla 3 ürün takip edebilirsin. Daha fazlası için Premium'a geç.")
    ).toBeTruthy();
    expect(backend.callsTo('POST /products')).toHaveLength(1); // boşuna yeniden denenmedi
    expect(screen.queryByText(/sonra tekrar deneyin/)).toBeNull();
  });

  it('elle yeniden denemede yalnızca hâlâ seçili (başarısız) bedenler gönderilir', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    fireEvent.press(screen.getByText('M'));
    backend.networkDown('POST /products', { after: 1, times: 3 }); // M üç denemede de düşsün

    await fireEventAsync.press(trackButton());
    expect(await screen.findByText('1 beden eklendi. Eklenemeyenler: M. Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();

    await fireEventAsync.press(trackButton()); // bağlantı gelince tekrar dene → sadece M

    await waitFor(() => expect(onTracked).toHaveBeenCalledTimes(1));
    const posts = backend.callsTo('POST /products').map((c) => c.body.sku);
    expect(posts).toEqual(['beyaz:sku-s', 'beyaz:sku-m', 'beyaz:sku-m', 'beyaz:sku-m', 'beyaz:sku-m']); // S bir daha gitmedi
  });

  it('bir rengin bedeni aynı anda başka yerden takibe alınmışsa (alreadyTracked) çökmeden akışı tamamlar', async () => {
    await reachVariantStep();
    fireEvent.press(screen.getByText('S'));
    // Ekran açıldıktan SONRA başka bir cihazdan/oturumdan aynı beden eklendi:
    backend.products.push(trackedProduct({ id: 77, size: 'S', sku: 'beyaz:sku-s' }));

    await fireEventAsync.press(trackButton());

    await waitFor(() => expect(onTracked).toHaveBeenCalledTimes(1));
    expect(backend.products.filter((p) => p.sku === 'beyaz:sku-s')).toHaveLength(1); // kopya oluşmadı
  });
});
