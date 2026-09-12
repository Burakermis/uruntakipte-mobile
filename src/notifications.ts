import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type PushRegistrationResult =
  | { status: 'granted'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string };

// expo-notifications'ın foreground'da da bildirimi göstermesi için (varsayılan
// davranış: uygulama açıkken push'u sessizce yutar).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * İzin ister ve bir Expo push token alır. Web'de ve simülatörde push
 * desteklenmediği için (Expo'nun kendi kısıtı, bizim eksiğimiz değil) bu
 * durumlar ayrı bir "unsupported" sonucuyla işaretlenir.
 */
export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return {
      status: 'unsupported',
      reason: 'Push bildirimleri web önizlemesinde desteklenmiyor. iOS/Android cihazda (Expo Go) dene.',
    };
  }
  if (!Device.isDevice) {
    return {
      status: 'unsupported',
      reason: 'Push bildirimleri sadece gerçek cihazlarda çalışır, simülatörde/emülatörde çalışmaz.',
    };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return { status: 'denied' };
  }

  try {
    // EAS projesi kurulunca app.json'daki extra.eas.projectId otomatik
    // dolar; kurulana kadar undefined geçmek Expo Go'da genelde yeterli.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return { status: 'granted', token: tokenResponse.data };
  } catch (err) {
    return {
      status: 'unsupported',
      reason: `Push token alınamadı: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
