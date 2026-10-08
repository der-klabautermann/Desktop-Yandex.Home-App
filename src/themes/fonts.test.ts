import { describe, expect, it } from 'vitest';
import { FONTS, fontById, migrateFont } from './fonts';

describe('migrateFont', () => {
  it('keeps a valid new setting', () => {
    expect(migrateFont({ font: 'germanica' })).toBe('germanica');
  });
  it('takes the old heading font when it is still offered', () => {
    expect(migrateFont({ headingFont: 'playfair' })).toBe('playfair');
  });
  it('maps the old Unbounded heading to the original look', () => {
    expect(migrateFont({ headingFont: 'unbounded' })).toBe('original');
  });
  it('falls back to the system font for removed fonts', () => {
    expect(migrateFont({ headingFont: 'raleway' })).toBe('system');
    expect(migrateFont({})).toBe('system');
  });
});

describe('FONTS', () => {
  it('offers exactly the ten chosen fonts', () => {
    expect(FONTS.map(f => f.id)).toEqual(['system', 'original', 'manrope', 'montserrat', 'plex', 'comfortaa', 'cormorant', 'playfair', 'literata', 'germanica']);
  });
  it('resolves unknown ids to the system font', () => {
    expect(fontById('nope').id).toBe('system');
  });
});
