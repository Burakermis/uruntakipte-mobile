import { confirmAsync as confirmAsyncViaDialog } from '../dialog/dialogStore';

// Eskiden Platform'a göre Alert.alert (native) / window.confirm (web) arasında
// dallanıyordu — ikisi de OS'e/tarayıcıya özgü, uygulamanın tasarımıyla
// alakasız pop-up'lar. Artık üçünde de AYNI özel diyaloğu gösteren
// src/dialog/dialogStore.ts'e delege ediyor; imza aynı kaldığı için mevcut
// çağrı yerleri (ProductsScreen, ProductDetailScreen) değişmeden çalışıyor.
export function confirmAsync(title: string, message: string): Promise<boolean> {
  return confirmAsyncViaDialog(title, message);
}
