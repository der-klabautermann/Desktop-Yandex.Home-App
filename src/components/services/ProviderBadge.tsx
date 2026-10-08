import React, { useContext } from 'react';
import { CloudOff } from 'lucide-react';
import DashboardContext from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { providerInfo } from './providers';

/**
 * Метка сервиса на карточке. Видна, только когда подключено больше одного сервиса,
 * а у недоступного сервиса всегда, со значком «нет связи».
 */
export const ProviderBadge: React.FC<{ providerId?: string; unreachable?: boolean }> = ({ providerId, unreachable }) => {
  const ctx = useContext(DashboardContext);
  const { t } = useI18n();
  const several = (ctx?.accounts.length ?? 0) > 1;
  if (!several && !unreachable) return null;
  const info = providerInfo(providerId);
  const name = t(`services.names.${info.id}`);
  return (
    <span
      className={`provider-badge ${unreachable ? 'is-unreachable' : ''}`}
      title={unreachable ? t('services.unreachable', { name }) : name}
    >
      {unreachable && <CloudOff className="w-3 h-3" />}
      {several && info.badge}
    </span>
  );
};
