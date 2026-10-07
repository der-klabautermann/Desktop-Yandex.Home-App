import { describe, expect, it } from 'vitest';
import { detectLanguage, interpolate, pluralCategory, resolveKey, type Dictionary } from './core';

const dict: Dictionary = {
  dashboard: {
    title: 'Дом',
    greeting: 'Привет, {name}!',
    devices: { one: '{count} устройство', few: '{count} устройства', many: '{count} устройств', other: '{count} устройства' },
  },
};

describe('resolveKey', () => {
  it('findet verschachtelte Schlüssel', () => {
    expect(resolveKey(dict, 'dashboard.title')).toBe('Дом');
  });
  it('liefert undefined für fehlende Schlüssel', () => {
    expect(resolveKey(dict, 'dashboard.missing')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('ersetzt Platzhalter', () => {
    expect(interpolate('Привет, {name}!', { name: 'Макс' })).toBe('Привет, Макс!');
  });
  it('lässt unbekannte Platzhalter stehen', () => {
    expect(interpolate('{a} und {b}', { a: 1 })).toBe('1 und {b}');
  });
});

describe('pluralCategory', () => {
  it('russische Mehrzahl', () => {
    expect(pluralCategory('ru', 1)).toBe('one');
    expect(pluralCategory('ru', 3)).toBe('few');
    expect(pluralCategory('ru', 8)).toBe('many');
    expect(pluralCategory('ru', 21)).toBe('one');
  });
  it('deutsche Mehrzahl', () => {
    expect(pluralCategory('de', 1)).toBe('one');
    expect(pluralCategory('de', 8)).toBe('other');
  });
});

describe('detectLanguage', () => {
  it('nimmt gespeicherte Wahl zuerst', () => {
    expect(detectLanguage('de', 'ru-RU')).toBe('de');
  });
  it('fällt auf Systemsprache zurück', () => {
    expect(detectLanguage(null, 'ru-RU')).toBe('ru');
    expect(detectLanguage(null, 'de-AT')).toBe('de');
  });
  it('fällt auf Englisch zurück', () => {
    expect(detectLanguage(null, 'fr-FR')).toBe('en');
    expect(detectLanguage('xx', undefined)).toBe('en');
  });
});
