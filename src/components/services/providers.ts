import type { ProviderId } from '../../types/electron-api';

export interface ProviderInfo {
  id: ProviderId;
  /** Короткая метка на карточке устройства. */
  badge: string;
  /** Фирменный цвет плашки. */
  color: string;
  available: boolean;
}

// Xiaomi подключается через Home Assistant (официальная интеграция Xiaomi разрешена только там).
export const PROVIDERS: ProviderInfo[] = [
  { id: 'yandex', badge: 'Я', color: '#FC3F1D', available: true },
  { id: 'xiaomi', badge: 'Mi', color: '#FF6900', available: true },
  { id: 'aqara', badge: 'Aq', color: '#2B2B2B', available: true },
  { id: 'homeassistant', badge: 'HA', color: '#18A0D8', available: true },
];

export const providerInfo = (id: string | undefined): ProviderInfo =>
  PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];
