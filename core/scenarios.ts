// Собственные сценарии: шаги с устройствами любых сервисов (Яндекс, Aqara, Home Assistant).
// Хранятся вместе с расписаниями (schedules.json) и выполняются главным процессом.
import type { YandexScenario } from '../src/types/index';
import type { ModeAction } from './model';

export interface ScenarioStep {
  deviceId: string;
  /** Включить или выключить. */
  on: boolean;
  /** Дополнительные настройки при включении, например яркость. */
  actions?: ModeAction[];
}

export interface CustomScenario {
  id: string;
  name: string;
  householdId: string | null;
  steps: ScenarioStep[];
}

export const isCustomScenarioId = (id: string) => id.startsWith('cscen:');

interface ScenarioHolder { scenarios?: CustomScenario[] }

const newId = () => `cscen:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const cleanSteps = (steps: ScenarioStep[]) => {
  // Одно устройство — один шаг: последний выигрывает
  const byDevice = new Map(steps.map(step => [step.deviceId, step]));
  return [...byDevice.values()];
};

export const newScenarioId = newId;

export const addScenario = <T extends ScenarioHolder>(
  config: T, scenario: { name: string; householdId: string | null; steps: ScenarioStep[] }, id: string = newId(),
): { config: T; id: string } => {
  const created: CustomScenario = { id, name: scenario.name.trim(), householdId: scenario.householdId, steps: cleanSteps(scenario.steps) };
  return { config: { ...config, scenarios: [...(config.scenarios ?? []), created] }, id };
};

export const updateScenario = <T extends ScenarioHolder>(config: T, id: string, changes: { name?: string; steps?: ScenarioStep[] }): T => ({
  ...config,
  scenarios: (config.scenarios ?? []).map(s => s.id !== id ? s : {
    ...s,
    name: changes.name !== undefined ? changes.name.trim() || s.name : s.name,
    steps: changes.steps !== undefined ? cleanSteps(changes.steps) : s.steps,
  }),
});

export const removeScenario = <T extends ScenarioHolder>(config: T, id: string): T => ({
  ...config,
  scenarios: (config.scenarios ?? []).filter(s => s.id !== id),
});

/** Сценарии в формате сервисов, чтобы интерфейс показывал их рядом с остальными. */
export const scenariosAsYandex = (scenarios: CustomScenario[], householdId: string | null): YandexScenario[] =>
  scenarios
    .filter(s => !householdId || !s.householdId || s.householdId === householdId)
    // Без provider_id: у собственных объектов приложения метки сервиса нет.
    // Устройства в шагах нужны, чтобы интерфейс понял, к какому дому относится сценарий
    .map(s => ({ id: s.id, name: s.name, is_active: true, steps: [{ parameters: { items: s.steps.map(step => ({ id: step.deviceId })) } }] }));

interface StepRunner {
  toggleDevice(deviceId: string, on: boolean): Promise<unknown>;
  setDeviceMode(deviceId: string, actions: ModeAction[], turnOn: boolean): Promise<unknown>;
}

/** Выполняет все шаги одновременно; ошибка одного устройства не останавливает остальные. */
export const runScenarioSteps = async (runner: StepRunner, steps: ScenarioStep[]) => {
  const results = await Promise.allSettled(steps.map(step =>
    step.on && step.actions?.length
      ? runner.setDeviceMode(step.deviceId, step.actions, true)
      : runner.toggleDevice(step.deviceId, step.on)));
  const failed = steps.filter((_, index) => results[index].status === 'rejected').map(step => step.deviceId);
  return { total: steps.length, failed };
};
