import { describe, expect, it } from 'vitest';
import { EMPTY_SCHEDULES, addSchedule, dueSchedules, isValidTime, removeSchedule, schedulesFor, updateSchedule } from './schedules';

// 13.10.2026 ist ein Dienstag (ISO-Tag 2)
const at = (day: number, hours: number, minutes: number, seconds = 0) => new Date(2026, 9, day, hours, minutes, seconds);

describe('schedules', () => {
  const base = addSchedule(EMPTY_SCHEDULES, 'vac', '09:30', [2, 4]);
  const id = base.schedules[0].id;

  it('startet genau einmal, wenn die Uhrzeit erreicht ist', () => {
    expect(dueSchedules(base, at(13, 9, 29, 40), at(13, 9, 30, 10))).toHaveLength(1);
    expect(dueSchedules(base, at(13, 9, 30, 10), at(13, 9, 30, 40))).toHaveLength(0);
  });

  it('beachtet die Wochentage', () => {
    // Mittwoch ist nicht gewählt
    expect(dueSchedules(base, at(14, 9, 29), at(14, 9, 31))).toHaveLength(0);
  });

  it('holt nach dem Ruhezustand nur kurz Verpasstes nach', () => {
    expect(dueSchedules(base, at(13, 9, 0), at(13, 9, 33))).toHaveLength(1);
    expect(dueSchedules(base, at(13, 8, 0), at(13, 10, 0))).toHaveLength(0);
  });

  it('funktioniert über Mitternacht', () => {
    const night = addSchedule(EMPTY_SCHEDULES, 'vac', '00:00', [3]);
    expect(dueSchedules(night, at(13, 23, 59, 50), at(14, 0, 0, 20))).toHaveLength(1);
  });

  it('ignoriert ausgeschaltete Zeiten', () => {
    const off = updateSchedule(base, id, { enabled: false });
    expect(dueSchedules(off, at(13, 9, 29), at(13, 9, 31))).toHaveLength(0);
  });

  it('sortiert, ändert und löscht', () => {
    const two = addSchedule(base, 'vac', '07:15');
    expect(schedulesFor(two, 'vac').map(s => s.time)).toEqual(['07:15', '09:30']);
    expect(schedulesFor(removeSchedule(two, id), 'vac').map(s => s.time)).toEqual(['07:15']);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('07:05')).toBe(true);
  });
});
