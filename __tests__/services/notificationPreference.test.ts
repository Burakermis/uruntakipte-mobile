import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isNotificationsOptedOut,
  setNotificationsOptedOut,
} from '../../src/utils/notificationPreference';

// İşletim sistemi izni uygulamadan geri alınamadığı için "bildirimleri kapat"
// tercihi ayrıca saklanır; kaybolursa kapatma sessizce geri alınır.
describe('notificationPreference', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('varsayılan olarak kapatmamış (bildirim açık) sayılır', async () => {
    await expect(isNotificationsOptedOut()).resolves.toBe(false);
  });

  it('kapatma tercihi kalıcı depoya yazılır ve okunur', async () => {
    await setNotificationsOptedOut(true);

    expect(await AsyncStorage.getItem('notificationsOptOut')).toBe('1');
    await expect(isNotificationsOptedOut()).resolves.toBe(true);
  });

  it('tekrar açılınca kayıt silinir ve bildirim açık sayılır', async () => {
    await setNotificationsOptedOut(true);
    await setNotificationsOptedOut(false);

    expect(await AsyncStorage.getItem('notificationsOptOut')).toBeNull();
    await expect(isNotificationsOptedOut()).resolves.toBe(false);
  });

  it('"1" dışındaki bir değer kapatma sayılmaz', async () => {
    await AsyncStorage.setItem('notificationsOptOut', 'true');
    await expect(isNotificationsOptedOut()).resolves.toBe(false);
  });

  describe('depo hatası uygulamayı bozmaz', () => {
    it('okuma başarısızsa kapatmamış sayılır', async () => {
      jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk hatası'));
      await expect(isNotificationsOptedOut()).resolves.toBe(false);
    });

    it('kapatma yazımı başarısız olursa hata fırlatmaz', async () => {
      jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk dolu'));
      await expect(setNotificationsOptedOut(true)).resolves.toBeUndefined();
    });

    it('silme başarısız olursa hata fırlatmaz', async () => {
      jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk hatası'));
      await expect(setNotificationsOptedOut(false)).resolves.toBeUndefined();
    });
  });
});
