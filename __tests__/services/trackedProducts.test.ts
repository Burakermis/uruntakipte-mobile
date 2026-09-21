import { ApiRequestError, ConnectionError } from '../../src/api';
import { addTrackedProduct, removeTrackedProduct } from '../../src/utils/trackedProducts';
import { installFakeBackend, type FakeBackend } from '../../test-utils/fakeBackend';
import { resolvedProduct, trackedProduct, ZARA_URL } from '../../test-utils/fixtures';

let backend: FakeBackend;
const input = { userId: 'test-device', url: ZARA_URL, sku: 'beyaz:sku-s' };

beforeEach(() => {
  backend = installFakeBackend({ catalog: [resolvedProduct()], products: [trackedProduct({ id: 7, sku: 'beyaz:sku-m', size: 'M' })] });
});

describe('addTrackedProduct', () => {
  it('geçici hatada (ağ) yeniden dener ve kaydı oluşturur — çift kayıt oluşmaz', async () => {
    backend.networkDown('POST /products');

    const result = await addTrackedProduct(input);

    expect(result.alreadyTracked).toBe(false);
    expect(backend.callsTo('POST /products')).toHaveLength(2);
    expect(backend.products.filter((p) => p.sku === 'beyaz:sku-s')).toHaveLength(1);
  });

  it('kesin retleri (limit doldu) yeniden denemez', async () => {
    backend.failWith('POST /products', 403, 'PREMIUM_LIMIT_REACHED', 'Limit doldu.');

    await expect(addTrackedProduct(input)).rejects.toMatchObject({ code: 'PREMIUM_LIMIT_REACHED' });
    expect(backend.callsTo('POST /products')).toHaveLength(1);
  });
});

describe('removeTrackedProduct', () => {
  it('kaydı siler', async () => {
    await removeTrackedProduct(7, 'test-device');
    expect(backend.products).toHaveLength(0);
  });

  it('kayıt zaten yoksa (404 — ilk deneme tamamlanmıştı ya da başka cihazdan silindi) başarı sayar', async () => {
    await expect(removeTrackedProduct(999, 'test-device')).resolves.toBeUndefined();
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(1); // 404 yeniden denenmedi
  });

  it('geçici ağ hatasında yeniden dener; üç denemede de düşerse bağlantı hatasını fırlatır', async () => {
    backend.networkDown('DELETE /products/*');
    await expect(removeTrackedProduct(7, 'test-device')).resolves.toBeUndefined();
    expect(backend.callsTo('DELETE /products/*')).toHaveLength(2);

    backend.networkDown('DELETE /products/*', { times: 3 });
    await expect(removeTrackedProduct(7, 'test-device')).rejects.toBeInstanceOf(ConnectionError);
  });

  it('başka bir kesin hatayı (ör. 403) olduğu gibi fırlatır', async () => {
    backend.failWith('DELETE /products/*', 403, 'FORBIDDEN', 'İzin yok.');
    await expect(removeTrackedProduct(7, 'test-device')).rejects.toBeInstanceOf(ApiRequestError);
  });
});
