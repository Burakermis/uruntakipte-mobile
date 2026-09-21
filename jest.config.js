// Birim/akış testleri — jest-expo preset'i RN + Expo modüllerini Node'da
// çalıştırmak için gereken transform/mock'ları getiriyor (bkz. Expo SDK 54
// "Unit testing with Jest" dokümanı). Testler `__tests__/` altında, ortak
// yardımcılar (sahte backend, render sarmalayıcı) `test-utils/` altında.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  // Her testten önce mock çağrı geçmişini sıfırla — testler birbirinin
  // sayaçlarına bağımlı olmasın. (Uygulama implementasyonlarını silmez.)
  clearMocks: true,
  // İlk çalıştırmada (soğuk Babel önbelleği) RN modülleri ilk render'da derleniyor.
  testTimeout: 30000,
};
