import { waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ApiRequestError, ConnectionError, setAuthToken } from '../../src/api';
import { clearSession, getOrCreateSession } from '../../src/utils/session';
import { installFakeBackend, seedSession, tokenFor, type FakeBackend } from '../../test-utils/fakeBackend';

// Kullanıcının TÜM takipleri ve premium durumu bu oturuma bağlı. Kimlik sunucudan alınır
// (POST /auth/register) ve güvenli depoda saklanır; her açılışta yeniden kaydolunursa
// kullanıcı ürünlerini kaybeder.
let backend: FakeBackend;

beforeEach(() => {
  backend = installFakeBackend({ userId: 'sunucu-kimligi' });
  setAuthToken(null);
});

describe('getOrCreateSession', () => {
  it('ilk açılışta sunucudan kimlik ve token alır, güvenli depoya yazar (AsyncStorage\'a değil)', async () => {
    const session = await getOrCreateSession();

    expect(session).toEqual({ userId: 'sunucu-kimligi', token: tokenFor('sunucu-kimligi') });
    expect(backend.callsTo('POST /auth/register')).toHaveLength(1);
    expect(JSON.parse((await SecureStore.getItemAsync('session'))!)).toEqual(session);
    expect(await AsyncStorage.getItem('session')).toBeNull();
  });

  it('kayıt isteği Authorization başlığı taşımaz, gövdede kimlik göndermez', async () => {
    setAuthToken('eski-token');
    await getOrCreateSession();

    const [call] = backend.callsTo('POST /auth/register');
    expect(call.headers.authorization).toBeUndefined();
    expect(call.body).toEqual({});
  });

  it('sonraki açılışlarda AYNI oturumu döndürür, yeniden kaydolmaz', async () => {
    const first = await getOrCreateSession();
    const second = await getOrCreateSession();

    expect(second).toEqual(first);
    expect(backend.registrations).toBe(1);
  });

  it('depoda zaten bir oturum varsa (ör. uygulama güncellemesi) onu kullanır', async () => {
    await seedSession('kayitli-kimlik');

    await expect(getOrCreateSession()).resolves.toEqual({ userId: 'kayitli-kimlik', token: tokenFor('kayitli-kimlik') });
    expect(backend.registrations).toBe(0);
  });

  it('bozuk/eksik kayıt yok sayılır ve yeniden kaydolunur', async () => {
    for (const bad of ['{bozuk', '{"userId":"a"}', '{"token":"t"}', '"metin"']) {
      await SecureStore.setItemAsync('session', bad);
      await expect(getOrCreateSession()).resolves.toMatchObject({ userId: 'sunucu-kimligi' });
    }
  });

  it('eski sürümün istemci-üretimli cihaz kimliğini siler (artık geçersiz)', async () => {
    await AsyncStorage.setItem('deviceId', 'eski-kimlik');

    await getOrCreateSession();

    await waitFor(async () => expect(await AsyncStorage.getItem('deviceId')).toBeNull());
  });

  it('güvenli depo yoksa (web) AsyncStorage\'a düşer', async () => {
    jest.mocked(SecureStore.isAvailableAsync).mockResolvedValue(false);
    try {
      const session = await getOrCreateSession();

      expect(JSON.parse((await AsyncStorage.getItem('session'))!)).toEqual(session);
      await expect(getOrCreateSession()).resolves.toEqual(session);
      expect(backend.registrations).toBe(1);
    } finally {
      jest.mocked(SecureStore.isAvailableAsync).mockResolvedValue(true);
    }
  });

  describe('hata durumları', () => {
    it('sunucuya ulaşılamazsa hata fırlatır ve depoya bir şey yazmaz (App "Tekrar dene" gösterir)', async () => {
      backend.networkDown('POST /auth/register');

      await expect(getOrCreateSession()).rejects.toBeInstanceOf(ConnectionError);
      expect(await SecureStore.getItemAsync('session')).toBeNull();
    });

    it('hız sınırı (429) hata olarak yansır', async () => {
      backend.failWith('POST /auth/register', 429, 'RATE_LIMITED', 'Çok fazla istek.');

      await expect(getOrCreateSession()).rejects.toBeInstanceOf(ApiRequestError);
    });

    it('depo okuması başarısızsa bu oturum için yeni kimlik alır ama depoya HİÇBİR ŞEY yazmaz (kayıtlı oturum ezilmez)', async () => {
      await seedSession('kayitli-kimlik');
      jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(async () => {
        throw new Error('keychain hatası');
      });
      jest.mocked(SecureStore.setItemAsync).mockClear();

      const session = await getOrCreateSession();

      expect(session.userId).toBe('sunucu-kimligi');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
      expect(JSON.parse((await SecureStore.getItemAsync('session'))!).userId).toBe('kayitli-kimlik');
    });

    it('ilk açılışta yazma başarısız olsa da alınan oturumla devam eder', async () => {
      jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('keychain dolu'));

      await expect(getOrCreateSession()).resolves.toMatchObject({ userId: 'sunucu-kimligi' });
    });
  });
});

describe('clearSession', () => {
  it('kayıtlı oturumu siler; sonraki çağrı yeniden kaydolur', async () => {
    await getOrCreateSession();

    await clearSession();

    expect(await SecureStore.getItemAsync('session')).toBeNull();
    await getOrCreateSession();
    expect(backend.registrations).toBe(2);
  });
});

describe('Authorization başlığı', () => {
  it('token ayarlıysa korumalı uçlara Bearer olarak eklenir; geçersiz token\'da sunucu 401 döner', async () => {
    const { listTrackedProducts } = require('../../src/api');
    setAuthToken(tokenFor('sunucu-kimligi'));
    await expect(listTrackedProducts('sunucu-kimligi')).resolves.toEqual([]);
    expect(backend.callsTo('GET /products')[0].headers.authorization).toBe(`Bearer ${tokenFor('sunucu-kimligi')}`);

    setAuthToken(null);
    await expect(listTrackedProducts('sunucu-kimligi')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('başkasının kimliğiyle istek 403 alır (token userId ile eşleşmeli)', async () => {
    const { listTrackedProducts } = require('../../src/api');
    setAuthToken(tokenFor('ben'));

    await expect(listTrackedProducts('baskasi')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('sunucu token\'ı reddedince (401) yenileme geri çağrısı tetiklenir', async () => {
    const { listTrackedProducts, setUnauthorizedHandler } = require('../../src/api');
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    setAuthToken('gecersiz');

    await expect(listTrackedProducts('x')).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
    setUnauthorizedHandler(null);
  });
});
