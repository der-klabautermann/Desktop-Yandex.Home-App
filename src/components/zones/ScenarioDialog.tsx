import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, X } from 'lucide-react';
import { useDashboardContext } from '../../contexts/DashboardContext';
import { useI18n } from '../../i18n/I18nContext';
import { getIconForDevice } from '../../constants/icons';
import { flattenTree } from '../../../core/zones';
import { isGroupable } from '../../../core/groups';
import { addScenario, newScenarioId, removeScenario, updateScenario, type ScenarioStep } from '../../../core/scenarios';
import { removeSchedulesFor } from '../../../core/schedules';
import { ProviderBadge } from '../services/ProviderBadge';
import { ScheduleList } from '../device/DeviceScheduleSection';
import { Segmented } from '../settings/Segmented';
import type { YandexDevice } from '../../types/index';

interface ScenarioDialogProps {
  mode: 'create' | 'edit';
  scenarioId?: string;
  onClose: () => void;
}

const brightnessOf = (device: YandexDevice) =>
  device.capabilities.find(c => c.type === 'devices.capabilities.range' && (c.parameters as any)?.instance === 'brightness');

/** Собственный сценарий: устройства любых сервисов, что с каждым сделать и когда запускать. */
export const ScenarioDialog: React.FC<ScenarioDialogProps> = ({ mode, scenarioId, onClose }) => {
  const ctx = useDashboardContext();
  const { t } = useI18n();
  const { config, update } = ctx.automations;
  const existing = scenarioId ? config?.scenarios?.find(s => s.id === scenarioId) : undefined;
  // У нового сценария id есть сразу, чтобы к нему можно было добавить время запуска
  const id = useRef(scenarioId ?? newScenarioId()).current;

  const [name, setName] = useState(existing?.name ?? '');
  const [steps, setSteps] = useState<Map<string, ScenarioStep>>(
    () => new Map((existing?.steps ?? []).map(step => [step.deviceId, step])),
  );

  // Комнаты в порядке дерева зон, внутри только то, что умеет включаться
  const sections = useMemo(() => {
    const byId = new Map(ctx.data.devices.map(d => [d.id, d]));
    const placed = new Set<string>();
    const result: Array<{ id: string; name: string; devices: YandexDevice[] }> = [];
    for (const node of flattenTree(ctx.zones.tree)) {
      const devices = node.deviceIds.map(deviceId => byId.get(deviceId)).filter((d): d is YandexDevice => !!d && isGroupable(d));
      devices.forEach(d => placed.add(d.id));
      if (devices.length) result.push({ id: node.id, name: node.name, devices });
    }
    const rest = ctx.data.devices.filter(d => !placed.has(d.id) && isGroupable(d)
      && (!ctx.activeHouseholdId || (d as any).household_id === ctx.activeHouseholdId));
    if (rest.length) result.push({ id: '', name: t('zones.noRoom'), devices: rest });
    return result;
  }, [ctx.data.devices, ctx.zones.tree, ctx.activeHouseholdId, t]);

  const toggle = (deviceId: string) => setSteps(prev => {
    const next = new Map<string, ScenarioStep>(prev);
    if (next.has(deviceId)) next.delete(deviceId);
    else next.set(deviceId, { deviceId, on: true });
    return next;
  });
  const change = (deviceId: string, patch: Partial<ScenarioStep>) => setSteps(prev => {
    const next = new Map<string, ScenarioStep>(prev);
    const step = next.get(deviceId);
    if (step) next.set(deviceId, { ...step, ...patch });
    return next;
  });

  const canSave = name.trim().length > 0 && steps.size > 0 && Boolean(config);

  const save = () => {
    if (!canSave) return;
    // Яркость имеет смысл только при включении
    const list = [...steps.values()].map(step => (step.on ? step : { deviceId: step.deviceId, on: false }));
    if (mode === 'create') {
      update(current => addScenario(current, { name, householdId: ctx.activeHouseholdId, steps: list }, id).config);
    } else {
      update(current => updateScenario(current, id, { name, steps: list }));
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

  return createPortal(
    <div className="zone-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="zone-dialog scenario-dialog" role="dialog" aria-label={mode === 'create' ? t('scenarioEditor.add') : existing?.name}>
        <header>
          <h3>{mode === 'create' ? t('scenarioEditor.add') : existing?.name}</h3>
          <button className="header-btn" onClick={cancel} title={t('common.close')}><X className="w-4 h-4" /></button>
        </header>

        <label htmlFor="scenario-name">{t('zones.name')}</label>
        <input
          id="scenario-name"
          value={name}
          placeholder={t('scenarioEditor.namePlaceholder')}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          autoFocus
        />

        <label>
          {t('zones.groupDevices')}
          {steps.size > 0 && <span className="group-pick-count">{steps.size}</span>}
        </label>
        <div className="group-pick-list">
          {sections.map(section => (
            <div key={section.id || 'rest'} className="group-pick-section">
              <div className="group-pick-room">{section.name}</div>
              {section.devices.map(device => {
                const step = steps.get(device.id);
                const brightness = brightnessOf(device);
                const level = Number(step?.actions?.find(a => a.instance === 'brightness')?.value ?? 100);
                return (
                  <div key={device.id} className={`scenario-pick ${step ? 'is-selected' : ''}`}>
                    <button className={`group-pick-item ${step ? 'is-selected' : ''}`} onClick={() => toggle(device.id)} aria-pressed={Boolean(step)}>
                      <span className="group-pick-icon">{getIconForDevice(device.type)}</span>
                      <span className="group-pick-name">{device.name}</span>
                      <ProviderBadge providerId={device.provider_id} unreachable={device.unreachable} />
                      <span className="group-pick-check">{step && <Check className="w-3 h-3" strokeWidth={3} />}</span>
                    </button>
                    {step && (
                      <div className="scenario-step">
                        <Segmented
                          label={device.name}
                          value={step.on}
                          options={[{ value: true, label: t('scenarioEditor.on') }, { value: false, label: t('scenarioEditor.off') }]}
                          onChange={on => change(device.id, on ? { on } : { on, actions: undefined })}
                        />
                        {step.on && brightness && (
                          <label className="scenario-level" title={t('scenarioEditor.brightness')}>
                            <input
                              type="range" className="dd-slider" min={1} max={100} value={level}
                              style={{ ['--fill' as any]: `${level}%` }}
                              aria-label={t('scenarioEditor.brightness')}
                              onChange={e => change(device.id, {
                                actions: [{ instance: 'brightness', value: Number(e.target.value), type: 'devices.capabilities.range' }],
                              })}
                            />
                            <span>{level} %</span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <label title={t('schedule.hintScenario')}>{t('scenarioEditor.times')}</label>
        <div className="scenario-times">
          <ScheduleList targetId={id} defaultTime="19:00" />
        </div>

        <footer>
          {mode === 'edit' && (
            <button className="zone-delete" onClick={remove}><Trash2 className="w-3.5 h-3.5" /> {t('scenarioEditor.delete')}</button>
          )}
          <span style={{ flex: 1 }} />
          <button className="service-action" onClick={cancel}>{t('common.cancel')}</button>
          <button className="connect-primary zone-save" disabled={!canSave} onClick={save}>{t('common.save')}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
