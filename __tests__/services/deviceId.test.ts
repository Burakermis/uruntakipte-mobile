import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { getOrCreateDeviceId } from '../../src/utils/deviceId';

// Uygulamada login yok — kullanıcının TÜM takipleri ve premium durumu bu
// kimliğe bağlı. Her açılışta yeni id üretilirse kullanıcı ürünlerini kaybeder.
describe('getOrCreateDeviceId', () => {
  it('ilk açılışta UUID üretip kalıcı depoya yazar', async () => {
    const id = await getOrCreateDeviceId();

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await AsyncStorage.getItem('deviceId')).toBe(id);
  });

  it('sonraki açılışlarda AYNI kimliği döndürür, yenisini üretmez', async () => {
    const first = await getOrCreateDeviceId();
    const uuidCalls = jest.mocked(Crypto.randomUUID).mock.calls.length;

    const second = await getOrCreateDeviceId();

    expect(second).toBe(first);
    expect(jest.mocked(Crypto.randomUUID).mock.calls.length).toBe(uuidCalls);
  });

  it('depoda zaten bir kimlik varsa (ör. uygulama güncellemesi) onu kullanır', async () => {
    await AsyncStorage.setItem('deviceId', 'kayitli-kimlik');
    await expect(getOrCreateDeviceId()).resolves.toBe('kayitli-kimlik');
    expect(Crypto.randomUUID).not.toHaveBeenCalled();
  });

  // Depo hatası açılış ekranında kilitlenmeye yol açmamalı — ama okuma hatasında
  // yeni kimlik YAZILIRSA kullanıcının gerçek (kayıtlı) kimliği kalıcı olarak kaybolur.
  // (AsyncStorage mock'ları jest.fn — restoreAllMocks bunların gerçeklemesini de
  // sıfırlıyor, bu yüzden tek seferlik reddetme kullanılıyor.)
  describe('depo hatası', () => {
    it('okuma başarısızsa oturum için geçici kimlik verir ve depoya HİÇBİR ŞEY yazmaz (kayıtlı kimlik ezilmez)', async () => {
      await AsyncStorage.setItem('deviceId', 'kayitli-kimlik');
      const setItem = jest.mocked(AsyncStorage.setItem);
      setItem.mockClear();
      jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk hatası'));

      const id = await getOrCreateDeviceId();

      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(id).not.toBe('kayitli-kimlik');
      expect(setItem).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem('deviceId')).toBe('kayitli-kimlik'); // depo düzelince eski kimlik geri gelir
    });

    it('ilk açılışta yazma başarısız olsa da üretilen kimlikle devam eder', async () => {
      jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk dolu'));

      await expect(getOrCreateDeviceId()).resolves.toMatch(/^[0-9a-f-]{36}$/);
    });
  });
});
