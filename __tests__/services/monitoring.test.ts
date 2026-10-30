import { captureError, initMonitoring, scrubEvent, scrubUrl } from '../../src/monitoring';

// Sentry SDK'sı gerçek ortamda native modül ister: burada sahte (Jest'te native yok). Önemli olan, bizim
// çağırdığımız seçenekler ve olayları temizleyen kancalar.
const mockSentry = { init: jest.fn(), captureException: jest.fn() };
jest.mock('@sentry/react-native', () => mockSentry, { virtual: true });

const USER = 'f8447412-8155-46c1-b04f-2e0a77aa82ea';
const original = { dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, dev: (global as any).__DEV__ };

afterEach(() => {
  process.env.EXPO_PUBLIC_SENTRY_DSN = original.dsn;
  (global as any).__DEV__ = original.dev;
  mockSentry.init.mockClear();
  mockSentry.captureException.mockClear();
});

describe('initMonitoring', () => {
  it('DSN yoksa kapalıdır: SDK başlatılmaz, captureError hata fırlatmaz', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    (global as any).__DEV__ = false;

    expect(initMonitoring()).toBe(false);
    expect(() => captureError(new Error('x'))).not.toThrow();
    expect(mockSentry.init).not.toHaveBeenCalled();
  });

  it('geliştirme modunda (__DEV__) DSN olsa da kapalıdır', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
    (global as any).__DEV__ = true;

    expect(initMonitoring()).toBe(false);
    expect(mockSentry.init).not.toHaveBeenCalled();
  });

  it('DSN varsa başlatır: kişisel veri ve performans izleme KAPALI, olay/breadcrumb temizleyici bağlı', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
    (global as any).__DEV__ = false;

    expect(initMonitoring()).toBe(true);
    expect(initMonitoring()).toBe(true); // tekrar çağrı güvenli
    expect(mockSentry.init).toHaveBeenCalledTimes(1);
    const options = mockSentry.init.mock.calls[0][0];
    expect(options).toMatchObject({ dsn: 'https://abc@o1.ingest.sentry.io/1', sendDefaultPii: false, tracesSampleRate: 0, attachScreenshot: false });

    const cleaned = options.beforeSend({ user: { id: USER }, request: { url: `https://api/x?userId=${USER}` } });
    expect(cleaned.user).toBeUndefined();
    expect(cleaned.request.url).toBe('https://api/x?userId=f84474***');
    const crumb = options.beforeBreadcrumb({ data: { url: `https://api/users/${USER}/limits` } });
    expect(crumb.data.url).toBe('https://api/users/f84474***/limits');
  });

  it('captureError: Error olmayan değerleri Error\'a çevirir ve bağlamı ekler', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/1';
    (global as any).__DEV__ = false;
    initMonitoring();

    captureError('düz metin', { ekran: 'Ayarlar' });

    const [err, hint] = mockSentry.captureException.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('düz metin');
    expect(hint).toEqual({ extra: { ekran: 'Ayarlar' } });
  });
});

describe('scrubUrl / scrubEvent', () => {
  it('userId sorgusu ve /users/<id> yolu maskelenir; kısa değerler tamamen gizlenir', () => {
    expect(scrubUrl(`/api/products?userId=${USER}&x=1`)).toBe('/api/products?userId=f84474***&x=1');
    expect(scrubUrl(`/api/users/${USER}/notifications`)).toBe('/api/users/f84474***/notifications');
    expect(scrubUrl('/api/users/abc/limits')).toBe('/api/users/***/limits');
    expect(scrubUrl('/api/health')).toBe('/api/health');
  });

  it('olaydan kullanıcı, istek gövdesi, çerez ve tüm istek başlıkları atılır', () => {
    const event = scrubEvent({
      user: { ip_address: '1.2.3.4' },
      request: { url: `https://api/u?userId=${USER}`, query_string: `userId=${USER}`, data: { a: 1 }, cookies: { s: 1 }, headers: { Authorization: 'Bearer x' } },
      breadcrumbs: [{ data: { url: `https://api/users/${USER}` } }],
    });

    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: 'https://api/u?userId=f84474***', query_string: 'userId=f84474***' });
    expect(event.breadcrumbs?.[0].data?.url).toBe('https://api/users/f84474***');
  });
});
