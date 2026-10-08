import type { HomeData, ProviderId } from './model';

// Дома с одинаковым названием объединяются, внутри дома объединяются комнаты.
const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export interface ProviderHome {
  providerId: ProviderId;
  data: HomeData;
  /** Сервис сейчас недоступен, данные из последней успешной загрузки. */
  unreachable?: boolean;
}

export const mergeHomes = (parts: ProviderHome[]): HomeData => {
  const result: HomeData = { status: 'ok', request_id: parts.map(p => p.data.request_id).join(','),
    households: [], rooms: [], groups: [], devices: [], scenarios: [] };

  const householdByName = new Map<string, string>();
  const householdMap = new Map<string, string>();
  const roomByKey = new Map<string, string>();
  const roomMap = new Map<string, string>();

  for (const { providerId, data, unreachable } of parts) {
    // Помечаем только недоступные сервисы, чтобы у остальных поле не появлялось вовсе
    const mark = unreachable ? { unreachable: true } : {};

    for (const household of data.households) {
      const key = normalize(household.name);
      const existing = householdByName.get(key);
      if (existing) {
        householdMap.set(household.id, existing);
      } else {
        householdByName.set(key, household.id);
        householdMap.set(household.id, household.id);
        result.households.push({ ...household, provider_id: providerId });
      }
    }

    for (const room of data.rooms) {
      const householdId = householdMap.get(room.household_id) ?? room.household_id;
      const key = `${householdId}|${normalize(room.name)}`;
      const existing = roomByKey.get(key);
      if (existing) {
        roomMap.set(room.id, existing);
        result.rooms.find(r => r.id === existing)!.devices.push(...room.devices);
      } else {
        roomByKey.set(key, room.id);
        roomMap.set(room.id, room.id);
        result.rooms.push({ ...room, household_id: householdId, devices: [...room.devices], provider_id: providerId });
      }
    }

    for (const device of data.devices) {
      result.devices.push({
        ...device,
        ...mark,
        provider_id: providerId,
        room: device.room ? roomMap.get(device.room) ?? device.room : device.room,
        household_id: device.household_id ? householdMap.get(device.household_id) ?? device.household_id : device.household_id,
      });
    }

    for (const group of data.groups) {
      result.groups.push({ ...group, ...mark, provider_id: providerId,
        household_id: householdMap.get(group.household_id) ?? group.household_id });
    }

    for (const scenario of data.scenarios) {
      result.scenarios.push({ ...scenario, ...mark, provider_id: providerId });
    }
  }

  return result;
};
