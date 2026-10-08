import type { YandexDevice } from '../../../src/types/index';
import type { HomeData } from '../../model';

/** Догружает устройства, которые есть в комнатах, но отсутствуют в списке устройств. */
export const fillMissingDevices = async (
  info: HomeData,
  fetchDevice: (deviceId: string) => Promise<YandexDevice>,
): Promise<HomeData> => {
  const known = new Set(info.devices.map(d => d.id));
  const missing = [...new Set(info.rooms.flatMap(r => r.devices))].filter(id => !known.has(id));
  if (missing.length === 0) return info;

  const fetched: YandexDevice[] = [];
  for (const deviceId of missing) {
    try {
      const device = await fetchDevice(deviceId);
      const room = info.rooms.find(r => r.devices.includes(deviceId));
      fetched.push({ ...device, room: device.room ?? room?.id, household_id: device.household_id ?? room?.household_id });
    } catch {
      // Устройство недоступно: показываем остальные
    }
  }
  return { ...info, devices: [...info.devices, ...fetched] };
};
