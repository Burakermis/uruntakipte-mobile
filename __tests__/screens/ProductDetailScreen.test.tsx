import React from 'react';
import { act, fireEvent, fireEventAsync, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ProductDetailScreen } from '../../src/screens/ProductDetailScreen';
import { installFakeBackend, type FakeBackend } from '../../test-utils/fakeBackend';
import { resolvedProduct, trackedProduct, ZARA_URL } from '../../test-utils/fixtures';
import { renderScreen } from '../../test-utils/render';
import type { ResolvedProduct, TrackedProductGroup } from '../../src/types';

const USER = 'test-device';
const ZARA_S = trackedProduct({ id: 1, size: 'S', sku: 'beyaz:sku-s' });
const ZARA_M = trackedProduct({ id: 2, size: 'M', sku: 'beyaz:sku-m', lastPrice: 1199 });

const group: TrackedProductGroup = {
  canonicalUrl: ZARA_URL,
  brand: 'zara',
  name: 'Oversize Gömlek',
  imageUrl: ZARA_S.imageUrl,
  items: [ZARA_S, ZARA_M],
};

const onClose = jest.fn();
const onChanged = jest.fn();
let backend: FakeBackend;

function detailElement({
  resolved = resolvedProduct() as ResolvedProduct | null,
  loadError = null as string | null,
  items = group,
  onRetryLoad = undefined as (() => Promise<void>) | undefined,
} = {}) {
  return (
    <ProductDetailScreen
      userId={USER}
      group={items}
      resolved={resolved}
      loadError={loadError}
      onRetryLoad={onRetryLoad}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

async function renderDetail(props: Parameters<typeof detailElement>[0] = {}) {
  return renderScreen(detailElement(props));
}

const saveButton = () => screen.getByTestId('save-detail-button');
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || el.props.disabled === true;
const rowStyle = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style);

beforeEach(() => {
  backend = installFakeBackend({ userId: USER, catalog: [resolvedProduct()], products: [ZARA_S, ZARA_M] });
});

describe('taslak düzenleme', () => {
  it('takip edilen bedenleri fiyatlarıyla listeler; hiç değişiklik yokken "Kaydet" pasiftir', async () => {
    await renderDetail();

    expect(screen.getByText('Beyaz · S')).toBeTruthy();
    expect(screen.getByText('Beyaz · M')).toBeTruthy();
    expect(screen.getByText('1.199,00 TL')).toBeTruthy();
    expect(isDisabled(saveButton())).toBe(true);
  });

  it('takipli bir bedene dokunmak onu üstü çizili "çıkarılacak" yapar; geri dokunmak taslağı eski haline döndürür', async () => {
    await renderDetail();

    fireEvent.press(screen.getByText('M')); // ızgaradaki M (seçiliydi) → kaldır
    expect(rowStyle('Beyaz · M').textDecorationLine).toBe('line-through');
    expect(isDisabled(saveButton())).toBe(false);
    expect(backend.calls).toHaveLength(0); // dokunuş anında sunucuya HİÇBİR şey gitmez

    fireEvent.press(screen.getByText('M'));
    expect(rowStyle('Beyaz · M').textDecorationLine).toBeUndefined();
    expect(isDisabled(saveButton())).toBe(true); // aynı küme → değişiklik yok
  });

  it('başka renkten yeni beden seçmek listede "+ Renk · Beden" olarak (kaydedilmeden) görünür', async () => {
    await renderDetail();

    fireEvent.press(screen.getByText('Siyah'));
    fireEvent.press(screen.getByText('S'));

    expect(screen.getByText('+ Siyah · S')).toBeTruthy();
    expect(isDisabled(saveButton())).toBe(false);
  });

  it('açılışta ürünün takip edilen rengi seçilidir', async () => {
    const siyah = trackedProduct({ id: 5, color: 'Siyah', size: 'S', sku: 'siyah:sku-s' });
    await renderDetail({ items: { ...group, items: [siyah] } });

    // Siyah'ın bedenleri (S, M) gösteriliyor; Beyaz'ın L/XL'i yok
    expect(screen.queryByText('XL')).toBeNull();
    expect(screen.getByText('M')).toBeTruthy();
  });

  it('takip edilen renk katalogdan kalkmışsa ilk renge düşer (boş ızgara göstermez)', async () => {
    const kirmizi = trackedProduct({ id: 6, color: 'Kırmızı', size: 'S', sku: 'kirmizi:sku-s' });
    await renderDetail({ items: { ...group, items: [kirmizi] } });

    expect(screen.getByText('XL')).toBeTruthy(); // Beyaz'ın bedenleri
  });
});

describe('Kaydet', () => {
  it('yalnızca FARKI gönderir: çıkarılan bedene DELETE, eklenene POST; ardından listeyi yenileyip kapanır', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('M')); // Beyaz M'yi çıkar
    fireEvent.press(screen.getByText('Siyah'));
    fireEvent.press(screen.getByText('S')); // Siyah S'yi ekle

    await fireEventAsync.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(backend.callsTo('DELETE /products/*').map((c) => [c.path, c.query.get('userId')])).toEqual([['/products/2', USER]]);
    expect(backend.callsTo('POST /products').map((c) => c.body)).toEqual([{ userId: USER, url: ZARA_URL, sku: 'siyah:sku-s' }]);
    // Dokunulmayan Beyaz S'e hiç istek gitmedi
    expect(backend.calls.some((c) => c.path === '/products/1')).toBe(false);
    expect(backend.products.map((p) => p.sku).sort()).toEqual(['beyaz:sku-s', 'siyah:sku-s']);
  });

  it('kayıt sürerken düğme yükleniyor durumundadır (çift gönderim yok)', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('M'));
    const pending = backend.hold('DELETE /products/2');

    await act(async () => {
      fireEvent.press(saveButton());
    });
    await pending.arrival;
    expect(isDisabled(saveButton())).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => pending.release());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(1);
  });

  it('bir istek başarısız olursa ekran AÇIK kalır, backend\'in mesajı gösterilir ve tekrar denenebilir', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('Siyah'));
    fireEvent.press(screen.getByText('S'));
    backend.failWith('POST /products', 403, 'LIMIT_REACHED', 'Ücretsiz planda en fazla 3 ürün takip edebilirsin.');

    await fireEventAsync.press(saveButton());

    expect(await screen.findByText('Ücretsiz planda en fazla 3 ürün takip edebilirsin.')).toBeTruthy();
    expect(screen.getByText('Değişiklikler kaydedilemedi')).toBeTruthy();
    expect(backend.callsTo('POST /products')).toHaveLength(1); // kesin ret yeniden denenmedi
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Tamam'));
    expect(isDisabled(saveButton())).toBe(false);
  });

  it('silme sırasında tek seferlik ağ kesintisi kullanıcıya yansımaz: silme sessizce yeniden denenir', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('M'));
    backend.networkDown('DELETE /products/*');

    await fireEventAsync.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(2);
    expect(backend.products.map((p) => p.size)).toEqual(['S']);
  });

  it('silme yeniden denemelerde de düşerse (bağlantı yok) "Bağlantı kurulamadı" der ve ekran açık kalır', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('M'));
    backend.networkDown('DELETE /products/*', { times: 3 });

    await fireEventAsync.press(saveButton());

    expect(await screen.findByText('Değişiklikler kaydedilemedi')).toBeTruthy();
    expect(screen.getByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(3);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('kayıt zaten silinmişse (404 — başka cihazdan ya da ilk deneme tamamlanmıştı) başarı sayılır, hata gösterilmez', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('M'));
    backend.failWith('DELETE /products/*', 404, 'NOT_FOUND', 'Takip kaydı bulunamadı.');

    await fireEventAsync.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Değişiklikler kaydedilemedi')).toBeNull();
  });

  it('yeni beden eklenirken tek seferlik ağ kesintisi kullanıcıya yansımaz: ekleme sessizce yeniden denenir ve kayıt tamamlanır', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('Siyah'));
    fireEvent.press(screen.getByText('S'));
    backend.networkDown('POST /products');

    await fireEventAsync.press(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Hata')).toBeNull();
    expect(backend.callsTo('POST /products')).toHaveLength(2);
    expect(backend.products.map((p) => p.sku).sort()).toEqual(['beyaz:sku-m', 'beyaz:sku-s', 'siyah:sku-s']);
  });

  it('yeniden denemelere rağmen eklenemezse (3 deneme) hata verir ve ekran açık kalır', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('Siyah'));
    fireEvent.press(screen.getByText('S'));
    backend.networkDown('POST /products', { times: 3 });

    await fireEventAsync.press(saveButton());

    expect(await screen.findByText('Değişiklikler kaydedilemedi')).toBeTruthy();
    expect(screen.getByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(backend.callsTo('POST /products')).toHaveLength(3);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('KISMEN başarılıysa ne olduğunu söyler, listeyi yeniler ve ekran gerçek durumu gösterir: yalnızca tamamlanamayan işlem taslakta kalır', async () => {
    const view = await renderDetail();
    fireEvent.press(screen.getByText('M')); // Beyaz M'yi çıkar  → sunucuda başarılı
    fireEvent.press(screen.getByText('Siyah'));
    fireEvent.press(screen.getByText('S')); // Siyah S'yi ekle → başarısız (limit)
    backend.failWith('POST /products', 403, 'PREMIUM_LIMIT_REACHED', 'Ücretsiz planda en fazla 3 ürün takip edebilirsin.');

    await fireEventAsync.press(saveButton());

    expect(await screen.findByText('Kısmen kaydedildi')).toBeTruthy();
    expect(screen.getByText(/Değişikliklerin bir kısmı kaydedildi, 1 işlem tamamlanamadı\. Ücretsiz planda en fazla 3 ürün takip edebilirsin\./)).toBeTruthy();
    expect(onChanged).toHaveBeenCalledTimes(1); // liste yenilendi
    expect(onClose).not.toHaveBeenCalled();
    expect(backend.products.map((p) => p.size)).toEqual(['S']); // M gerçekten silindi

    // Üst ekran güncel listeyi (M artık yok) geri verir → satırlar gerçeği yansıtır, "+ Siyah · S" bekleyen işlem olarak kalır
    fireEvent.press(screen.getByText('Tamam'));
    await view.rerenderAsync(detailElement({ items: { ...group, items: [ZARA_S] } }));
    expect(screen.queryByText('Beyaz · M')).toBeNull();
    expect(screen.getByText('+ Siyah · S')).toBeTruthy();
    expect(isDisabled(saveButton())).toBe(false); // hâlâ kaydedilecek bir şey var
  });
});

describe('kapatma', () => {
  it('değişiklik yoksa hemen kapanır, onay sormaz', async () => {
    await renderDetail();
    await fireEventAsync.press(screen.getByTestId('close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Kaydedilmemiş değişiklikler var')).toBeNull();
  });

  it('kaydedilmemiş değişiklik varsa onay ister: "Vazgeç" ekranda tutar, "Onayla" taslağı atıp kapatır', async () => {
    await renderDetail();
    fireEvent.press(screen.getByText('M'));

    fireEvent.press(screen.getByTestId('close-button'));
    expect(await screen.findByText('Kaydedilmemiş değişiklikler var')).toBeTruthy();
    await fireEventAsync.press(screen.getByText('Vazgeç'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('close-button'));
    await fireEventAsync.press(await screen.findByText('Onayla'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(backend.calls).toHaveLength(0); // taslak sunucuya hiç yansımadı
  });
});

describe('güncel veri yüklenemediğinde (kullanıcı yine de istediği işlemi yapabilmeli)', () => {
  it('ızgara yokken de takip edilen bir bedene dokunarak takipten çıkarılabilir ve kaydedilir', async () => {
    await renderDetail({ resolved: null, loadError: 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.' });
    expect(screen.getByText('Bir bedeni takipten çıkarmak için üzerine dokun.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Beyaz M takipten çıkar'));
    expect(rowStyle('Beyaz · M').textDecorationLine).toBe('line-through');
    expect(isDisabled(saveButton())).toBe(false);

    fireEvent.press(screen.getByLabelText('Beyaz M takipte kalsın')); // geri al
    expect(isDisabled(saveButton())).toBe(true);

    fireEvent.press(screen.getByLabelText('Beyaz M takipten çıkar'));
    await fireEventAsync.press(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(backend.products.map((p) => p.size)).toEqual(['S']);
  });

  it('nedenini ("Bağlantı kurulamadı…") başlıkla birlikte gösterir; "Tekrar dene" bilgiyi yeniden ister, gelince ızgara açılır', async () => {
    const onRetryLoad = jest.fn().mockResolvedValue(undefined);
    const view = await renderDetail({ resolved: null, loadError: 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.', onRetryLoad });

    expect(screen.getByText('Renk ve bedenler yüklenemedi')).toBeTruthy();
    expect(screen.getByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();

    await fireEventAsync.press(screen.getByTestId('detail-retry-button'));
    expect(onRetryLoad).toHaveBeenCalledTimes(1);

    // Üst ekran veriyi getirdi
    await view.rerenderAsync(detailElement({ resolved: resolvedProduct(), loadError: null, onRetryLoad }));
    expect(screen.queryByTestId('detail-load-error')).toBeNull();
    expect(screen.getByText('RENK/BEDEN EKLE YA DA ÇIKAR')).toBeTruthy();
  });

  it('yeniden deneme sürerken düğme "Deneniyor…" olur ve ikinci dokunuş ikinci istek başlatmaz', async () => {
    let finish!: () => void;
    const onRetryLoad = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    await renderDetail({ resolved: null, loadError: 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.', onRetryLoad });

    await act(async () => {
      fireEvent.press(screen.getByTestId('detail-retry-button'));
    });
    expect(screen.getByText('Deneniyor…')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('detail-retry-button'));
    });
    expect(onRetryLoad).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(screen.getByText('Tekrar dene')).toBeTruthy();
  });

  it('hata metnini gösterir, ekleme ızgarasını göstermez; takip edilen bedenler görünür kalır', async () => {
    await renderDetail({ resolved: null, loadError: 'Sayfa okunamadı.' });

    expect(screen.getByText('Sayfa okunamadı.')).toBeTruthy();
    expect(screen.getByText('Beyaz · S')).toBeTruthy();
    expect(screen.queryByText('RENK/BEDEN EKLE YA DA ÇIKAR')).toBeNull();
    expect(isDisabled(saveButton())).toBe(true);
  });
});
