import React, { useEffect, useState } from 'react';
import { AppDialog } from '../components/AppDialog';
import { dismiss, getState, subscribe } from './dialogStore';

// App.tsx kökünde TEK sefer monte edilir — aktif ekran ne olursa olsun
// (Ürünlerim, Ürün Detayı, Premium…) tüm showAlert/confirmAsync çağrıları
// aynı bu örneği kullanır, ekran başına ayrı bir diyalog state'i gerekmez.
export function DialogHost() {
  const [state, setState] = useState(getState());

  useEffect(() => subscribe(setState), []);

  return (
    <AppDialog
      visible={state.visible}
      title={state.title}
      message={state.message}
      buttons={state.buttons}
      onDismiss={dismiss}
    />
  );
}
