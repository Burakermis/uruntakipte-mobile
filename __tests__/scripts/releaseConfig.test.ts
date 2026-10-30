import { validate } from '../../scripts/check-release-config';

const appJson = { expo: { extra: { eas: { projectId: '9c00dd3b-3927-4c3e-8590-28b0e837977f' } } } };
const good = {
  EXPO_PUBLIC_API_URL: 'https://api.uruntakipte.com/api',
  EXPO_PUBLIC_PRIVACY_URL: 'https://uruntakipte.com/gizlilik/',
  EXPO_PUBLIC_TERMS_URL: 'https://uruntakipte.com/kosullar/',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_abc123',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_abc123',
};
const names = (problems: string[]) => problems.map((p) => p.split(' ')[0]);

describe('validate (yayın build yapılandırma koruması)', () => {
  it('eksiksiz yapılandırmada sorun yok', () => {
    expect(validate(good, { platform: 'all', appJson })).toEqual([]);
  });

  it('bugünkü gibi yer tutuculu ya da boş değerlerin HEPSİNİ raporlar', () => {
    const placeholders = Object.fromEntries(Object.keys(good).map((k) => [k, `REPLACE_WITH_${k}`]));
    const problems = validate(placeholders, { platform: 'all', appJson });
    expect(names(problems)).toEqual(Object.keys(good));
    expect(names(validate({}, { platform: 'all', appJson }))).toEqual(Object.keys(good));
  });

  it('API adresi: localhost / http / /api eksik kabul edilmez (uygulama sessizce yerel adrese bağlanmasın)', () => {
    for (const bad of ['http://localhost:4000/api', 'https://192.168.1.5/api', 'http://api.uruntakipte.com/api', 'https://api.uruntakipte.com', '']) {
      expect(names(validate({ ...good, EXPO_PUBLIC_API_URL: bad }, { platform: 'ios', appJson }))).toEqual(['EXPO_PUBLIC_API_URL']);
    }
    expect(validate({ ...good, EXPO_PUBLIC_API_URL: 'https://api.uruntakipte.com/api/' }, { platform: 'ios', appJson })).toEqual([]);
  });

  it('gizlilik/koşullar adresleri https olmalı', () => {
    expect(names(validate({ ...good, EXPO_PUBLIC_PRIVACY_URL: 'http://x.com/g', EXPO_PUBLIC_TERMS_URL: 'yok' }, { platform: 'ios', appJson }))).toEqual([
      'EXPO_PUBLIC_PRIVACY_URL',
      'EXPO_PUBLIC_TERMS_URL',
    ]);
  });

  it('RevenueCat anahtarı yalnızca derlenen platform için istenir', () => {
    const { EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: _a, ...iosOnly } = good;
    expect(validate(iosOnly, { platform: 'ios', appJson })).toEqual([]);
    expect(names(validate(iosOnly, { platform: 'android', appJson }))).toEqual(['EXPO_PUBLIC_REVENUECAT_ANDROID_KEY']);
    const { EXPO_PUBLIC_REVENUECAT_IOS_KEY: _i, ...androidOnly } = good;
    expect(validate(androidOnly, { platform: 'android', appJson })).toEqual([]);
    expect(names(validate(androidOnly, { platform: 'ios', appJson }))).toEqual(['EXPO_PUBLIC_REVENUECAT_IOS_KEY']);
  });

  it('Android build\'inde google-services.json yoksa durdurur; iOS\'ta istemez', () => {
    expect(validate(good, { platform: 'android', appJson, hasGoogleServices: false })[0]).toMatch(/google-services\.json/);
    expect(validate(good, { platform: 'ios', appJson, hasGoogleServices: false })).toEqual([]);
  });

  it('EAS proje kimliği geçerli bir UUID olmalı', () => {
    const bad = { expo: { extra: { eas: { projectId: 'REPLACE_WITH_EAS_PROJECT_ID' } } } };
    expect(validate(good, { platform: 'ios', appJson: bad })[0]).toMatch(/projectId/);
    expect(validate(good, { platform: 'ios', appJson: {} })[0]).toMatch(/projectId/);
  });
});
