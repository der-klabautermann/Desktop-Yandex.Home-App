import { describe, expect, it } from 'vitest';
import { providerOf, stripPrefix, withPrefix } from './ids';

describe('ids', () => {
  it('Yandex-IDs bleiben ohne Präfix', () => {
    expect(withPrefix('yandex', 'a1b2-c3')).toBe('a1b2-c3');
    expect(providerOf('a1b2-c3')).toBe('yandex');
    expect(stripPrefix('a1b2-c3')).toBe('a1b2-c3');
  });
  it('andere Dienste bekommen ein Präfix', () => {
    expect(withPrefix('xiaomi', '12345')).toBe('xiaomi:12345');
    expect(providerOf('xiaomi:12345')).toBe('xiaomi');
    expect(stripPrefix('aqara:lumi.abc')).toBe('lumi.abc');
  });
  it('unbekanntes Präfix gehört zu Yandex', () => {
    expect(providerOf('foo:bar')).toBe('yandex');
    expect(stripPrefix('foo:bar')).toBe('foo:bar');
  });
});
