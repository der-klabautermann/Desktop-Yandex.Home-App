import { PROVIDER_IDS, ProviderId } from './model';

// ID Яндекса остаются без префикса, чтобы не потерять избранное и камеры.
export const withPrefix = (providerId: ProviderId, id: string): string =>
  providerId === 'yandex' ? id : `${providerId}:${id}`;

export const providerOf = (id: string): ProviderId => {
  const index = id.indexOf(':');
  if (index > 0) {
    const prefix = id.slice(0, index) as ProviderId;
    if (prefix !== 'yandex' && PROVIDER_IDS.includes(prefix)) return prefix;
  }
  return 'yandex';
};

export const stripPrefix = (id: string): string => {
  const provider = providerOf(id);
  return provider === 'yandex' ? id : id.slice(provider.length + 1);
};
