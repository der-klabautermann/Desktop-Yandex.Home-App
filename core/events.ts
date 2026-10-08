// События для ленты уведомлений: что изменилось между двумя загрузками дома.
// Только заметные изменения (открытие, протечка, дым, батарея, связь), без шума от датчиков движения.
import type { YandexDevice } from '../src/types/index';
import type { AccountSummary, HomeData, ProviderId } from './model';

export type EventKind =
  | 'opened' | 'leak' | 'smoke' | 'gas' | 'batteryLow'
  | 'deviceOffline' | 'deviceOnline' | 'serviceOffline' | 'serviceOnline' | 'serviceRelogin';

export type EventSeverity = 'info' | 'warning' | 'alarm';

export interface HomeEvent {
  id: string;
  at: number;
  kind: EventKind;
  severity: EventSeverity;
  deviceId?: string;
  deviceName?: string;
  providerId?: string;
  value?: number;
}

const BATTERY_LOW = 15;

const propertyValue = (device: YandexDevice, instance: string): unknown =>
  device.properties?.find(p => (p.parameters?.instance ?? p.state?.instance) === instance)?.state?.value;

type Rule = { instance: string; value: string; kind: EventKind; severity: EventSeverity };
const EVENT_RULES: Rule[] = [
  { instance: 'open', value: 'opened', kind: 'opened', severity: 'info' },
  { instance: 'water_leak', value: 'leak', kind: 'leak', severity: 'alarm' },
  { instance: 'smoke', value: 'detected', kind: 'smoke', severity: 'alarm' },
  { instance: 'gas', value: 'detected', kind: 'gas', severity: 'alarm' },
];

export const detectEvents = (
  prev: HomeData | null,
  next: HomeData,
  prevAccounts: AccountSummary[],
  nextAccounts: AccountSummary[],
  now: number = Date.now(),
): HomeEvent[] => {
  if (!prev) return [];
  const events: HomeEvent[] = [];
  const push = (event: Omit<HomeEvent, 'id' | 'at'>) =>
    events.push({ ...event, at: now, id: `${now}-${events.length}-${event.kind}-${event.deviceId ?? event.providerId ?? ''}` });

  // Сервисы: связь пропала или вернулась
  const changedProviders = new Set<string>();
  for (const account of nextAccounts) {
    const before = prevAccounts.find(a => a.providerId === account.providerId);
    if (!before || before.status === account.status) continue;
    changedProviders.add(account.providerId);
    if (account.status === 'offline') push({ kind: 'serviceOffline', severity: 'warning', providerId: account.providerId });
    if (account.status === 'relogin') push({ kind: 'serviceRelogin', severity: 'warning', providerId: account.providerId });
    if (account.status === 'connected') push({ kind: 'serviceOnline', severity: 'info', providerId: account.providerId });
  }

  const previous = new Map(prev.devices.map(d => [d.id, d]));
  for (const device of next.devices) {
    const before = previous.get(device.id);
    if (!before) continue;
    const base = { deviceId: device.id, deviceName: device.name, providerId: device.provider_id as ProviderId | undefined };
    // Если пропал весь сервис, отдельные устройства не перечисляем
    const serviceChanged = changedProviders.has(device.provider_id ?? 'yandex');

    if (!serviceChanged && Boolean(before.unreachable) !== Boolean(device.unreachable)) {
      push({ ...base, kind: device.unreachable ? 'deviceOffline' : 'deviceOnline', severity: device.unreachable ? 'warning' : 'info' });
    }
    if (device.unreachable) continue;

    for (const rule of EVENT_RULES) {
      if (propertyValue(device, rule.instance) === rule.value && propertyValue(before, rule.instance) !== rule.value) {
        push({ ...base, kind: rule.kind, severity: rule.severity });
      }
    }

    const battery = propertyValue(device, 'battery_level');
    const batteryBefore = propertyValue(before, 'battery_level');
    if (typeof battery === 'number' && battery < BATTERY_LOW && (typeof batteryBefore !== 'number' || batteryBefore >= BATTERY_LOW)) {
      push({ ...base, kind: 'batteryLow', severity: 'warning', value: battery });
    }
  }
  return events;
};
