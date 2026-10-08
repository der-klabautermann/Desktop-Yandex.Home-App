import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { FONTS, fontById, type FontChoice, type FontId } from '../../themes/fonts';

/** Шрифты: живой пример сверху, ниже отдельно шрифт заголовков и шрифт текста. */
export const FontSettings: React.FC = () => {
  const { settings, updateSettings } = useTheme();
  const { t } = useI18n();
  const heading = fontById(settings.headingFont, 'system');
  const text = fontById(settings.textFont, 'system');

  const list = (slot: 'headingFont' | 'textFont', current: FontId) => (
    <div className="font-list" role="radiogroup">
      {FONTS.map((font: FontChoice) => (
        <button
          key={font.id}
          role="radio"
          aria-checked={current === font.id}
          className={`font-option ${current === font.id ? 'is-active' : ''}`}
          onClick={() => updateSettings({ [slot]: font.id })}
        >
          <span
            className="font-option-sample"
            style={{
              fontFamily: font.family,
              fontWeight: slot === 'headingFont' ? font.headingWeight : 500,
              fontSize: slot === 'headingFont' ? 19 * font.headingScale : 15,
            }}
          >
            {font.id === 'system' ? t('settings.fonts.system') : font.name}
          </span>
          <span className="font-option-kind">{font.serif ? t('settings.fonts.serif') : t('settings.fonts.sans')}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="font-settings">
      <div className="font-preview">
        <div className="font-preview-title" style={{ fontFamily: heading.family, fontWeight: heading.headingWeight, fontSize: 34 * heading.headingScale, letterSpacing: `calc(-0.03em + ${heading.headingTracking})` }}>
          {t('settings.fonts.previewTitle')}
        </div>
        <div className="font-preview-text" style={{ fontFamily: text.family }}>{t('settings.fonts.previewText')}</div>
      </div>
      <div className="font-columns">
        <div>
          <h4>{t('settings.fonts.headings')}</h4>
          {list('headingFont', heading.id)}
        </div>
        <div>
          <h4>{t('settings.fonts.text')}</h4>
          {list('textFont', text.id)}
        </div>
      </div>
    </div>
  );
};
