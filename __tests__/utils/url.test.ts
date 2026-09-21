import { extractUrlFromPastedText } from '../../src/utils/url';

// Marka uygulamalarının "Paylaş" menüsü ne kopyalarsa kopyalasın kutuya girecek
// şey backend'e gidecek gerçek URL olmalı — yoksa /products/resolve "geçersiz
// URL" döner ve kullanıcı neyin yanlış olduğunu anlayamaz.
describe('extractUrlFromPastedText', () => {
  it('Paylaş metninin başındaki ürün adını atıp yalnızca URL\'i döndürür', () => {
    expect(
      extractUrlFromPastedText('Şardonlu bermuda - Bershka https://www.bershka.com/tr/sardonlu-bermuda-c0p123.html')
    ).toBe('https://www.bershka.com/tr/sardonlu-bermuda-c0p123.html');
  });

  it('URL yeni satırdan sonra geliyorsa da bulur', () => {
    expect(extractUrlFromPastedText('Oversize gömlek\nhttps://www.zara.com/tr/tr/gomlek-p01887320.html')).toBe(
      'https://www.zara.com/tr/tr/gomlek-p01887320.html'
    );
  });

  it('URL\'den sonra gelen metni (ör. pazarlama sonekini) kırpar', () => {
    expect(extractUrlFromPastedText('https://www2.hm.com/tr_tr/productpage.1336969003.html Şimdi indirimde!')).toBe(
      'https://www2.hm.com/tr_tr/productpage.1336969003.html'
    );
  });

  it('sorgu parametrelerini ve # parçasını korur', () => {
    const url = 'https://www.mango.com/tr/tr/p/kadin/elbise_17021231?c=99&utm_source=share#beden';
    expect(extractUrlFromPastedText(`  ${url}  `)).toBe(url);
  });

  it('http ve büyük harfli protokolü de tanır, birden çok URL varsa ilkini alır', () => {
    expect(extractUrlFromPastedText('HTTPS://a.example/x http://b.example/y')).toBe('HTTPS://a.example/x');
  });

  it('yalnızca http (https olmayan) bağlantıları da tanır', () => {
    expect(extractUrlFromPastedText('Ürün: http://shop.example.com/p/1')).toBe('http://shop.example.com/p/1');
  });

  it('URL yoksa metni olduğu gibi (trim\'lenmiş) döndürür — hatayı backend anlamlı şekilde versin', () => {
    expect(extractUrlFromPastedText('  merhaba dünya  ')).toBe('merhaba dünya');
    expect(extractUrlFromPastedText('   ')).toBe('');
  });
});
