// Шрифтовые пары интерфейса: заголовочный шрифт и основной текст. Все поддерживают кириллицу.
// Шрифты подключены локально (@fontsource), без загрузки из интернета.
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/cyrillic-600.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-500.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/playfair-display/cyrillic-500.css';
import '@fontsource/playfair-display/cyrillic-600.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/golos-text/cyrillic-400.css';
import '@fontsource/golos-text/cyrillic-500.css';
import '@fontsource/golos-text/cyrillic-600.css';
import '@fontsource/golos-text/latin-400.css';
import '@fontsource/golos-text/latin-500.css';
import '@fontsource/golos-text/latin-600.css';
import '@fontsource/prata/cyrillic-400.css';
import '@fontsource/prata/latin-400.css';
import '@fontsource/comfortaa/cyrillic-600.css';
import '@fontsource/comfortaa/latin-600.css';
import '@fontsource/nunito/cyrillic-400.css';
import '@fontsource/nunito/cyrillic-500.css';
import '@fontsource/nunito/cyrillic-600.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-600.css';

export type FontId = 'elegant' | 'classic' | 'editorial' | 'modern' | 'soft' | 'system';

export interface FontSet {
  id: FontId;
  display: string;
  body: string;
  /** Насыщенность заголовков, поправка межбуквенного интервала и масштаб для разных шрифтов. */
  displayWeight: number;
  displayTracking: string;
  displayScale: number;
  /** Мелкие подписи (счётчики, рубрики): у засечковых шрифтов лучше читается основной шрифт. */
  labelsInBody: boolean;
}

const SYSTEM = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const FONT_SETS: FontSet[] = [
  { id: 'elegant', display: `"Cormorant Garamond", Georgia, serif`, body: `"Manrope", ${SYSTEM}`, displayWeight: 600, displayTracking: '0.02em', displayScale: 1.16, labelsInBody: true },
  { id: 'classic', display: `"Playfair Display", Georgia, serif`, body: `"Golos Text", ${SYSTEM}`, displayWeight: 500, displayTracking: '0.015em', displayScale: 1.02, labelsInBody: true },
  { id: 'editorial', display: `"Prata", Georgia, serif`, body: `"Manrope", ${SYSTEM}`, displayWeight: 400, displayTracking: '0.02em', displayScale: 1, labelsInBody: true },
  { id: 'modern', display: `"Unbounded", "Onest", ${SYSTEM}`, body: `"Onest", ${SYSTEM}`, displayWeight: 500, displayTracking: '0em', displayScale: 1, labelsInBody: false },
  { id: 'soft', display: `"Comfortaa", ${SYSTEM}`, body: `"Nunito", ${SYSTEM}`, displayWeight: 600, displayTracking: '0.01em', displayScale: 1.02, labelsInBody: false },
  { id: 'system', display: `"SF Pro Display", ${SYSTEM}`, body: SYSTEM, displayWeight: 600, displayTracking: '0.01em', displayScale: 1, labelsInBody: true },
];

export const DEFAULT_FONT: FontId = 'elegant';

export const fontById = (id: string | undefined): FontSet =>
  FONT_SETS.find(f => f.id === id) ?? FONT_SETS.find(f => f.id === DEFAULT_FONT)!;

/** Переносит шрифтовую пару в CSS-переменные на <html>. */
export const applyFontSet = (font: FontSet) => {
  const root = document.documentElement;
  root.setAttribute('data-font', font.id);
  root.style.setProperty('--font-display', font.display);
  root.style.setProperty('--font-body', font.body);
  root.style.setProperty('--font-label', font.labelsInBody ? font.body : font.display);
  root.style.setProperty('--display-weight', String(font.displayWeight));
  root.style.setProperty('--display-tracking', font.displayTracking);
  root.style.setProperty('--display-scale', String(font.displayScale));
};
