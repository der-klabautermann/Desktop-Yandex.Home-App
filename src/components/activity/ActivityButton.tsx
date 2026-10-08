import React, { useEffect, useRef, useState } from 'react';
import { Bell, DoorOpen, Droplet, Flame, BatteryLow, CloudOff, Cloud, Unplug, Wind } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { eventText } from '../../hooks/useActivity';
import type { EventKind, HomeEvent } from '../../../core/events';

const ICONS: Record<EventKind, React.ElementType> = {
  opened: DoorOpen,
  leak: Droplet,
  smoke: Flame,
  gas: Wind,
  batteryLow: BatteryLow,
  deviceOffline: CloudOff,
  deviceOnline: Cloud,
  serviceOffline: CloudOff,
  serviceOnline: Cloud,
  serviceRelogin: Unplug,
};

/** Колокольчик в шапке: число новых событий и лента последних уведомлений. */
export const ActivityButton: React.FC = () => {
  const { activity, onSelectRoom, data } = useDashboardContext();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) activity.markRead();
    setOpen(v => !v);
  };

  const time = (at: number) => {
    const date = new Date(at);
    const sameDay = date.toDateString() === new Date().toDateString();
    return sameDay
      ? date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleString(lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const openDevice = (event: HomeEvent) => {
    const room = data.devices.find(d => d.id === event.deviceId)?.room;
    if (room) onSelectRoom(room);
    setOpen(false);
  };

  return (
    <div className="theme-picker" ref={wrapperRef}>
      <button onClick={toggle} className={`header-btn ${open ? 'active' : ''}`} title={t('header.notifications')}>
        <Bell className="w-4 h-4" />
        {activity.unread > 0 && <span className="header-badge">{activity.unread > 9 ? '9+' : activity.unread}</span>}
      </button>
      {open && (
        <div className="activity-popover" role="dialog" aria-label={t('header.notifications')}>
          <div className="activity-head">
            <strong>{t('header.notifications')}</strong>
          </div>
          {activity.events.length === 0 ? (
            <p className="activity-empty">{t('events.empty')}</p>
          ) : (
            <ul className="activity-list">
              {activity.events.slice(0, 40).map(event => {
                const Icon = ICONS[event.kind];
                return (
                  <li key={event.id} className={`activity-item is-${event.severity}`} onClick={() => openDevice(event)}>
                    <span className="activity-icon"><Icon className="w-4 h-4" /></span>
                    <span className="activity-text">{eventText(event, t)}</span>
                    <time>{time(event.at)}</time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
