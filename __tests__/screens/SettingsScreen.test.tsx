import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Linking, Platform, StyleSheet, Text, useColorScheme } from 'react-native';
import { act, fireEvent, fireEventAsync, screen, waitFor, within } from '@testing-library/react-native';
import { SettingsScreen } from '../../src/screens/SettingsScreen';
import { useTheme } from '../../src/theme/ThemeProvider';
import { installFakeBackend, type FakeBackend } from '../../test-utils/fakeBackend';
import { renderScreen } from '../../test-utils/render';

// İşletim sisteminin açık/koyu şeması — testte elle sürülüyor (react-native'in `useColorScheme`
// dışa aktarımı bu iç modülün default'una bağlı).
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn() }));
const osScheme = jest.mocked(useColorScheme);

const USER = 'cihaz-1234-abcd';
const callbacks = { onOpenProducts: jest.fn(), onOpenPremium: jest.fn(), onAccountDeleted: jest.fn() };
let backend: FakeBackend;

const getPermissions = jest.mocked(Notifications.getPermissionsAsync);
const requestPermissions = jest.mocked(Notifications.requestPermissionsAsync);

// Tema durumunu görünür kılan küçük sonda — ThemeProvider'ın gerçek çözümlemesini okur.
function ThemeProbe() {
  const { mode, resolvedScheme } = useTheme();
  return <Text testID="theme-probe">{`${mode}/${resolvedScheme}`}</Text>;
}

async function renderSettings() {
  return renderScreen(
    <>
      <SettingsScreen userId={USER} {...callbacks} />
      <ThemeProbe />
    </>
  );
}

// SettingsRow'un satır kabuğu (yatay, iki yana yaslı) — etiketten yukarı çıkıp bulur.
function rowOf(label: string) {
  let node = screen.getByText(label).parent;
  while (node) {
    const style = StyleSheet.flatten(node.props.style);
    if (style?.flexDirection === 'row' && style?.justifyContent === 'space-between') return node;
    node = node.parent;
  }
  throw new Error(`"${label}" için satır bulunamadı`);
}
const notificationRow = () => within(rowOf('Bildirim Ayarları'));
const isChecked = (label: string) => rowOf(label).findAll((n: any) => n.props.testID === 'icon-check-circle').length > 0;

beforeEach(() => {
  backend = installFakeBackend({ userId: USER });
  osScheme.mockReturnValue('light');
});
afterEach(() => {
  Platform.OS = 'ios';
});

describe('hesap ve plan durumu', () => {
  it('ücretsiz kullanıcıya "Ücretsiz plan" ve "YENİ" rozetini gösterir; satıra dokunmak Premium\'a götürür', async () => {
    await renderSettings();

    expect(await screen.findByText('Ücretsiz plan')).toBeTruthy();
    expect(screen.getByText('YENİ')).toBeTruthy();

    fireEvent.press(screen.getByText("Premium'a Geç"));
    expect(callbacks.onOpenPremium).toHaveBeenCalledTimes(1);
  });

  it('premium kullanıcıya "Premium üye" der ve "YENİ" rozetini göstermez', async () => {
    backend = installFakeBackend({ userId: USER, limits: { isPremium: true } });
    await renderSettings();

    expect(await screen.findByText('Premium üye')).toBeTruthy();
    expect(screen.queryByText('YENİ')).toBeNull();
  });

  it('limitler alınamazsa (sunucu kapalı) ekran yine açılır, plan durumu yazmaz', async () => {
    backend.networkDown('GET /users/*');
    await renderSettings();

    expect(await screen.findByText("Premium'a Geç")).toBeTruthy();
    expect(screen.queryByText('Ücretsiz plan')).toBeNull();
  });
});

describe('bildirim izni durumu', () => {
  it.each([
    ['verilmiş', 'granted', 'Açık'],
    ['reddedilmiş', 'denied', 'Kapalı — cihaz ayarlarından aç'],
  ])('izin %s ise durum satırında "%s → %s" gösterilir (izin TEKRAR istenmez)', async (_label, status, text) => {
    getPermissions.mockResolvedValue({ status } as any);

    await renderSettings();

    await waitFor(() => expect(notificationRow().getByText(text)).toBeTruthy());
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('simülatörde/web\'de "bu ortamda desteklenmiyor" der', async () => {
    (Device as any).isDevice = false;
    await renderSettings();
    expect(await screen.findByText('Bu ortamda desteklenmiyor')).toBeTruthy();

    await screen.unmountAsync();
    (Device as any).isDevice = true;
    Platform.OS = 'web';
    await renderSettings();
    expect(await screen.findByText('Bu ortamda desteklenmiyor')).toBeTruthy();
  });
});

// Mağaza kuralları (ör. Apple 4.5.4) uygulama içinden bildirimden çıkış yolu istiyor. İşletim sistemi izni
// uygulamadan geri alınamadığı için kapatma, sunucudan cihazın token'larını sildirip tercihi saklayarak yapılır.
const notificationSwitch = () => screen.getByLabelText('Bildirim Ayarları');
const OPT_OUT_KEY = 'notificationsOptOut';

describe('"Bildirim Ayarları" anahtarı — kapatma', () => {
  beforeEach(() => getPermissions.mockResolvedValue({ status: 'granted' } as any));

  it('izin verilmişse anahtar AÇIK görünür', async () => {
    await renderSettings();

    await waitFor(() => expect(notificationSwitch().props.value).toBe(true));
    expect(notificationRow().getByText('Açık')).toBeTruthy();
  });

  it('satıra dokunmak bildirimleri KAPATIR: sunucudan cihaz kaydını sildirir, tercihi saklar, izni tekrar istemez', async () => {
    await renderSettings();
    await waitFor(() => expect(notificationSwitch().props.value).toBe(true));

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    await waitFor(() => expect(notificationRow().getByText('Kapalı')).toBeTruthy());
    expect(notificationSwitch().props.value).toBe(false);
    expect(backend.callsTo('DELETE /devices')).toHaveLength(1);
    expect(backend.callsTo('DELETE /devices')[0].query.get('userId')).toBe(USER);
    expect(backend.callsTo('POST /devices')).toHaveLength(0);
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(OPT_OUT_KEY)).toBe('1');
  });

  it('anahtarın kendisini çevirmek de aynı şekilde kapatır', async () => {
    await renderSettings();
    await waitFor(() => expect(notificationSwitch().props.value).toBe(true));

    await fireEventAsync(notificationSwitch(), 'valueChange', false);

    await waitFor(() => expect(notificationRow().getByText('Kapalı')).toBeTruthy());
    expect(backend.callsTo('DELETE /devices')).toHaveLength(1);
  });

  it('sunucuya ulaşılamazsa anahtar AÇIK kalır (bildirim hâlâ gelebilir), nedeni söylenir ve tercih saklanmaz', async () => {
    backend.networkDown('DELETE /devices', { times: 3 });
    await renderSettings();
    await waitFor(() => expect(notificationSwitch().props.value).toBe(true));

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    expect(await screen.findByText('Bildirimler kapatılamadı')).toBeTruthy();
    expect(screen.getByText('Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(notificationSwitch().props.value).toBe(true);
    expect(notificationRow().getByText('Açık')).toBeTruthy();
    expect(backend.callsTo('DELETE /devices')).toHaveLength(3);
    expect(await AsyncStorage.getItem(OPT_OUT_KEY)).toBeNull();
  });

  it('tek seferlik ağ kesintisinde kapatma sessizce yeniden denenir; kullanıcı uyarı görmez', async () => {
    backend.networkDown('DELETE /devices');
    await renderSettings();
    await waitFor(() => expect(notificationSwitch().props.value).toBe(true));

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    await waitFor(() => expect(notificationRow().getByText('Kapalı')).toBeTruthy());
    expect(backend.callsTo('DELETE /devices')).toHaveLength(2);
    expect(screen.queryByText('Bildirimler kapatılamadı')).toBeNull();
  });

  it('uygulama içinden kapatılmışsa işletim sistemi izni verilmiş olsa bile "Kapalı" görünür', async () => {
    await AsyncStorage.setItem(OPT_OUT_KEY, '1');

    await renderSettings();

    await waitFor(() => expect(notificationRow().getByText('Kapalı')).toBeTruthy());
    expect(notificationSwitch().props.value).toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });
});

describe('"Bildirim Ayarları" anahtarı — açma', () => {
  it('kapatılmış bildirimi açınca tercih kalkar, cihaz yeniden kaydolur ve "Açık" olur', async () => {
    await AsyncStorage.setItem(OPT_OUT_KEY, '1');
    getPermissions.mockResolvedValue({ status: 'granted' } as any);
    await renderSettings();
    await waitFor(() => expect(notificationRow().getByText('Kapalı')).toBeTruthy());

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    await waitFor(() => expect(notificationRow().getByText('Açık')).toBeTruthy());
    expect(notificationSwitch().props.value).toBe(true);
    expect(backend.callsTo('POST /devices')[0].body).toEqual({
      userId: USER,
      expoPushToken: 'ExponentPushToken[test]',
      platform: 'ios',
    });
    expect(backend.callsTo('DELETE /devices')).toHaveLength(0);
    expect(await AsyncStorage.getItem(OPT_OUT_KEY)).toBeNull();
  });

  it('izin henüz sorulmadıysa ister; alınırsa anahtarı açar ve cihazı push token\'ıyla backend\'e kaydeder', async () => {
    requestPermissions.mockResolvedValue({ status: 'granted' } as any);
    await renderSettings();

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    await waitFor(() => expect(notificationRow().getByText('Açık')).toBeTruthy());
    expect(backend.callsTo('POST /devices')[0].body).toEqual({
      userId: USER,
      expoPushToken: 'ExponentPushToken[test]',
      platform: 'ios',
    });
  });

  it('izin alınır ama cihaz sunucuya kaydedilemezse (bağlantı yok) anahtar AÇILMAZ; sonucu ve NEDENİNİ söyler — "Backend çalışıyor mu?" değil', async () => {
    backend.networkDown('POST /devices', { times: 3 });
    await renderSettings();

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    expect(await screen.findByText('Bildirimler açılamadı')).toBeTruthy();
    expect(screen.getByText('Bildirim izni verildi ama bu cihaz sunucuya kaydedilemedi, bu yüzden bildirim alamazsın. Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    expect(screen.queryByText(/Backend/i)).toBeNull();
    expect(backend.callsTo('POST /devices')).toHaveLength(3);
    expect(notificationSwitch().props.value).toBe(false);
    expect(notificationRow().getByText('Açılamadı — dokunarak tekrar dene')).toBeTruthy();

    // Anahtarı tekrar çevirmek yeniden dener (bu sefer ağ düzelmiş).
    fireEvent.press(screen.getByText('Tamam'));
    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));
    await waitFor(() => expect(notificationRow().getByText('Açık')).toBeTruthy());
  });

  it('tek seferlik ağ kesintisinde cihaz kaydı sessizce yeniden denenir; kullanıcı uyarı görmez', async () => {
    backend.networkDown('POST /devices');
    await renderSettings();

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    await waitFor(() => expect(backend.callsTo('POST /devices')).toHaveLength(2));
    await waitFor(() => expect(notificationRow().getByText('Açık')).toBeTruthy());
    expect(screen.queryByText('Bildirimler açılamadı')).toBeNull();
  });

  it('kullanıcı izni reddederse anahtar KAPALI kalır ve "Ayarları Aç" ile cihaz ayarlarına yönlendirir', async () => {
    requestPermissions.mockResolvedValue({ status: 'denied' } as any);
    jest.mocked(Linking.openSettings).mockResolvedValue(undefined);
    await renderSettings();

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    expect(await screen.findByText('Bildirimler kapalı')).toBeTruthy();
    expect(screen.getByText('Kapalı — cihaz ayarlarından aç')).toBeTruthy();
    expect(notificationSwitch().props.value).toBe(false);
    expect(backend.callsTo('POST /devices')).toHaveLength(0);

    fireEvent.press(screen.getByText('Ayarları Aç'));
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it('izin önceden reddedilmiş ve OS tekrar sormuyorsa anahtara dokununca izin penceresi aranmadan ayarlara yönlendirir', async () => {
    getPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false } as any);
    await renderSettings();
    await waitFor(() => expect(notificationRow().getByText('Kapalı — cihaz ayarlarından aç')).toBeTruthy());

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    expect(await screen.findByText('Bildirimler kapalı')).toBeTruthy();
    expect(screen.getByText('Ayarları Aç')).toBeTruthy();
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  // Önceden bu durum "Desteklenmiyor" görünüyordu; oysa ortam destekliyor, token alma geçici olarak başarısızdı.
  it('token alınamazsa "Desteklenmiyor" DEMEZ; anlaşılır bir mesaj gösterir, teknik hata metni sızdırmaz ve tekrar denenebilir', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValue(new Error('Expo servisi yanıt vermedi'));
    requestPermissions.mockResolvedValue({ status: 'granted' } as any);
    await renderSettings();

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    expect(await screen.findByText('Bildirimler açılamadı')).toBeTruthy();
    expect(screen.getByText('Bildirimler şu an açılamadı. Biraz sonra tekrar dene.')).toBeTruthy();
    expect(screen.queryByText('Desteklenmiyor')).toBeNull();
    expect(screen.queryByText(/Expo servisi yanıt vermedi/)).toBeNull();
    expect(notificationRow().getByText('Açılamadı — dokunarak tekrar dene')).toBeTruthy();

    // Aynı satıra tekrar dokununca yeniden dener (bu sefer olur).
    fireEvent.press(screen.getByText('Tamam'));
    jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExponentPushToken[test]' } as any);
    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));
    await waitFor(() => expect(notificationRow().getByText('Açık')).toBeTruthy());
    warn.mockRestore();
  });

  it('gerçekten desteklenmeyen ortamda (Android Expo Go) "Desteklenmiyor" der ve nedenini söyler', async () => {
    Platform.OS = 'android';
    (Constants as any).executionEnvironment = 'storeClient';
    await renderSettings();

    await fireEventAsync.press(screen.getByText('Bildirim Ayarları'));

    expect(await screen.findByText('Desteklenmiyor')).toBeTruthy();
    expect(screen.getByText(/Expo Go push bildirimlerini desteklemiyor/)).toBeTruthy();
    expect(notificationRow().getByText('Bu ortamda desteklenmiyor')).toBeTruthy();
  });
});

describe('hesabı sil', () => {
  const deleteCalls = () => backend.callsTo('DELETE /users/*');
  const openConfirm = () => fireEvent.press(screen.getByText('Hesabımı ve Verilerimi Sil'));

  it('"Hesabımı ve Verilerimi Sil" satırına dokununca ONAY ister, henüz hiçbir şey silmez', async () => {
    await renderSettings();

    openConfirm();

    expect(await screen.findByText('Hesabını silmek istiyor musun?')).toBeTruthy();
    expect(screen.getByText(/Bu işlem geri alınamaz/)).toBeTruthy();
    expect(deleteCalls()).toHaveLength(0);
    expect(callbacks.onAccountDeleted).not.toHaveBeenCalled();
  });

  it('"Vazgeç" hiçbir şeyi silmez', async () => {
    await renderSettings();
    openConfirm();

    fireEvent.press(await screen.findByText('Vazgeç'));

    expect(screen.queryByText('Hesabını silmek istiyor musun?')).toBeNull();
    expect(deleteCalls()).toHaveLength(0);
    expect(callbacks.onAccountDeleted).not.toHaveBeenCalled();
  });

  it('onaylayınca kendi kimliğiyle DELETE atar, "silindi" der ve uygulamaya haber verir', async () => {
    await renderSettings();
    openConfirm();

    await fireEventAsync.press(await screen.findByText('Hesabımı Sil'));

    await waitFor(() => expect(callbacks.onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(deleteCalls()).toHaveLength(1);
    expect(deleteCalls()[0].path).toBe(`/users/${USER}`);
    expect(deleteCalls()[0].headers.authorization).toBe(`Bearer token-${USER}`);
    expect(await screen.findByText('Hesabın silindi')).toBeTruthy();
  });

  it('ücretsiz kullanıcıya abonelik uyarısı göstermez', async () => {
    await renderSettings();
    await screen.findByText('Ücretsiz plan');
    openConfirm();

    await screen.findByText('Hesabını silmek istiyor musun?');
    expect(screen.queryByText(/aboneliğin iptal olmaz/)).toBeNull();
  });

  it('PREMIUM kullanıcıya uyarır: hesabı silmek mağazadaki aboneliği iptal ETMEZ', async () => {
    backend = installFakeBackend({ userId: USER, limits: { isPremium: true } });
    await renderSettings();
    await screen.findByText('Premium üye');

    openConfirm();

    expect(await screen.findByText(/Premium aboneliğin iptal olmaz[\s\S]*App Store \/ Google Play/)).toBeTruthy();
  });

  it('anlık ağ kesintisinde silme sessizce yeniden denenir ve başarılı olur', async () => {
    backend.networkDown('DELETE /users/*');
    await renderSettings();
    openConfirm();

    await fireEventAsync.press(await screen.findByText('Hesabımı Sil'));

    await waitFor(() => expect(callbacks.onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(deleteCalls()).toHaveLength(2);
  });

  it('silme hiç yapılamazsa (sunucu kapalı) hata gösterir, uygulamaya "silindi" DEMEZ ve tekrar denenebilir', async () => {
    backend.networkDown('DELETE /users/*', { times: 3 });
    await renderSettings();
    openConfirm();

    await fireEventAsync.press(await screen.findByText('Hesabımı Sil'));

    expect(await screen.findByText('Hesap silinemedi')).toBeTruthy();
    expect(callbacks.onAccountDeleted).not.toHaveBeenCalled();
    expect(screen.queryByText('Hesabın silindi')).toBeNull();
    expect(screen.getByText('Takiplerin ve bildirim kayıtların kalıcı olarak silinir')).toBeTruthy(); // satır yeniden kullanılabilir
  });

  it('yeniden denemede 401 gelirse (ilk istek sunucuda tamamlandı, yanıt kayboldu) hesap silinmiş sayılır', async () => {
    backend.networkDown('DELETE /users/*'); // 1. deneme: yanıt kayboldu
    backend.failWith('DELETE /users/*', 401, 'UNAUTHORIZED', 'Oturum doğrulanamadı.', { after: 1 }); // 2. deneme: artık silinmiş
    await renderSettings();
    openConfirm();

    await fireEventAsync.press(await screen.findByText('Hesabımı Sil'));

    await waitFor(() => expect(callbacks.onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Hesap silinemedi')).toBeNull();
  });
});

describe('görünüm (tema) seçimi', () => {
  it('varsayılan "Sistem"dir ve işletim sisteminin koyu temasını izler', async () => {
    osScheme.mockReturnValue('dark');
    await renderSettings();

    expect(screen.getByTestId('theme-probe').props.children).toBe('system/dark');
    expect(isChecked('Sistem')).toBe(true);
  });

  it('"Koyu"yu seçince tema hemen değişir ve tercih kalıcı depoya yazılır', async () => {
    await renderSettings();
    expect(screen.getByTestId('theme-probe').props.children).toBe('system/light');

    fireEvent.press(screen.getByText('Koyu'));

    expect(screen.getByTestId('theme-probe').props.children).toBe('dark/dark');
    expect(isChecked('Koyu')).toBe(true);
    expect(isChecked('Sistem')).toBe(false);
    await waitFor(async () => expect(await AsyncStorage.getItem('themeMode')).toBe('dark'));
  });

  it('kaydedilmiş tercih uygulama yeniden açılınca geri yüklenir (işletim sistemi açık olsa bile)', async () => {
    await AsyncStorage.setItem('themeMode', 'dark');

    await renderSettings();

    await waitFor(() => expect(screen.getByTestId('theme-probe').props.children).toBe('dark/dark'));
    expect(isChecked('Koyu')).toBe(true);
  });

  it('depoda geçersiz bir değer varsa yok sayıp "Sistem"de kalır', async () => {
    await AsyncStorage.setItem('themeMode', 'mor');
    await renderSettings();
    await act(async () => {});

    expect(screen.getByTestId('theme-probe').props.children).toBe('system/light');
  });
});

describe('hakkında ve alt sayfalar', () => {
  it('cihaz kimliğini gösterir; dokununca panoya kopyalar ve bilgi verir', async () => {
    await renderSettings();
    expect(screen.getByText(USER)).toBeTruthy();

    await fireEventAsync.press(screen.getByText('Cihaz ID'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(USER);
    expect(await screen.findByText('Cihaz ID panoya kopyalandı.')).toBeTruthy();
  });

  it('uygulama sürümünü app.json\'dan okur; yoksa tire gösterir', async () => {
    await renderSettings();
    expect(screen.getByText('1.0.0')).toBeTruthy();

    await screen.unmountAsync();
    (Constants as any).expoConfig = null;
    await renderSettings();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('Bildirim Geçmişi/Gizlilik/Koşullar alt sayfasını açar ve geri düğmesi ana Ayarlar\'a döner', async () => {
    await renderSettings();

    fireEvent.press(screen.getByText('Bildirim Geçmişi'));
    expect(screen.getByText(/Henüz bir bildirim yok/)).toBeTruthy();
    expect(screen.queryByText('Hesap Ayarları')).toBeNull();

    fireEvent.press(screen.getByTestId('close-button'));
    expect(screen.getByText('HESAP AYARLARI')).toBeTruthy();

    fireEvent.press(screen.getByText('Gizlilik Politikası'));
    fireEvent.press(screen.getByTestId('close-button'));
    fireEvent.press(screen.getByText('Kullanım Koşulları'));
    expect(screen.getByText('Kullanım Koşulları', { exact: true })).toBeTruthy();
  });

  describe('Gizlilik Politikası / Kullanım Koşulları', () => {
    const openURL = jest.mocked(Linking.openURL);
    afterEach(() => {
      delete process.env.EXPO_PUBLIC_PRIVACY_URL;
      delete process.env.EXPO_PUBLIC_TERMS_URL;
    });

    it('yayınlanmış bir sayfa adresi tanımlıysa tarayıcıda açar (boş "yakında" sayfasına gitmez)', async () => {
      process.env.EXPO_PUBLIC_PRIVACY_URL = 'https://uruntakipte.example/gizlilik';
      process.env.EXPO_PUBLIC_TERMS_URL = 'https://uruntakipte.example/kosullar';
      openURL.mockResolvedValue(undefined);
      await renderSettings();

      fireEvent.press(screen.getByText('Gizlilik Politikası'));
      fireEvent.press(screen.getByText('Kullanım Koşulları'));

      expect(openURL.mock.calls.map((c) => c[0])).toEqual(['https://uruntakipte.example/gizlilik', 'https://uruntakipte.example/kosullar']);
      expect(screen.queryByText('İçerik yakında eklenecek.')).toBeNull();
    });

    it('adres tanımlı değilse ya da yer tutucuysa (REPLACE_WITH_…) uygulama içi "yakında" sayfası gösterilir; geçersiz adres açılmaya çalışılmaz', async () => {
      process.env.EXPO_PUBLIC_TERMS_URL = 'REPLACE_WITH_TERMS_URL';
      await renderSettings();

      fireEvent.press(screen.getByText('Gizlilik Politikası'));
      expect(screen.getByText('İçerik yakında eklenecek.')).toBeTruthy();
      fireEvent.press(screen.getByTestId('close-button'));
      fireEvent.press(screen.getByText('Kullanım Koşulları'));
      expect(screen.getByText('İçerik yakında eklenecek.')).toBeTruthy();

      expect(openURL).not.toHaveBeenCalled();
    });

    it('sayfa açılamazsa nedenini söyler', async () => {
      process.env.EXPO_PUBLIC_PRIVACY_URL = 'https://uruntakipte.example/gizlilik';
      openURL.mockRejectedValueOnce(new Error('açılamadı'));
      await renderSettings();

      await fireEventAsync.press(screen.getByText('Gizlilik Politikası'));

      expect(await screen.findByText('Sayfa açılamadı')).toBeTruthy();
      expect(screen.getByText('Sayfa şu an açılamıyor. İnternet bağlantını kontrol edip tekrar dene.')).toBeTruthy();
    });
  });

  it('alt sekme: hem ana Ayarlar\'dan hem alt sayfadan Ürünlerim\'e dönülebilir', async () => {
    await renderSettings();
    fireEvent.press(screen.getByText('Ürünlerim'));
    fireEvent.press(screen.getByText('Gizlilik Politikası'));
    fireEvent.press(screen.getByText('Ürünlerim'));
    expect(callbacks.onOpenProducts).toHaveBeenCalledTimes(2);
  });
});
