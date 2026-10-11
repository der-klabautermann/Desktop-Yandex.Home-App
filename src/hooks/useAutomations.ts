import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_SCHEDULES, type ScheduleConfig } from '../../core/schedules';

export interface UseAutomationsReturn {
  /** null, пока не загружено или нет поддержки (старый главный процесс). */
  config: ScheduleConfig | null;
  /** Изменение строится на самой свежей конфигурации и сразу сохраняется. */
  update: (change: (current: ScheduleConfig) => ScheduleConfig) => void;
}

/** Расписания и собственные сценарии: один источник для всего интерфейса. */
export function useAutomations(): UseAutomationsReturn {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const latest = useRef<ScheduleConfig>(EMPTY_SCHEDULES);

  useEffect(() => {
    if (!window.api?.schedules) return;
    window.api.schedules.load()
      .then(saved => {
        const next = saved?.version === 1 ? saved : EMPTY_SCHEDULES;
        latest.current = next;
        setConfig(next);
      })
      .catch(() => setConfig(EMPTY_SCHEDULES));
  }, []);

  const update = useCallback((change: (current: ScheduleConfig) => ScheduleConfig) => {
    const next = change(latest.current);
    latest.current = next;
    setConfig(next);
    window.api?.schedules?.save(next).catch(err => console.error('Schedules save failed', err));
  }, []);

  return { config, update };
}
