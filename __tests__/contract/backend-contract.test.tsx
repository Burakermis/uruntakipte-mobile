import fs from 'fs';
import path from 'path';
import React from 'react';
import { screen } from '@testing-library/react-native';
import * as api from '../../src/api';
import { canNotifyOnBackInStock } from '../../src/availability';
import { PremiumScreen } from '../../src/screens/PremiumScreen';
import type { Availability } from '../../src/types';
import { renderScreen } from '../../test-utils/render';

// Bu testler mobil ile yan klasördeki backend'in AYNI şeyi söylediğini doğrular:
// mobil bazı backend sabitlerini ekranda metin olarak, bazı kuralları ise kendi
// içinde tekrar uyguluyor. Biri değişip diğeri unutulursa kullanıcıya verilen söz
// (ör. "1 dakikada bir kontrol") ile gerçek davranış ayrışır. Backend klasörü
// yoksa (mobil tek başına klonlandıysa) atlanır.
const backendDir = path.resolve(__dirname, '../../../backend');
const hasBackend = fs.existsSync(path.join(backendDir, 'constants.js'));
const describeIfBackend = hasBackend ? describe : describe.skip;

// backend/constants.js saf bir CommonJS modülü (require içermiyor). Jest'in
// dönüştürücüsü proje dışındaki dosyalarda babel çalışma zamanını bulamıyor,
// bu yüzden dosya doğrudan değerlendiriliyor.
function loadBackendConstants() {
  const source = fs.readFileSync(path.join(backendDir, 'constants.js'), 'utf8');
  const mod = { exports: {} as any };
  new Function('module', 'exports', source)(mod, mod.exports);
  return mod.exports;
}

jest.mock('../../src/purchases', () => ({
  isPurchasesAvailable: jest.fn(() => false),
  getPremiumPackages: jest.fn(async () => ({ weekly: null, monthly: null, annual: null })),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
}));

describeIfBackend('plan limitleri (backend/constants.js ↔ Premium ekranı vaadi)', () => {
  const { TIER_LIMITS } = hasBackend ? loadBackendConstants() : ({} as any);
  const minutes = (ms: number) => ms / 60_000;

  it('Premium karşılaştırma tablosu backend\'in gerçek kontrol sıklığı ve ürün limitiyle aynı', async () => {
    await renderScreen(<PremiumScreen userId="u" onClose={jest.fn()} onOpenProducts={jest.fn()} onOpenSettings={jest.fn()} />);

    expect(screen.getByText(`${minutes(TIER_LIMITS.free.checkIntervalMs)} dk`)).toBeTruthy();
    expect(screen.getByText(`${minutes(TIER_LIMITS.premium.checkIntervalMs)} dk`)).toBeTruthy();
    expect(screen.getByText(`${TIER_LIMITS.free.maxActiveProducts} ürün`)).toBeTruthy();
    expect(Number.isFinite(TIER_LIMITS.premium.maxActiveProducts)).toBe(false); // tabloda "Sınırsız"
    expect(screen.getByText('Sınırsız')).toBeTruthy();
    // "5x daha hızlı kontrol" başlığı gerçek orandan geliyor mu?
    const ratio = TIER_LIMITS.free.checkIntervalMs / TIER_LIMITS.premium.checkIntervalMs;
    expect(screen.getByText(`${ratio}x daha hızlı kontrol`)).toBeTruthy();
    // Premium'da bekleme süresi olmadığı vaadi
    expect(TIER_LIMITS.premium.reAddCooldownMs).toBe(0);
    expect(TIER_LIMITS.free.reAddCooldownMs).toBeGreaterThan(0);
  });
});

describeIfBackend('"stoğa girince bildir" kuralı (backend NOT_CURRENTLY_PURCHASABLE ↔ mobil canNotifyOnBackInStock)', () => {
  it('her stok durumu için mobilin UI kuralı backend\'in zorunlu kıldığıyla aynı', () => {
    const { NOT_CURRENTLY_PURCHASABLE } = loadBackendConstants();
    const all: Availability[] = ['in_stock', 'low_stock', 'coming_soon', 'out_of_stock'];

    for (const availability of all) {
      expect({ availability, mobile: canNotifyOnBackInStock(availability) }).toEqual({
        availability,
        mobile: NOT_CURRENTLY_PURCHASABLE.has(availability),
      });
    }
  });
});

describeIfBackend('tarama zaman aşımı (backend SCRAPE_JOB_TIMEOUT_MS ↔ mobil istek zaman aşımı)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('mobil, backend işi bitirmek için 30 sn beklerken vazgeçmez (backend süresi + pay kadar bekler)', async () => {
    const { SCRAPE_JOB_TIMEOUT_MS } = loadBackendConstants();
    (global as any).fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
    );
    let settled = false;
    api.resolveProduct('https://x.com/p').then(
      () => (settled = true),
      () => (settled = true)
    );

    await jest.advanceTimersByTimeAsync(SCRAPE_JOB_TIMEOUT_MS + 1000);

    expect(settled).toBe(false);
  });
});

describeIfBackend('HTTP rotaları (backend route tanımları ↔ mobil api.ts çağrıları)', () => {
  // server.js'teki `app.use('/api/xxx', ..., xxxRouter)` bağlantıları + her
  // routes/*.js içindeki `router.<metot>('<yol>')` tanımlarından rota tablosu.
  function backendRoutes() {
    const server = fs.readFileSync(path.join(backendDir, 'server.js'), 'utf8');
    const requires = new Map<string, string>(); // değişken -> dosya adı
    for (const m of server.matchAll(/const (\w+) = require\('\.\/routes\/(\w+)'\)/g)) requires.set(m[1], m[2]);

    const routes: { method: string; pattern: RegExp; label: string }[] = [];
    for (const m of server.matchAll(/app\.use\('(\/[^']+)'[^)]*?\b(\w+Router)\)/g)) {
      const [, mount, variable] = m;
      const file = requires.get(variable);
      if (!file) continue;
      const source = fs.readFileSync(path.join(backendDir, 'routes', `${file}.js`), 'utf8');
      for (const r of source.matchAll(/router\.(get|post|put|delete|patch)\('([^']*)'/g)) {
        const full = (mount + (r[2] === '/' ? '' : r[2])).replace(/:\w+/g, '[^/]+');
        routes.push({ method: r[1].toUpperCase(), pattern: new RegExp(`^${full}$`), label: `${r[1].toUpperCase()} ${mount}${r[2]}` });
      }
    }
    return routes;
  }

  it('mobilin çağırdığı her uç nokta backend\'de tanımlı (yol + HTTP metodu)', async () => {
    const routes = backendRoutes();
    expect(routes.length).toBeGreaterThan(5); // ayrıştırma çalışıyor mu

    const seen: { method: string; pathname: string }[] = [];
    (global as any).fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
      seen.push({ method: (init.method ?? 'GET').toUpperCase(), pathname: new URL(url).pathname });
      return { ok: true, status: 200, json: async () => ({}) };
    });

    await Promise.all([
      api.resolveProduct('https://x.com/p'),
      api.createTrackedProduct({ userId: 'u', url: 'https://x.com/p', sku: 's' }),
      api.listTrackedProducts('u'),
      api.deleteTrackedProduct(1, 'u'),
      api.checkTrackedProductNow(1, 'u'),
      api.registerDevice('u', 't', 'ios'),
      api.getUserLimits('u'),
      api.setPremium('u', true),
      api.syncPremiumStatus('u'),
    ]);

    expect(seen).toHaveLength(9);
    for (const call of seen) {
      const match = routes.find((r) => r.method === call.method && r.pattern.test(call.pathname));
      expect({ call: `${call.method} ${call.pathname}`, definedInBackend: !!match }).toEqual({
        call: `${call.method} ${call.pathname}`,
        definedInBackend: true,
      });
    }
  });
});
