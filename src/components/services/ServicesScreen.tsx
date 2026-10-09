import React, { useContext, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw, LogIn, Unplug, ChevronRight, PackagePlus } from 'lucide-react';
import DashboardContext from '../../contexts/DashboardContext';
import { ProviderDevices } from './ProviderDevices';
import { AddDeviceDialog } from './AddDeviceDialog';
import { useI18n } from '../../i18n/I18nContext';
import { disconnectProvider } from '../../services/hub';
import type { AccountSummary, ProviderId } from '../../types/electron-api';
import { cleanErrorMessage } from '../../utils/errors';
import { HubMap } from './HubMap';
import { ProviderMark } from './ProviderMark';
import { ProviderPicker } from './ProviderPicker';
import { YandexConnect } from './YandexConnect';
import { AqaraConnect } from './AqaraConnect';
import { HomeAssistantConnect } from './HomeAssistantConnect';

interface ServicesScreenProps {
  accounts: AccountSummary[];
  /** Сервис подключён или отключён: нужно заново загрузить дом. stay: остаться на этом экране. */
  onChanged: (stay?: boolean) => void;
  /** Открыть страницу устройства (из списка устройств сервиса). */
  onOpenDevice?: (deviceId: string) => void;
  /** Нет, если открыто вместо панели (тогда кнопка «назад» не нужна). */
  onClose?: () => void;
  /** Ошибка последней загрузки. */
  error?: string;
  onRetry?: () => void;
  /** С чего начать: список сервисов или сразу выбор нового. */
  initialView?: 'list' | 'pick';
}

type View = { kind: 'list' } | { kind: 'pick' } | { kind: 'connect'; providerId: ProviderId } | { kind: 'provider'; providerId: ProviderId };

/** «Мои сервисы»: список подключённых сервисов, выбор нового и вход в него. */
export const ServicesScreen: React.FC<ServicesScreenProps> = ({ accounts, onChanged, onClose, error, onRetry, initialView, onOpenDevice }) => {
  const { t } = useI18n();
  // Без панели (первый запуск) списков устройств ещё нет
  const dashboard = useContext(DashboardContext);
  // Окно добавления устройства: для какого сервиса (или выбор сервиса)
  const [adding, setAdding] = useState<{ providerId?: ProviderId } | null>(null);
  // Новый сервис подключают ради устройства: после входа сразу продолжить добавление
  const [addAfterConnect, setAddAfterConnect] = useState(false);

  const connectedNew = (providerId: ProviderId) => {
    if (addAfterConnect) {
      setAddAfterConnect(false);
      onChanged(true);
      setView({ kind: 'provider', providerId });
      setAdding({ providerId });
    } else {
      setView({ kind: 'list' });
      onChanged();
    }
  };
  const [view, setView] = useState<View>(accounts.length === 0 || initialView === 'pick' ? { kind: 'pick' } : { kind: 'list' });
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
    else if (view.kind === 'provider') setView({ kind: 'list' });
    else setView(accounts.length ? { kind: 'list' } : { kind: 'pick' });
  };
  const showBack = view.kind === 'list' ? Boolean(onClose) : view.kind === 'connect' || view.kind === 'provider' || accounts.length > 0;

  const title = view.kind === 'pick'
    ? (accounts.length === 0 ? t('services.welcome') : t('services.choose'))
    : view.kind === 'connect' || view.kind === 'provider' ? t(`services.names.${view.providerId}`) : t('services.title');
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
                <button
                  className="service-card-open"
                  disabled={!dashboard}
                  onClick={() => setView({ kind: 'provider', providerId: account.providerId })}
                  title={t('services.showDevices')}
                >
                  <ProviderMark id={account.providerId} />
                  <div className="service-card-text">
                    <strong>{t(`services.names.${account.providerId}`)}</strong>
                    <span className="service-status"><i />{t(`services.status.${account.status}`)}</span>
                  </div>
                  {dashboard && <ChevronRight className="w-4 h-4 service-card-chevron" />}
                </button>
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
          <div className="services-add-row">
            {dashboard && (
              <button className="services-add" onClick={() => setAdding({})}>
                <PackagePlus className="w-4 h-4" /> {t('addDevice.title')}
              </button>
            )}
            <button className="services-add" onClick={() => setView({ kind: 'pick' })}>
              <Plus className="w-4 h-4" /> {t('services.add')}
            </button>
          </div>
        </>
      )}

      {view.kind === 'provider' && dashboard && (
        <ProviderDevices
          providerId={view.providerId}
          onAdd={() => setAdding({ providerId: view.providerId })}
          onOpenDevice={id => onOpenDevice?.(id)}
        />
      )}

      {adding && dashboard && (
        <AddDeviceDialog
          providerId={adding.providerId}
          onClose={() => setAdding(null)}
          onConnectNew={() => { setAdding(null); setAddAfterConnect(true); setView({ kind: 'pick' }); }}
          onOpenDevice={id => { setAdding(null); onOpenDevice?.(id); }}
        />
      )}

      {view.kind === 'pick' && (
        <ProviderPicker
          connected={accounts.filter(a => a.status === 'connected').map(a => a.providerId)}
          onPick={providerId => setView({ kind: 'connect', providerId })}
        />
      )}

      {view.kind === 'connect' && view.providerId === 'yandex' && (
        <YandexConnect onConnected={() => connectedNew('yandex')} />
      )}
      {view.kind === 'connect' && (view.providerId === 'homeassistant' || view.providerId === 'xiaomi') && (
        <HomeAssistantConnect
          variant={view.providerId}
          alreadyConnected={view.providerId === 'xiaomi' && accounts.some(a => a.providerId === 'homeassistant')}
          onConnected={() => connectedNew(view.providerId === 'xiaomi' ? 'homeassistant' : view.providerId)}
        />
      )}
      {view.kind === 'connect' && view.providerId === 'aqara' && (
        <AqaraConnect onConnected={() => connectedNew('aqara')} />
      )}
    </div>
  );
};
