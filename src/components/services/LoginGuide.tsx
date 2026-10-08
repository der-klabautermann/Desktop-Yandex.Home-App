import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface LoginGuideProps {
  /** Префикс ключей, например 'services.yandex.guide'. Ожидаются title, steps.1..N, problems.1..M. */
  base: string;
  stepCount: number;
  problemCount: number;
  links?: Record<string, string>;
}

/** Пошаговая инструкция рядом с формой входа. В тексте: {link:имя} и `код`. */
export const LoginGuide: React.FC<LoginGuideProps> = ({ base, stepCount, problemCount, links = {} }) => {
  const { t } = useI18n();

  const renderText = (text: string) =>
    text.split(/(\{link:\w+\}|`[^`]+`)/g).map((part, index) => {
      const link = part.match(/^\{link:(\w+)\}$/);
      if (link && links[link[1]]) {
        return (
          <a key={index} href={links[link[1]]} target="_blank" rel="noreferrer" className="login-guide-link">
            {links[link[1]].replace(/^https?:\/\//, '').replace(/\/$/, '')}
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      }
      if (/^`[^`]+`$/.test(part)) return <code key={index}>{part.slice(1, -1)}</code>;
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });

  return (
    <aside className="login-guide">
      <h3>{t(`${base}.title`)}</h3>
      <ol className="login-guide-steps">
        {Array.from({ length: stepCount }, (_, i) => (
          <li key={i} style={{ animationDelay: `${80 + i * 55}ms` }}>
            <span className="login-guide-num">{i + 1}</span>
            <p>{renderText(t(`${base}.steps.${i + 1}`))}</p>
          </li>
        ))}
      </ol>
      {problemCount > 0 && (
        <div className="login-guide-problems">
          <h4>{t('services.guideProblems')}</h4>
          <ul>
            {Array.from({ length: problemCount }, (_, i) => (
              <li key={i}>{renderText(t(`${base}.problems.${i + 1}`))}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};
