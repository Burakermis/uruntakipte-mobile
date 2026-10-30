// expo-share-intent'in test sahtesi: native modül Jest'te yok. Testler `setShareIntent` ile
// "başka bir uygulamadan paylaşım geldi" durumunu sürer; Provider/hook gerçek API'yle aynı biçimde
// (hasShareIntent, shareIntent, resetShareIntent) çalışır.
import { useSyncExternalStore } from 'react';

type Intent = { text: string | null; webUrl: string | null; type: 'text' | 'weburl' | null };
const EMPTY: Intent = { text: null, webUrl: null, type: null };

let state: { hasShareIntent: boolean; shareIntent: Intent } = { hasShareIntent: false, shareIntent: EMPTY };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const resetShareIntentMock = jest.fn(() => {
  state = { hasShareIntent: false, shareIntent: EMPTY };
  emit();
});

/** Paylaşım geldi (text: ham metin; webUrl: iOS'un ayıkladığı bağlantı). */
export function setShareIntent(text: string, webUrl: string | null = null) {
  state = { hasShareIntent: true, shareIntent: { text, webUrl, type: webUrl ? 'weburl' : 'text' } };
  emit();
}

export function clearShareIntentMock() {
  state = { hasShareIntent: false, shareIntent: EMPTY };
  resetShareIntentMock.mockClear();
}

export function useShareIntentContext() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
  return { isReady: true, error: null, resetShareIntent: resetShareIntentMock, ...snapshot };
}
