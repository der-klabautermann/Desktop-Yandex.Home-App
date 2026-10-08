import { describe, expect, it, vi } from 'vitest';
import { fillMissingDevices } from './fillMissing';
import type { HomeData } from '../../model';

const base: HomeData = {
  status: 'ok', request_id: 'r', households: [], groups: [], scenarios: [],
  rooms: [{ id: 'room', name: 'Кухня', household_id: 'h', devices: ['known', 'missing'] }],
  devices: [{ id: 'known', name: 'A', type: 'devices.types.light', capabilities: [] }],
};

describe('fillMissingDevices', () => {
  it('lädt fehlende Geräte nach und setzt Raum und Haus', async () => {
    const fetchDevice = vi.fn(async (id: string) => ({ id, name: 'B', type: 'devices.types.socket', capabilities: [] }));
    const result = await fillMissingDevices(base, fetchDevice);
    expect(fetchDevice).toHaveBeenCalledWith('missing');
    const added = result.devices.find(d => d.id === 'missing')!;
    expect(added.room).toBe('room');
    expect(added.household_id).toBe('h');
  });

  it('überspringt Geräte, die nicht geladen werden können', async () => {
    const result = await fillMissingDevices(base, async () => { throw new Error('ERR_HTTP 404'); });
    expect(result.devices.map(d => d.id)).toEqual(['known']);
  });

  it('ändert nichts, wenn nichts fehlt', async () => {
    const complete = { ...base, rooms: [{ ...base.rooms[0], devices: ['known'] }] };
    const fetchDevice = vi.fn();
    expect(await fillMissingDevices(complete, fetchDevice)).toBe(complete);
    expect(fetchDevice).not.toHaveBeenCalled();
  });
});
