import React, { useState } from 'react';
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { connectProvider } from '../../services/hub';
import { cleanErrorMessage } from '../../utils/errors';
import { LoginGuide } from './LoginGuide';
import { ProviderMark } from './ProviderMark';

const TOKEN_PAGE = 'https://oauth.yandex.ru/authorize?response_type=token&client_id=';

/** Вход в Яндекс: OAuth-токен, рядом пошаговая инструкция. */
export const YandexConnect: React.FC<{ onConnected: () => void }> = ({ onConnected }) => {
  const { t } = useI18n();
  const [clientId, setClientId] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await connectProvider('yandex', { token });
      onConnected();
    } catch (err) {
      setError(cleanErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="connect-layout">
      <form className="connect-form" onSubmit={submit}>
        <div className="connect-form-head">
          <ProviderMark id="yandex" size={48} />
          <div>
            <strong>{t('services.names.yandex')}</strong>
            <span>{t('services.taglines.yandex')}</span>
          </div>
        </div>

        <label htmlFor="yandex-client-id">{t('services.yandex.clientIdLabel')}</label>
        <div className="connect-inline">
          <input id="yandex-client-id" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="a1b2c3d4..." spellCheck={false} />
          <a
            className={`connect-secondary ${clientId.trim() ? '' : 'is-disabled'}`}
            href={clientId.trim() ? TOKEN_PAGE + encodeURIComponent(clientId.trim()) : undefined}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {t('services.yandex.openTokenPage')}
          </a>
        </div>

        <label htmlFor="yandex-token">{t('services.yandex.tokenLabel')}</label>
        <input id="yandex-token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="y0_AgAAAA..." spellCheck={false} />

        {error && <p className="connect-error">{error}</p>}

        <button type="submit" className="connect-primary" disabled={busy || !token.trim()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {t('services.yandex.connect')}
        </button>
      </form>
      <LoginGuide base="services.yandex.guide" stepCount={6} problemCount={3}
        links={{ oauth: 'https://oauth.yandex.ru/client/new/' }} />
    </div>
  );
};
