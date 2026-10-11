import React from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import type { YandexDevice } from '../../types/index';
import { useI18n } from '../../i18n/I18nContext';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { ALL_DAYS, addSchedule, isValidTime, removeSchedule, schedulesFor, updateSchedule } from '../../../core/schedules';

/** Для каких устройств показываем расписание. */
export const hasSchedule = (device: YandexDevice) => device.type.startsWith('devices.types.vacuum_cleaner')
    && device.capabilities.some(c => c.type === 'devices.capabilities.on_off');

/** Короткие названия дней недели на языке интерфейса, начиная с понедельника. */
const dayNames = (lang: string) => ALL_DAYS.map(day => {
    // 12.10.2026 — понедельник
    const name = new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(2026, 9, 11 + day));
    return name.replace(/\.$/, '');
});

/** Список времён запуска с днями недели; цель: устройство или собственный сценарий. */
export const ScheduleList: React.FC<{ targetId: string; defaultTime?: string }> = ({ targetId, defaultTime = '09:00' }) => {
    const ctx = useDashboardContext();
    const { t, lang } = useI18n();
    const { config, update } = ctx.automations;
    if (!config) return null;
    const list = schedulesFor(config, targetId);
    const days = dayNames(lang);

    return (
        <>
            {list.map(schedule => (
                <div key={schedule.id} className={`dd-row ${schedule.enabled ? '' : 'is-paused'}`}>
                    <div className="dd-row-head">
                        <span className="dd-row-icon"><Clock className="w-4 h-4" /></span>
                        <input
                            type="time" className="dd-time" value={schedule.time} aria-label={t('schedule.time')}
                            onChange={e => { if (isValidTime(e.target.value)) update(c => updateSchedule(c, schedule.id, { time: e.target.value })); }}
                        />
                        <span className="dd-row-label" />
                        <button
                            role="switch" aria-checked={schedule.enabled} aria-label={t('schedule.active')} title={t('schedule.active')}
                            className={`dd-switch ${schedule.enabled ? 'is-on' : ''}`}
                            onClick={() => update(c => updateSchedule(c, schedule.id, { enabled: !schedule.enabled }))}
                        ><span /></button>
                        <button className="dd-icon-btn" title={t('schedule.remove')} aria-label={t('schedule.remove')}
                            onClick={() => update(c => removeSchedule(c, schedule.id))}>
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="dd-days">
                        {ALL_DAYS.map((day, index) => {
                            const on = schedule.days.includes(day);
                            return (
                                <button
                                    key={day} className={`dd-day ${on ? 'is-active' : ''}`} aria-pressed={on}
                                    // Хотя бы один день должен остаться
                                    disabled={on && schedule.days.length === 1}
                                    onClick={() => update(c => updateSchedule(c, schedule.id, {
                                        days: on ? schedule.days.filter(d => d !== day) : [...schedule.days, day].sort(),
                                    }))}
                                >{days[index]}</button>
                            );
                        })}
                    </div>
                </div>
            ))}
            <button className="dd-add" onClick={() => update(c => addSchedule(c, targetId, defaultTime))}>
                <Plus className="w-4 h-4" /> {t('schedule.add')}
            </button>
        </>
    );
};

/** Время уборки робота-пылесоса: Центр сам запускает его в выбранные дни. */
export const DeviceScheduleSection: React.FC<{ device: YandexDevice }> = ({ device }) => {
    const ctx = useDashboardContext();
    const { t } = useI18n();
    if (!ctx.automations.config) return null;
    return (
        <section className="dd-schedule">
            <h3 title={t('schedule.hint')}>{t('schedule.title')}</h3>
            <ScheduleList targetId={device.id} />
        </section>
    );
};
