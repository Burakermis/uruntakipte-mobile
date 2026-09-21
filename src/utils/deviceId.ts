import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'deviceId';

// Uygulamanın login sistemi yok — kimlik, cihazda üretilip AsyncStorage'da
// saklanan rastgele bir UUID. Backend'deki userStore.getOrCreate() görülmemiş
// herhangi bir opak id'yi otomatik ücretsiz kullanıcı olarak kaydediyor, bu
// yüzden deviceId doğrudan mevcut userId parametresinin yerine geçebiliyor.
//
// Depo hatası uygulamayı açılış ekranında kilitlememeli (App.tsx kimlik gelmeden
// hiçbir ekranı çizmiyor):
//  - Okuma başarısız: mevcut kimliğin ne olduğunu BİLMİYORUZ. Yeni bir kimliği
//    depoya YAZMAYIZ — geçici bir okuma hatası, kullanıcının kayıtlı kimliğinin
//    (ve takiplerinin) kalıcı olarak üzerine yazılmasına yol açardı. Yalnızca bu
//    oturum için geçici bir kimlik kullanılır; depo düzelince eski kimlik döner.
//  - Yazma başarısız (ilk açılış): üretilen kimlik oturum boyunca kullanılır.
export async function getOrCreateDeviceId(): Promise<string> {
  let existing: string | null;
  try {
    existing = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return Crypto.randomUUID();
  }
  if (existing) return existing;

  const generated = Crypto.randomUUID();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, generated);
  } catch {
    // yut — kimlik bu oturum için geçerli
  }
  return generated;
}
