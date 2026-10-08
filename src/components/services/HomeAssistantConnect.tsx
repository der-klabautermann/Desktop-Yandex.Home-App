import React, { useState } from 'react';
import { ArrowRight, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { connectProvider } from '../../services/hub';
import { cleanErrorMessage } from '../../utils/errors';
import { LoginGuide } from './LoginGuide';
import { ProviderMark } from './ProviderMark';

interface HomeAssistantConnectProps {
  /** 'xiaomi' показывает инструкцию «Xiaomi через Home Assistant». */
  variant: 'homeassistant' | 'xiaomi';
  /** Home Assistant уже подключён: формы нет, только инструкция и обновление. */
  alreadyConnected: boolean;
  onConnected: () => void;
}

const LINKS = {
  install: 'https://www.home-assistant.io/installation/',
  xiaomi: 'https://github.com/XiaoMi/ha_xiaomi_home',
};

/** Подключение Home Assistant: адрес сервера и долгосрочный токен. */
export const HomeAssistantConnect: React.FC<HomeAssistantConnectProps> = ({ variant, alreadyConnected, onConnected }) => {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await connectProvider('homeassistant', { url, token });
      onConnected();
    } catch (err) {
      setError(cleanErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const guide = variant === 'xiaomi'
    ? <LoginGuide base="services.homeassistant.xiaomiGuide" stepCount={6} problemCount={3} links={LINKS} />
    : <LoginGuide base="services.homeassistant.guide" stepCount={6} problemCount={3} links={LINKS} />;

  return (
    <div className="connect-layout">
      {alreadyConnected ? (
        <div className="connect-form">
          <div className="connect-form-head">
            <ProviderMark id={variant} size={48} />
            <div>
              <strong>{t(`services.names.${variant}`)}</strong>
              <span>{t(`services.taglines.${variant}`)}</span>
            </div>
          </div>
          <p className="connect-note"><CheckCircle2 className="w-3.5 h-3.5" /> {t('services.homeassistant.connectedNote')}</p>
          <button type="button" className="connect-primary" onClick={onConnected}>
            <RefreshCw className="w-4 h-4" /> {t('services.homeassistant.refresh')}
          </button>
        </div>
      ) : (
        <form className="connect-form" onSubmit={submit}>
          <div className="connect-form-head">
            <ProviderMark id={variant} size={48} />
            <div>
              <strong>{t(`services.names.${variant}`)}</strong>
              <span>{t(`services.taglines.${variant}`)}</span>
            </div>
          </div>
          <label htmlFor="ha-url">{t('services.homeassistant.url')}</label>
          <input id="ha-url" value={url} onChange={e => setUrl(e.target.value)} placeholder={t('services.homeassistant.urlPlaceholder')} spellCheck={false} />
          <label htmlFor="ha-token">{t('services.homeassistant.token')}</label>
          <input id="ha-token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="eyJhbGciOi..." spellCheck={false} />
          {error && <p className="connect-error">{error}</p>}
          <button type="submit" className="connect-primary" disabled={busy || !url.trim() || !token.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {t('services.homeassistant.connect')}
          </button>
        </form>
      )}
      {guide}
    </div>
  );
};
