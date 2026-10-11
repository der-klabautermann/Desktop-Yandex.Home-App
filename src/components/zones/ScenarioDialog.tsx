import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Hand, Link2, Mic, Plus, Radio, Scissors, Search, Trash2, X, Zap } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { getIconForDevice } from '../../constants/icons';
import { localizeEvent } from '../../constants';
import { propertyLabel } from '../../utils/deviceInfo';
import { flattenTree } from '../../../core/zones';
import { isGroupable } from '../../../core/groups';
import {
  addScenario, branchesOf, newScenarioId, removeScenario, updateScenario, type ScenarioStep, type StepWait,
} from '../../../core/scenarios';
import { canTrigger, newTriggerId, triggerOptionsFor, type DeviceTrigger } from '../../../core/triggers';
import { removeSchedulesFor, schedulesFor } from '../../../core/schedules';
import { ProviderBadge } from '../services/ProviderBadge';
import { ScheduleList } from '../device/DeviceScheduleSection';
import { Segmented } from '../settings/Segmented';
import type { YandexDevice } from '../../types/index';

interface ScenarioDialogProps {
  mode: 'create' | 'edit';
  scenarioId?: string;
  onClose: () => void;
}

/** Что выбрано в схеме. link: стрелка перед шагом index (0 — стрелка от старта). */
type Selection =
  | { kind: 'trigger' }
  | { kind: 'triggerPick' }
  | { kind: 'step'; branch: number; index: number }
  | { kind: 'add'; branch: number; at?: number }
  | { kind: 'link'; branch: number; index: number };

/** Куда положить перетаскиваемый шаг. */
type DropTarget = { kind: 'at'; branch: number; at: number } | { kind: 'new' };

// Размеры схемы: по ним рисуются скруглённые стрелки от старта к цепочкам
const NODE_H = 82;
const NEW_H = 52;
const ROW_GAP = 18;
const ENTRY_W = 46;

const brightnessOf = (device?: YandexDevice) =>
  device?.capabilities.find(c => c.type === 'devices.capabilities.range' && (c.parameters as any)?.instance === 'brightness');

const levelOf = (step: ScenarioStep) => Number(step.actions?.find(a => a.instance === 'brightness')?.value ?? 100);

/** Собственный сценарий как схема: старт слева, цепочки шагов вправо, параллельные цепочки друг под другом. */
export const ScenarioDialog: React.FC<ScenarioDialogProps> = ({ mode, scenarioId, onClose }) => {
  const ctx = useDashboardContext();
  const { t } = useI18n();
  const { config, update } = ctx.automations;
  const existing = scenarioId ? config?.scenarios?.find(s => s.id === scenarioId) : undefined;
  // У нового сценария id есть сразу, чтобы к нему можно было добавить время запуска
  const id = useRef(scenarioId ?? newScenarioId()).current;

  const [name, setName] = useState(existing?.name ?? '');
  const [branches, setBranches] = useState<ScenarioStep[][]>(() => {
    const saved = existing ? branchesOf(existing) : [];
    return saved.length ? saved : [[]];
  });
  const [triggers, setTriggers] = useState<DeviceTrigger[]>(existing?.triggers ?? []);
  const [selection, setSelection] = useState<Selection>(() => (existing ? { kind: 'trigger' } : { kind: 'add', branch: 0 }));
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<{ from: { branch: number; index: number }; x: number; y: number; target: DropTarget | null } | null>(null);
  const justDragged = useRef(false);

  const devicesById = useMemo(() => new Map(ctx.data.devices.map(d => [d.id, d])), [ctx.data.devices]);

  // Комнаты в порядке дерева зон
  const sections = useMemo(() => {
    const placed = new Set<string>();
    const result: Array<{ id: string; name: string; devices: YandexDevice[] }> = [];
    for (const node of flattenTree(ctx.zones.tree)) {
      const devices = node.deviceIds.map(deviceId => devicesById.get(deviceId)).filter((d): d is YandexDevice => !!d);
      devices.forEach(d => placed.add(d.id));
      if (devices.length) result.push({ id: node.id, name: node.name, devices });
    }
    const rest = ctx.data.devices.filter(d => !placed.has(d.id)
      && (!ctx.activeHouseholdId || (d as any).household_id === ctx.activeHouseholdId));
    if (rest.length) result.push({ id: '', name: t('zones.noRoom'), devices: rest });
    return result;
  }, [ctx.data.devices, ctx.zones.tree, ctx.activeHouseholdId, devicesById, t]);

  const stepCount = branches.reduce((sum, branch) => sum + branch.length, 0);
  const canSave = name.trim().length > 0 && stepCount > 0 && Boolean(config);

  // ---- Изменения схемы ----
  const changeStep = (branch: number, index: number, patch: Partial<ScenarioStep>) =>
    setBranches(prev => prev.map((b, bi) => bi !== branch ? b : b.map((step, si) => (si === index ? { ...step, ...patch } : step))));

  /** Пустые цепочки убираем, но одна (пустая) всегда остаётся местом для первого шага. */
  const tidy = (list: ScenarioStep[][]) => {
    const kept = list.filter(b => b.length > 0);
    return kept.length ? kept : [[]];
  };

  const pickStepDevice = (deviceId: string) => {
    if (selection.kind === 'add') {
      const at = selection.at ?? branches[selection.branch]?.length ?? 0;
      setBranches(prev => prev.map((b, bi) => (bi === selection.branch ? [...b.slice(0, at), { deviceId, on: true }, ...b.slice(at)] : b)));
      setSelection({ kind: 'step', branch: selection.branch, index: at });
    } else if (selection.kind === 'step') {
      // Другое устройство: прежние настройки к нему не подходят
      changeStep(selection.branch, selection.index, { deviceId, actions: undefined });
    }
    setQuery('');
  };

  const pickTriggerDevice = (deviceId: string) => {
    const device = devicesById.get(deviceId);
    const first = device ? triggerOptionsFor(device)[0] : undefined;
    if (!first) return;
    setTriggers(prev => [...prev, { id: newTriggerId(), deviceId, ...first }]);
    setSelection({ kind: 'trigger' });
    setQuery('');
  };

  const removeStep = (branch: number, index: number) => {
    setBranches(prev => tidy(prev.map((b, bi) => (bi === branch ? b.filter((_, si) => si !== index) : b))));
    setSelection({ kind: 'trigger' });
  };

  const addBranch = () => {
    setBranches(prev => [...prev, []]);
    setSelection({ kind: 'add', branch: branches.length });
  };

  /** Разорвать стрелку перед шагом index: хвост становится отдельной параллельной цепочкой. */
  const splitAt = (branch: number, index: number) => {
    setBranches(prev => {
      const head = prev[branch].slice(0, index);
      const tail = prev[branch].slice(index);
      return tidy([...prev.slice(0, branch), head, ...prev.slice(branch + 1), tail]);
    });
    setSelection({ kind: 'trigger' });
  };

  /** Соединить цепочку с концом цепочки над ней. */
  const joinUp = (branch: number) => {
    if (branch === 0) return;
    setBranches(prev => tidy(prev.map((b, bi) => (bi === branch - 1 ? [...b, ...prev[branch]] : bi === branch ? [] : b))));
    setSelection({ kind: 'trigger' });
  };

  const moveStep = (from: { branch: number; index: number }, target: DropTarget) => {
    setBranches(prev => {
      const copy = prev.map(b => [...b]);
      const [step] = copy[from.branch].splice(from.index, 1);
      if (!step) return prev;
      if (target.kind === 'new') {
        copy.push([step]);
      } else {
        const at = target.branch === from.branch && target.at > from.index ? target.at - 1 : target.at;
        copy[target.branch].splice(at, 0, step);
      }
      return tidy(copy);
    });
    setSelection({ kind: 'trigger' });
  };

  // ---- Перетаскивание шагов мышью ----
  const targetAt = (x: number, y: number): DropTarget | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]');
    if (!el) return null;
    const branch = Number(el.dataset.branch);
    if (el.dataset.drop === 'new') return { kind: 'new' };
    if (el.dataset.drop === 'node') {
      const box = el.getBoundingClientRect();
      const index = Number(el.dataset.index);
      return { kind: 'at', branch, at: x < box.left + box.width / 2 ? index : index + 1 };
    }
    return { kind: 'at', branch, at: Number(el.dataset.index) };
  };

  const startDrag = (branch: number, index: number, down: React.PointerEvent) => {
    if (down.button !== 0) return;
    const startX = down.clientX;
    const startY = down.clientY;
    let active = false;
    let target: DropTarget | null = null;
    const onMove = (e: PointerEvent) => {
      if (!active && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
      active = true;
      target = targetAt(e.clientX, e.clientY);
      setDrag({ from: { branch, index }, x: e.clientX, y: e.clientY, target });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (active) {
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 0);
        if (target) moveStep({ branch, index }, target);
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dropsBefore = (branch: number, index: number) =>
    drag?.target?.kind === 'at' && drag.target.branch === branch && drag.target.at === index;

  // ---- Сохранение ----
  const save = () => {
    if (!canSave) return;
    // Яркость имеет смысл только при включении
    const clean = branches.map(branch => branch.map(step => (step.on ? step : { ...step, actions: undefined })));
    if (mode === 'create') {
      update(current => addScenario(current, { name, householdId: ctx.activeHouseholdId, branches: clean, triggers }, id).config);
    } else {
      update(current => updateScenario(current, id, { name, branches: clean, triggers }));
    }
    onClose();
  };

  const cancel = () => {
    // Время запуска, добавленное к так и не сохранённому сценарию, не оставляем
    if (mode === 'create') update(current => removeSchedulesFor(current, id));
    onClose();
  };

  const remove = () => {
    if (!window.confirm(t('scenarioEditor.deleteConfirm', { name: existing?.name ?? '' }))) return;
    update(current => removeSchedulesFor(removeScenario(current, id), id));
    onClose();
  };

  // ---- Подписи ----
  const times = config ? schedulesFor(config, id).filter(s => s.enabled) : [];
  const triggerSummary = times.length === 0 ? null
    : times.length <= 2 ? times.map(s => s.time).join(', ')
    : `${times.slice(0, 2).map(s => s.time).join(', ')} +${times.length - 2}`;

  const waitLabel = (wait?: StepWait) => {
    if (!wait) return t('flow.now');
    return wait.kind === 'delay' ? t('flow.after', { n: wait.minutes }) : t('flow.at', { time: wait.time });
  };
  const actionLabel = (step: ScenarioStep, device?: YandexDevice) => {
    if (!step.on) return t('scenarioEditor.off');
    return brightnessOf(device) && step.actions?.length ? `${t('scenarioEditor.on')}, ${levelOf(step)} %` : t('scenarioEditor.on');
  };
  const eventLabel = (device: YandexDevice | undefined, instance: string, value: string) => {
    if (instance === 'on') return value === 'true' ? t('flow.turnedOn') : t('flow.turnedOff');
    const property = (device?.properties ?? []).find((p: any) => (p.parameters?.instance ?? p.state?.instance) === instance) as any;
    return `${propertyLabel(instance, t)}: ${localizeEvent(value, property?.parameters?.events, t)}`;
  };

  // ---- Выбор устройства ----
  const devicePicker = (filter: (d: YandexDevice) => boolean, onPick: (deviceId: string) => void) => {
    const needle = query.trim().toLocaleLowerCase();
    const list = sections
      .map(section => ({ ...section, devices: section.devices.filter(d => filter(d) && (!needle || `${d.name} ${section.name}`.toLocaleLowerCase().includes(needle))) }))
      .filter(section => section.devices.length > 0);
    return (
      <div className="flow-picker">
        <label className="flow-search">
          <Search className="w-4 h-4" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('flow.search')} aria-label={t('flow.search')} />
        </label>
        <div className="group-pick-list flow-pick-list">
          {list.map(section => (
            <div key={section.id || 'rest'} className="group-pick-section">
              <div className="group-pick-room">{section.name}</div>
              {section.devices.map(device => (
                <button key={device.id} className="group-pick-item" onClick={() => onPick(device.id)}>
                  <span className="group-pick-icon">{getIconForDevice(device.type)}</span>
                  <span className="group-pick-name">{device.name}</span>
                  <ProviderBadge providerId={device.provider_id} unreachable={device.unreachable} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---- Панель настроек под схемой ----
  const inspector = (() => {
    if (selection.kind === 'trigger') {
      return (
        <div className="flow-inspector">
          <h4 title={t('flow.triggerHint')}>{t('flow.start')}</h4>
          <div className="flow-trigger-row is-static"><Hand className="w-4 h-4" /> {t('flow.byClick')}</div>

          <div className="flow-sub">{t('flow.clock')}</div>
          <div className="scenario-times"><ScheduleList targetId={id} defaultTime="19:00" /></div>

          <div className="flow-sub">{t('flow.deviceEvent')}</div>
          {triggers.map(trigger => {
            const device = devicesById.get(trigger.deviceId);
            const options = device ? triggerOptionsFor(device) : [];
            return (
              <div key={trigger.id} className="flow-trigger-row">
                <span className="flow-node-icon">{device ? getIconForDevice(device.type) : <Radio className="w-4 h-4" />}</span>
                <span className="flow-trigger-name">{device?.name ?? t('flow.missingDevice')}</span>
                <select
                  className="flow-select"
                  value={`${trigger.instance}|${trigger.value}`}
                  aria-label={t('flow.deviceEvent')}
                  onChange={e => {
                    const [instance, value] = e.target.value.split('|');
                    setTriggers(prev => prev.map(tr => (tr.id === trigger.id ? { ...tr, instance, value } : tr)));
                  }}
                >
                  {options.map(o => (
                    <option key={`${o.instance}|${o.value}`} value={`${o.instance}|${o.value}`}>{eventLabel(device, o.instance, o.value)}</option>
                  ))}
                </select>
                <button className="dd-icon-btn" title={t('flow.removeTrigger')} aria-label={t('flow.removeTrigger')}
                  onClick={() => setTriggers(prev => prev.filter(tr => tr.id !== trigger.id))}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <div className="flow-trigger-actions">
            <button className="dd-add" onClick={() => setSelection({ kind: 'triggerPick' })}>
              <Plus className="w-4 h-4" /> {t('flow.addTrigger')}
            </button>
            <span className="dd-add is-disabled" title={t('flow.voiceHint')}>
              <Mic className="w-4 h-4" /> {t('flow.voice')}
            </span>
          </div>
        </div>
      );
    }
    if (selection.kind === 'triggerPick') {
      return (
        <div className="flow-inspector">
          <h4>{t('flow.pickTriggerDevice')}</h4>
          {devicePicker(canTrigger, pickTriggerDevice)}
        </div>
      );
    }
    if (selection.kind === 'add') {
      return (
        <div className="flow-inspector">
          <h4>{t('flow.pickDevice')}</h4>
          {devicePicker(isGroupable, pickStepDevice)}
        </div>
      );
    }
    if (selection.kind === 'link') {
      const { branch, index } = selection;
      const inside = index > 0 && index < branches[branch].length;
      return (
        <div className="flow-inspector">
          <h4>{t('flow.connection')}</h4>
          <div className="flow-link-actions">
            <button className="dd-add" onClick={() => setSelection({ kind: 'add', branch, at: index })}>
              <Plus className="w-4 h-4" /> {t('flow.insertHere')}
            </button>
            {inside && (
              <button className="dd-add" onClick={() => splitAt(branch, index)} title={t('flow.splitHint')}>
                <Scissors className="w-4 h-4" /> {t('flow.split')}
              </button>
            )}
            {index === 0 && branch > 0 && (
              <button className="dd-add" onClick={() => joinUp(branch)} title={t('flow.joinHint')}>
                <Link2 className="w-4 h-4" /> {t('flow.join')}
              </button>
            )}
          </div>
        </div>
      );
    }
    const step = branches[selection.branch]?.[selection.index];
    if (!step) return null;
    const device = devicesById.get(step.deviceId);
    const brightness = brightnessOf(device);
    const level = levelOf(step);
    const waitKind: 'now' | 'delay' | 'at' = step.wait?.kind ?? 'now';
    return (
      <div className="flow-inspector">
        <div className="flow-inspector-head">
          <h4>{device?.name ?? t('flow.missingDevice')}</h4>
          <button className="dd-icon-btn" title={t('flow.removeStep')} aria-label={t('flow.removeStep')}
            onClick={() => removeStep(selection.branch, selection.index)}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flow-fields">
          <div className="flow-field">
            <span>{t('flow.action')}</span>
            <Segmented
              label={t('flow.action')}
              value={step.on}
              options={[{ value: true, label: t('scenarioEditor.on') }, { value: false, label: t('scenarioEditor.off') }]}
              onChange={on => changeStep(selection.branch, selection.index, on ? { on } : { on, actions: undefined })}
            />
          </div>
          {step.on && brightness && (
            <div className="flow-field">
              <span>{t('scenarioEditor.brightness')}</span>
              <label className="scenario-level">
                <input
                  type="range" className="dd-slider" min={1} max={100} value={level}
                  style={{ ['--fill' as any]: `${level}%` }}
                  aria-label={t('scenarioEditor.brightness')}
                  onChange={e => changeStep(selection.branch, selection.index, {
                    actions: [{ instance: 'brightness', value: Number(e.target.value), type: 'devices.capabilities.range' }],
                  })}
                />
                <span>{level} %</span>
              </label>
            </div>
          )}
          <div className="flow-field">
            <span title={t('flow.whenHint')}>{t('flow.when')}</span>
            <div className="flow-when">
              <Segmented<'now' | 'delay' | 'at'>
                label={t('flow.when')}
                value={waitKind}
                options={[
                  { value: 'now', label: t('flow.immediately') },
                  { value: 'delay', label: t('flow.delay') },
                  { value: 'at', label: t('flow.clock') },
                ]}
                onChange={kind => changeStep(selection.branch, selection.index, {
                  wait: kind === 'delay' ? { kind: 'delay', minutes: step.wait?.kind === 'delay' ? step.wait.minutes : 5 }
                    : kind === 'at' ? { kind: 'at', time: step.wait?.kind === 'at' ? step.wait.time : '22:00' }
                    : undefined,
                })}
              />
              {step.wait?.kind === 'delay' && (
                <label className="flow-minutes">
                  <input
                    type="number" min={1} max={1440} value={step.wait.minutes} aria-label={t('flow.minutes')}
                    onChange={e => changeStep(selection.branch, selection.index, {
                      wait: { kind: 'delay', minutes: Math.min(1440, Math.max(1, Number(e.target.value) || 1)) },
                    })}
                  />
                  <span>{t('flow.minutes')}</span>
                </label>
              )}
              {step.wait?.kind === 'at' && (
                <input
                  type="time" className="dd-time" value={step.wait.time} aria-label={t('flow.clock')}
                  onChange={e => { if (e.target.value) changeStep(selection.branch, selection.index, { wait: { kind: 'at', time: e.target.value } }); }}
                />
              )}
            </div>
          </div>
          <details className="flow-change-device">
            <summary>{t('flow.changeDevice')}</summary>
            {devicePicker(isGroupable, pickStepDevice)}
          </details>
        </div>
      </div>
    );
  })();

  // ---- Скруглённые стрелки от старта к каждой цепочке ----
  const showNewRow = stepCount > 0 && branches.every(b => b.length > 0);
  const rowHeights = [...branches.map(() => NODE_H), ...(showNewRow ? [NEW_H] : [])];
  const rowCenters = rowHeights.map((h, i) => rowHeights.slice(0, i).reduce((sum, x) => sum + x + ROW_GAP, 0) + h / 2);
  const railHeight = rowHeights.reduce((sum, h) => sum + h, 0) + ROW_GAP * (rowHeights.length - 1);
  const startY = NODE_H / 2;
  const entryPath = (y: number) => {
    if (Math.abs(y - startY) < 1) return `M0 ${startY} H${ENTRY_W - 2}`;
    const r = 12;
    return `M0 ${startY} H6 Q${6 + r} ${startY} ${6 + r} ${startY + r} V${y - r} Q${6 + r} ${y} ${6 + 2 * r} ${y} H${ENTRY_W - 2}`;
  };

  const linkClass = (branch: number, index: number) =>
    `flow-link ${selection.kind === 'link' && selection.branch === branch && selection.index === index ? 'is-selected' : ''} ${dropsBefore(branch, index) ? 'is-drop' : ''}`;

  const dragged = drag ? branches[drag.from.branch]?.[drag.from.index] : undefined;
  const draggedDevice = dragged ? devicesById.get(dragged.deviceId) : undefined;

  return createPortal(
    <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) cancel(); }}>
      <div className={`zone-dialog flow-dialog ${drag ? 'is-dragging' : ''}`} role="dialog" aria-label={mode === 'create' ? t('scenarioEditor.add') : existing?.name}>
        <header>
          <input
            className="flow-name"
            value={name}
            placeholder={t('scenarioEditor.namePlaceholder')}
            aria-label={t('zones.name')}
            onChange={e => setName(e.target.value)}
          />
          <button className="header-btn" onClick={cancel} title={t('common.close')}><X className="w-4 h-4" /></button>
        </header>

        <div className="flow-canvas">
          <div className="flow">
            <button className={`flow-node is-trigger ${selection.kind === 'trigger' || selection.kind === 'triggerPick' ? 'is-selected' : ''}`} onClick={() => setSelection({ kind: 'trigger' })}>
              <span className="flow-kicker">{t('flow.start')}</span>
              <span className="flow-trigger-line"><Hand className="w-3.5 h-3.5" /> {t('flow.byClick')}</span>
              {triggerSummary && <span className="flow-trigger-line"><Clock className="w-3.5 h-3.5" /> {triggerSummary}</span>}
              {triggers.map(trigger => {
                const device = devicesById.get(trigger.deviceId);
                return (
                  <span key={trigger.id} className="flow-trigger-line" title={eventLabel(device, trigger.instance, trigger.value)}>
                    <Zap className="w-3.5 h-3.5" /> {device?.name ?? t('flow.missingDevice')}
                  </span>
                );
              })}
            </button>

            <div className="flow-branches">
              <svg className="flow-rail" width={ENTRY_W} height={railHeight} aria-hidden>
                <defs>
                  <marker id="flow-arrow" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
                  </marker>
                </defs>
                {rowCenters.map((y, i) => (
                  <path
                    key={i} d={entryPath(y)} fill="none" stroke="currentColor" strokeWidth="2" markerEnd="url(#flow-arrow)"
                    strokeDasharray={showNewRow && i === rowCenters.length - 1 ? '5 4' : undefined}
                  />
                ))}
              </svg>

              {branches.map((branch, bi) => (
                <div key={bi} className="flow-branch">
                  <button
                    className={`flow-entry ${linkClass(bi, 0)}`} data-drop="link" data-branch={bi} data-index={0}
                    onClick={() => setSelection({ kind: 'link', branch: bi, index: 0 })} title={t('flow.connection')}
                  />
                  {branch.map((step, si) => {
                    const device = devicesById.get(step.deviceId);
                    const beingDragged = drag?.from.branch === bi && drag.from.index === si;
                    return (
                      <React.Fragment key={`${step.deviceId}-${si}`}>
                        {si > 0 && (
                          <button
                            className={linkClass(bi, si)} data-drop="link" data-branch={bi} data-index={si}
                            onClick={() => setSelection({ kind: 'link', branch: bi, index: si })} title={t('flow.connection')}
                          ><span className="flow-link-dot"><Plus className="w-3 h-3" /></span></button>
                        )}
                        <button
                          className={`flow-node ${isSelectedStep(selection, bi, si) ? 'is-selected' : ''} ${device ? '' : 'is-missing'} ${beingDragged ? 'is-dragged' : ''}`}
                          data-drop="node" data-branch={bi} data-index={si}
                          onPointerDown={e => startDrag(bi, si, e)}
                          onClick={() => { if (!justDragged.current) setSelection({ kind: 'step', branch: bi, index: si }); }}
                        >
                          <span className="flow-node-title">
                            <span className="flow-node-icon">{device ? getIconForDevice(device.type) : null}</span>
                            <span className="flow-node-name">{device?.name ?? t('flow.missingDevice')}</span>
                          </span>
                          <span className={`flow-node-action ${step.on ? 'is-on' : ''}`}>{actionLabel(step, device)}</span>
                          <span className="flow-node-meta"><Clock className="w-3 h-3" /> {waitLabel(step.wait)}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                  {branch.length > 0 && (
                    <span className={`flow-link is-tail ${dropsBefore(bi, branch.length) ? 'is-drop' : ''}`} data-drop="link" data-branch={bi} data-index={branch.length} aria-hidden />
                  )}
                  <button
                    className={`flow-add ${selection.kind === 'add' && selection.branch === bi && selection.at === undefined ? 'is-selected' : ''} ${dropsBefore(bi, branch.length) ? 'is-drop' : ''}`}
                    data-drop="link" data-branch={bi} data-index={branch.length}
                    onClick={() => setSelection({ kind: 'add', branch: bi })}
                    title={t('flow.addStep')} aria-label={t('flow.addStep')}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {showNewRow && (
                <div className="flow-branch is-new">
                  <span className="flow-entry-space" aria-hidden />
                  <button className={`flow-ghost ${drag?.target?.kind === 'new' ? 'is-drop' : ''}`} data-drop="new" onClick={addBranch} title={t('flow.addBranchHint')}>
                    <Plus className="w-4 h-4" /> {t('flow.addBranch')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {inspector}

        <footer>
          {mode === 'edit' && (
            <button className="zone-delete" onClick={remove}><Trash2 className="w-3.5 h-3.5" /> {t('scenarioEditor.delete')}</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="service-action" onClick={cancel}>{t('common.cancel')}</button>
          <button className="connect-primary zone-save" disabled={!canSave} onClick={save} title={canSave ? undefined : t('flow.saveHint')}>
            {t('common.save')}
          </button>
        </footer>
      </div>

      {drag && dragged && (
        <div className="flow-node flow-drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <span className="flow-node-title">
            <span className="flow-node-icon">{draggedDevice ? getIconForDevice(draggedDevice.type) : null}</span>
            <span className="flow-node-name">{draggedDevice?.name ?? t('flow.missingDevice')}</span>
          </span>
          <span className="flow-node-meta"><Clock className="w-3 h-3" /> {waitLabel(dragged.wait)}</span>
        </div>
      )}
    </div>,
    document.body,
  );
};

const isSelectedStep = (selection: Selection, branch: number, index: number) =>
  selection.kind === 'step' && selection.branch === branch && selection.index === index;
