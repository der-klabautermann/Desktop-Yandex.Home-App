import React, { useState } from 'react';
import { ArrowLeft, Plus, RefreshCw, LogIn, Unplug } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { disconnectProvider } from '../../services/hub';
import type { AccountSummary, ProviderId } from '../../types/electron-api';
import { cleanErrorMessage } from '../../utils/errors';
import { HubMap } from './HubMap';
import { ProviderMark } from './ProviderMark';
import { ProviderPicker } from './ProviderPicker';
import { YandexConnect } from './YandexConnect';
import { AqaraConnect } from './AqaraConnect';

interface ServicesScreenProps {
  accounts: AccountSummary[];
  /** Сервис подключён или отключён: нужно заново загрузить дом. */
  onChanged: () => void;
  /** Нет, если открыто вместо панели (тогда кнопка «назад» не нужна). */
  onClose?: () => void;
  /** Ошибка последней загрузки. */
  error?: string;
  onRetry?: () => void;
}

type View = { kind: 'list' } | { kind: 'pick' } | { kind: 'connect'; providerId: ProviderId };

/** «Мои сервисы»: список подключённых сервисов, выбор нового и вход в него. */
export const ServicesScreen: React.FC<ServicesScreenProps> = ({ accounts, onChanged, onClose, error, onRetry }) => {
  const { t } = useI18n();
  const [view, setView] = useState<View>(accounts.length === 0 ? { kind: 'pick' } : { kind: 'list' });
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [actionError, setActionError] = useState<string>();

  const disconnect = async (providerId: ProviderId) => {
    if (!window.confirm(t('services.disconnectConfirm', { name: t(`services.names.${providerId}`) }))) return;
    setBusy(providerId);
    setActionError(undefined);
    try {
      await disconnectProvider(providerId);
      onChanged();
    } catch (err) {
      setActionError(cleanErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const back = () => {
    if (view.kind === 'list') onClose?.();
    else setView(accounts.length ? { kind: 'list' } : { kind: 'pick' });
  };
  const showBack = view.kind === 'list' ? Boolean(onClose) : view.kind === 'connect' || accounts.length > 0;

  const title = view.kind === 'pick'
    ? (accounts.length === 0 ? t('services.welcome') : t('services.choose'))
    : view.kind === 'connect' ? t(`services.names.${view.providerId}`) : t('services.title');
  const subtitle = view.kind === 'list' ? t('services.subtitle') : view.kind === 'pick' ? t('services.chooseHint') : undefined;

  return (
    <div className="services-screen">
      <header className="services-header">
        {showBack && (
          <button className="header-btn" onClick={back} title={t('common.close')}>
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      {(error || actionError) && (
        <div className="services-error">
          <span>{actionError ?? error}</span>
          {onRetry && !actionError && (
            <button onClick={onRetry}><RefreshCw className="w-3.5 h-3.5" /> {t('services.retry')}</button>
          )}
        </div>
      )}

      {view.kind === 'list' && (
        <>
          <HubMap accounts={accounts} />
          <div className="services-list">
            {accounts.map((account, index) => (
              <div key={account.providerId} className={`service-card is-${account.status}`} style={{ animationDelay: `${index * 60}ms` }}>
                <ProviderMark id={account.providerId} />
                <div className="service-card-text">
                  <strong>{t(`services.names.${account.providerId}`)}</strong>
                  <span className="service-status"><i />{t(`services.status.${account.status}`)}</span>
                </div>
                {account.status === 'relogin' && (
                  <button className="service-action" onClick={() => setView({ kind: 'connect', providerId: account.providerId })}>
                    <LogIn className="w-3.5 h-3.5" /> {t('services.relogin')}
                  </button>
                )}
                <button className="service-action is-quiet" disabled={busy === account.providerId} onClick={() => disconnect(account.providerId)}>
                  <Unplug className="w-3.5 h-3.5" /> {t('services.disconnect')}
                </button>
              </div>
            ))}
          </div>
          <button className="services-add" onClick={() => setView({ kind: 'pick' })}>
            <Plus className="w-4 h-4" /> {t('services.add')}
          </button>
        </>
      )}

      {view.kind === 'pick' && (
        <ProviderPicker
          connected={accounts.filter(a => a.status === 'connected').map(a => a.providerId)}
          onPick={providerId => setView({ kind: 'connect', providerId })}
        />
      )}

      {view.kind === 'connect' && view.providerId === 'yandex' && (
        <YandexConnect onConnected={() => { setView({ kind: 'list' }); onChanged(); }} />
      )}
      {view.kind === 'connect' && view.providerId === 'aqara' && (
        <AqaraConnect onConnected={() => { setView({ kind: 'list' }); onChanged(); }} />
      )}
    </div>
  );
};
