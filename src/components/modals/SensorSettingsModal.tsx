import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { YandexDevice } from '../../types/index';
import { useI18n } from '../../i18n/I18nContext';
import { InstanceIcon, listProperties, propertyLabel } from '../../utils/deviceInfo';
import { SensorCard } from '../cards/SensorCard';

export interface SensorDisplayConfig {
  /** Index in device.properties array to use as the main (primary) value */
  primaryIndex: number;
  /** Indices in device.properties array to use as secondary values (max 2) */
  secondaryIndexes: number[];
}

interface SensorSettingsModalProps {
  device: YandexDevice;
  isOpen: boolean;
  onClose: () => void;
  onSave: (deviceId: string, config: SensorDisplayConfig) => void;
  initialConfig?: SensorDisplayConfig | null;
}

const MAX_SECONDARY = 2;

/** Что показывает карточка датчика: один крупный показатель и до двух мелких сверху, с живым предпросмотром. */
export const SensorSettingsModal: React.FC<SensorSettingsModalProps> = ({ device, isOpen, onClose, onSave, initialConfig }) => {
  const { t, lang } = useI18n();
  const properties = listProperties(device, t, lang);
  const [primary, setPrimary] = useState<number | null>(null);
  const [secondary, setSecondary] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const exists = (index: number) => properties.some(p => p.index === index);
    if (initialConfig && exists(initialConfig.primaryIndex)) {
      setPrimary(initialConfig.primaryIndex);
      setSecondary(initialConfig.secondaryIndexes.filter(i => i !== initialConfig.primaryIndex && exists(i)).slice(0, MAX_SECONDARY));
    } else if (properties.length > 0) {
      const last = properties[properties.length - 1].index;
      setPrimary(last);
      setSecondary(properties.filter(p => p.index !== last).slice(0, MAX_SECONDARY).map(p => p.index));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, device.id]);

  if (!isOpen) return null;

  const choosePrimary = (index: number) => {
    setPrimary(index);
    setSecondary(prev => prev.filter(i => i !== index));
  };

  const toggleSecondary = (index: number) => setSecondary(prev =>
    prev.includes(index) ? prev.filter(i => i !== index) : prev.length < MAX_SECONDARY ? [...prev, index] : prev);

  const save = () => {
    if (primary === null) return;
    onSave(device.id, { primaryIndex: primary, secondaryIndexes: secondary });
    onClose();
  };

  const draft = primary === null ? undefined : { [device.id]: { primaryIndex: primary, secondaryIndexes: secondary } };

  return createPortal(
    <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="zone-dialog sensor-display" role="dialog" aria-label={t('modals.sensor.title')}>
        <header>
          <h3>{device.name}</h3>
          <button className="header-btn" onClick={onClose} title={t('common.close')}><X className="w-4 h-4" /></button>
        </header>

        {properties.length === 0 ? (
          <p className="zone-dialog-hint">{t('modals.sensor.empty')}</p>
        ) : (
          <>
            <div className="sensor-display-preview" aria-hidden>
              <SensorCard device={device} onToggle={async () => {}} isFavorite={false} onToggleFavorite={() => {}} sensorDisplayConfig={draft} />
            </div>

            <label>{t('modals.sensor.primary')}</label>
            <div className="dd-chips">
              {properties.map(p => (
                <button key={p.index} className={`dd-chip ${primary === p.index ? 'is-active' : ''}`} onClick={() => choosePrimary(p.index)}>
                  <InstanceIcon instance={p.instance} className="w-3.5 h-3.5" />
                  {propertyLabel(p.instance, t)}
                </button>
              ))}
            </div>

            <label>{t('modals.sensor.secondary')}</label>
            <div className="dd-chips">
              {properties.filter(p => p.index !== primary).map(p => {
                const active = secondary.includes(p.index);
                const full = !active && secondary.length >= MAX_SECONDARY;
                return (
                  <button
                    key={p.index}
                    className={`dd-chip ${active ? 'is-active' : ''}`}
                    disabled={full}
                    title={full ? t('modals.sensor.max') : undefined}
                    onClick={() => toggleSecondary(p.index)}
                  >
                    <InstanceIcon instance={p.instance} className="w-3.5 h-3.5" />
                    {propertyLabel(p.instance, t)}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <footer>
          <span style={{ flex: 1 }} />
          <button className="service-action" onClick={onClose}>{t('common.cancel')}</button>
          <button className="connect-primary zone-save" disabled={primary === null} onClick={save}>{t('common.save')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
