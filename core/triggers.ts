// Запуск собственных сценариев по событиям устройств: движение, нажатие кнопки, открытие двери,
// включение устройства и т. п. Центр сравнивает два последних опроса и находит новые события.
import type { YandexDevice } from '../src/types/index';

export interface DeviceTrigger {
  id: string;
  deviceId: string;
  /** Показатель: motion, button, open, water_leak, smoke … или on (включение). */
  instance: string;
  /** Нужное значение: detected, click, opened … для on: 'true' или 'false'. */
  value: string;
}

export interface TriggerOption { instance: string; value: string }

/** Какие события устройства годятся как старт сценария. */
export const triggerOptionsFor = (device: YandexDevice): TriggerOption[] => {
  const options: TriggerOption[] = [];
  for (const property of device.properties ?? []) {
    if ((property as any).type !== 'devices.properties.event') continue;
    const instance: string | undefined = (property as any).parameters?.instance ?? (property as any).state?.instance;
    const events: Array<{ value: string }> = (property as any).parameters?.events ?? [];
    if (!instance) continue;
    for (const event of events) options.push({ instance, value: event.value });
  }
  if (device.capabilities.some(c => c.type === 'devices.capabilities.on_off')) {
    options.push({ instance: 'on', value: 'true' }, { instance: 'on', value: 'false' });
  }
  return options;
};

export const canTrigger = (device: YandexDevice) => triggerOptionsFor(device).length > 0;

interface Reading { value: string; at: number | null }
/** Снимок всех событий и включений: ключ «устройство|показатель». */
export type HomeSnapshot = Map<string, Reading>;

const key = (deviceId: string, instance: string) => `${deviceId}|${instance}`;

export const snapshotOf = (devices: YandexDevice[]): HomeSnapshot => {
  const snapshot: HomeSnapshot = new Map();
  for (const device of devices) {
    // Недоступный сервис отдаёт старое состояние: по нему ничего не запускаем
    if (device.unreachable) continue;
    for (const property of device.properties ?? []) {
      if ((property as any).type !== 'devices.properties.event') continue;
      const instance = (property as any).parameters?.instance ?? (property as any).state?.instance;
      const value = (property as any).state?.value;
      if (!instance || typeof value !== 'string') continue;
      const updated = Number((property as any).last_updated);
      snapshot.set(key(device.id, instance), { value, at: Number.isFinite(updated) && updated > 0 ? updated : null });
    }
    const onOff = device.capabilities.find(c => c.type === 'devices.capabilities.on_off');
    if (typeof onOff?.state?.value === 'boolean') snapshot.set(key(device.id, 'on'), { value: String(onOff.state.value), at: null });
  }
  return snapshot;
};

/**
 * Сработал ли старт: значение стало нужным, или то же значение пришло заново (второе нажатие кнопки,
 * новое движение). Первый опрос после запуска приложения ничего не запускает.
 */
export const isFired = (trigger: DeviceTrigger, previous: HomeSnapshot | null, next: HomeSnapshot): boolean => {
  if (!previous) return false;
  const now = next.get(key(trigger.deviceId, trigger.instance));
  const before = previous.get(key(trigger.deviceId, trigger.instance));
  if (!now || !before || now.value !== trigger.value) return false;
  if (before.value !== now.value) return true;
  return now.at !== null && before.at !== null && now.at > before.at;
};

/** Сценарии, которые нужно запустить после нового опроса. */
export const firedScenarios = (
  scenarios: Array<{ id: string; triggers?: DeviceTrigger[] }>, previous: HomeSnapshot | null, next: HomeSnapshot,
): string[] => scenarios.filter(s => (s.triggers ?? []).some(trigger => isFired(trigger, previous, next))).map(s => s.id);

export const newTriggerId = () => `trg${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
