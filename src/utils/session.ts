import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { registerSession } from '../api';

const STORAGE_KEY = 'session';
const LEGACY_DEVICE_ID_KEY = 'deviceId';

export interface Session {
  userId: string;
  token: string;
}

// Kimlik artık İSTEMCİDE üretilmiyor: ilk açılışta sunucudan bir userId ve onu
// imzalayan bir erişim anahtarı (token) alınır (POST /auth/register) ve her istekte
// `Authorization: Bearer` ile gönderilir. userId'yi bilmek tek başına artık yetmez.
// Token cihazın güvenli deposunda (iOS Keychain / Android Keystore) saklanır; güvenli
// depo olmayan ortamda (web önizlemesi) AsyncStorage'a düşer.
//
// Depo hatası uygulamayı açılış ekranında kilitlememeli ama mevcut kimliği de ezmemeli:
//  - Okuma başarısız: kayıtlı kimliğin ne olduğunu BİLMİYORUZ. Yeni kimliği depoya YAZMAYIZ
//    (geçici bir okuma hatası, kullanıcının kayıtlı kimliğinin ve takiplerinin kalıcı olarak
//    üzerine yazılmasına yol açardı); yalnızca bu oturum için yeni bir kimlik kullanılır.
//  - Yazma başarısız (ilk açılış): alınan kimlik oturum boyunca kullanılır.
// Kayıt isteği başarısızsa hata fırlatılır (App "tekrar dene" gösterir): kimliksiz ilerlenemez.

async function secureAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function readStored(): Promise<string | null> {
  if (await secureAvailable()) return SecureStore.getItemAsync(STORAGE_KEY);
  return AsyncStorage.getItem(STORAGE_KEY);
}

async function writeStored(value: string): Promise<void> {
  if (await secureAvailable()) await SecureStore.setItemAsync(STORAGE_KEY, value);
  else await AsyncStorage.setItem(STORAGE_KEY, value);
}

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value?.userId === 'string' && value.userId && typeof value?.token === 'string' && value.token) {
      return { userId: value.userId, token: value.token };
    }
  } catch {
    // bozuk kayıt -> yok say, yeniden kaydol
  }
  return null;
}

export async function getOrCreateSession(): Promise<Session> {
  let raw: string | null;
  try {
    raw = await readStored();
  } catch {
    return registerSession();
  }
  const existing = parse(raw);
  if (existing) return existing;

  const created = await registerSession();
  try {
    await writeStored(JSON.stringify(created));
  } catch {
    // yut — kimlik bu oturum için geçerli
  }
  // Eski sürümün istemci-üretimli kimliği artık geçersiz (sunucu onu tanımıyor); temizle.
  AsyncStorage.removeItem(LEGACY_DEVICE_ID_KEY).catch(() => {});
  return created;
}

// Sunucu token'ı reddettiğinde (401: ör. imzalama anahtarı döndürüldü) çağrılır;
// ardından getOrCreateSession() yeni bir kimlik alır.
export async function clearSession(): Promise<void> {
  try {
    if (await secureAvailable()) await SecureStore.deleteItemAsync(STORAGE_KEY);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // yut
  }
}
