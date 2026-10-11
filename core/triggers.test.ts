import { describe, expect, it } from 'vitest';
import { firedScenarios, isFired, snapshotOf, triggerOptionsFor } from './triggers';
import type { YandexDevice } from '../src/types/index';

const button = (value: string, at: number): YandexDevice => ({
  id: 'aqara:btn', name: 'Taster', type: 'devices.types.sensor.button', capabilities: [],
  properties: [{
    type: 'devices.properties.event', parameters: { instance: 'button', events: [{ value: 'click' }, { value: 'double_click' }] },
    state: { instance: 'button', value }, last_updated: at,
  }],
} as any);

const lamp = (on: boolean): YandexDevice => ({
  id: 'lamp', name: 'Lampe', type: 'devices.types.light',
  capabilities: [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: on } }],
} as any);

const click = { id: 't1', deviceId: 'aqara:btn', instance: 'button', value: 'click' };

describe('Auslöser', () => {
  it('bietet Ereignisse und Ein/Aus als Auslöser an', () => {
    expect(triggerOptionsFor(button('click', 1))).toEqual([{ instance: 'button', value: 'click' }, { instance: 'button', value: 'double_click' }]);
    expect(triggerOptionsFor(lamp(false))).toEqual([{ instance: 'on', value: 'true' }, { instance: 'on', value: 'false' }]);
  });

  it('löst beim ersten Abruf nach dem Start nicht aus', () => {
    expect(isFired(click, null, snapshotOf([button('click', 10)]))).toBe(false);
  });

  it('erkennt einen neuen Wert und denselben Wert mit neuer Zeit', () => {
    const first = snapshotOf([button('double_click', 10)]);
    const second = snapshotOf([button('click', 20)]);
    const third = snapshotOf([button('click', 30)]);
    expect(isFired(click, first, second)).toBe(true);
    expect(isFired(click, second, second)).toBe(false);
    expect(isFired(click, second, third)).toBe(true);
  });

  it('erkennt das Einschalten und ignoriert nicht erreichbare Dienste', () => {
    const on = { id: 't2', deviceId: 'lamp', instance: 'on', value: 'true' };
    expect(isFired(on, snapshotOf([lamp(false)]), snapshotOf([lamp(true)]))).toBe(true);
    expect(isFired(on, snapshotOf([lamp(false)]), snapshotOf([{ ...lamp(true), unreachable: true } as any]))).toBe(false);
  });

  it('liefert die passenden Szenarien', () => {
    const scenarios = [{ id: 'cscen:a', triggers: [click] }, { id: 'cscen:b' }];
    expect(firedScenarios(scenarios, snapshotOf([button('double_click', 1)]), snapshotOf([button('click', 2)]))).toEqual(['cscen:a']);
  });
});
