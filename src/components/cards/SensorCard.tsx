import React from 'react';
import { YandexDevice } from '../../types/index';
import { getIconForDevice } from '../../constants';
import type { SensorDisplayConfig } from '../modals/SensorSettingsModal';
import { Star, Eye, EyeOff } from 'lucide-react';
import { InstanceIcon, formatPropertyValue } from '../../utils/deviceInfo';
import { useI18n } from '../../i18n/I18nContext';
import { ProviderBadge } from '../services/ProviderBadge';

const getIconForInstance = (instance: string, className: string = 'w-5 h-5'): React.ReactNode =>
  <InstanceIcon instance={instance} className={className} />;

interface SensorCardProps {
  device: YandexDevice;
  /** Intentionally unused for sensor cards (sensors are not toggleable). Kept for interface compatibility with DeviceCardProps. */
  onToggle: (id: string, currentState: boolean) => Promise<void>;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenSettings?: (device: YandexDevice) => void;
  onOpenCameraStream?: (device: YandexDevice) => void;
  isEditMode?: boolean;
  iconHiddenState?: boolean;
  onToggleVisibility?: (id: string) => void;
  sensorDisplayConfig?: Record<string, SensorDisplayConfig>;
}

interface PropertyData {
  key: string;
  originalIndex: number;
  instance: string;
  rawValue: unknown;
  type: string;
  unit?: string;
  events?: Array<{ value: string; name: string }>;
}

/**
 * Extract all valid properties with their original index in device.properties array.
 * Used both for display and for config matching.
 */
const extractProperties = (device: YandexDevice): PropertyData[] => {
  const props = device.properties ?? [];
  const result: PropertyData[] = [];

  for (let i = 0; i < props.length; i++) {
    const anyProp = props[i] as any;
    const type: string | undefined = anyProp?.type;
    const instance: string | undefined = anyProp?.parameters?.instance ?? anyProp?.state?.instance;
    const value: unknown = anyProp?.state?.value;

    if (typeof type !== 'string' || !type.includes('devices.properties') || !instance || value === undefined) {
      continue;
    }

    result.push({
      key: `${instance}_${i}`,
      originalIndex: i,
      instance,
      rawValue: value,
      type,
      unit: anyProp?.parameters?.unit ?? anyProp?.state?.unit,
      events: anyProp?.parameters?.events as Array<{ value: string; name: string }> | undefined,
    });
  }

  return result;
};

export const SensorCard: React.FC<SensorCardProps> = ({
  device,
  onToggle,
  isFavorite,
  onToggleFavorite,
  onOpenSettings,
  onOpenCameraStream,
  isEditMode = false,
  iconHiddenState = false,
  onToggleVisibility,
  sensorDisplayConfig,
}) => {
  const { t, lang } = useI18n();
  const allProps = extractProperties(device);
  const formatMainValue = (prop: PropertyData) => formatPropertyValue((device.properties ?? [])[prop.originalIndex], t, lang);

  // Determine which properties to show based on saved config, with fallback
  const config = sensorDisplayConfig?.[device.id];

  let primaryProp: PropertyData | undefined;
  let secondaryProps: PropertyData[] = [];

  if (config && allProps.length > 0) {
    // Try to match by originalIndex
    primaryProp = allProps.find(p => p.originalIndex === config.primaryIndex);
    secondaryProps = config.secondaryIndexes
      .map(idx => allProps.find(p => p.originalIndex === idx))
      .filter((p): p is PropertyData => p !== undefined)
      .filter(p => p !== primaryProp)
      .slice(0, 2);
  }

  // If no config or config doesn't match, fall back to default behavior
  if (!primaryProp) {
    if (allProps.length >= 3) {
      primaryProp = allProps[2];
      secondaryProps = [allProps[0], allProps[1]];
    } else if (allProps.length === 2) {
      primaryProp = allProps[1];
      secondaryProps = [allProps[0]];
    } else if (allProps.length === 1) {
      primaryProp = allProps[0];
      secondaryProps = [];
    }
  }

  const icon = getIconForDevice(device.type);

  const isUnreachable = Boolean(device.unreachable);

  const handleClick = () => {
    // Сервис недоступен: onToggle только сообщит «нет связи»
    if (isUnreachable) { void onToggle(device.id, false).catch(() => {}); return; }
    if (onOpenSettings) {
      onOpenSettings(device);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onOpenSettings) {
      e.preventDefault();
      e.stopPropagation();
      onOpenSettings(device);
    }
  };

  return (
    <div
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`device-card sensor-card ${isUnreachable ? 'is-unreachable' : ''} ${isEditMode && iconHiddenState ? 'opacity-50 grayscale' : ''}`}
    >
      <div className="device-card-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="device-icon">
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          {isEditMode && onToggleVisibility && (
            <div
              onClick={(e) => { e.stopPropagation(); onToggleVisibility(`device_${device.id}`); }}
              style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              className="edit-vis-btn"
            >
              {iconHiddenState ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(device.id); }}
            className={`device-fav ${isFavorite ? 'is-fav' : ''}`}
          >
            <Star className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="device-name">{device.name}<ProviderBadge providerId={device.provider_id} unreachable={isUnreachable} /></div>

      {secondaryProps.length > 0 && (
        <div className="device-type-label">
          {secondaryProps.map((prop, idx) => (
            <span key={prop.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: idx > 0 ? 6 : 0 }}>
              {getIconForInstance(prop.instance, 'w-3.5 h-3.5')}
              {formatMainValue(prop)}
            </span>
          ))}
        </div>
      )}

      {primaryProp && <hr className="sensor-divider" />}

      {primaryProp && (
        <div className="sensor-main-value">
          <span className="sensor-main-icon">
            {getIconForInstance(primaryProp.instance, 'w-4 h-4')}
          </span>
          <span className="sensor-main-text">
            {formatMainValue(primaryProp)}
          </span>
        </div>
      )}
    </div>
  );
};
