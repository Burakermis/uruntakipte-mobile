# Urun Takipte - Mobile

Cross-platform mobile app with React Native and Expo.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

## Android bildirimleri (FCM) — canlıya çıkmadan ÖNCE

Uygulama Firebase SDK'sı kullanmaz; bildirimleri Expo Push Service gönderir. Ama Expo, Android'e FCM üzerinden ilettiği için **bir Firebase projesi yalnızca kimlik bilgisi için** gerekir. Eksikse Android'de bildirim **sessizce gelmez** (iOS etkilenmez).

1. [Firebase Console](https://console.firebase.google.com)'da proje oluştur. Google Analytics'i **kapalı** bırak (gizlilik politikamız analitik kullanmadığımızı söylüyor).
2. Projeye bir **Android uygulaması** ekle, paket adı: `com.uruntakipte.app` (`app.json` > `android.package` ile birebir aynı).
3. `google-services.json` dosyasını indirip **`mobile/google-services.json`** olarak kaydet. İçinde yalnızca genel kimlikler var; depoya eklenebilir (`app.json` > `android.googleServicesFile` bu yolu bekler; dosya yokken Android build'i bilerek hata verir).
4. Firebase Console > Proje ayarları > **Hizmet hesapları** > **Yeni özel anahtar oluştur**. Bu JSON **gizlidir**: depoya girmez (`.gitignore` yakalar), yalnızca EAS'e yüklenir.
5. EAS'e yükle: `npx eas-cli credentials` > Android > production (sonra development/preview) > Google Service Account > **FCM V1** > Upload. Ya da expo.dev > proje > Credentials > Android > FCM V1 service account key.
6. Her Android build türü (development, preview, production) için aynı adımı tekrarla ve **yeniden derle** (`eas build --platform android --profile ...`).

Notlar:
- Android'de **Expo Go push desteklemez**; test için development build gerekir (`eas build --profile development --platform android`).
- Android 13+ bildirim iznini bildirim kanalı oluşturulunca sorar; kanal `src/notifications.ts` içinde zaten `default` adıyla oluşturuluyor.

### Doğrulama (gerçek cihazda)

1. Development/preview Android build'ini telefona kur, uygulamayı aç, bildirim iznini ver.
2. Jetonu veritabanından al ve test bildirimi gönder (backend klasöründe):

```bash
docker exec uruntakipte-postgres-1 psql -U trackprice -d trackprice -c "select platform, expo_push_token from device_tokens order by id desc limit 3"
node scripts/check-push.js "ExponentPushToken[...]"
```

Betik, Expo'nun **teslimat makbuzunu** bekler: "✔ Teslim edildi" görürsen FCM çalışıyor. `InvalidCredentials` görürsen 4–5. adımlar eksik/yanlış; `MismatchSenderId` görürsen `google-services.json` ile service account farklı Firebase projelerinden.
