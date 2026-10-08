// Шрифт интерфейса: один выбор на всё приложение. Все варианты поддерживают кириллицу
// и подключены локально (@fontsource), без загрузки из интернета.
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/montserrat/cyrillic-400.css';
import '@fontsource/montserrat/cyrillic-500.css';
import '@fontsource/montserrat/cyrillic-600.css';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-600.css';
// Google Sans: CSS-файлы пакета не задают unicode-range, и латиница перекрывала бы кириллицу.
// Поэтому подключаем файлы сами, с правильными диапазонами (см. registerGoogleSans).
import googleSansCyrillic400 from '@fontsource/google-sans/files/google-sans-cyrillic-400-normal.woff2';
import googleSansCyrillic500 from '@fontsource/google-sans/files/google-sans-cyrillic-500-normal.woff2';
import googleSansCyrillic600 from '@fontsource/google-sans/files/google-sans-cyrillic-600-normal.woff2';
import googleSansLatin400 from '@fontsource/google-sans/files/google-sans-latin-400-normal.woff2';
import googleSansLatin500 from '@fontsource/google-sans/files/google-sans-latin-500-normal.woff2';
import googleSansLatin600 from '@fontsource/google-sans/files/google-sans-latin-600-normal.woff2';
import '@fontsource/comfortaa/cyrillic-400.css';
import '@fontsource/comfortaa/cyrillic-500.css';
import '@fontsource/comfortaa/cyrillic-600.css';
import '@fontsource/comfortaa/latin-400.css';
import '@fontsource/comfortaa/latin-500.css';
import '@fontsource/comfortaa/latin-600.css';
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/cyrillic-600.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/playfair-display/cyrillic-400.css';
import '@fontsource/playfair-display/cyrillic-500.css';
import '@fontsource/playfair-display/cyrillic-600.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/literata/cyrillic-400.css';
import '@fontsource/literata/cyrillic-500.css';
import '@fontsource/literata/cyrillic-600.css';
import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/latin-500.css';
import '@fontsource/literata/latin-600.css';
// Исходный вариант приложения: Unbounded для заголовков, Onest для текста
import '@fontsource/unbounded/cyrillic-400.css';
import '@fontsource/unbounded/cyrillic-500.css';
import '@fontsource/unbounded/latin-400.css';
import '@fontsource/unbounded/latin-500.css';
import '@fontsource/onest/cyrillic-400.css';
import '@fontsource/onest/cyrillic-500.css';
import '@fontsource/onest/cyrillic-600.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-600.css';

export type FontId = 'system' | 'original' | 'manrope' | 'montserrat' | 'google' | 'comfortaa' | 'cormorant' | 'playfair' | 'literata';

export interface FontChoice {
  id: FontId;
  /** Название шрифта (не переводится); у system и original берётся из словаря. */
  name: string;
  /** Заголовки, крупные числа. */
  display: string;
  /** Основной текст и мелкие подписи. */
  body: string;
  /** Для заголовков: насыщенность, масштаб (у шрифтов с маленькой высотой строчных) и интервал. */
  headingWeight: number;
  headingScale: number;
  headingTracking: string;
}

const CYRILLIC_RANGE = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
const LATIN_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

const registerGoogleSans = () => {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  const faces: Array<[string, string, string]> = [
    [googleSansCyrillic400, '400', CYRILLIC_RANGE], [googleSansCyrillic500, '500', CYRILLIC_RANGE], [googleSansCyrillic600, '600', CYRILLIC_RANGE],
    [googleSansLatin400, '400', LATIN_RANGE], [googleSansLatin500, '500', LATIN_RANGE], [googleSansLatin600, '600', LATIN_RANGE],
  ];
  for (const [url, weight, unicodeRange] of faces) {
    document.fonts.add(new FontFace('Google Sans', `url(${url}) format('woff2')`, { weight, unicodeRange, display: 'swap' }));
  }
};
registerGoogleSans();

const SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const single = (family: string) => ({ display: family, body: family });

export const FONTS: FontChoice[] = [
  { id: 'system', name: 'SF Pro', ...single(`"SF Pro Display", ${SYSTEM}`), headingWeight: 600, headingScale: 1, headingTracking: '0.005em' },
  { id: 'original', name: 'Unbounded', display: `"Unbounded", "Onest", ${SYSTEM}`, body: `"Onest", ${SYSTEM}`, headingWeight: 500, headingScale: 0.94, headingTracking: '-0.01em' },
  { id: 'manrope', name: 'Manrope', ...single(`"Manrope", ${SYSTEM}`), headingWeight: 600, headingScale: 1, headingTracking: '0em' },
  { id: 'montserrat', name: 'Montserrat', ...single(`"Montserrat", ${SYSTEM}`), headingWeight: 600, headingScale: 0.96, headingTracking: '0em' },
  { id: 'google', name: 'Google Sans', ...single(`"Google Sans", ${SYSTEM}`), headingWeight: 500, headingScale: 1, headingTracking: '0em' },
  { id: 'comfortaa', name: 'Comfortaa', ...single(`"Comfortaa", ${SYSTEM}`), headingWeight: 600, headingScale: 1, headingTracking: '0.01em' },
  { id: 'cormorant', name: 'Cormorant', ...single(`"Cormorant Garamond", Georgia, serif`), headingWeight: 600, headingScale: 1.16, headingTracking: '0.02em' },
  { id: 'playfair', name: 'Playfair', ...single(`"Playfair Display", Georgia, serif`), headingWeight: 500, headingScale: 1.02, headingTracking: '0.015em' },
  { id: 'literata', name: 'Literata', ...single(`"Literata", Georgia, serif`), headingWeight: 500, headingScale: 1, headingTracking: '0.005em' },
];

export const DEFAULT_FONT: FontId = 'system';

export const isFontId = (id: unknown): id is FontId => FONTS.some(f => f.id === id);

export const fontById = (id: string | undefined): FontChoice =>
  FONTS.find(f => f.id === id) ?? FONTS.find(f => f.id === DEFAULT_FONT)!;

/** Старые настройки хранили отдельно шрифт заголовков и текста: берём шрифт заголовков. */
export const migrateFont = (stored: { font?: unknown; headingFont?: unknown }): FontId => {
  if (isFontId(stored.font)) return stored.font;
  if (stored.headingFont === 'unbounded') return 'original';
  if (isFontId(stored.headingFont)) return stored.headingFont;
  return DEFAULT_FONT;
};

/** Переносит выбранный шрифт в CSS-переменные на <html>. */
export const applyFont = (font: FontChoice) => {
  const root = document.documentElement;
  root.style.setProperty('--font-display', font.display);
  root.style.setProperty('--font-body', font.body);
  root.style.setProperty('--font-label', font.body);
  root.style.setProperty('--display-weight', String(font.headingWeight));
  root.style.setProperty('--display-tracking', font.headingTracking);
  root.style.setProperty('--display-scale', String(font.headingScale));
};
