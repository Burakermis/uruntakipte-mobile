import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notificationsOptOut';

// Kullanıcının Ayarlar'daki "Bildirim Ayarları" anahtarını KAPATMA tercihi. İşletim sistemi izni
// uygulamadan geri alınamadığı için (izin hâlâ "verilmiş" kalır) bu tercih ayrıca saklanıyor:
// açılışta token'ı yeniden kaydetmemek ve "bildirimler kapalı" uyarısı göstermemek için okunur;
// aksi halde kapatma bir sonraki açılışta sessizce geri alınırdı.
//
// Varsayılan "kapatmamış" (bildirim açık). Depo hataları uygulamayı bozmamalı: okuma
// başarısızsa kapatmamış sayılır, yazma başarısızsa sessizce geçilir (tema tercihiyle aynı).
export async function isNotificationsOptedOut(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setNotificationsOptedOut(optedOut: boolean): Promise<void> {
  try {
    if (optedOut) await AsyncStorage.setItem(STORAGE_KEY, '1');
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // yut — bu oturumda ekran durumu zaten güncel
  }
}
