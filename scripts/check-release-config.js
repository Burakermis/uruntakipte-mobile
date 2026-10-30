// Yayın (preview/production) build'inde eksik ya da yer tutucu yapılandırmayı build BAŞINDA reddeder.
// Neden: EXPO_PUBLIC_API_URL boş kalırsa uygulama, geliştirme için "localhost"a bağlanan varsayılana düşer ve hata
// vermeden mağazaya çıkabilir; gizlilik/koşullar adresleri boşsa "içerik yakında" sayfası görünür (mağaza reddi);
// RevenueCat anahtarı yoksa satın alma sessizce kapanır. EAS bunu `eas-build-post-install` kancasıyla çağırır
// (bkz. package.json); development build'ler kontrol edilmez. Elle: `node scripts/check-release-config.js production`.
const fs = require('fs');
const path = require('path');

const PLACEHOLDER = /REPLACE_WITH|^$|^<.*>$/i;
const isPlaceholder = (v) => v == null || PLACEHOLDER.test(String(v).trim());
const isHttps = (v) => /^https:\/\/[^\s/]+\.[^\s/]+/i.test(String(v));
const isLocal = (v) => /^https?:\/\/(localhost|127\.|10\.|192\.168\.|\[::1\])/i.test(String(v));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {Record<string,string|undefined>} env  build ortamı
 * @param {{platform?: string, appJson?: any, hasGoogleServices?: boolean}} ctx
 * @returns {string[]} sorun listesi (boşsa yapılandırma tamam)
 */
function validate(env, { platform = 'all', appJson, hasGoogleServices = true } = {}) {
  const problems = [];
  const need = (name, label, extra) => {
    const v = env[name];
    if (isPlaceholder(v)) return problems.push(`${name} tanımlı değil ya da yer tutucu (${label}).`);
    if (extra && !extra(v)) problems.push(`${name} geçersiz: "${v}" (${label}).`);
  };

  need('EXPO_PUBLIC_API_URL', 'üretim API adresi, https olmalı ve /api ile bitmeli', (v) => isHttps(v) && !isLocal(v) && /\/api\/?$/.test(v));
  need('EXPO_PUBLIC_PRIVACY_URL', 'yayınlanmış Gizlilik Politikası sayfası, https', isHttps);
  need('EXPO_PUBLIC_TERMS_URL', 'yayınlanmış Kullanım Koşulları sayfası, https', isHttps);
  if (platform === 'ios' || platform === 'all') need('EXPO_PUBLIC_REVENUECAT_IOS_KEY', 'RevenueCat iOS public SDK anahtarı');
  if (platform === 'android' || platform === 'all') {
    need('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY', 'RevenueCat Android public SDK anahtarı');
    if (!hasGoogleServices) problems.push('google-services.json yok: Android bildirimleri (FCM) için gerekli (bkz. README "Android bildirimleri").');
  }
  const projectId = appJson?.expo?.extra?.eas?.projectId;
  if (!UUID.test(String(projectId ?? ''))) problems.push('app.json > expo.extra.eas.projectId geçerli bir EAS proje kimliği (UUID) değil.');
  return problems;
}

function main() {
  const profile = process.argv[2] || process.env.EAS_BUILD_PROFILE;
  if (!profile) {
    console.log('[release-config] EAS build ortamı değil, kontrol atlandı (elle: node scripts/check-release-config.js production).');
    return 0;
  }
  if (profile === 'development') {
    console.log('[release-config] development build: kontrol atlandı.');
    return 0;
  }
  const root = path.join(__dirname, '..');
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const platform = (process.env.EAS_BUILD_PLATFORM || 'all').toLowerCase();
  // EAS, profilin eas.json `env` değerlerini build ortamına zaten enjekte eder; elle çalıştırınca da aynı
  // değerlerin görünmesi için eas.json'dan okunup (varsa gerçek ortam değişkenleri üstüne yazar) eklenir.
  let easEnv = {};
  try {
    easEnv = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8')).build?.[profile]?.env ?? {};
  } catch {
    // eas.json okunamazsa yalnızca ortam değişkenleri kullanılır
  }
  const problems = validate({ ...easEnv, ...process.env }, { platform, appJson, hasGoogleServices: fs.existsSync(path.join(root, 'google-services.json')) });
  if (problems.length === 0) {
    console.log(`[release-config] "${profile}" (${platform}) yapılandırması tamam.`);
    return 0;
  }
  console.error(`\n[release-config] "${profile}" build'i DURDURULDU — ${problems.length} sorun:\n`);
  for (const p of problems) console.error(`  ✘ ${p}`);
  console.error('\nDeğerleri eas.json > build > <profil> > env altına ya da EAS ortam değişkenlerine (eas env:create) girin.\n');
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { validate };
