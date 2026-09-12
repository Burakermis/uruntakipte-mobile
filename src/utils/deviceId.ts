import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'deviceId';

// Uygulamanın login sistemi yok — kimlik, cihazda üretilip AsyncStorage'da
// saklanan rastgele bir UUID. Backend'deki userStore.getOrCreate() görülmemiş
// herhangi bir opak id'yi otomatik ücretsiz kullanıcı olarak kaydediyor, bu
// yüzden deviceId doğrudan mevcut userId parametresinin yerine geçebiliyor.
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const generated = Crypto.randomUUID();
  await AsyncStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
