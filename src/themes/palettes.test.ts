import { describe, expect, it } from 'vitest';
import { seasonFor } from './palettes';



describe('Jahreszeit', () => {
  it('richtet sich nach dem Monat, im Süden umgekehrt', () => {
    expect(seasonFor(new Date(2026, 0, 15))).toBe('winter');
    expect(seasonFor(new Date(2026, 3, 1))).toBe('spring');
    expect(seasonFor(new Date(2026, 6, 1))).toBe('summer');
    expect(seasonFor(new Date(2026, 9, 10))).toBe('autumn');
    expect(seasonFor(new Date(2026, 11, 24))).toBe('winter');
    expect(seasonFor(new Date(2026, 6, 1), true)).toBe('winter');
  });
});
