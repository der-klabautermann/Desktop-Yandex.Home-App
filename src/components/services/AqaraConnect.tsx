import React, { useState } from 'react';
import { ArrowRight, Loader2, Mail } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { connectProvider } from '../../services/hub';
import { cleanErrorMessage } from '../../utils/errors';
import { LoginGuide } from './LoginGuide';
import { ProviderMark } from './ProviderMark';

const REGIONS = ['europe', 'russia', 'china', 'usa', 'korea'] as const;

/**
 * Вход в Aqara: ключ разработчика (App ID, Key ID, App Key), регион и аккаунт Aqara Home.
 * Сначала Aqara присылает код, затем код подтверждает вход.
 */
export const AqaraConnect: React.FC<{ onConnected: () => void }> = ({ onConnected }) => {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    region: lang === 'ru' ? 'russia' : 'europe',
    appId: '', keyId: '', appKey: '', account: '', code: '',
  });
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: event.target.value }));

  const keysComplete = ['appId', 'keyId', 'appKey', 'account'].every(key => form[key as keyof typeof form].trim());

  const run = async (step: 'requestCode' | 'verify') => {
    setBusy(true);
    setError(undefined);
    try {
      await connectProvider('aqara', { ...form, step });
      if (step === 'requestCode') setCodeSent(true);
      else onConnected();
    } catch (err) {
      setError(cleanErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="connect-layout">
      <form className="connect-form" onSubmit={e => { e.preventDefault(); void run(codeSent ? 'verify' : 'requestCode'); }}>
        <div className="connect-form-head">
          <ProviderMark id="aqara" size={48} />
          <div>
            <strong>{t('services.names.aqara')}</strong>
            <span>{t('services.taglines.aqara')}</span>
          </div>
        </div>

        <label htmlFor="aqara-region">{t('services.aqara.region')}</label>
        <select id="aqara-region" className="connect-select" value={form.region} onChange={set('region')}>
          {REGIONS.map(region => <option key={region} value={region}>{t(`services.aqara.regions.${region}`)}</option>)}
        </select>

        <div className="connect-grid">
          <div>
            <label htmlFor="aqara-app-id">App ID</label>
            <input id="aqara-app-id" value={form.appId} onChange={set('appId')} spellCheck={false} />
          </div>
          <div>
            <label htmlFor="aqara-key-id">Key ID</label>
            <input id="aqara-key-id" value={form.keyId} onChange={set('keyId')} placeholder="K.123..." spellCheck={false} />
          </div>
        </div>
        <label htmlFor="aqara-app-key">App Key</label>
        <input id="aqara-app-key" type="password" value={form.appKey} onChange={set('appKey')} spellCheck={false} />

        <label htmlFor="aqara-account">{t('services.aqara.account')}</label>
        <input id="aqara-account" value={form.account} onChange={set('account')} placeholder={t('services.aqara.accountPlaceholder')} spellCheck={false} />

        {codeSent && (
          <>
            <p className="connect-note"><Mail className="w-3.5 h-3.5" /> {t('services.aqara.codeSent', { account: form.account })}</p>
            <label htmlFor="aqara-code">{t('services.aqara.code')}</label>
            <input id="aqara-code" value={form.code} onChange={set('code')} inputMode="numeric" autoFocus />
          </>
        )}

        {error && <p className="connect-error">{error}</p>}

        <button type="submit" className="connect-primary" disabled={busy || !keysComplete || (codeSent && !form.code.trim())}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {codeSent ? t('services.aqara.connect') : t('services.aqara.requestCode')}
        </button>
        {codeSent && (
          <button type="button" className="connect-link" disabled={busy} onClick={() => run('requestCode')}>
            {t('services.aqara.resend')}
          </button>
        )}
      </form>
      <LoginGuide base="services.aqara.guide" stepCount={7} problemCount={4}
        links={{ developer: 'https://developer.aqara.com/' }} />
    </div>
  );
};
