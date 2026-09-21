import { confirmAsync, dismiss, getState, showAlert, subscribe } from '../../src/dialog/dialogStore';

// Diyalog tek bir global depo — testler arasında açık kalmasın.
afterEach(() => {
  if (getState().visible) dismiss();
});

function pressButton(text: string) {
  const button = getState().buttons.find((b) => b.text === text);
  if (!button) throw new Error(`"${text}" butonu yok: ${getState().buttons.map((b) => b.text).join(', ')}`);
  button.onPress?.();
}

describe('confirmAsync — silme/çıkış onayı sözleşmesi', () => {
  it('"Onayla"ya basınca true ile çözülür ve diyalog kapanır', async () => {
    const result = confirmAsync('Takipten çıkar', 'Silinsin mi?');
    expect(getState()).toMatchObject({ visible: true, title: 'Takipten çıkar', message: 'Silinsin mi?' });

    pressButton('Onayla');

    await expect(result).resolves.toBe(true);
    expect(getState().visible).toBe(false);
  });

  it('"Vazgeç"e basınca false ile çözülür', async () => {
    const result = confirmAsync('Takipten çıkar', 'Silinsin mi?');
    pressButton('Vazgeç');
    await expect(result).resolves.toBe(false);
  });

  it('geri tuşu / karartılmış alana dokunma (dismiss) "vazgeç" sayılır — Promise asılı kalmaz', async () => {
    const result = confirmAsync('Kaydedilmemiş değişiklikler var', 'Çıkılsın mı?');
    dismiss();
    await expect(result).resolves.toBe(false);
    expect(getState().visible).toBe(false);
  });

  it('onay butonu varsayılan olarak "destructive" — silme diyaloğu kırmızı görünür; destructive:false ile normale döner', () => {
    confirmAsync('Sil', 'Emin misin?');
    expect(getState().buttons.find((b) => b.text === 'Onayla')?.style).toBe('destructive');
    dismiss();

    confirmAsync('Devam', 'Emin misin?', { destructive: false, confirmText: 'Devam et', cancelText: 'Geri' });
    expect(getState().buttons.map((b) => [b.text, b.style])).toEqual([
      ['Geri', 'cancel'],
      ['Devam et', 'default'],
    ]);
  });
});

describe('showAlert', () => {
  it('buton verilmezse tek bir "Tamam" butonu gösterir', () => {
    showAlert('Hata', 'Silinemedi, tekrar dene.');
    expect(getState().buttons.map((b) => b.text)).toEqual(['Tamam']);
  });

  it('dokunulan butonun callback\'ini çalıştırır ve önce diyaloğu kapatır', () => {
    let visibleWhenCallbackRan: boolean | undefined;
    const onPremium = jest.fn(() => {
      visibleWhenCallbackRan = getState().visible;
    });
    showAlert('Ürün limiti doldu', 'Limit doldu', [
      { text: 'İptal', style: 'cancel' },
      { text: "Premium'a Bak", onPress: onPremium },
    ]);

    pressButton("Premium'a Bak");

    expect(onPremium).toHaveBeenCalledTimes(1);
    // Callback yeni bir diyalog açarsa (ör. ardışık uyarılar) kapatma onu ezmesin.
    expect(visibleWhenCallbackRan).toBe(false);
  });

  it('dismiss, tek butonlu diyalogda o tek butonu tetikler (geri tuşu "Tamam"a basmış gibi)', () => {
    const onOk = jest.fn();
    showAlert('Premium aktif', 'Hazır', [{ text: 'Tamam', onPress: onOk }]);
    dismiss();
    expect(onOk).toHaveBeenCalledTimes(1);
    expect(getState().visible).toBe(false);
  });

  it('dismiss, "cancel" stilli buton varsa onu (sonuncuyu değil) tetikler', () => {
    const onCancel = jest.fn();
    const onOther = jest.fn();
    showAlert('Başlık', undefined, [
      { text: 'Vazgeç', style: 'cancel', onPress: onCancel },
      { text: 'Sil', style: 'destructive', onPress: onOther },
    ]);
    dismiss();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOther).not.toHaveBeenCalled();
  });
});

describe('subscribe', () => {
  it('DialogHost gibi dinleyicilere açılış ve kapanışı bildirir; abonelik bırakılınca susar', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribe((s) => seen.push(s.visible));

    showAlert('A');
    pressButton('Tamam');
    expect(seen).toEqual([true, false]);

    unsubscribe();
    showAlert('B');
    expect(seen).toEqual([true, false]);
  });
});
