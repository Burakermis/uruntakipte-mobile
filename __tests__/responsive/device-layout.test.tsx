import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { BottomTabBar } from '../../src/components/BottomTabBar';
import { ColorChip } from '../../src/components/ColorChip';
import { Header } from '../../src/components/Header';
import { HEADER_CONTENT_HEIGHT } from '../../src/components/Header.styles';
import { ProductGridItem } from '../../src/components/ProductGridItem';
import { ProductListItem } from '../../src/components/ProductListItem';
import { SettingsRow } from '../../src/components/SettingsRow';
import { ProductDetailScreen } from '../../src/screens/ProductDetailScreen';
import { ProductVariantScreen } from '../../src/screens/ProductVariantScreen';
import { ProductsScreen } from '../../src/screens/ProductsScreen';
import { DEVICES, PHONES, TABLETS, type DeviceProfile } from '../../test-utils/devices';
import { installFakeBackend } from '../../test-utils/fakeBackend';
import { resolvedProduct, trackedProduct, ZARA_URL } from '../../test-utils/fixtures';
import { renderScreen } from '../../test-utils/render';
import type { TrackedProductGroup } from '../../src/types';

// Jest'te düzen motoru (Yoga) yok — burada ölçülebilenler test ediliyor:
//   1) cihaza göre değişen safe-area boşlukları (çentik, home indicator, 3 tuşlu gezinme),
//   2) 2 sütunlu ızgaranın piksel hesabı (her genişlikte tam oturuyor mu),
//   3) gerçek tarayıcı düzeninde (RN Web, 280–768dp) bulunup düzeltilen taşmaların
//      geri gelmemesi için stil sözleşmeleri.
// Asıl "taşıyor mu?" ölçümü tarayıcıda yapıldı (bkz. rapor); bu testler o bulguların
// regresyon bekçisi.

const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as any) ?? {};
const ALL_DEVICES: DeviceProfile[] = Object.values(DEVICES);

// Test renderer'da bir Text'in "kabuk" View'ini bulmak için — hangi sarmalayıcı
// katmanların (composite/host) araya girdiğine bağımlı olmadan, stili koşulu
// sağlayan en yakın atayı döndürür.
function ancestorWhere(node: any, predicate: (style: Record<string, any>) => boolean): any {
  for (let n = node.parent; n; n = n.parent) if (predicate(flat(n))) return n;
  throw new Error('Koşulu sağlayan bir üst düğüm bulunamadı');
}

describe.each(ALL_DEVICES.map((d) => [d.name, d] as const))('safe-area — %s', (_name, device) => {
  it('üst çubuk çentik/Dynamic Island kadar aşağı iner; içerik satırının yüksekliği küçülmez', async () => {
    await renderScreen(<Header center={<Text>Başlık</Text>} />, { device });

    const root = screen.toJSON() as any;
    expect(flat(root).paddingTop).toBe(device.insets.top);
    const content = root.children[0];
    expect(flat(content).height).toBe(HEADER_CONTENT_HEIGHT);
  });

  it('alt sekme çubuğu home indicator / gezinme çubuğunun üstünde kalır (en az 8dp iç boşluk)', async () => {
    await renderScreen(<BottomTabBar active="products" onSelect={jest.fn()} />, { device });

    const bar = flat(screen.toJSON() as any);
    expect(bar.paddingBottom).toBe(Math.max(8, device.insets.bottom));
    expect(bar.minHeight).toBe(64);
  });

  it('"Ürün Ekle" düğmesi alt çubuğun üstünde durur ve inset büyüdükçe birlikte yükselir', async () => {
    installFakeBackend({ products: [] });
    await renderScreen(
      <ProductsScreen userId="u" refreshToken={0} onAddProduct={jest.fn()} onOpenPremium={jest.fn()} onOpenSettings={jest.fn()} />,
      { device }
    );

    const fabBottom = flat(screen.getByTestId('add-product-button')).bottom as number;
    const tabBarHeight = Math.max(64, 8 + 52 + Math.max(8, device.insets.bottom)); // 52 = sekme içeriği (ikon 24 + etiket ~16 + boşluklar)
    expect(fabBottom).toBe(88 + device.insets.bottom);
    expect(fabBottom - tabBarHeight).toBeGreaterThanOrEqual(12); // çubukla çakışmaz, nefes payı var
  });

  it('kaydet/takibe al düğmesinin altlığı home indicator\'ın altına girmez (ürün detayı ve ürün ekleme)', async () => {
    installFakeBackend({ catalog: [resolvedProduct()] });
    const group: TrackedProductGroup = { canonicalUrl: ZARA_URL, brand: 'zara', name: 'x', imageUrl: null, items: [trackedProduct({ id: 1 })] };
    await renderScreen(
      <ProductDetailScreen userId="u" group={group} resolved={resolvedProduct()} loadError={null} onClose={jest.fn()} onChanged={jest.fn()} />,
      { device }
    );

    const footer = (node: any): any => (node.parent && flat(node.parent).borderTopWidth === 1 ? node.parent : footer(node.parent));
    expect(flat(footer(screen.getByTestId('save-detail-button'))).paddingBottom).toBe(Math.max(16, device.insets.bottom));
  });
});

describe('2 sütunlu ızgara — piksel hesabı', () => {
  const GAP = 12;
  const PADDING = 16;
  // ProductsScreen.styles: content { maxWidth: 720, padding: 16 } → ızgara = min(ekran, 720) - 32
  const gridWidthFor = (device: DeviceProfile) => Math.min(device.width, 720) - PADDING * 2;

  async function openGrid(device: DeviceProfile) {
    installFakeBackend({
      userId: 'test-device',
      products: [1, 2, 3].map((i) => trackedProduct({ id: i, name: `Ürün ${i}`, canonicalUrl: `https://x.com/${i}`, sku: `s${i}` })),
    });
    await renderScreen(
      <ProductsScreen userId="test-device" refreshToken={0} onAddProduct={jest.fn()} onOpenPremium={jest.fn()} onOpenSettings={jest.fn()} />,
      { device }
    );
    await waitFor(() => expect(screen.queryAllByTestId('product-card')).toHaveLength(3));
    fireEvent.press(screen.getByTestId('toggle-view-button'));
  }

  const gridContainer = () =>
    screen.UNSAFE_root.findAll((n: any) => typeof n.props.onLayout === 'function' && flat(n).flexWrap === 'wrap' && flat(n).flexDirection === 'row')[0];
  const cardWidths = () => screen.getAllByTestId('product-card').map((c) => flat(c).width as number);
  const layout = (width: number) =>
    fireEvent(gridContainer(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 400 } } });

  it.each([...PHONES, ...TABLETS].map((d) => [d.name, d] as const))(
    '%s: iki kart + boşluk konteyneri tam doldurur (taşma yok, üçüncü kart alt satıra iner)',
    async (_name, device) => {
      await openGrid(device);
      const container = gridWidthFor(device);

      layout(container);

      const [a, b, c] = cardWidths();
      expect(a).toBe(b);
      expect(a * 2 + GAP).toBeCloseTo(container, 5); // ikisi + boşluk = konteyner
      expect(a).toBeGreaterThanOrEqual(100); // en dar telefonda (280dp) bile okunabilir kart
      expect(c).toBe(a); // tek kalan kart da aynı genişlikte (gerilmez)
    }
  );

  it('yön değişimi / iPad bölünmüş ekran gibi genişlik değişiminde kart genişlikleri yeniden hesaplanır', async () => {
    await openGrid(DEVICES.ipadMini);

    layout(688);
    expect(cardWidths()[0]).toBe(338);
    layout(288); // aynı uygulama 1/3 bölünmüş ekrana daraldı
    expect(cardWidths()[0]).toBe(138);
    expect(cardWidths().every((w) => w === 138)).toBe(true);
  });

  it('ilk ölçümden ÖNCEKİ geri düğüş (%47) en dar ızgarada bile 2 sütuna sığar', () => {
    for (const device of PHONES) {
      const container = gridWidthFor(device);
      expect(container * 0.47 * 2 + GAP).toBeLessThanOrEqual(container);
    }
  });
});

describe('gerçek düzende bulunan taşmaların regresyon bekçileri', () => {
  const longColorGroup: TrackedProductGroup = (() => {
    const base = { canonicalUrl: 'https://x.com/m', brand: 'mango', name: 'Uzun Ad', imageUrl: null };
    return {
      ...base,
      items: [
        trackedProduct({ id: 1, brand: 'mango', color: 'Ekru / Mavi Çizgili Desenli Uzun Renk Adı', size: 'XXL (52-54)', lastPrice: 12499.99 }),
        trackedProduct({ id: 2, brand: 'mango', color: 'Siyah', size: '3XL' }),
      ],
    };
  })();

  it('ürün kartı: uzun renk+beden rozeti kart genişliğini aşamaz, tek satırda ortadan kısalır (beden görünür kalır)', async () => {
    await renderScreen(<ProductListItem group={longColorGroup} onPress={jest.fn()} onDeleteAll={jest.fn()} />);

    const text = screen.getByText('Ekru / Mavi Çizgili Desenli Uzun Renk Adı XXL (52-54)');
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.ellipsizeMode).toBe('middle');
    expect(flat(text).flexShrink).toBe(1);
    ancestorWhere(text, (style) => style.maxWidth === '100%'); // rozet kabuğu tam genişlikle sınırlı
  });

  it('ürün kartı: dar kartta fiyat, adı ezmek yerine alt satıra sarılır (ad sıfır taban genişlikli flex:1 değil)', async () => {
    await renderScreen(<ProductListItem group={longColorGroup} onPress={jest.fn()} onDeleteAll={jest.fn()} />);

    const nameText = screen.getByText('Oversize Gömlek');
    const name = flat(nameText);
    expect(name.flexBasis).toBeGreaterThan(0); // taban 0 olsaydı ad 5-6 haneli fiyat yanında 10-20dp'ye sıkışırdı
    expect(name.flexShrink).toBe(1);
    ancestorWhere(nameText, (style) => style.flexWrap === 'wrap' && style.flexDirection === 'row'); // ad+fiyat satırı sarılır
  });

  it('ızgara kartı: 6 haneli fiyat + "N beden" dar kartta (≈117dp) yan yana sığmazsa alt satıra sarılır', async () => {
    await renderScreen(<ProductGridItem group={longColorGroup} onPress={jest.fn()} onDeleteAll={jest.fn()} width={117} />);

    ancestorWhere(screen.getByText('12.499,99 TL'), (style) => style.flexWrap === 'wrap' && style.flexDirection === 'row');
  });

  it('renk çipi: uzun renk adı satırdan taşmaz; en fazla 2 satıra kısalır', async () => {
    await renderScreen(<ColorChip label="Ekru / Mavi Çizgili Desenli Uzun Renk Adı" selected onPress={jest.fn()} />);

    const label = screen.getByText('Ekru / Mavi Çizgili Desenli Uzun Renk Adı');
    expect(label.props.numberOfLines).toBe(2);
    expect(flat(label).flexShrink).toBe(1);
    const chip = screen.toJSON() as any;
    expect(flat(chip).maxWidth).toBe('100%');
  });

  it('ayar satırı: 36 haneli Cihaz ID gibi uzun durum metni, ikon ile chevron arasındaki alana sığacak şekilde küçülür', async () => {
    await renderScreen(
      <SettingsRow
        icon="fingerprint"
        iconBackground="#eee"
        iconColor="#000"
        label="Cihaz ID"
        statusText="9faed4da-380d-47a5-98ec-2f772f18ad60"
        onPress={jest.fn()}
      />
    );

    const status = screen.getByText('9faed4da-380d-47a5-98ec-2f772f18ad60');
    // Metin sarmalayıcısı (label + durum) küçülebilir olmalı; aksi halde satırın tamamına göre ölçülüp taşar.
    ancestorWhere(status, (style) => style.flexShrink === 1);
  });

  it('ürün ekleme: görselin yanındaki dar sütunda 32dp\'lik fiyat tek satırda kalıp küçülür', async () => {
    installFakeBackend({
      catalog: [resolvedProduct({ colors: [{ name: 'Beyaz', sizes: [{ size: 'S', sku: 's', price: 12499.99, currency: 'TRY', availability: 'in_stock' }] }] })],
    });
    await renderScreen(<ProductVariantScreen userId="u" onClose={jest.fn()} onTracked={jest.fn()} />, { device: DEVICES.galaxyFoldFolded });
    fireEvent.changeText(screen.getByTestId('url-input'), ZARA_URL);
    fireEvent.press(screen.getByTestId('fetch-product-button'));

    const price = await screen.findByText('12.499,99 TL');
    expect(price.props.numberOfLines).toBe(1);
    expect(price.props.adjustsFontSizeToFit).toBe(true);
  });
});
