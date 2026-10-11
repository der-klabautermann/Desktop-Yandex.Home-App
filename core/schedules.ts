// Расписания: в заданное время по выбранным дням Центр сам включает устройство
// (например, запускает уборку робота-пылесоса) или запускает собственный сценарий.
// Работает, пока запущено приложение.
import type { CustomScenario } from './scenarios';

export interface Schedule {
  id: string;
  /** Что запускать: устройство или собственный сценарий. */
  deviceId?: string;
  scenarioId?: string;
  /** Время запуска «ЧЧ:ММ» по местному времени. */
  time: string;
  /** Дни недели по ISO: 1 = понедельник … 7 = воскресенье. */
  days: number[];
  enabled: boolean;
}

export interface ScheduleConfig {
  version: 1;
  schedules: Schedule[];
  /** Собственные сценарии (дополнительно к сценариям сервисов). */
  scenarios?: CustomScenario[];
}

export const EMPTY_SCHEDULES: ScheduleConfig = { version: 1, schedules: [] };

export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

/** Пропущенный запуск догоняем не дольше этого времени (например, после сна компьютера). */
const CATCH_UP_MS = 5 * 60_000;

const isoDay = (date: Date) => ((date.getDay() + 6) % 7) + 1;

export const isValidTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

/** Запуски, время которых наступило между прошлой проверкой и сейчас. */
export const dueSchedules = (config: ScheduleConfig, lastCheck: Date, now: Date): Schedule[] => {
  const from = Math.max(lastCheck.getTime(), now.getTime() - CATCH_UP_MS);
  return config.schedules.filter(schedule => {
    if (!schedule.enabled || !isValidTime(schedule.time)) return false;
    const [hours, minutes] = schedule.time.split(':').map(Number);
    // Проверяем сегодня и вчера: проверка могла перейти через полночь
    return [0, 1].some(daysBack => {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack, hours, minutes);
      return at.getTime() > from && at.getTime() <= now.getTime() && schedule.days.includes(isoDay(at));
    });
  });
};

/** Цель расписания: id устройства или собственного сценария. */
const targetOf = (schedule: Schedule) => schedule.deviceId ?? schedule.scenarioId;
const targetFields = (targetId: string) => (targetId.startsWith('cscen:') ? { scenarioId: targetId } : { deviceId: targetId });

export const schedulesFor = (config: ScheduleConfig, targetId: string) =>
  config.schedules.filter(s => targetOf(s) === targetId).sort((a, b) => a.time.localeCompare(b.time));

export const addSchedule = (config: ScheduleConfig, targetId: string, time: string, days: number[] = ALL_DAYS): ScheduleConfig => ({
  ...config,
  schedules: [...config.schedules, {
    id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...targetFields(targetId), time, days, enabled: true,
  }],
});

export const updateSchedule = (config: ScheduleConfig, id: string, changes: Partial<Omit<Schedule, 'id' | 'deviceId'>>): ScheduleConfig => ({
  ...config,
  schedules: config.schedules.map(s => (s.id === id ? { ...s, ...changes } : s)),
});

export const removeSchedule = (config: ScheduleConfig, id: string): ScheduleConfig => ({
  ...config,
  schedules: config.schedules.filter(s => s.id !== id),
});

/** Убирает все расписания устройства или сценария (например, после удаления). */
export const removeSchedulesFor = (config: ScheduleConfig, targetId: string): ScheduleConfig => ({
  ...config,
  schedules: config.schedules.filter(s => targetOf(s) !== targetId),
});
