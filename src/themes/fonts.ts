// Шрифты интерфейса: отдельно для заголовков и для текста. Все поддерживают кириллицу
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
import '@fontsource/raleway/cyrillic-400.css';
import '@fontsource/raleway/cyrillic-500.css';
import '@fontsource/raleway/cyrillic-600.css';
import '@fontsource/raleway/latin-400.css';
import '@fontsource/raleway/latin-500.css';
import '@fontsource/raleway/latin-600.css';
import '@fontsource/golos-text/cyrillic-400.css';
import '@fontsource/golos-text/cyrillic-500.css';
import '@fontsource/golos-text/cyrillic-600.css';
import '@fontsource/golos-text/latin-400.css';
import '@fontsource/golos-text/latin-500.css';
import '@fontsource/golos-text/latin-600.css';
import '@fontsource/onest/cyrillic-400.css';
import '@fontsource/onest/cyrillic-500.css';
import '@fontsource/onest/cyrillic-600.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/ibm-plex-sans/cyrillic-400.css';
import '@fontsource/ibm-plex-sans/cyrillic-500.css';
import '@fontsource/ibm-plex-sans/cyrillic-600.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/jost/cyrillic-400.css';
import '@fontsource/jost/cyrillic-500.css';
import '@fontsource/jost/cyrillic-600.css';
import '@fontsource/jost/latin-400.css';
import '@fontsource/jost/latin-500.css';
import '@fontsource/jost/latin-600.css';
import '@fontsource/nunito/cyrillic-400.css';
import '@fontsource/nunito/cyrillic-500.css';
import '@fontsource/nunito/cyrillic-600.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/comfortaa/cyrillic-600.css';
import '@fontsource/comfortaa/latin-600.css';
import '@fontsource/unbounded/cyrillic-400.css';
import '@fontsource/unbounded/cyrillic-500.css';
import '@fontsource/unbounded/latin-400.css';
import '@fontsource/unbounded/latin-500.css';
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/cyrillic-600.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/playfair-display/cyrillic-500.css';
import '@fontsource/playfair-display/cyrillic-600.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/lora/cyrillic-400.css';
import '@fontsource/lora/cyrillic-500.css';
import '@fontsource/lora/cyrillic-600.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-500.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/eb-garamond/cyrillic-400.css';
import '@fontsource/eb-garamond/cyrillic-500.css';
import '@fontsource/eb-garamond/cyrillic-600.css';
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-500.css';
import '@fontsource/eb-garamond/latin-600.css';
import '@fontsource/prata/cyrillic-400.css';
import '@fontsource/prata/latin-400.css';
import '@fontsource/literata/cyrillic-400.css';
import '@fontsource/literata/cyrillic-500.css';
import '@fontsource/literata/cyrillic-600.css';
import '@fontsource/literata/latin-400.css';
import '@fontsource/literata/latin-500.css';
import '@fontsource/literata/latin-600.css';

export type FontId = 'system' | 'manrope' | 'montserrat' | 'raleway' | 'golos' | 'onest' | 'plex' | 'jost' | 'nunito' | 'comfortaa' | 'unbounded' | 'cormorant' | 'playfair' | 'lora' | 'garamond' | 'prata' | 'literata';

export interface FontChoice {
  id: FontId;
  /** Название шрифта: не переводится. */
  name: string;
  family: string;
  serif: boolean;
  /** Для заголовков: насыщенность, масштаб (у шрифтов с маленькой высотой строчных) и интервал. */
  headingWeight: number;
  headingScale: number;
  headingTracking: string;
}

const SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const FONTS: FontChoice[] = [
  { id: 'system', name: 'SF Pro', family: `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`, serif: false, headingWeight: 600, headingScale: 1, headingTracking: '0.005em' },
  { id: 'manrope', name: 'Manrope', family: `"Manrope", ${SYSTEM}`, serif: false, headingWeight: 600, headingScale: 1, headingTracking: '0em' },
  { id: 'montserrat', name: 'Montserrat', family: `"Montserrat", ${SYSTEM}`, serif: false, headingWeight: 600, headingScale: 0.96, headingTracking: '0em' },
  { id: 'raleway', name: 'Raleway', family: `"Raleway", ${SYSTEM}`, serif: false, headingWeight: 600, headingScale: 1, headingTracking: '0.005em' },
  { id: 'golos', name: 'Golos', family: `"Golos Text", ${SYSTEM}`, serif: false, headingWeight: 600, headingScale: 1, headingTracking: '0em' },
  { id: 'onest', name: 'Onest', family: `"Onest", ${SYSTEM}`, serif: false, headingWeight: 600, headingScale: 1, headingTracking: '0em' },
  { id: 'plex', name: 'IBM Plex Sans', family: `"IBM Plex Sans", ${SYSTEM}`, serif: false, headingWeight: 600, headingScale: 1, headingTracking: '0em' },
  { id: 'jost', name: 'Jost', family: `"Jost", ${SYSTEM}`, serif: false, headingWeight: 500, headingScale: 1.04, headingTracking: '0.01em' },
  { id: 'nunito', name: 'Nunito', family: `"Nunito", ${SYSTEM}`, serif: false, headingWeight: 700, headingScale: 1.02, headingTracking: '0em' },
  { id: 'comfortaa', name: 'Comfortaa', family: `"Comfortaa", ${SYSTEM}`, serif: false, headingWeight: 600, headingScale: 1, headingTracking: '0.01em' },
  { id: 'unbounded', name: 'Unbounded', family: `"Unbounded", ${SYSTEM}`, serif: false, headingWeight: 500, headingScale: 0.94, headingTracking: '-0.01em' },
  { id: 'cormorant', name: 'Cormorant', family: `"Cormorant Garamond", Georgia, serif`, serif: true, headingWeight: 600, headingScale: 1.16, headingTracking: '0.02em' },
  { id: 'playfair', name: 'Playfair', family: `"Playfair Display", Georgia, serif`, serif: true, headingWeight: 500, headingScale: 1.02, headingTracking: '0.015em' },
  { id: 'lora', name: 'Lora', family: `"Lora", Georgia, serif`, serif: true, headingWeight: 500, headingScale: 1.02, headingTracking: '0.01em' },
  { id: 'garamond', name: 'EB Garamond', family: `"EB Garamond", Georgia, serif`, serif: true, headingWeight: 500, headingScale: 1.12, headingTracking: '0.015em' },
  { id: 'prata', name: 'Prata', family: `"Prata", Georgia, serif`, serif: true, headingWeight: 400, headingScale: 1, headingTracking: '0.02em' },
  { id: 'literata', name: 'Literata', family: `"Literata", Georgia, serif`, serif: true, headingWeight: 500, headingScale: 1, headingTracking: '0.005em' },
];

export const DEFAULT_HEADING_FONT: FontId = 'system';
export const DEFAULT_TEXT_FONT: FontId = 'system';

export const fontById = (id: string | undefined, fallback: FontId): FontChoice =>
  FONTS.find(f => f.id === id) ?? FONTS.find(f => f.id === fallback)!;

export const isFontId = (id: unknown): id is FontId => FONTS.some(f => f.id === id);

/** Переносит выбранные шрифты в CSS-переменные на <html>. */
export const applyFonts = (heading: FontChoice, text: FontChoice) => {
  const root = document.documentElement;
  root.style.setProperty('--font-display', heading.family);
  root.style.setProperty('--font-body', text.family);
  // Мелкие подписи (счётчики, рубрики) всегда основным шрифтом: так они лучше читаются
  root.style.setProperty('--font-label', text.family);
  root.style.setProperty('--display-weight', String(heading.headingWeight));
  root.style.setProperty('--display-tracking', heading.headingTracking);
  root.style.setProperty('--display-scale', String(heading.headingScale));
};
