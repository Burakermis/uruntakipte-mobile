import { ApiRequestError, CONNECTION_MESSAGE, ConnectionError, TIMEOUT_MESSAGE } from '../../src/api';
import { describeError, describePurchaseError, explainFailure, GENERIC_ERROR_MESSAGE, SERVER_BUSY_MESSAGE } from '../../src/utils/errors';

const api = (status: number, code: string, message: string) => new ApiRequestError({ error: code, message }, status);

// Kullanıcıya "ne oldu, ne yapabilirim" söylenir: kural (limit…), bağlantı, sunucu — ham istisna metni değil.
describe('explainFailure — birden çok başarısızlıktan tek, anlaşılır neden', () => {
  it('KESİN ret her şeyden önce gelir (sunucunun kendi gerekçesi): "sonra tekrar dene" yanıltıcı olurdu', () => {
    const refusal = api(403, 'PREMIUM_LIMIT_REACHED', "Ücretsiz planda en fazla 3 ürün takip edebilirsin.");
    expect(explainFailure([new ConnectionError('offline'), refusal])).toBe("Ücretsiz planda en fazla 3 ürün takip edebilirsin.");
  });

  it('bağlantı yoksa "Bağlantı kurulamadı…", yalnızca zaman aşımıysa zaman aşımı mesajı verir', () => {
    expect(explainFailure([new ConnectionError('offline')])).toBe(CONNECTION_MESSAGE);
    expect(explainFailure([new ConnectionError('timeout')])).toBe(TIMEOUT_MESSAGE);
    expect(explainFailure([new ConnectionError('timeout'), new ConnectionError('offline')])).toBe(TIMEOUT_MESSAGE); // ilk bağlantı hatası
  });

  it('geçici sunucu hatasında sunucunun gerekçesini korur ve "sonra tekrar deneyin" yönlendirmesini ekler', () => {
    expect(explainFailure([api(502, 'PARSE', 'Sayfa okunamadı')])).toBe('Sayfa okunamadı. Lütfen daha sonra tekrar deneyin.');
    expect(explainFailure([api(502, 'X', 'Sayfa okunamadı.')])).toBe('Sayfa okunamadı. Lütfen daha sonra tekrar deneyin.');
  });

  it('sunucu mesajı zaten "tekrar deneyin" diyorsa aynen kullanır (çift yönlendirme yok)', () => {
    const message = 'Ürün sayfasına ulaşılamadı, lütfen daha sonra tekrar deneyin.';
    expect(explainFailure([api(502, 'FETCH_FAILED', message)])).toBe(message);
  });

  it('mesajsız geçici sunucu hatasında genel "sunucu yanıt veremiyor" metnine düşer', () => {
    expect(explainFailure([api(503, 'X', '')])).toBe(SERVER_BUSY_MESSAGE);
  });

  it('tanınmayan istisnada ham metni sızdırmaz', () => {
    expect(explainFailure([new Error('TypeError: undefined is not an object (evaluating x.y)')])).toBe(GENERIC_ERROR_MESSAGE);
    expect(explainFailure([])).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('describeError', () => {
  it('bağlantı ve API hatalarında açıklayıcı metin, diğerlerinde çağıranın verdiği yedek metin', () => {
    expect(describeError(new ConnectionError('offline'))).toBe(CONNECTION_MESSAGE);
    expect(describeError(api(422, 'UNSUPPORTED_SITE', 'Bu site şu an desteklenmiyor.'))).toBe('Bu site şu an desteklenmiyor.');
    expect(describeError(new Error('iç hata'), 'Ürün bilgisi güncellenemedi.')).toBe('Ürün bilgisi güncellenemedi.');
    expect(describeError(undefined)).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe('describePurchaseError (RevenueCat hata kodları)', () => {
  it.each(['10', '32', '35'])('bağlantı kodu %s → "Bağlantı kurulamadı"', (code) => {
    expect(describePurchaseError({ code })).toBe(CONNECTION_MESSAGE);
  });

  it('bilinen nedenleri (mağaza sorunu, zaten abone, ödeme onayda) Türkçe ve yönlendirmeyle açıklar', () => {
    expect(describePurchaseError({ code: '2' })).toMatch(/Mağazaya şu an ulaşılamıyor/);
    expect(describePurchaseError({ code: '6' })).toMatch(/Geri Yükle/);
    expect(describePurchaseError({ code: '20' })).toMatch(/onay bekliyor/);
  });

  it('bilinmeyen kodda (ya da kodsuz hatada) yedek metni verir; İngilizce ham mesajı göstermez', () => {
    expect(describePurchaseError({ code: '999', message: 'Something went wrong' }, 'yedek')).toBe('yedek');
    expect(describePurchaseError(null)).toBe(GENERIC_ERROR_MESSAGE);
  });
});
