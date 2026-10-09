import { describe, expect, it } from 'vitest';
import { addGroup, customGroupsAsYandex, isCustomGroupId, removeGroup, updateGroup } from './groups';
import { EMPTY_ZONE_CONFIG } from './zones';
import type { HomeData } from './model';

const onOff = (value: boolean) => ({ type: 'devices.capabilities.on_off', retrievable: true, reportable: true, state: { instance: 'on', value } });

const home: HomeData = {
  status: 'ok', request_id: 'r', households: [{ id: 'h1', name: 'Дом' }], rooms: [], groups: [], scenarios: [],
  devices: [
    { id: 'yandex:lamp', name: 'Лампа', type: 'devices.types.light', capabilities: [onOff(true)] },
    { id: 'aqara:plug', name: 'Розетка', type: 'devices.types.socket', capabilities: [onOff(true)] },
    { id: 'homeassistant:fan', name: 'Вентилятор', type: 'devices.types.ventilation.fan', capabilities: [onOff(false)], unreachable: true },
  ],
};

describe('eigene Gruppen', () => {
  const created = addGroup(EMPTY_ZONE_CONFIG, { name: ' Wohnlicht ', householdId: 'h1', deviceIds: ['yandex:lamp', 'aqara:plug', 'aqara:plug'] }, () => 'cgroup:1');

  it('legt eine Gruppe über Anbieter hinweg an, ohne doppelte Geräte', () => {
    expect(created.id).toBe('cgroup:1');
    expect(isCustomGroupId(created.id)).toBe(true);
    expect(created.config.groups).toEqual([{ id: 'cgroup:1', name: 'Wohnlicht', householdId: 'h1', deviceIds: ['yandex:lamp', 'aqara:plug'] }]);
  });

  it('erscheint als Gruppe wie bei den Diensten, an nur wenn alle erreichbaren an sind', () => {
    const [group] = customGroupsAsYandex(created.config, home);
    expect(group).toMatchObject({ id: 'cgroup:1', household_id: 'h1', devices: ['yandex:lamp', 'aqara:plug'] });
    expect(group.capabilities[0].state?.value).toBe(true);

    const withFan = updateGroup(created.config, 'cgroup:1', { deviceIds: ['yandex:lamp', 'homeassistant:fan'] });
    // Nicht erreichbarer Ventilator zählt nicht gegen „alle an“
    expect(customGroupsAsYandex(withFan, home)[0].capabilities[0].state?.value).toBe(true);
  });

  it('verschwundene Geräte fallen heraus, leerer Name bleibt beim alten', () => {
    const changed = updateGroup(created.config, 'cgroup:1', { name: '  ', deviceIds: ['yandex:lamp', 'xiaomi:weg'] });
    expect(changed.groups?.[0].name).toBe('Wohnlicht');
    expect(customGroupsAsYandex(changed, home)[0].devices).toEqual(['yandex:lamp']);
  });

  it('löschen entfernt nur diese Gruppe', () => {
    expect(removeGroup(created.config, 'cgroup:1').groups).toEqual([]);
  });
});
