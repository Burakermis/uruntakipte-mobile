// Çökme / hata izleme (Sentry). EXPO_PUBLIC_SENTRY_DSN yoksa TAMAMEN kapalıdır (SDK yüklenmez, çağrılar no-op);
// geliştirme modunda da (__DEV__) kapalı — yerel hatalar kirletmesin. Gizlilik: kişisel veri göndermiyoruz
// (sendDefaultPii kapalı) ve olaylar gönderilmeden önce temizlenir: kullanıcı bilgisi atılır, adreslerdeki
// userId maskelenir (backend/middleware/requestLog.js ile aynı kural). Sentry'yi AÇARSAN gizlilik politikası ve
// mağazaların veri beyanları (Apple App Privacy, Google Data safety: "Çökme verisi") güncellenmeli.

const KEEP = 6;

// "?userId=<id>" ve "/users/<id>" değerlerini ilk 6 karaktere maskeler.
export function scrubUrl(url: string): string {
  const mask = (id: string) => (id.length > KEEP ? `${id.slice(0, KEEP)}***` : '***');
  return url
    .replace(/([?&]userId=)([^&#\s]+)/gi, (_m, prefix: string, id: string) => prefix + mask(id))
    .replace(/(\/users\/)([^/?#\s]+)/gi, (_m, prefix: string, id: string) => prefix + mask(id));
}

type SentryLikeEvent = {
  user?: unknown;
  request?: { url?: string; query_string?: unknown; headers?: Record<string, string>; data?: unknown; cookies?: unknown };
  breadcrumbs?: { data?: { url?: string } }[];
};

export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  delete event.user;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers; // Authorization dahil tüm başlıklar
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    if (typeof event.request.query_string === 'string') event.request.query_string = scrubUrl(`?${event.request.query_string}`).slice(1);
  }
  for (const b of event.breadcrumbs ?? []) if (b?.data?.url) b.data.url = scrubUrl(b.data.url);
  return event;
}

let sentry: typeof import('@sentry/react-native') | null = null;

/** Çağrı güvenlidir (idempotent). Başlatıldıysa true. */
export function initMonitoring(): boolean {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || __DEV__) return false;
  if (sentry) return true;
  // Gevşek yükleme: DSN yoksa SDK hiç çalıştırılmaz.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
  sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0, // yalnızca hata izleme; performans izleme kapalı
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: (event) => scrubEvent(event as SentryLikeEvent) as typeof event,
    beforeBreadcrumb: (breadcrumb) => {
      if (breadcrumb.data?.url) breadcrumb.data.url = scrubUrl(String(breadcrumb.data.url));
      return breadcrumb;
    },
  });
  return true;
}

/** Beklenmeyen bir hatayı bildirir (bağlantı hataları gibi beklenen durumlar için ÇAĞIRMA). */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  sentry?.captureException(error instanceof Error ? error : new Error(String(error)), context ? { extra: context } : undefined);
}
