import {
  API_BASE_URL,
  ApiRequestError,
  CONNECTION_MESSAGE,
  ConnectionError,
  checkTrackedProductNow,
  createTrackedProduct,
  deleteTrackedProduct,
  getUserLimits,
  listTrackedProducts,
  registerDevice,
  resolveProduct,
  setPremium,
  syncPremiumStatus,
} from '../../src/api';

const fetchMock = jest.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// Ağ katmanını taklit eder: istek AbortController ile iptal edilene kadar
// hiç dönmeyen bir fetch — ulaşılamayan LAN IP'sinin native'deki davranışı.
function neverRespondingFetch() {
  fetchMock.mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  (global as any).fetch = fetchMock;
});

describe('istek biçimi', () => {
  it('userId sorgu parametresini URL-encode eder (özel karakterli kimlik başka kullanıcıya sızmasın)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await listTrackedProducts('a b&userId=baska');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/products\?userId=a%20b%26userId%3Dbaska$/);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.method).toBeUndefined(); // GET
  });

  it('ürün ekleme yalnızca {userId, url, sku} gönderir — ham HTML telefondan geçmez', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 1, alreadyTracked: false }));

    await createTrackedProduct({ userId: 'u1', url: 'https://www.zara.com/p1', sku: 'sku-1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/products$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ userId: 'u1', url: 'https://www.zara.com/p1', sku: 'sku-1' });
  });

  // Mobil ile backend arasındaki sözleşme — yol/metot/gövde bir yerde bozulursa
  // ilgili ekran sessizce 404 alıp "bağlantı hatası" gösterir.
  it.each([
    ['resolveProduct', () => resolveProduct('https://x.com/p'), 'POST', '/products/resolve', { url: 'https://x.com/p' }],
    ['deleteTrackedProduct', () => deleteTrackedProduct(7, 'u 1'), 'DELETE', '/products/7?userId=u%201', undefined],
    ['checkTrackedProductNow', () => checkTrackedProductNow(7, 'u1'), 'POST', '/products/7/check-now', { userId: 'u1' }],
    ['registerDevice', () => registerDevice('u1', 'ExponentPushToken[x]', 'ios'), 'POST', '/devices', { userId: 'u1', expoPushToken: 'ExponentPushToken[x]', platform: 'ios' }],
    ['getUserLimits', () => getUserLimits('u/1'), undefined, '/users/u%2F1/limits', undefined],
    ['setPremium', () => setPremium('u1', true), 'POST', '/users/u1/premium', { isPremium: true }],
    ['syncPremiumStatus', () => syncPremiumStatus('u1'), 'POST', '/users/u1/sync-premium', {}],
  ])('%s doğru uç noktaya gider', async (_name, call, method, path, body) => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await call();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}${path}`);
    expect(init.method).toBe(method);
    if (body === undefined) expect(init.body).toBeUndefined();
    else expect(JSON.parse(init.body)).toEqual(body);
  });
});

describe('yanıt işleme', () => {
  it('hata gövdesini ApiRequestError\'a çevirir: backend mesajı, kod ve bekleme süresi korunur', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        error: 'COOLDOWN_ACTIVE',
        message: 'Yeni ürün eklemek için beklemelisin.',
        cooldownRemainingMs: 3_600_000,
      })
    );

    const error = await createTrackedProduct({ userId: 'u1', url: 'https://x.com/p', sku: 's' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      message: 'Yeni ürün eklemek için beklemelisin.',
      code: 'COOLDOWN_ACTIVE',
      cooldownRemainingMs: 3_600_000,
    });
  });

  it('204 No Content (silme) gövde okumaya çalışmadan başarıyla döner', async () => {
    const json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
    fetchMock.mockResolvedValue({ ok: true, status: 204, json });

    await expect(deleteTrackedProduct(1, 'u1')).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it('sunucuya hiç ulaşılamazsa geliştirici diliyle değil, kullanıcıya ne yapacağını söyleyen "Bağlantı kurulamadı" hatası fırlatır', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await listTrackedProducts('u1').catch((e) => e);

    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.kind).toBe('offline');
    expect(error.message).toBe(CONNECTION_MESSAGE);
    expect(error.message).not.toMatch(/backend|localhost|http/i);
  });

  it('JSON olmayan hata yanıtını (ters proxy\'nin HTML 502 sayfası) ham SyntaxError yerine geçici sunucu hatasına çevirir', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } });

    const error = await createTrackedProduct({ userId: 'u1', url: 'https://x.com/p', sku: 's' }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ code: 'BAD_RESPONSE', status: 502, message: 'Sunucu şu an yanıt veremiyor. Lütfen daha sonra tekrar deneyin.' });
  });

  it('başarılı (200) ama bozuk gövdeli yanıt da geçici sunucu hatası sayılır', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } });

    const error = await getUserLimits('u1').catch((e) => e);

    expect(error).toMatchObject({ code: 'BAD_RESPONSE', status: 502 });
  });
});

describe('zaman aşımı', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function trackSettlement(promise: Promise<unknown>) {
    let state: 'pending' | 'rejected' | 'resolved' = 'pending';
    let message = '';
    promise.then(
      () => (state = 'resolved'),
      (e) => {
        state = 'rejected';
        message = e.message;
      }
    );
    return () => ({ state, message });
  }

  it('sıradan istekler 10 sn\'de bırakılır ve kullanıcıya anlaşılır bir mesaj verir', async () => {
    neverRespondingFetch();
    const read = trackSettlement(listTrackedProducts('u1'));

    await jest.advanceTimersByTimeAsync(9_999);
    expect(read().state).toBe('pending');

    await jest.advanceTimersByTimeAsync(1);
    expect(read().state).toBe('rejected');
    expect(read().message).toMatch(/zaman aşımına uğradı/);
    expect(read().message).not.toMatch(/backend|localhost|http/i); // API adresi/geliştirici dili kullanıcıya sızmaz
  });

  // Backend gerçek bir sayfa taraması (en fazla 30 sn) yapabiliyor — istemci 10
  // sn'de vazgeçerse kullanıcı, işlem sunucuda sürerken "bağlantı hatası" görür.
  it.each([
    ['resolveProduct', () => resolveProduct('https://x.com/p')],
    ['createTrackedProduct', () => createTrackedProduct({ userId: 'u1', url: 'https://x.com/p', sku: 's' })],
    ['checkTrackedProductNow', () => checkTrackedProductNow(1, 'u1')],
  ])('%s tarama bekleyeceği için 35 sn tanır', async (_name, call) => {
    neverRespondingFetch();
    const read = trackSettlement(call());

    await jest.advanceTimersByTimeAsync(30_000);
    expect(read().state).toBe('pending'); // backend'in kendi 30 sn sınırı dolmuş olsa bile hâlâ bekliyor

    await jest.advanceTimersByTimeAsync(5_000);
    expect(read().state).toBe('rejected');
  });

  it('başarılı yanıttan sonra zamanlayıcıyı temizler (asılı kalan timer yok)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await listTrackedProducts('u1');
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('API_BASE_URL çözümlemesi (cihaz/ortama göre backend adresi)', () => {
  function loadApiWith({
    os,
    hostUri,
    envUrl,
  }: {
    os: 'web' | 'ios' | 'android';
    hostUri?: string;
    envUrl?: string;
  }): string {
    let baseUrl = '';
    const previousEnv = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = envUrl;

    jest.isolateModules(() => {
      // jest.setup.ts'teki değiştirilebilir expo-constants mock'u (ana kayıtta yüklü,
      // izole kayıt da aynı nesneyi görüyor).
      require('expo-constants').default.expoConfig = hostUri ? { hostUri } : null;
      require('react-native').Platform.OS = os;
      baseUrl = require('../../src/api').API_BASE_URL;
    });

    if (previousEnv === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previousEnv;
    return baseUrl;
  }

  it('gerçek cihazda Metro\'nun bağlandığı host\'u kullanır (DHCP ile IP değişse de doğru kalır)', () => {
    expect(loadApiWith({ os: 'android', hostUri: '192.168.1.23:8081' })).toBe('http://192.168.1.23:4000/api');
    expect(loadApiWith({ os: 'ios', hostUri: '10.0.0.5:8081' })).toBe('http://10.0.0.5:4000/api');
  });

  it('host bilinmiyorsa Android emülatör adresine düşer', () => {
    expect(loadApiWith({ os: 'android' })).toBe('http://10.0.2.2:4000/api');
  });

  it('web önizlemede localhost kullanır', () => {
    expect(loadApiWith({ os: 'web', hostUri: '192.168.1.23:8081' })).toBe('http://localhost:4000/api');
  });

  it('EXPO_PUBLIC_API_URL (prod/staging build) tanımlıysa otomatik tespiti ezer', () => {
    expect(loadApiWith({ os: 'ios', hostUri: '192.168.1.23:8081', envUrl: 'https://api.uruntakipte.com/api' })).toBe(
      'https://api.uruntakipte.com/api'
    );
  });
});
