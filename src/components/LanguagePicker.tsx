import React, { useEffect, useRef, useState } from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { LANGUAGES } from '../i18n/core';

/** Кнопка в шапке со списком языков. */
export const LanguagePicker: React.FC = () => {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="theme-picker" ref={wrapperRef}>
      <button onClick={() => setOpen(v => !v)} className={`header-btn ${open ? 'active' : ''}`} title={t('language.title')}>
        <Languages className="w-4 h-4" />
      </button>
      {open && (
        <div className="language-popover" role="menu" aria-label={t('language.title')}>
          {LANGUAGES.map(code => (
            <button
              key={code}
              role="menuitemradio"
              aria-checked={lang === code}
              className={`language-option ${lang === code ? 'is-active' : ''}`}
              onClick={() => { setLang(code); setOpen(false); }}
            >
              <span className="language-code">{code.toUpperCase()}</span>
              {t(`language.${code}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
