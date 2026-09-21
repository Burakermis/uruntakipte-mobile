import { ApiRequestError, ConnectionError } from '../../src/api';
import { isTransientError, retryConfig, retryTransient } from '../../src/utils/retry';

const apiError = (status: number, code: string, message = 'hata') => new ApiRequestError({ error: code, message }, status);

// Hangi hata "biraz sonra düzelebilir", hangisi kesin ret? Yanlış sınıflandırma iki türlü zarar
// verir: kesin bir ret tekrar denenirse kullanıcı boşuna bekler; geçici bir hata denenmezse
// aynı ürünün bir bedeni "eklenemedi" olarak kalır.
describe('isTransientError', () => {
  it.each([
    ['bağlantı kurulamadı (ConnectionError)', new ConnectionError('offline')],
    ['bağlantı zaman aşımı (ConnectionError)', new ConnectionError('timeout')],
    ['bozuk yanıt gövdesi (BAD_RESPONSE)', apiError(502, 'BAD_RESPONSE')],
    ['JSON olmayan 429 (ters proxy\'nin hız sınırı sayfası — durum kodu 5xx değil ama geçici)', apiError(429, 'BAD_RESPONSE')],
    ['ağ kesintisi (fetch TypeError)', new TypeError('Network request failed')],
    ['istemci zaman aşımı', new Error('İstek zaman aşımına uğradı')],
    ['JSON olmayan yanıt (ör. proxy\'nin HTML 502 sayfası)', new SyntaxError('Unexpected token <')],
    ['502 FETCH_FAILED (sayfa okunamadı)', apiError(502, 'FETCH_FAILED')],
    ['500 sunucu hatası', apiError(500, 'INTERNAL')],
    ['429 RATE_LIMITED (hız sınırı)', apiError(429, 'RATE_LIMITED')],
  ])('%s → geçici', (_name, error) => {
    expect(isTransientError(error)).toBe(true);
  });

  it.each([
    ['403 ücretsiz limit doldu', apiError(403, 'PREMIUM_LIMIT_REACHED')],
    ['429 bekleme süresi (RATE_LIMITED değil)', apiError(429, 'PREMIUM_COOLDOWN_ACTIVE')],
    ['422 geçersiz beden', apiError(422, 'VARIANT_NOT_FOUND')],
    ['422 desteklenmeyen site', apiError(422, 'UNSUPPORTED_SITE')],
    ['400 geçersiz istek', apiError(400, 'INVALID_REQUEST')],
    ['404 bulunamadı', apiError(404, 'NOT_FOUND')],
  ])('%s → kesin ret', (_name, error) => {
    expect(isTransientError(error)).toBe(false);
  });
});

describe('retryTransient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.assign(retryConfig, { delaysMs: [600, 1500], slowFailureMs: 10_000 });
  });
  afterEach(() => jest.useRealTimers());

  it('ilk denemede başarılıysa bekletmeden döner', async () => {
    const operation = jest.fn().mockResolvedValue('tamam');
    await expect(retryTransient(operation)).resolves.toBe('tamam');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('geçici hatada artan beklemeyle (600ms, sonra 1,5sn) yeniden dener ve sonunda başarır', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockRejectedValueOnce(apiError(502, 'FETCH_FAILED'))
      .mockResolvedValue('tamam');
    let result: unknown;
    retryTransient(operation).then((v) => (result = v));

    await jest.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(599);
    expect(operation).toHaveBeenCalledTimes(1); // henüz beklemede
    await jest.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1499);
    expect(operation).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(operation).toHaveBeenCalledTimes(3);
    expect(result).toBe('tamam');
  });

  it('tüm denemeler geçici hatayla biterse (toplam 3) SON hatayı fırlatır', async () => {
    const last = apiError(502, 'FETCH_FAILED', 'Ürün sayfasına ulaşılamadı');
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('a'))
      .mockRejectedValueOnce(new TypeError('b'))
      .mockRejectedValueOnce(last);
    const outcome = retryTransient(operation).catch((e) => e);

    await jest.advanceTimersByTimeAsync(600 + 1500);

    expect(await outcome).toBe(last);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('kesin retleri (limit doldu, geçersiz beden) HİÇ yeniden denemez', async () => {
    const refusal = apiError(403, 'PREMIUM_LIMIT_REACHED');
    const operation = jest.fn().mockRejectedValue(refusal);

    await expect(retryTransient(operation)).rejects.toBe(refusal);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('uzun süren başarısızlığı (ör. 30 sn\'lik tarama zaman aşımı) yeniden denemez — kullanıcıyı bir dakika daha bekletmez', async () => {
    const slowFailure = jest.fn(
      () => new Promise((_resolve, reject) => setTimeout(() => reject(apiError(502, 'FETCH_FAILED')), 11_000))
    );
    const outcome = retryTransient(slowFailure).catch((e) => e);

    await jest.advanceTimersByTimeAsync(11_000);

    expect(await outcome).toBeInstanceOf(ApiRequestError);
    expect(slowFailure).toHaveBeenCalledTimes(1);
  });
});
