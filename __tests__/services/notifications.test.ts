import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { waitFor } from '@testing-library/react-native';
import * as dialogStore from '../../src/dialog/dialogStore';
import {
  registerForPushNotificationsAsync,
  showNotificationsOffAlert,
  showNotificationsOffAtLaunchAlert,
} from '../../src/notifications';

const getPermissions = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissions = jest.mocked(Notifications.requestPermissionsAsync);
const getToken = jest.mocked(Notifications.getExpoPushTokenAsync);
const setChannel = jest.mocked(Notifications.setNotificationChannelAsync);

// jest.setup.ts'in varsayılan yapılandırmasındaki geçerli (UUID) projectId.
const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

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

  it('kullanıcı reddederse token İSTEMEZ ve "denied" döner (izin penceresi bu çağrıda açıldı)', async () => {
    getPermissions.mockResolvedValue({ status: 'undetermined' } as any);
    requestPermissions.mockResolvedValue({ status: 'denied' } as any);

    const result = await registerForPushNotificationsAsync();

    expect(result).toEqual({ status: 'denied', prompted: true });
    expect(getToken).not.toHaveBeenCalled();
  });

  it('izin daha önce reddedilmiş ve OS tekrar sormuyorsa (canAskAgain=false) izin istemez; prompted=false döner', async () => {
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false } as any);

    const result = await registerForPushNotificationsAsync();

    expect(requestPermissions).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'denied', prompted: false });
  });

  // Pencerenin açıldığı yalnızca İLK sormada kesin; daha önce reddedilmişse (Android) istek pencere
  // açmadan da "reddedildi" dönebilir → kullanıcı kapalı olduğunu bilmeyebilir, prompted=false.
  it('daha önce reddedilmiş ama OS hâlâ soruyorsa (Android ilk ret) tekrar sorar; pencere açıldığı KESİN olmadığından prompted=false', async () => {
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true } as any);
    requestPermissions.mockResolvedValue({ status: 'denied' } as any);

    const result = await registerForPushNotificationsAsync();

    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'denied', prompted: false });
  });

  it('geçerli EAS projectId\'yi token isteğine ekler (app.json\'dan ya da EAS build\'in easConfig\'inden)', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);

    await registerForPushNotificationsAsync();
    expect(getToken).toHaveBeenLastCalledWith({ projectId: PROJECT_ID });

    (Constants as any).expoConfig = { extra: {} };
    (Constants as any).easConfig = { projectId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' };
    await registerForPushNotificationsAsync();
    expect(getToken).toHaveBeenLastCalledWith({ projectId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' });
  });

  // Hata raporundaki asıl neden: app.json'daki yer tutucu Expo sunucusuna gidip reddediliyordu ve
  // kullanıcı "Desteklenmiyor" görüyordu.
  it.each([
    ['yer tutucu', 'REPLACE_WITH_EAS_PROJECT_ID'],
    ['UUID olmayan', 'proj-123'],
    ['boş', ''],
    ['tanımsız', undefined],
  ])('%s projectId varsa Expo sunucusuna HİÇ gitmez; "desteklenmiyor" değil "error" döner', async (_label, projectId) => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    (Constants as any).expoConfig = { extra: { eas: { projectId } } };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await registerForPushNotificationsAsync();

    expect(getToken).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'error' });
    expect((result as { reason: string }).reason).not.toMatch(/projectId|eas/i); // teknik ayrıntı kullanıcıya gösterilmez
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('npx eas-cli init'));
    warn.mockRestore();
  });

  it('Android Expo Go\'da (uzaktan push yok) izin penceresi açmadan "desteklenmiyor" der', async () => {
    Platform.OS = 'android';
    (Constants as any).executionEnvironment = 'storeClient';

    const result = await registerForPushNotificationsAsync();

    expect(result).toMatchObject({ status: 'unsupported' });
    expect((result as { reason: string }).reason).toMatch(/Expo Go/);
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('iOS\'ta Expo Go push destekler: token alınır', async () => {
    (Constants as any).executionEnvironment = 'storeClient';
    getPermissions.mockResolvedValue({ status: 'granted' } as any);

    await expect(registerForPushNotificationsAsync()).resolves.toEqual({ status: 'granted', token: 'ExponentPushToken[test]' });
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

  it('token alınamazsa (Expo hatası) çökmez; kullanıcıya teknik ayrıntı değil anlaşılır mesaj verir, ayrıntı konsola gider', async () => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    const failure = new Error('Error encountered while fetching Expo token, expected an OK response, received: 400 (body: "{}")');
    getToken.mockRejectedValue(failure);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await registerForPushNotificationsAsync();

    expect(result).toEqual({ status: 'error', reason: 'Bildirimler şu an açılamadı. Biraz sonra tekrar dene.' });
    expect(warn).toHaveBeenCalledWith(expect.any(String), failure);
    warn.mockRestore();
  });

  it.each([
    ['Expo\'nun ağ hata kodu', Object.assign(new Error('Error encountered while fetching Expo token: TypeError: x.'), { code: 'ERR_NOTIFICATIONS_NETWORK_ERROR' })],
    ['fetch\'in "Network request failed" hatası', new Error('Network request failed')],
  ])('%s → bağlantıyı kontrol etmesini söyler', async (_label, failure) => {
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    getToken.mockRejectedValue(failure);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await registerForPushNotificationsAsync();

    expect(result).toEqual({ status: 'error', reason: 'Bildirim servisine ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.' });
    warn.mockRestore();
  });
});

describe('showNotificationsOffAtLaunchAlert', () => {
  const pressButton = (text: string) => dialogStore.getState().buttons.find((b) => b.text === text)!.onPress!();

  it('bilgilendirir; "Ayarlara Git" uygulamadaki Ayarlar sekmesine götüren geri çağrıyı çalıştırır, cihaz ayarlarını açmaz', () => {
    const goToSettings = jest.fn();

    showNotificationsOffAtLaunchAlert(goToSettings);

    expect(dialogStore.getState()).toMatchObject({ visible: true, title: 'Bildirimler kapalı' });
    expect(dialogStore.getState().buttons.map((b) => b.text)).toEqual(['Şimdi Değil', 'Ayarlara Git']);

    pressButton('Şimdi Değil');
    expect(goToSettings).not.toHaveBeenCalled();
    expect(dialogStore.getState().visible).toBe(false);

    showNotificationsOffAtLaunchAlert(goToSettings);
    pressButton('Ayarlara Git');
    expect(goToSettings).toHaveBeenCalledTimes(1);
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });
});

describe('showNotificationsOffAlert', () => {
  const openSettings = jest.mocked(Linking.openSettings);
  const pressButton = (text: string) => dialogStore.getState().buttons.find((b) => b.text === text)!.onPress!();

  it('bilgilendirir ve "Ayarları Aç" ile cihazın uygulama ayarlarına götürür; "Şimdi Değil" hiçbir şey açmaz', () => {
    openSettings.mockResolvedValue(undefined);

    showNotificationsOffAlert();

    expect(dialogStore.getState()).toMatchObject({ visible: true, title: 'Bildirimler kapalı' });
    expect(dialogStore.getState().buttons.map((b) => b.text)).toEqual(['Şimdi Değil', 'Ayarları Aç']);

    pressButton('Şimdi Değil');
    expect(openSettings).not.toHaveBeenCalled();
    expect(dialogStore.getState().visible).toBe(false);

    showNotificationsOffAlert();
    pressButton('Ayarları Aç');
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('ayarlar açılamazsa kullanıcıya elle nereden açacağını söyler', async () => {
    openSettings.mockRejectedValue(new Error('açılamadı'));

    showNotificationsOffAlert();
    pressButton('Ayarları Aç');

    await waitFor(() => expect(dialogStore.getState().title).toBe('Ayarlar açılamadı'));
  });
});
