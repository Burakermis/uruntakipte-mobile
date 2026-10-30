import { urlFromShare } from '../../src/utils/sharedUrl';

describe('urlFromShare', () => {
  it('iOS\'un ayıkladığı webUrl\'i tercih eder', () => {
    expect(urlFromShare({ webUrl: 'https://www.zara.com/tr/x-p1.html', text: 'başka bir şey' })).toBe(
      'https://www.zara.com/tr/x-p1.html'
    );
  });

  it('yalnızca ham metin gelince (Android) içindeki bağlantıyı ayıklar', () => {
    expect(urlFromShare({ text: 'https://www.zara.com/tr/x-p1.html' })).toBe('https://www.zara.com/tr/x-p1.html');
  });

  it('marka uygulamalarının başa eklediği ürün adını atar', () => {
    expect(urlFromShare({ text: 'Şardonlu bermuda - Bershka https://www.bershka.com/tr/x-c0p1.html' })).toBe(
      'https://www.bershka.com/tr/x-c0p1.html'
    );
  });

  it('bağlantı olmayan içerikte null döner (düz metin, boş, yalnızca dosya)', () => {
    expect(urlFromShare({ text: 'merhaba' })).toBeNull();
    expect(urlFromShare({ text: '   ' })).toBeNull();
    expect(urlFromShare({ webUrl: null, text: null })).toBeNull();
    expect(urlFromShare({})).toBeNull();
  });

  it('http(s) dışı şemaları kabul etmez (ör. file://, javascript:)', () => {
    expect(urlFromShare({ text: 'file:///etc/passwd' })).toBeNull();
    expect(urlFromShare({ text: 'javascript:alert(1)' })).toBeNull();
    expect(urlFromShare({ webUrl: 'ftp://x.com/a' })).toBeNull();
  });
});
