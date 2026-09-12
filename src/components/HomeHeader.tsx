import React from 'react';
import { BrandHeader } from './BrandHeader';
import { Header } from './Header';

interface HomeHeaderProps {
  right?: React.ReactNode;
}

// "Ana ekran" rolündeki header — marka damgası solda, isteğe bağlı bir aksiyon
// sağda. ProductsScreen (arama/ayarlar) ve SettingsScreen (sağsız) kullanır.
// Her ikisi de `bordered` sabit true — daha önce ekranlar arası tutarsız
// (bazısı border'lı bazısı değil) olan bu ayrıntı artık tek yerden garanti.
export function HomeHeader({ right }: HomeHeaderProps) {
  return <Header bordered left={<BrandHeader />} right={right} />;
}
