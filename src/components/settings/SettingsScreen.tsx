import React, { useState } from 'react';
import { ArrowLeft, Palette, Type, Languages, Bell, Plug, LayoutGrid, Info, RefreshCw, Pencil, Plus } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { LANGUAGES } from '../../i18n/core';
import { ToggleSwitch } from '../ToggleSwitch';
import { InfoModal } from '../modals/InfoModal';
import { ProviderMark } from '../services/ProviderMark';
import { ThemeSettings } from './ThemeSettings';
import { FontSettings } from './FontSettings';
import type { SystemNotifyLevel } from '../../hooks/useActivity';
import packageJson from '../../../package.json';

type Section = 'appearance' | 'fonts' | 'language' | 'notifications' | 'services' | 'general';

const SECTIONS: Array<{ id: Section; icon: React.ElementType }> = [
  { id: 'appearance', icon: Palette },
  { id: 'fonts', icon: Type },
  { id: 'language', icon: Languages },
  { id: 'notifications', icon: Bell },
  { id: 'services', icon: Plug },
  { id: 'general', icon: LayoutGrid },
];

const NOTIFY_LEVELS: SystemNotifyLevel[] = ['off', 'alarms', 'all'];

interface SettingsScreenProps {
  onClose: () => void;
  onManageServices: () => void;
  onAddService: () => void;
  onEditDashboard: () => void;
}

/** Настройки приложения: всё, что раньше было кнопками в шапке, собрано по разделам. */
export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose, onManageServices, onAddService, onEditDashboard }) => {
  const ctx = useDashboardContext();
  const { t, lang, setLang } = useI18n();
  const [section, setSection] = useState<Section>('appearance');
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="settings-screen">
      <header className="services-header">
        <button className="header-btn" onClick={onClose} title={t('common.close')}><ArrowLeft className="w-4 h-4" /></button>
        <div><h1>{t('settings.title')}</h1></div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map(({ id, icon: Icon }) => (
            <button key={id} className={`settings-nav-item ${section === id ? 'is-active' : ''}`} onClick={() => setSection(id)}>
              <Icon className="w-4 h-4" /> {t(`settings.sections.${id}`)}
            </button>
          ))}
        </nav>

        <section className="settings-panel" key={section}>
          <h2>{t(`settings.sections.${section}`)}</h2>

          {section === 'appearance' && <ThemeSettings />}
          {section === 'fonts' && <FontSettings />}

          {section === 'language' && (
            <div className="settings-choices">
              {LANGUAGES.map(code => (
                <button key={code} className={`settings-choice ${lang === code ? 'is-active' : ''}`} onClick={() => setLang(code)}>
                  <span className="settings-choice-code">{code.toUpperCase()}</span>
                  <span>{t(`language.${code}`)}</span>
                </button>
              ))}
            </div>
          )}

          {section === 'notifications' && (
            <>
              <p className="settings-hint">{t('settings.notifications.hint')}</p>
              <div className="settings-choices is-column">
                {NOTIFY_LEVELS.map(level => (
                  <button
                    key={level}
                    className={`settings-choice ${ctx.activity.systemLevel === level ? 'is-active' : ''}`}
                    onClick={() => ctx.activity.setSystemLevel(level)}
                  >
                    <strong>{t(`settings.notifications.levels.${level}.title`)}</strong>
                    <span>{t(`settings.notifications.levels.${level}.hint`)}</span>
                  </button>
                ))}
              </div>
              <button className="service-action is-quiet settings-row-action" onClick={ctx.activity.clear} disabled={ctx.activity.events.length === 0}>
                {t('settings.notifications.clear')}
              </button>
            </>
          )}

          {section === 'services' && (
            <>
              <div className="services-list">
                {ctx.accounts.map(account => (
                  <div key={account.providerId} className={`service-card is-${account.status}`}>
                    <ProviderMark id={account.providerId} />
                    <div className="service-card-text">
                      <strong>{t(`services.names.${account.providerId}`)}</strong>
                      <span className="service-status"><i />{t(`services.status.${account.status}`)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="settings-actions">
                <button className="service-action" onClick={onManageServices}><Plug className="w-3.5 h-3.5" /> {t('settings.services.manage')}</button>
                <button className="service-action" onClick={onAddService}><Plus className="w-3.5 h-3.5" /> {t('header.addConnection')}</button>
              </div>
            </>
          )}

          {section === 'general' && (
            <div className="settings-rows">
              <div className="settings-row">
                <ToggleSwitch checked={ctx.isAutostartEnabled} onChange={() => ctx.onToggleAutostart()} label={t('settings.general.autostart')} />
              </div>
              <div className="settings-row">
                <div>
                  <strong>{t('settings.general.edit')}</strong>
                  <span>{t('settings.general.editHint')}</span>
                </div>
                <button className="service-action" onClick={onEditDashboard}><Pencil className="w-3.5 h-3.5" /> {t('settings.general.editButton')}</button>
              </div>
              <div className="settings-row">
                <div>
                  <strong>{t('settings.general.refresh')}</strong>
                  <span>{t('settings.general.refreshHint')}</span>
                </div>
                <button className="service-action" disabled={ctx.isRefreshing} onClick={ctx.onRefresh}>
                  <RefreshCw className={`w-3.5 h-3.5 ${ctx.isRefreshing ? 'animate-spin' : ''}`} /> {t('dashboard.refresh')}
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <strong>{t('dashboard.about')}</strong>
                  <span>{t('settings.general.version', { version: packageJson.version })}</span>
                </div>
                <button className="service-action" onClick={() => setShowInfo(true)}><Info className="w-3.5 h-3.5" /> {t('modals.info.check')}</button>
              </div>
            </div>
          )}
        </section>
      </div>

      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} currentVersion={packageJson.version} />
    </div>
  );
};
