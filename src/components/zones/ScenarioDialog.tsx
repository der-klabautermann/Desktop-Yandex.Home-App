import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  addScenario, branchesOf, flowFromServiceSteps, newScenarioId, removeScenario, updateScenario, type ScenarioStep, type StepWait,
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
  /** Сценарий сервиса, который открыли для изменения: его шаги — начальная схема, своя версия заменит его в списке. */
  source?: { id: string; name: string; steps?: unknown };
  onClose: () => void;
}

/** Шаг в редакторе: uid нужен, чтобы выделять, перетаскивать и плавно двигать шаги. */
type EditorStep = ScenarioStep & { uid: string };

/** Что показано в панели настроек. link: стрелка перед шагом index (0 — стрелка от старта). */
type Panel =
  | { kind: 'trigger' }
  | { kind: 'triggerPick' }
  | { kind: 'steps' }
  | { kind: 'add'; branch: number; at?: number }
  | { kind: 'link'; branch: number; index: number };

/** Куда положить перетаскиваемые шаги. */
type DropTarget = { kind: 'at'; branch: number; at: number } | { kind: 'new' };

interface DragState { uids: string[]; x: number; y: number; target: DropTarget | null }

// Размеры схемы: по ним рисуются скруглённые стрелки от старта к цепочкам
const NODE_H = 82;
const NEW_H = 52;
const ROW_GAP = 18;
const ENTRY_W = 46;
const PLACEHOLDER = '__placeholder';

const makeUid = () => Math.random().toString(36).slice(2, 10);
const withUids = (branches: ScenarioStep[][]): EditorStep[][] => branches.map(b => b.map(step => ({ ...step, uid: makeUid() })));

const brightnessOf = (device?: YandexDevice) =>
  device?.capabilities.find(c => c.type === 'devices.capabilities.range' && (c.parameters as any)?.instance === 'brightness');

const levelOf = (step: ScenarioStep) => Number(step.actions?.find(a => a.instance === 'brightness')?.value ?? 100);

/** Пустые цепочки убираем, но одна (пустая) всегда остаётся местом для первого шага. */
const tidy = (list: EditorStep[][]) => {
  const kept = list.filter(b => b.length > 0);
  return kept.length ? kept : [[]];
};

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

/** Собственный сценарий как схема: старт слева, цепочки шагов вправо, параллельные цепочки друг под другом. */
export const ScenarioDialog: React.FC<ScenarioDialogProps> = ({ mode, scenarioId, source, onClose }) => {
  const ctx = useDashboardContext();
  const { t } = useI18n();
  const { config, update } = ctx.automations;
  const existing = scenarioId ? config?.scenarios?.find(s => s.id === scenarioId) : undefined;
  // У нового сценария id есть сразу, чтобы к нему можно было добавить время запуска
  const id = useRef(scenarioId ?? newScenarioId()).current;

  const [name, setName] = useState(existing?.name ?? source?.name ?? '');
  const [branches, setBranches] = useState<EditorStep[][]>(() => {
    const saved = existing ? branchesOf(existing) : source ? flowFromServiceSteps(source.steps) ?? [] : [];
    return saved.length ? withUids(saved) : [[]];
  });
  const [triggers, setTriggers] = useState<DeviceTrigger[]>(existing?.triggers ?? []);
  const [panel, setPanel] = useState<Panel>(() => (existing || source ? { kind: 'trigger' } : { kind: 'add', branch: 0 }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const [band, setBand] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
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
  const allSteps = branches.flat();
  const selectedSteps = allSteps.filter(step => selected.has(step.uid));

  // ---- Изменения схемы ----
  const patchSteps = (uids: Set<string>, patch: (step: EditorStep) => Partial<ScenarioStep>) =>
    setBranches(prev => prev.map(b => b.map(step => (uids.has(step.uid) ? { ...step, ...patch(step) } : step))));

  const selectOnly = (uid: string) => { setSelected(new Set([uid])); setPanel({ kind: 'steps' }); };

  const pickStepDevice = (deviceId: string) => {
    if (panel.kind === 'add') {
      const at = panel.at ?? branches[panel.branch]?.length ?? 0;
      const step: EditorStep = { deviceId, on: true, uid: makeUid() };
      setBranches(prev => prev.map((b, bi) => (bi === panel.branch ? [...b.slice(0, at), step, ...b.slice(at)] : b)));
      selectOnly(step.uid);
    } else if (panel.kind === 'steps') {
      // Другое устройство: прежние настройки к нему не подходят
      patchSteps(selected, () => ({ deviceId, actions: undefined }));
    }
    setQuery('');
  };

  const pickTriggerDevice = (deviceId: string) => {
    const device = devicesById.get(deviceId);
    const first = device ? triggerOptionsFor(device)[0] : undefined;
    if (!first) return;
    setTriggers(prev => [...prev, { id: newTriggerId(), deviceId, ...first }]);
    setPanel({ kind: 'trigger' });
    setQuery('');
  };

  const removeSelected = () => {
    if (selected.size === 0) return;
    setBranches(prev => tidy(prev.map(b => b.filter(step => !selected.has(step.uid)))));
    setSelected(new Set());
    setPanel({ kind: 'trigger' });
  };

  const addBranch = () => {
    setBranches(prev => [...prev, []]);
    setPanel({ kind: 'add', branch: branches.length });
  };

  /** Разорвать стрелку перед шагом index: хвост становится отдельной параллельной цепочкой. */
  const splitAt = (branch: number, index: number) => {
    setBranches(prev => tidy([...prev.slice(0, branch), prev[branch].slice(0, index), ...prev.slice(branch + 1), prev[branch].slice(index)]));
    setPanel({ kind: 'trigger' });
  };

  /** Соединить цепочку с концом цепочки над ней. */
  const joinUp = (branch: number) => {
    if (branch === 0) return;
    setBranches(prev => tidy(prev.map((b, bi) => (bi === branch - 1 ? [...b, ...prev[branch]] : bi === branch ? [] : b))));
    setPanel({ kind: 'trigger' });
  };

  // Клавиши: Delete удаляет выделенное, Esc снимает выделение, Cmd/Ctrl+A выделяет все шаги
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size > 0) { e.preventDefault(); removeSelected(); }
      if (e.key === 'Escape' && selected.size > 0) { e.stopPropagation(); setSelected(new Set()); setPanel({ kind: 'trigger' }); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && allSteps.length) {
        e.preventDefault();
        setSelected(new Set(allSteps.map(s => s.uid)));
        setPanel({ kind: 'steps' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- Перетаскивание: схема сразу раздвигается под место вставки ----
  const preview = useMemo<EditorStep[][]>(() => {
    if (!drag) return branches;
    const moving = new Set(drag.uids);
    const rest = branches.map(b => b.filter(step => !moving.has(step.uid)));
    if (!drag.target) return rest;
    const holder: EditorStep = { uid: PLACEHOLDER, deviceId: '', on: true };
    if (drag.target.kind === 'new') return [...rest, [holder]];
    const { branch, at } = drag.target;
    return rest.map((b, bi) => (bi === branch ? [...b.slice(0, at), holder, ...b.slice(at)] : b));
  }, [branches, drag]);

  const targetAt = (x: number, y: number, current: DropTarget | null): DropTarget | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]');
    if (!el) return current;
    const kind = el.dataset.drop;
    if (kind === 'placeholder') return current;
    if (kind === 'new') return { kind: 'new' };
    const branch = Number(el.dataset.branch);
    if (kind === 'node') {
      const box = el.getBoundingClientRect();
      const pos = Number(el.dataset.pos);
      return { kind: 'at', branch, at: x < box.left + box.width / 2 ? pos : pos + 1 };
    }
    return { kind: 'at', branch, at: Number(el.dataset.pos) };
  };

  const startDrag = (uid: string, down: React.PointerEvent) => {
    if (down.button !== 0 || down.shiftKey || down.metaKey || down.ctrlKey) return;
    down.stopPropagation();
    const startX = down.clientX;
    const startY = down.clientY;
    // Тащим всё выделенное, если шаг в выделении; иначе только его
    const uids = selected.has(uid) ? allSteps.filter(s => selected.has(s.uid)).map(s => s.uid) : [uid];
    let state: DragState | null = null;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (!state && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        state = { uids, x: e.clientX, y: e.clientY, target: targetAt(e.clientX, e.clientY, state?.target ?? null) };
        setDrag(state);
      });
    };
    const onUp = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (state) {
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 0);
        const { target } = state;
        if (target) {
          const moving = new Set(uids);
          const steps = allSteps.filter(s => moving.has(s.uid));
          setBranches(prev => {
            const rest = prev.map(b => b.filter(step => !moving.has(step.uid)));
            if (target.kind === 'new') return tidy([...rest, steps]);
            return tidy(rest.map((b, bi) => (bi === target.branch ? [...b.slice(0, target.at), ...steps, ...b.slice(target.at)] : b)));
          });
          setSelected(moving);
          setPanel({ kind: 'steps' });
        }
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ---- Рамка выделения по пустому месту схемы ----
  const nodeEls = useRef(new Map<string, HTMLElement>());
  const startBand = (down: React.PointerEvent) => {
    if (down.button !== 0 || (down.target as HTMLElement).closest('button, input, select, a')) return;
    const additive = down.shiftKey || down.metaKey || down.ctrlKey;
    const base = additive ? new Set(selected) : new Set<string>();
    const x0 = down.clientX;
    const y0 = down.clientY;
    let moved = false;
    const onMove = (e: PointerEvent) => {
      if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 4) return;
      moved = true;
      const rect = { left: Math.min(x0, e.clientX), right: Math.max(x0, e.clientX), top: Math.min(y0, e.clientY), bottom: Math.max(y0, e.clientY) };
      const next = new Set(base);
      nodeEls.current.forEach((el, uid) => {
        const box = el.getBoundingClientRect();
        if (box.right > rect.left && box.left < rect.right && box.bottom > rect.top && box.top < rect.bottom) next.add(uid);
      });
      setSelected(next);
      setBand({ x0, y0, x1: e.clientX, y1: e.clientY });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setBand(null);
      if (!moved && !additive) {
        // Щелчок по пустому месту снимает выделение
        setSelected(new Set());
        if (panel.kind === 'steps') setPanel({ kind: 'trigger' });
      } else if (moved) {
        setPanel({ kind: 'steps' });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const clickNode = (uid: string, e: React.MouseEvent) => {
    if (justDragged.current) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(uid)) next.delete(uid); else next.add(uid);
        return next;
      });
      setPanel({ kind: 'steps' });
      return;
    }
    selectOnly(uid);
  };

  // ---- Плавное движение шагов при любой перестановке (FLIP) ----
  const lastRects = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    nodeEls.current.forEach((el, uid) => {
      const box = el.getBoundingClientRect();
      next.set(uid, box);
      const before = lastRects.current.get(uid);
      if (!before) return;
      const dx = before.left - box.left;
      const dy = before.top - box.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    });
    lastRects.current = next;
  });

  // ---- Сохранение ----
  const save = () => {
    if (!canSave) return;
    // Яркость имеет смысл только при включении; uid убирает cleanBranches
    const clean = branches.map(branch => branch.map(step => (step.on ? step : { ...step, actions: undefined })));
    if (mode === 'create') {
      update(current => addScenario(current, { name, householdId: ctx.activeHouseholdId, branches: clean, triggers, replaces: source?.id }, id).config);
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
    return brightnessOf(device) && step.actions?.some(a => a.instance === 'brightness') ? `${t('scenarioEditor.on')}, ${levelOf(step)} %` : t('scenarioEditor.on');
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
    if (panel.kind === 'trigger') {
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
            <button className="dd-add" onClick={() => setPanel({ kind: 'triggerPick' })}>
              <Plus className="w-4 h-4" /> {t('flow.addTrigger')}
            </button>
            <span className="dd-add is-disabled" title={t('flow.voiceHint')}>
              <Mic className="w-4 h-4" /> {t('flow.voice')}
            </span>
          </div>
        </div>
      );
    }
    if (panel.kind === 'triggerPick') {
      return (
        <div className="flow-inspector">
          <h4>{t('flow.pickTriggerDevice')}</h4>
          {devicePicker(canTrigger, pickTriggerDevice)}
        </div>
      );
    }
    if (panel.kind === 'add') {
      return (
        <div className="flow-inspector">
          <h4>{t('flow.pickDevice')}</h4>
          {devicePicker(isGroupable, pickStepDevice)}
        </div>
      );
    }
    if (panel.kind === 'link') {
      const { branch, index } = panel;
      const inside = index > 0 && index < (branches[branch]?.length ?? 0);
      return (
        <div className="flow-inspector">
          <h4>{t('flow.connection')}</h4>
          <div className="flow-link-actions">
            <button className="dd-add" onClick={() => setPanel({ kind: 'add', branch, at: index })}>
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

    // Выделено несколько шагов: общие действия
    if (selectedSteps.length > 1) {
      const allOn = selectedSteps.every(s => s.on);
      const allOff = selectedSteps.every(s => !s.on);
      return (
        <div className="flow-inspector">
          <div className="flow-inspector-head">
            <h4>{t('flow.selectedCount', { n: selectedSteps.length })}</h4>
            <button className="zone-delete" onClick={removeSelected}><Trash2 className="w-3.5 h-3.5" /> {t('flow.removeSelected')}</button>
          </div>
          <div className="flow-fields">
            <div className="flow-field">
              <span>{t('flow.action')}</span>
              <Segmented<'on' | 'off' | 'mixed'>
                label={t('flow.action')}
                value={allOn ? 'on' : allOff ? 'off' : 'mixed'}
                options={[{ value: 'on', label: t('scenarioEditor.on') }, { value: 'off', label: t('scenarioEditor.off') }]}
                onChange={value => patchSteps(selected, () => (value === 'on' ? { on: true } : { on: false, actions: undefined }))}
              />
            </div>
          </div>
          <p className="flow-tip">{t('flow.multiTip')}</p>
        </div>
      );
    }

    const step = selectedSteps[0];
    if (!step) return null;
    const device = devicesById.get(step.deviceId);
    const brightness = brightnessOf(device);
    const level = levelOf(step);
    const waitKind: 'now' | 'delay' | 'at' = step.wait?.kind ?? 'now';
    const only = new Set([step.uid]);
    return (
      <div className="flow-inspector">
        <div className="flow-inspector-head">
          <h4>{device?.name ?? t('flow.missingDevice')}</h4>
          <button className="dd-icon-btn" title={t('flow.removeStep')} aria-label={t('flow.removeStep')} onClick={removeSelected}>
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
              onChange={on => patchSteps(only, () => (on ? { on } : { on, actions: undefined }))}
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
                  onChange={e => patchSteps(only, s => ({
                    actions: [
                      ...(s.actions ?? []).filter(a => a.instance !== 'brightness'),
                      { instance: 'brightness', value: Number(e.target.value), type: 'devices.capabilities.range' },
                    ],
                  }))}
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
                onChange={kind => patchSteps(only, s => ({
                  wait: kind === 'delay' ? { kind: 'delay', minutes: s.wait?.kind === 'delay' ? s.wait.minutes : 5 }
                    : kind === 'at' ? { kind: 'at', time: s.wait?.kind === 'at' ? s.wait.time : '22:00' }
                    : undefined,
                }))}
              />
              {step.wait?.kind === 'delay' && (
                <label className="flow-minutes">
                  <input
                    type="number" min={1} max={1440} value={step.wait.minutes} aria-label={t('flow.minutes')}
                    onChange={e => patchSteps(only, () => ({
                      wait: { kind: 'delay', minutes: Math.min(1440, Math.max(1, Number(e.target.value) || 1)) },
                    }))}
                  />
                  <span>{t('flow.minutes')}</span>
                </label>
              )}
              {step.wait?.kind === 'at' && (
                <input
                  type="time" className="dd-time" value={step.wait.time} aria-label={t('flow.clock')}
                  onChange={e => { if (e.target.value) patchSteps(only, () => ({ wait: { kind: 'at', time: e.target.value } })); }}
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
  const showNewRow = !drag && stepCount > 0 && branches.every(b => b.length > 0);
  const rowHeights = [...preview.map(() => NODE_H), ...(showNewRow || (drag && drag.target?.kind !== 'new') ? [NEW_H] : [])];
  const rowCenters = rowHeights.map((h, i) => rowHeights.slice(0, i).reduce((sum, x) => sum + x + ROW_GAP, 0) + h / 2);
  const railHeight = rowHeights.reduce((sum, h) => sum + h, 0) + ROW_GAP * (rowHeights.length - 1);
  const startY = NODE_H / 2;
  const entryPath = (y: number) => {
    if (Math.abs(y - startY) < 1) return `M0 ${startY} H${ENTRY_W - 2}`;
    const r = 12;
    return `M0 ${startY} H6 Q${6 + r} ${startY} ${6 + r} ${startY + r} V${y - r} Q${6 + r} ${y} ${6 + 2 * r} ${y} H${ENTRY_W - 2}`;
  };
  const dashedRow = rowHeights.length > preview.length ? rowHeights.length - 1 : -1;

  const linkClass = (branch: number, index: number) =>
    `flow-link ${panel.kind === 'link' && panel.branch === branch && panel.index === index ? 'is-selected' : ''}`;

  const draggedSteps = drag ? allSteps.filter(s => drag.uids.includes(s.uid)) : [];

  const renderNode = (step: EditorStep, bi: number, pos: number) => {
    if (step.uid === PLACEHOLDER) {
      return (
        <div key={PLACEHOLDER} className="flow-node flow-placeholder" data-drop="placeholder"
          ref={el => { if (el) nodeEls.current.set(PLACEHOLDER, el); else nodeEls.current.delete(PLACEHOLDER); }}>
          {drag && drag.uids.length > 1 ? t('flow.selectedCount', { n: drag.uids.length }) : null}
        </div>
      );
    }
    const device = devicesById.get(step.deviceId);
    return (
      <button
        key={step.uid}
        ref={el => { if (el) nodeEls.current.set(step.uid, el); else nodeEls.current.delete(step.uid); }}
        className={`flow-node ${selected.has(step.uid) ? 'is-selected' : ''} ${device ? '' : 'is-missing'}`}
        data-drop="node" data-branch={bi} data-pos={pos}
        onPointerDown={e => startDrag(step.uid, e)}
        onClick={e => clickNode(step.uid, e)}
      >
        <span className="flow-node-title">
          <span className="flow-node-icon">{device ? getIconForDevice(device.type) : null}</span>
          <span className="flow-node-name">{device?.name ?? t('flow.missingDevice')}</span>
        </span>
        <span className={`flow-node-action ${step.on ? 'is-on' : ''}`}>{actionLabel(step, device)}</span>
        <span className="flow-node-meta"><Clock className="w-3 h-3" /> {waitLabel(step.wait)}</span>
      </button>
    );
  };

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
        {source && <p className="flow-source" title={t('flow.copyHint')}>{t('flow.copyOf', { name: source.name })}</p>}

        <div className="flow-canvas" onPointerDown={startBand}>
          <div className="flow">
            <button className={`flow-node is-trigger ${panel.kind === 'trigger' || panel.kind === 'triggerPick' ? 'is-selected' : ''}`} onClick={() => setPanel({ kind: 'trigger' })}>
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
                    key={i} className="flow-rail-path" d={entryPath(y)} fill="none" stroke="currentColor" strokeWidth="2" markerEnd="url(#flow-arrow)"
                    strokeDasharray={i === dashedRow ? '5 4' : undefined}
                  />
                ))}
              </svg>

              {preview.map((branch, bi) => (
                <div key={bi} className="flow-branch" data-drop="row" data-branch={bi} data-pos={branch.filter(s => s.uid !== PLACEHOLDER).length}>
                  <button
                    className={`flow-entry ${linkClass(bi, 0)}`} data-drop="link" data-branch={bi} data-pos={0}
                    onClick={() => setPanel({ kind: 'link', branch: bi, index: 0 })} title={t('flow.connection')}
                  />
                  {(() => {
                    let pos = 0;
                    return branch.map((step, si) => {
                      const node = renderNode(step, bi, pos);
                      const linkPos = pos;
                      if (step.uid !== PLACEHOLDER) pos += 1;
                      return (
                        <React.Fragment key={step.uid}>
                          {si > 0 && (
                            <button
                              className={linkClass(bi, linkPos)} data-drop="link" data-branch={bi} data-pos={linkPos}
                              onClick={() => setPanel({ kind: 'link', branch: bi, index: linkPos })} title={t('flow.connection')}
                            ><span className="flow-link-dot"><Plus className="w-3 h-3" /></span></button>
                          )}
                          {node}
                        </React.Fragment>
                      );
                    });
                  })()}
                  {branch.length > 0 && <span className="flow-link is-tail" aria-hidden />}
                  <button
                    ref={el => { const key = `add-${bi}`; if (el) nodeEls.current.set(key, el); else nodeEls.current.delete(key); }}
                    className={`flow-add ${panel.kind === 'add' && panel.branch === bi && panel.at === undefined ? 'is-selected' : ''}`}
                    data-drop="link" data-branch={bi} data-pos={branch.filter(s => s.uid !== PLACEHOLDER).length}
                    onClick={() => setPanel({ kind: 'add', branch: bi })}
                    title={t('flow.addStep')} aria-label={t('flow.addStep')}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {(showNewRow || (drag && drag.target?.kind !== 'new')) && (
                <div className="flow-branch is-new">
                  <span className="flow-entry-space" aria-hidden />
                  <button className="flow-ghost" data-drop="new" onClick={addBranch} title={t('flow.addBranchHint')}>
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

      {drag && draggedSteps.length > 0 && (
        <div className="flow-drag-stack" style={{ left: drag.x, top: drag.y }}>
          {draggedSteps.slice(0, 3).map((step, i) => {
            const device = devicesById.get(step.deviceId);
            return (
              <div key={step.uid} className="flow-node flow-drag-ghost" style={{ ['--i' as any]: i }}>
                <span className="flow-node-title">
                  <span className="flow-node-icon">{device ? getIconForDevice(device.type) : null}</span>
                  <span className="flow-node-name">{device?.name ?? t('flow.missingDevice')}</span>
                </span>
                <span className="flow-node-meta"><Clock className="w-3 h-3" /> {waitLabel(step.wait)}</span>
              </div>
            );
          })}
          {draggedSteps.length > 1 && <span className="flow-drag-count">{draggedSteps.length}</span>}
        </div>
      )}
      {band && (
        <div className="flow-band" style={{
          left: Math.min(band.x0, band.x1), top: Math.min(band.y0, band.y1),
          width: Math.abs(band.x1 - band.x0), height: Math.abs(band.y1 - band.y0),
        }} />
      )}
    </div>,
    document.body,
  );
};
