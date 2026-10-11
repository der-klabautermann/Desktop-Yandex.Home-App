import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Hand, Plus, Search, Trash2, X } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { getIconForDevice } from '../../constants/icons';
import { flattenTree } from '../../../core/zones';
import { isGroupable } from '../../../core/groups';
import {
  addScenario, branchesOf, newScenarioId, removeScenario, updateScenario, type ScenarioStep, type StepWait,
} from '../../../core/scenarios';
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

/** Что выбрано в схеме: старт, шаг или место для нового шага. */
type Selection =
  | { kind: 'trigger' }
  | { kind: 'step'; branch: number; index: number }
  | { kind: 'add'; branch: number };

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
  const [selection, setSelection] = useState<Selection>(() => (existing ? { kind: 'trigger' } : { kind: 'add', branch: 0 }));
  const [query, setQuery] = useState('');

  const devicesById = useMemo(() => new Map(ctx.data.devices.map(d => [d.id, d])), [ctx.data.devices]);

  // Комнаты в порядке дерева зон, внутри только то, что умеет включаться
  const sections = useMemo(() => {
    const placed = new Set<string>();
    const result: Array<{ id: string; name: string; devices: YandexDevice[] }> = [];
    for (const node of flattenTree(ctx.zones.tree)) {
      const devices = node.deviceIds.map(deviceId => devicesById.get(deviceId)).filter((d): d is YandexDevice => !!d && isGroupable(d));
      devices.forEach(d => placed.add(d.id));
      if (devices.length) result.push({ id: node.id, name: node.name, devices });
    }
    const rest = ctx.data.devices.filter(d => !placed.has(d.id) && isGroupable(d)
      && (!ctx.activeHouseholdId || (d as any).household_id === ctx.activeHouseholdId));
    if (rest.length) result.push({ id: '', name: t('zones.noRoom'), devices: rest });
    return result;
  }, [ctx.data.devices, ctx.zones.tree, ctx.activeHouseholdId, devicesById, t]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return sections;
    return sections
      .map(section => ({ ...section, devices: section.devices.filter(d => `${d.name} ${section.name}`.toLocaleLowerCase().includes(needle)) }))
      .filter(section => section.devices.length > 0);
  }, [sections, query]);

  const stepCount = branches.reduce((sum, branch) => sum + branch.length, 0);
  const canSave = name.trim().length > 0 && stepCount > 0 && Boolean(config);

  const changeStep = (branch: number, index: number, patch: Partial<ScenarioStep>) =>
    setBranches(prev => prev.map((b, bi) => bi !== branch ? b : b.map((step, si) => (si === index ? { ...step, ...patch } : step))));

  const pickDevice = (deviceId: string) => {
    if (selection.kind === 'add') {
      const index = branches[selection.branch]?.length ?? 0;
      setBranches(prev => prev.map((b, bi) => (bi === selection.branch ? [...b, { deviceId, on: true }] : b)));
      setSelection({ kind: 'step', branch: selection.branch, index });
    } else if (selection.kind === 'step') {
      // Другое устройство: прежние настройки к нему не подходят
      changeStep(selection.branch, selection.index, { deviceId, actions: undefined });
    }
    setQuery('');
  };

  const removeStep = (branch: number, index: number) => {
    setBranches(prev => {
      const next = prev.map((b, bi) => (bi === branch ? b.filter((_, si) => si !== index) : b));
      // Пустую параллельную цепочку убираем, первая остаётся местом для нового шага
      const kept = next.filter(b => b.length > 0);
      return kept.length ? kept : [[]];
    });
    setSelection({ kind: 'trigger' });
  };

  const addBranch = () => {
    setBranches(prev => [...prev, []]);
    setSelection({ kind: 'add', branch: branches.length });
  };

  const save = () => {
    if (!canSave) return;
    // Яркость имеет смысл только при включении
    const clean = branches.map(branch => branch.map(step => (step.on ? step : { ...step, actions: undefined })));
    if (mode === 'create') {
      update(current => addScenario(current, { name, householdId: ctx.activeHouseholdId, branches: clean }, id).config);
    } else {
      update(current => updateScenario(current, id, { name, branches: clean }));
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

  // ---- Подписи в схеме ----
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

  const isSelected = (branch: number, index: number) => selection.kind === 'step' && selection.branch === branch && selection.index === index;

  // ---- Панель под схемой: настройки выбранного элемента ----
  const devicePicker = (
    <div className="flow-picker">
      <label className="flow-search">
        <Search className="w-4 h-4" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('flow.search')} aria-label={t('flow.search')} />
      </label>
      <div className="group-pick-list flow-pick-list">
        {filtered.map(section => (
          <div key={section.id || 'rest'} className="group-pick-section">
            <div className="group-pick-room">{section.name}</div>
            {section.devices.map(device => (
              <button key={device.id} className="group-pick-item" onClick={() => pickDevice(device.id)}>
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

  const inspector = (() => {
    if (selection.kind === 'trigger') {
      return (
        <div className="flow-inspector">
          <h4 title={t('flow.triggerHint')}>{t('flow.start')}</h4>
          <div className="flow-trigger-manual"><Hand className="w-4 h-4" /> {t('flow.byClick')}</div>
          <div className="scenario-times"><ScheduleList targetId={id} defaultTime="19:00" /></div>
        </div>
      );
    }
    if (selection.kind === 'add') {
      return (
        <div className="flow-inspector">
          <h4>{t('flow.pickDevice')}</h4>
          {devicePicker}
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
            {devicePicker}
          </details>
        </div>
      </div>
    );
  })();

  return createPortal(
    <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="zone-dialog flow-dialog" role="dialog" aria-label={mode === 'create' ? t('scenarioEditor.add') : existing?.name}>
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
            <button className={`flow-node is-trigger ${selection.kind === 'trigger' ? 'is-selected' : ''}`} onClick={() => setSelection({ kind: 'trigger' })}>
              <span className="flow-kicker">{t('flow.start')}</span>
              <span className="flow-node-title"><Hand className="w-4 h-4" /> {t('flow.byClick')}</span>
              <span className="flow-node-meta">
                <Clock className="w-3 h-3" /> {triggerSummary ?? t('flow.noTime')}
              </span>
            </button>

            <div className={`flow-branches ${branches.length > 1 || stepCount > 0 ? 'has-rail' : ''}`}>
              {branches.map((branch, bi) => (
                <div key={bi} className="flow-branch">
                  <span className="flow-link" aria-hidden />
                  {branch.map((step, si) => {
                    const device = devicesById.get(step.deviceId);
                    return (
                      <React.Fragment key={`${step.deviceId}-${si}`}>
                        <button
                          className={`flow-node ${isSelected(bi, si) ? 'is-selected' : ''} ${device ? '' : 'is-missing'}`}
                          onClick={() => setSelection({ kind: 'step', branch: bi, index: si })}
                        >
                          <span className="flow-node-title">
                            <span className="flow-node-icon">{device ? getIconForDevice(device.type) : null}</span>
                            <span className="flow-node-name">{device?.name ?? t('flow.missingDevice')}</span>
                          </span>
                          <span className={`flow-node-action ${step.on ? 'is-on' : ''}`}>{actionLabel(step, device)}</span>
                          <span className="flow-node-meta"><Clock className="w-3 h-3" /> {waitLabel(step.wait)}</span>
                        </button>
                        <span className="flow-link" aria-hidden />
                      </React.Fragment>
                    );
                  })}
                  <button
                    className={`flow-add ${selection.kind === 'add' && selection.branch === bi ? 'is-selected' : ''}`}
                    onClick={() => setSelection({ kind: 'add', branch: bi })}
                    title={t('flow.addStep')} aria-label={t('flow.addStep')}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {stepCount > 0 && branches.every(b => b.length > 0) && (
                <div className="flow-branch is-new">
                  <span className="flow-link is-dashed" aria-hidden />
                  <button className="flow-ghost" onClick={addBranch} title={t('flow.addBranchHint')}>
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
    </div>,
    document.body,
  );
};
