// Собственные сценарии: цепочки шагов с устройствами любых сервисов (Яндекс, Aqara, Home Assistant).
// Сценарий — это старт (по нажатию или по расписанию) и одна или несколько параллельных цепочек.
// Хранятся вместе с расписаниями (schedules.json) и выполняются главным процессом.
import type { YandexScenario } from '../src/types/index';
import type { ModeAction } from './model';

/** Когда выполнять шаг: сразу, через несколько минут после предыдущего или в заданное время. */
export type StepWait =
  | { kind: 'delay'; minutes: number }
  | { kind: 'at'; time: string };

export interface ScenarioStep {
  deviceId: string;
  /** Включить или выключить. */
  on: boolean;
  /** Дополнительные настройки при включении, например яркость. */
  actions?: ModeAction[];
  /** Без ожидания шаг выполняется сразу после предыдущего. */
  wait?: StepWait;
}

export interface CustomScenario {
  id: string;
  name: string;
  householdId: string | null;
  /** Параллельные цепочки; внутри цепочки шаги идут по очереди. */
  branches?: ScenarioStep[][];
  /** Старый формат (все шаги сразу): читаем, но больше не пишем. */
  steps?: ScenarioStep[];
}

export const isCustomScenarioId = (id: string) => id.startsWith('cscen:');

/** Цепочки сценария; старый формат превращается в одну цепочку без ожиданий. */
export const branchesOf = (scenario: CustomScenario): ScenarioStep[][] =>
  scenario.branches ?? (scenario.steps?.length ? [scenario.steps] : []);

interface ScenarioHolder { scenarios?: CustomScenario[] }

const newId = () => `cscen:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Пустые цепочки и некорректные ожидания не сохраняем. */
const cleanBranches = (branches: ScenarioStep[][]) =>
  branches
    .map(branch => branch.map(step => {
      const { wait, ...rest } = step;
      if (!wait) return rest;
      if (wait.kind === 'delay' && wait.minutes > 0) return { ...rest, wait: { kind: 'delay' as const, minutes: Math.round(wait.minutes) } };
      if (wait.kind === 'at' && /^([01]\d|2[0-3]):[0-5]\d$/.test(wait.time)) return { ...rest, wait };
      return rest;
    }))
    .filter(branch => branch.length > 0);

export const newScenarioId = newId;

export const addScenario = <T extends ScenarioHolder>(
  config: T, scenario: { name: string; householdId: string | null; branches: ScenarioStep[][] }, id: string = newId(),
): { config: T; id: string } => {
  const created: CustomScenario = { id, name: scenario.name.trim(), householdId: scenario.householdId, branches: cleanBranches(scenario.branches) };
  return { config: { ...config, scenarios: [...(config.scenarios ?? []), created] }, id };
};

export const updateScenario = <T extends ScenarioHolder>(config: T, id: string, changes: { name?: string; branches?: ScenarioStep[][] }): T => ({
  ...config,
  scenarios: (config.scenarios ?? []).map(s => {
    if (s.id !== id) return s;
    const { steps: _legacy, ...rest } = s;
    return {
      ...rest,
      name: changes.name !== undefined ? changes.name.trim() || s.name : s.name,
      branches: changes.branches !== undefined ? cleanBranches(changes.branches) : branchesOf(s),
    };
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
    .map(s => ({
      id: s.id, name: s.name, is_active: true,
      steps: [{ parameters: { items: branchesOf(s).flat().map(step => ({ id: step.deviceId })) } }],
    }));

/** Сколько ждать перед шагом (мс). «В заданное время» — ближайшее наступление, не дальше суток. */
export const waitMs = (wait: StepWait | undefined, now: Date): number => {
  if (!wait) return 0;
  if (wait.kind === 'delay') return Math.max(0, wait.minutes) * 60_000;
  const [hours, minutes] = wait.time.split(':').map(Number);
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  if (at.getTime() < now.getTime() - 30_000) at.setDate(at.getDate() + 1);
  return Math.max(0, at.getTime() - now.getTime());
};

interface StepRunner {
  toggleDevice(deviceId: string, on: boolean): Promise<unknown>;
  setDeviceMode(deviceId: string, actions: ModeAction[], turnOn: boolean): Promise<unknown>;
}

export interface FlowResult { total: number; failed: string[] }

interface FlowOptions {
  signal?: AbortSignal;
  now?: () => Date;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const defaultSleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(new Error('ERR_ABORTED')); return; }
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('ERR_ABORTED')); }, { once: true });
});

const runStep = (runner: StepRunner, step: ScenarioStep) =>
  step.on && step.actions?.length
    ? runner.setDeviceMode(step.deviceId, step.actions, true)
    : runner.toggleDevice(step.deviceId, step.on);

/**
 * Запускает цепочки параллельно, шаги внутри цепочки по очереди с ожиданиями.
 * immediate — итог шагов до первого ожидания (для сообщения пользователю), done — итог всего сценария.
 * Ошибка одного устройства не останавливает цепочку.
 */
export const runScenarioFlow = (runner: StepRunner, branches: ScenarioStep[][], options: FlowOptions = {}) => {
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;
  const result: FlowResult = { total: 0, failed: [] };
  const snapshot = () => ({ total: result.total, failed: [...result.failed] });
  // Итог «сразу» фиксируем в момент, когда последняя цепочка дошла до первого ожидания
  let resolveImmediate!: (value: FlowResult) => void;
  const immediate = new Promise<FlowResult>(resolve => { resolveImmediate = resolve; });
  let paused = 0;
  const pause = () => { paused += 1; if (paused === branches.length) resolveImmediate(snapshot()); };
  if (branches.length === 0) resolveImmediate(snapshot());

  const branchRuns = branches.map(branch => {
    let reached = false;
    const reachPause = () => { if (!reached) { reached = true; pause(); } };
    return (async () => {
      try {
        for (const step of branch) {
          const ms = waitMs(step.wait, now());
          if (ms > 0) {
            reachPause();
            await sleep(ms, options.signal);
          }
          if (options.signal?.aborted) return;
          result.total += 1;
          try { await runStep(runner, step); } catch { result.failed.push(step.deviceId); }
        }
      } catch {
        // Отменено: оставшиеся шаги не выполняем
      } finally {
        reachPause();
      }
    })();
  });

  return { immediate, done: Promise.all(branchRuns).then(snapshot) };
};
