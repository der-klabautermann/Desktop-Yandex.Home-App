import { describe, expect, it } from 'vitest';
import { FONTS, fontById, migrateFont } from './fonts';

describe('migrateFont', () => {
  it('keeps a valid new setting', () => {
    expect(migrateFont({ font: 'google' })).toBe('google');
  });
  it('takes the old heading font when it is still offered', () => {
    expect(migrateFont({ headingFont: 'playfair' })).toBe('playfair');
  });
  it('maps the old Unbounded heading to the original look', () => {
    expect(migrateFont({ headingFont: 'unbounded' })).toBe('original');
  });
  it('falls back to the system font for removed fonts', () => {
    expect(migrateFont({ headingFont: 'raleway' })).toBe('system');
    expect(migrateFont({ font: 'germanica' })).toBe('system');
    expect(migrateFont({ font: 'plex' })).toBe('system');
    expect(migrateFont({})).toBe('system');
  });
});

describe('FONTS', () => {
  it('offers exactly the chosen fonts', () => {
    expect(FONTS.map(f => f.id)).toEqual(['system', 'original', 'manrope', 'montserrat', 'google', 'comfortaa', 'cormorant', 'playfair', 'literata']);
  });
  it('resolves unknown ids to the system font', () => {
    expect(fontById('nope').id).toBe('system');
  });
});
