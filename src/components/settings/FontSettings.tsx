import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { FONTS, fontById, type FontChoice } from '../../themes/fonts';

/** Шрифт: живой пример сверху, ниже один столбец вариантов (заголовки и текст сразу). */
export const FontSettings: React.FC = () => {
  const { settings, updateSettings } = useTheme();
  const { t } = useI18n();
  const current = fontById(settings.font);

  const label = (font: FontChoice) =>
    font.id === 'system' ? t('settings.fonts.system') : font.id === 'original' ? t('settings.fonts.original') : font.name;

  return (
    <div className="font-settings">
      <div className="font-preview">
        <div className="font-preview-title" style={{ fontFamily: current.display, fontWeight: current.headingWeight, fontSize: 34 * current.headingScale, letterSpacing: `calc(-0.03em + ${current.headingTracking})` }}>
          {t('settings.fonts.previewTitle')}
        </div>
        <div className="font-preview-text" style={{ fontFamily: current.body }}>{t('settings.fonts.previewText')}</div>
      </div>
      <div className="font-list" role="radiogroup">
        {FONTS.map(font => (
          <button
            key={font.id}
            role="radio"
            aria-checked={current.id === font.id}
            className={`font-option ${current.id === font.id ? 'is-active' : ''}`}
            onClick={() => updateSettings({ font: font.id })}
          >
            <span
              className="font-option-sample"
              style={{ fontFamily: font.display, fontWeight: font.headingWeight, fontSize: 19 * font.headingScale }}
            >
              {label(font)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
