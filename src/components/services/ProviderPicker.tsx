import React from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { PROVIDERS } from './providers';
import { ProviderMark } from './ProviderMark';
import type { ProviderId } from '../../types/electron-api';

/** Плитки сервисов: доступные можно выбрать, будущие помечены «скоро». */
export const ProviderPicker: React.FC<{ connected: ProviderId[]; onPick: (id: ProviderId) => void }> = ({ connected, onPick }) => {
  const { t } = useI18n();
  return (
    <div className="provider-grid">
      {PROVIDERS.map((p, index) => {
        const isConnected = connected.includes(p.id);
        const disabled = !p.available || isConnected;
        return (
          <button
            key={p.id}
            className={`provider-tile ${isConnected ? 'is-connected' : ''}`}
            disabled={disabled}
            onClick={() => onPick(p.id)}
            style={{ animationDelay: `${index * 70}ms`, ['--mark' as string]: p.color }}
          >
            <ProviderMark id={p.id} size={46} />
            <span className="provider-name">{t(`services.names.${p.id}`)}</span>
            <span className="provider-tagline">{t(`services.taglines.${p.id}`)}</span>
            {!p.available && <span className="provider-flag">{t('services.soon')}</span>}
            {isConnected && <span className="provider-flag is-ok"><Check className="w-3 h-3" /> {t('services.status.connected')}</span>}
          </button>
        );
      })}
    </div>
  );
};
