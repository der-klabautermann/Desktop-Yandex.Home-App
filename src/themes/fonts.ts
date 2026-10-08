// Шрифт интерфейса: один выбор на всё приложение. Все варианты поддерживают кириллицу
// и подключены локально (@fontsource и src/assets/fonts), без загрузки из интернета.
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
import '@fontsource/ibm-plex-sans/cyrillic-400.css';
import '@fontsource/ibm-plex-sans/cyrillic-500.css';
import '@fontsource/ibm-plex-sans/cyrillic-600.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
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
// Germanica (Peter Wiegel, SIL Open Font License): готический шрифт с кириллицей
import '../assets/fonts/germanica/germanica.css';

export type FontId = 'system' | 'original' | 'manrope' | 'montserrat' | 'plex' | 'comfortaa' | 'cormorant' | 'playfair' | 'literata' | 'germanica';

export type FontKind = 'sans' | 'serif' | 'blackletter';

export interface FontChoice {
  id: FontId;
  /** Название шрифта (не переводится); у system и original берётся из словаря. */
  name: string;
  kind: FontKind;
  /** Заголовки, крупные числа. */
  display: string;
  /** Основной текст и мелкие подписи. */
  body: string;
  /** Для заголовков: насыщенность, масштаб (у шрифтов с маленькой высотой строчных) и интервал. */
  headingWeight: number;
  headingScale: number;
  headingTracking: string;
}

const SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const single = (family: string) => ({ display: family, body: family });

export const FONTS: FontChoice[] = [
  { id: 'system', name: 'SF Pro', kind: 'sans', ...single(`"SF Pro Display", ${SYSTEM}`), headingWeight: 600, headingScale: 1, headingTracking: '0.005em' },
  { id: 'original', name: 'Unbounded', kind: 'sans', display: `"Unbounded", "Onest", ${SYSTEM}`, body: `"Onest", ${SYSTEM}`, headingWeight: 500, headingScale: 0.94, headingTracking: '-0.01em' },
  { id: 'manrope', name: 'Manrope', kind: 'sans', ...single(`"Manrope", ${SYSTEM}`), headingWeight: 600, headingScale: 1, headingTracking: '0em' },
  { id: 'montserrat', name: 'Montserrat', kind: 'sans', ...single(`"Montserrat", ${SYSTEM}`), headingWeight: 600, headingScale: 0.96, headingTracking: '0em' },
  { id: 'plex', name: 'IBM Plex Sans', kind: 'sans', ...single(`"IBM Plex Sans", ${SYSTEM}`), headingWeight: 600, headingScale: 1, headingTracking: '0em' },
  { id: 'comfortaa', name: 'Comfortaa', kind: 'sans', ...single(`"Comfortaa", ${SYSTEM}`), headingWeight: 600, headingScale: 1, headingTracking: '0.01em' },
  { id: 'cormorant', name: 'Cormorant', kind: 'serif', ...single(`"Cormorant Garamond", Georgia, serif`), headingWeight: 600, headingScale: 1.16, headingTracking: '0.02em' },
  { id: 'playfair', name: 'Playfair', kind: 'serif', ...single(`"Playfair Display", Georgia, serif`), headingWeight: 500, headingScale: 1.02, headingTracking: '0.015em' },
  { id: 'literata', name: 'Literata', kind: 'serif', ...single(`"Literata", Georgia, serif`), headingWeight: 500, headingScale: 1, headingTracking: '0.005em' },
  // Фрактура в мелком тексте не читается: заголовки готикой, текст спокойной антиквой
  { id: 'germanica', name: 'Germanica', kind: 'blackletter', display: `"Germanica", "Literata", Georgia, serif`, body: `"Literata", Georgia, serif`, headingWeight: 400, headingScale: 1.12, headingTracking: '0.01em' },
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
