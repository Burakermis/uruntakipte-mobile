import { API_BASE_URL } from '../src/api';
import { canNotifyOnBackInStock } from '../src/availability';
import type { ResolvedProduct, TrackedProduct, UserLimits } from '../src/types';
import { userLimits } from './fixtures';

// Bellekte çalışan sahte backend — `global.fetch`'i değiştirir, böylece
// testler ekran -> src/api.ts -> "HTTP" zincirinin TAMAMINI çalıştırır (api
// modülünü mock'lamak yerine). Sözleşme, backend/routes/*.js'in mobilin
// kullandığı kısmıyla aynı: resolve, ekle (alreadyTracked), listele, sil,
// check-now, limitler, cihaz kaydı, premium.

export interface RecordedRequest {
  method: string;
  path: string; // "/products/12" (API_BASE_URL çıkarılmış, sorgu dizgesiz)
  query: URLSearchParams;
  body: any;
}

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
}

type Interceptor = {
  match: (req: RecordedRequest) => boolean;
  handler: (req: RecordedRequest) => FakeResponse | Promise<FakeResponse>;
  remaining: number;
  /** Eşleşen ilk `skip` isteği normal işler, sonrakilere müdahale eder ("2. istek başarısız olsun"). */
  skip: number;
};

export interface InterceptOptions {
  times?: number;
  after?: number;
}

export interface FakeBackendOptions {
  userId?: string;
  products?: TrackedProduct[];
  catalog?: ResolvedProduct[];
  limits?: Partial<UserLimits>;
}

function respond(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function apiError(status: number, error: string, message: string, extra: object = {}): FakeResponse {
  return respond(status, { error, message, ...extra });
}

export function createFakeBackend(options: FakeBackendOptions = {}) {
  const userId = options.userId ?? 'test-device';
  let products: TrackedProduct[] = [...(options.products ?? [])];
  const catalog = new Map<string, ResolvedProduct>((options.catalog ?? []).map((p) => [p.canonicalUrl, p]));
  const limitOverrides: Partial<UserLimits> = { ...options.limits };
  const calls: RecordedRequest[] = [];
  const interceptors: Interceptor[] = [];
  let nextId = Math.max(0, ...products.map((p) => p.id)) + 1;

  // Backend limiti ÜRÜN bazında sayıyor (DISTINCT target_id — bkz. backend/store/
  // subscriptionStore.js countActiveByUser): aynı ürünün birden çok bedeni tek slot.
  const activeProductCount = () => new Set(products.map((p) => p.canonicalUrl)).size;

  function currentLimits(): UserLimits {
    const base = userLimits({ userId, activeCount: activeProductCount() });
    const merged = { ...base, ...limitOverrides };
    // Premium'da sınır yok — backend de null döndürüyor.
    return merged.isPremium ? { ...merged, maxActiveProducts: null } : merged;
  }

  function findSize(resolved: ResolvedProduct, sku: string) {
    for (const c of resolved.colors) {
      const s = c.sizes.find((x) => x.sku === sku);
      if (s) return { color: c, size: s };
    }
    return null;
  }

  function route(req: RecordedRequest): FakeResponse {
    const { method, path, body } = req;

    if (method === 'POST' && path === '/products/resolve') {
      const resolved = catalog.get(body.url);
      return resolved
        ? respond(200, resolved)
        : apiError(400, 'UNSUPPORTED_SITE', 'Bu bağlantı desteklenen bir siteye ait değil.');
    }

    if (method === 'POST' && path === '/products') {
      const resolved = catalog.get(body.url);
      const hit = resolved && findSize(resolved, body.sku);
      if (!resolved || !hit) return apiError(404, 'SKU_NOT_FOUND', 'Seçilen beden bulunamadı.');

      const existing = products.find((p) => p.canonicalUrl === resolved.canonicalUrl && p.sku === body.sku);
      if (existing) return respond(200, { ...existing, alreadyTracked: true });

      // Ürün için zaten bir slot varsa (başka bir bedeni takipte) limit uygulanmaz.
      const hasProductSlot = products.some((p) => p.canonicalUrl === resolved.canonicalUrl);
      const limits = currentLimits();
      if (!hasProductSlot && !limits.isPremium && activeProductCount() >= (limits.maxActiveProducts ?? Infinity)) {
        return apiError(
          403,
          'PREMIUM_LIMIT_REACHED',
          "Ücretsiz planda en fazla 3 ürün takip edebilirsin. Daha fazlası için Premium'a geç."
        );
      }

      const row: TrackedProduct = {
        id: nextId++,
        userId: body.userId,
        brand: resolved.brand,
        productId: resolved.productId,
        name: resolved.name,
        imageUrl: resolved.imageUrl,
        canonicalUrl: resolved.canonicalUrl,
        color: hit.color.name,
        size: hit.size.size,
        sku: hit.size.sku,
        lastPrice: hit.size.price,
        currency: hit.size.currency,
        lastAvailability: hit.size.availability,
        notifyOnPriceDrop: true,
        notifyOnBackInStock: canNotifyOnBackInStock(hit.size.availability),
        createdAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        priceChangePercent: null,
      };
      products.push(row);
      return respond(201, { ...row, alreadyTracked: false });
    }

    if (method === 'GET' && path === '/products') {
      return respond(200, products.filter((p) => p.userId === req.query.get('userId')));
    }

    const del = path.match(/^\/products\/(\d+)$/);
    if (method === 'DELETE' && del) {
      const id = Number(del[1]);
      if (!products.some((p) => p.id === id)) return apiError(404, 'NOT_FOUND', 'Takip bulunamadı.');
      products = products.filter((p) => p.id !== id);
      return respond(204, undefined);
    }

    const check = path.match(/^\/products\/(\d+)\/check-now$/);
    if (method === 'POST' && check) return respond(200, { id: Number(check[1]), ok: true });

    if (method === 'GET' && /^\/users\/[^/]+\/limits$/.test(path)) return respond(200, currentLimits());

    if (method === 'POST' && /^\/users\/[^/]+\/(premium|sync-premium)$/.test(path)) {
      if (path.endsWith('/premium')) limitOverrides.isPremium = body.isPremium;
      else limitOverrides.isPremium = true; // sync: RevenueCat doğruladı varsayımı
      return respond(200, { userId, isPremium: !!limitOverrides.isPremium });
    }

    if (method === 'POST' && path === '/devices') return respond(200, {});

    return apiError(404, 'NO_ROUTE', `${method} ${path} sahte backend'de tanımlı değil`);
  }

  const fetchImpl = jest.fn(async (url: string, init: RequestInit = {}) => {
    const parsed = new URL(url);
    const basePath = new URL(API_BASE_URL).pathname.replace(/\/$/, '');
    const req: RecordedRequest = {
      method: (init.method ?? 'GET').toUpperCase(),
      path: parsed.pathname.slice(basePath.length) || '/',
      query: parsed.searchParams,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
    calls.push(req);

    const interceptor = interceptors.find((i) => i.remaining > 0 && i.match(req));
    if (interceptor) {
      if (interceptor.skip > 0) {
        interceptor.skip -= 1;
        return route(req);
      }
      interceptor.remaining -= 1;
      return interceptor.handler(req);
    }
    return route(req);
  });

  const requestMatcher = (spec: string) => (req: RecordedRequest) => {
    const [method, pattern] = spec.split(' ');
    return req.method === method && (pattern.endsWith('*') ? req.path.startsWith(pattern.slice(0, -1)) : req.path === pattern);
  };

  return {
    userId,
    fetch: fetchImpl,
    calls,
    get products() {
      return products;
    },
    /** "POST /products" biçiminde (sonu * ise önek) eşleşen çağrılar. */
    callsTo(spec: string) {
      return calls.filter(requestMatcher(spec));
    },
    addProduct(product: ResolvedProduct) {
      catalog.set(product.canonicalUrl, product);
    },
    setLimits(next: Partial<UserLimits>) {
      Object.assign(limitOverrides, next);
    },
    /** Eşleşen istek(ler)e sahte bir hata yanıtı verir. */
    failWith(spec: string, status: number, error: string, message: string, { times = 1, after = 0 }: InterceptOptions = {}) {
      interceptors.push({ match: requestMatcher(spec), remaining: times, skip: after, handler: () => apiError(status, error, message) });
    },
    /** Sunucuya hiç ulaşılamıyor (offline) — fetch TypeError ile reddedilir. */
    networkDown(spec: string, { times = 1, after = 0 }: InterceptOptions = {}) {
      interceptors.push({
        match: requestMatcher(spec),
        remaining: times,
        skip: after,
        handler: () => {
          throw new TypeError('Network request failed');
        },
      });
    },
    /** Eşleşen isteği `release()` çağrılana kadar bekletir — yükleniyor/iyimser durumları gözlemlemek için. */
    hold(spec: string) {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let arrived!: () => void;
      const arrival = new Promise<void>((resolve) => (arrived = resolve));
      interceptors.push({
        match: requestMatcher(spec),
        remaining: 1,
        skip: 0,
        handler: async (req) => {
          arrived();
          await gate;
          return route(req);
        },
      });
      return { release, arrival };
    },
  };
}

export type FakeBackend = ReturnType<typeof createFakeBackend>;

export function installFakeBackend(options?: FakeBackendOptions): FakeBackend {
  const backend = createFakeBackend(options);
  (global as any).fetch = backend.fetch;
  return backend;
}
