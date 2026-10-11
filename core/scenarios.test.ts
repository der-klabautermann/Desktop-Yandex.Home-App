import { describe, expect, it } from 'vitest';
import { addScenario, isCustomScenarioId, removeScenario, runScenarioSteps, scenariosAsYandex, updateScenario } from './scenarios';

describe('eigene Szenarien', () => {
  const { config, id } = addScenario({ scenarios: [] }, {
    name: ' Filmabend ', householdId: 'h1',
    steps: [
      { deviceId: 'yandex-lamp', on: true, actions: [{ instance: 'brightness', value: 20, type: 'devices.capabilities.range' }] },
      { deviceId: 'aqara:plug', on: false },
      { deviceId: 'aqara:plug', on: true },
    ],
  });

  it('legt an, kürzt den Namen und hält ein Gerät nur einmal', () => {
    expect(isCustomScenarioId(id)).toBe(true);
    expect(config.scenarios[0].name).toBe('Filmabend');
    expect(config.scenarios[0].steps).toHaveLength(2);
    expect(config.scenarios[0].steps.find(s => s.deviceId === 'aqara:plug')?.on).toBe(true);
  });

  it('zeigt Szenarien nur im passenden Haus', () => {
    expect(scenariosAsYandex(config.scenarios, 'h1')).toHaveLength(1);
    expect(scenariosAsYandex(config.scenarios, 'h2')).toHaveLength(0);
  });

  it('ändert und löscht', () => {
    expect(updateScenario(config, id, { name: 'Kino' }).scenarios[0].name).toBe('Kino');
    expect(removeScenario(config, id).scenarios).toHaveLength(0);
  });

  it('führt alle Schritte aus, auch wenn einer fehlschlägt', async () => {
    const calls: string[] = [];
    const runner = {
      toggleDevice: async (deviceId: string, on: boolean) => {
        calls.push(`${deviceId}:${on}`);
        if (deviceId === 'aqara:plug') throw new Error('offline');
      },
      setDeviceMode: async (deviceId: string) => { calls.push(`${deviceId}:mode`); },
    };
    const result = await runScenarioSteps(runner, config.scenarios[0].steps);
    expect(calls.sort()).toEqual(['aqara:plug:true', 'yandex-lamp:mode']);
    expect(result).toEqual({ total: 2, failed: ['aqara:plug'] });
  });
});
