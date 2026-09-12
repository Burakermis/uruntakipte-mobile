export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export interface DialogButton {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void;
}

interface DialogState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

const EMPTY_STATE: DialogState = { visible: false, title: '', message: undefined, buttons: [] };

let state: DialogState = EMPTY_STATE;
const listeners = new Set<(next: DialogState) => void>();

function setState(next: DialogState) {
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener: (next: DialogState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState() {
  return state;
}

function close() {
  setState(EMPTY_STATE);
}

function open(title: string, message: string | undefined, buttons: DialogButton[]) {
  setState({
    visible: true,
    title,
    message,
    buttons: buttons.map((button) => ({
      ...button,
      onPress: () => {
        close();
        button.onPress?.();
      },
    })),
  });
}

// Android'in kendi AlertDialog'u ya da web'in window.confirm'i YERİNE — üç
// platformda da AYNI, tasarıma uygun diyaloğu gösterir. Alert.alert ile
// birebir aynı çağrı imzası (title, message?, buttons?) — mevcut çağrı
// yerlerini değiştirmeden takılıyor.
export function showAlert(title: string, message?: string, buttons?: DialogButton[]) {
  open(title, message, buttons && buttons.length > 0 ? buttons : [{ text: 'Tamam' }]);
}

// confirmAsync ile aynı sözleşme: Promise<boolean>, kullanıcı "Onayla"ya
// basarsa true, "Vazgeç"e basarsa ya da diyaloğu kapatırsa false.
export function confirmAsync(
  title: string,
  message?: string,
  options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
): Promise<boolean> {
  return new Promise((resolve) => {
    open(title, message, [
      { text: options?.cancelText ?? 'Vazgeç', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options?.confirmText ?? 'Onayla',
        style: options?.destructive === false ? 'default' : 'destructive',
        onPress: () => resolve(true),
      },
    ]);
  });
}

// Geri tuşu / karartılmış arka plana dokunma: "Vazgeç"/iptal niteliğindeki
// buton varsa onu tetikler (Alert'in cancelable davranışıyla aynı), yoksa
// (tek butonlu "Tamam" diyaloglarında) o tek butonu tetikler — aksi halde
// confirmAsync/alertAsync'in Promise'i hiç çözülmeden diyalog sessizce kapanırdı.
export function dismiss() {
  const cancelButton = state.buttons.find((b) => b.style === 'cancel');
  const fallback = state.buttons[state.buttons.length - 1];
  (cancelButton ?? fallback)?.onPress?.();
}
