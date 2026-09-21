import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '../../src/notifications';

const getPermissions = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissions = jest.mocked(Notifications.requestPermissionsAsync);
const getToken = jest.mocked(Notifications.getExpoPushTokenAsync);
const setChannel = jest.mocked(Notifications.setNotificationChannelAsync);

// Push izni akışı: kullanıcı fiyat/stok bildirimlerinin tek yolu bu — yanlış bir
// dal (ör. izin verilmişken tekrar sormak, reddedilmişken token istemek) ya
// kullanıcıyı gereksiz diyaloglara boğar ya da bildirimi sessizce öldürür.
describe('registerForPushNotificationsAsync', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
    (Device as any).isDevice = true;
  });

  it('web önizlemede izin sormadan "desteklenmiyor" der', async () => {
    Platform.OS = 'web';

    const result = await registerForPushNotificationsAsync();

    expect(result).toMatchObject({ status: 'unsupported' });
    expect(getPermissions).not.toHaveBeenCalled();
  });

  it('simülatör/emülatörde izin sormadan "desteklenmiyor" der', async () => {
    (Device as any).isDevice = false;

    const result = await registerForPushNotificationsAsync();

    expect(result).toMatchObject({ status: 'unsupported' });
    expect((result as { reason: string }).reason).toMatch(/gerçek cihaz/);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('izin zaten verilmişse OS diyaloğunu tekrar açmadan token döndürür', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);

    const result = await registerForPushNotificationsAsync();

    expect(requestPermissions).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'granted', token: 'ExponentPushToken[test]' });
  });

  it('izin henüz sorulmadıysa ister; kullanıcı kabul ederse token alır', async () => {
    getPermissions.mockResolvedValue({ status: 'undetermined' } as any);
    requestPermissions.mockResolvedValue({ status: 'granted' } as any);

    const result = await registerForPushNotificationsAsync();

    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'granted', token: 'ExponentPushToken[test]' });
  });

  it('kullanıcı reddederse token İSTEMEZ ve "denied" döner', async () => {
    getPermissions.mockResolvedValue({ status: 'undetermined' } as any);
    requestPermissions.mockResolvedValue({ status: 'denied' } as any);

    const result = await registerForPushNotificationsAsync();

    expect(result).toEqual({ status: 'denied' });
    expect(getToken).not.toHaveBeenCalled();
  });

  it('EAS projectId tanımlıysa token isteğine ekler, tanımsızsa hiç göndermez (Expo Go)', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);

    (Constants as any).expoConfig = { extra: { eas: { projectId: 'proj-123' } } };
    await registerForPushNotificationsAsync();
    expect(getToken).toHaveBeenLastCalledWith({ projectId: 'proj-123' });

    (Constants as any).expoConfig = { extra: {} };
    await registerForPushNotificationsAsync();
    expect(getToken).toHaveBeenLastCalledWith(undefined);
  });

  // Android 13+: kanal oluşturulmadan izin penceresi HİÇ çıkmıyor (Expo notifications dokümanı) —
  // kullanıcı izin veremez, bildirim hiç gelmez.
  it('Android\'de izin istenmeden ÖNCE bildirim kanalı oluşturulur', async () => {
    Platform.OS = 'android';
    getPermissions.mockResolvedValue({ status: 'undetermined' } as any);

    await registerForPushNotificationsAsync();

    expect(setChannel).toHaveBeenCalledWith('default', expect.objectContaining({ name: expect.any(String), importance: 4 }));
    expect(setChannel.mock.invocationCallOrder[0]).toBeLessThan(requestPermissions.mock.invocationCallOrder[0]);
    expect(setChannel.mock.invocationCallOrder[0]).toBeLessThan(getToken.mock.invocationCallOrder[0]);
  });

  it('iOS\'ta kanal oluşturulmaz', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    await registerForPushNotificationsAsync();
    expect(setChannel).not.toHaveBeenCalled();
  });

  it('Android\'de kanal oluşturulamasa da izin/token akışı engellenmez', async () => {
    Platform.OS = 'android';
    setChannel.mockRejectedValue(new Error('kanal hatası'));
    getPermissions.mockResolvedValue({ status: 'granted' } as any);

    await expect(registerForPushNotificationsAsync()).resolves.toEqual({ status: 'granted', token: 'ExponentPushToken[test]' });
  });

  it('token alınamazsa (ağ/Expo hatası) çökmez; nedenini kullanıcıya gösterilebilir mesajla döner', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    getToken.mockRejectedValue(new Error('Network request failed'));

    const result = await registerForPushNotificationsAsync();

    expect(result).toEqual({
      status: 'unsupported',
      reason: 'Push token alınamadı: Network request failed',
    });
  });
});
