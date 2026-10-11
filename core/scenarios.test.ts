import { describe, expect, it } from 'vitest';
import {
  addScenario, branchesOf, isCustomScenarioId, removeScenario, runScenarioFlow, scenariosAsYandex, updateScenario, waitMs,
} from './scenarios';

const lamp = { deviceId: 'yandex-lamp', on: true, actions: [{ instance: 'brightness', value: 20, type: 'devices.capabilities.range' }] };

describe('eigene Szenarien', () => {
  const { config, id } = addScenario({ scenarios: [] }, {
    name: ' Filmabend ', householdId: 'h1',
    branches: [
      [lamp, { deviceId: 'aqara:plug', on: false, wait: { kind: 'delay', minutes: 10 } }],
      [],
      [{ deviceId: 'homeassistant:tv', on: true, wait: { kind: 'delay', minutes: 0 } }],
    ],
  });

  it('legt an, kürzt den Namen und entfernt leere Stränge und Null-Wartezeiten', () => {
    expect(isCustomScenarioId(id)).toBe(true);
    const branches = branchesOf(config.scenarios[0]);
    expect(config.scenarios[0].name).toBe('Filmabend');
    expect(branches).toHaveLength(2);
    expect(branches[1][0].wait).toBeUndefined();
  });

  it('liest das alte Format als einen Strang', () => {
    const legacy = { id: 'cscen:x', name: 'Alt', householdId: null, steps: [lamp] };
    expect(branchesOf(legacy)).toEqual([[lamp]]);
    expect(updateScenario({ scenarios: [legacy] }, 'cscen:x', { name: 'Neu' }).scenarios[0]).toMatchObject({ name: 'Neu', branches: [[lamp]] });
  });

  it('zeigt Szenarien nur im passenden Haus', () => {
    expect(scenariosAsYandex(config.scenarios, 'h1')).toHaveLength(1);
    expect(scenariosAsYandex(config.scenarios, 'h2')).toHaveLength(0);
  });

  it('ändert und löscht', () => {
    expect(updateScenario(config, id, { name: 'Kino' }).scenarios[0].name).toBe('Kino');
    expect(removeScenario(config, id).scenarios).toHaveLength(0);
  });
});

describe('Wartezeiten', () => {
  const now = new Date(2026, 9, 13, 19, 0);
  it('rechnet Minuten und Uhrzeiten um', () => {
    expect(waitMs(undefined, now)).toBe(0);
    expect(waitMs({ kind: 'delay', minutes: 10 }, now)).toBe(600_000);
    expect(waitMs({ kind: 'at', time: '22:30' }, now)).toBe(3.5 * 3_600_000);
    // Schon vorbei: nächster Tag
    expect(waitMs({ kind: 'at', time: '18:00' }, now)).toBe(23 * 3_600_000);
  });
});

describe('Ablauf', () => {
  it('läuft Stränge parallel, Schritte nacheinander, und meldet Sofort-Schritte getrennt', async () => {
    const calls: string[] = [];
    const sleeps: number[] = [];
    const runner = {
      toggleDevice: async (deviceId: string, on: boolean) => {
        calls.push(`${deviceId}:${on}`);
        if (deviceId === 'aqara:plug') throw new Error('offline');
      },
      setDeviceMode: async (deviceId: string) => { calls.push(`${deviceId}:mode`); },
    };
    const flow = runScenarioFlow(runner, [
      [lamp, { deviceId: 'aqara:plug', on: false, wait: { kind: 'delay', minutes: 10 } }],
      [{ deviceId: 'tv', on: true }],
    ], { sleep: async ms => { sleeps.push(ms); } });

    expect(await flow.immediate).toEqual({ total: 2, failed: [] });
    expect(await flow.done).toEqual({ total: 3, failed: ['aqara:plug'] });
    expect(sleeps).toEqual([600_000]);
    expect(calls).toEqual(['yandex-lamp:mode', 'tv:true', 'aqara:plug:false']);
  });

  it('bricht ab, wenn das Szenario neu gestartet wird', async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    const flow = runScenarioFlow({
      toggleDevice: async (deviceId: string) => { calls.push(deviceId); },
      setDeviceMode: async () => {},
    }, [[{ deviceId: 'a', on: true }, { deviceId: 'b', on: true, wait: { kind: 'delay', minutes: 5 } }]], {
      signal: controller.signal,
      sleep: (_ms, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new Error('ERR_ABORTED')))),
    });
    await flow.immediate;
    controller.abort();
    await flow.done;
    expect(calls).toEqual(['a']);
  });
});
