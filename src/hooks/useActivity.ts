import { useCallback, useEffect, useRef, useState } from 'react';
import { detectEvents, type HomeEvent } from '../../core/events';
import type { YandexUserInfoResponse } from '../types/index';
import type { AccountSummary } from '../types/electron-api';
import type { Translate } from '../i18n/core';

const EVENTS_KEY = 'app_events';
const SEEN_KEY = 'app_events_seen';
const SETTINGS_KEY = 'app_notify_settings';
const MAX_EVENTS = 100;

/** off: только лента; alarms: системное уведомление при протечке, дыме, газе; all: ещё и при предупреждениях. */
export type SystemNotifyLevel = 'off' | 'alarms' | 'all';

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* не сохранится между запусками */ }
};

/** Текст события на выбранном языке. */
export const eventText = (event: HomeEvent, t: Translate): string => {
  const service = event.providerId ? t(`services.names.${event.providerId}`) : '';
  return t(`events.${event.kind}`, { device: event.deviceName ?? '', service, value: event.value ?? '' });
};

export interface UseActivityReturn {
  events: HomeEvent[];
  unread: number;
  markRead: () => void;
  clear: () => void;
  systemLevel: SystemNotifyLevel;
  setSystemLevel: (level: SystemNotifyLevel) => void;
}

/** Лента уведомлений: что сообщили устройства и сервисы между обновлениями. */
export function useActivity(
  userData: YandexUserInfoResponse | null,
  accounts: AccountSummary[],
  t: Translate,
): UseActivityReturn {
  const [events, setEvents] = useState<HomeEvent[]>(() => read(EVENTS_KEY, []));
  const [seenAt, setSeenAt] = useState<number>(() => read(SEEN_KEY, 0));
  const [systemLevel, setLevel] = useState<SystemNotifyLevel>(() => read<{ level?: SystemNotifyLevel }>(SETTINGS_KEY, {}).level ?? 'alarms');
  const previous = useRef<{ data: YandexUserInfoResponse | null; accounts: AccountSummary[] }>({ data: null, accounts: [] });

  useEffect(() => {
    if (!userData) return;
    const found = detectEvents(previous.current.data, userData, previous.current.accounts, accounts);
    previous.current = { data: userData, accounts };
    if (found.length === 0) return;

    setEvents(list => {
      const next = [...found.reverse(), ...list].slice(0, MAX_EVENTS);
      write(EVENTS_KEY, next);
      return next;
    });

    for (const event of found) {
      const wanted = systemLevel === 'all' ? event.severity !== 'info' : systemLevel === 'alarms' ? event.severity === 'alarm' : false;
      if (wanted) window.api?.showSystemNotification?.({ title: t('events.title'), body: eventText(event, t) });
    }
  }, [userData, accounts, systemLevel, t]);

  const markRead = useCallback(() => {
    const now = Date.now();
    setSeenAt(now);
    write(SEEN_KEY, now);
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    write(EVENTS_KEY, []);
  }, []);

  const setSystemLevel = useCallback((level: SystemNotifyLevel) => {
    setLevel(level);
    write(SETTINGS_KEY, { level });
  }, []);

  return { events, unread: events.filter(e => e.at > seenAt).length, markRead, clear, systemLevel, setSystemLevel };
}
