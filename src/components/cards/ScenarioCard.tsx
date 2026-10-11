import React, { useContext, useState } from 'react';
import { getIconForScenario } from '../../constants';
import { YandexScenario } from '../../types/index';
import { Loader2, CheckCircle2, Star, Eye, EyeOff, Settings2 } from 'lucide-react';
import { ProviderBadge } from '../services/ProviderBadge';
import DashboardContext from '../../contexts/DashboardContext';
import { ScenarioDialog } from '../zones/ScenarioDialog';
import { flowFromServiceSteps, isCustomScenarioId } from '../../../core/scenarios';
import { useI18n } from '../../i18n/I18nContext';

interface ScenarioCardProps {
  scenario: YandexScenario;
  onExecute: (id: string) => Promise<void>;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  isEditMode?: boolean;
  iconHiddenState?: boolean;
  onToggleVisibility?: (id: string) => void;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, onExecute, isFavorite, onToggleFavorite, isEditMode = false, iconHiddenState = false, onToggleVisibility }) => {
  const [loading, setLoading] = useState(false);
  const [justExecuted, setJustExecuted] = useState(false);
  const [editing, setEditing] = useState(false);
  const ctx = useContext(DashboardContext);
  const { t } = useI18n();
  // Изменять можно свои сценарии и сценарии сервиса, шаги которых удаётся прочитать
  const custom = isCustomScenarioId(scenario.id);
  const editable = Boolean(ctx?.automations.config) && !isEditMode && (custom || flowFromServiceSteps(scenario.steps) !== null);

  const handleClick = async () => {
    // Сервис недоступен: onExecute только сообщит «нет связи», галочку не показываем
    if (scenario.unreachable) { void onExecute(scenario.id).catch(() => {}); return; }
    if (loading) return;
    setLoading(true);
    try {
      await onExecute(scenario.id);
      setJustExecuted(true);
      setTimeout(() => setJustExecuted(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const icon = getIconForScenario(scenario.icon, scenario.name);

  return (
    <>
    <button
      onClick={handleClick}
      disabled={loading}
      className={`scenario-card ${loading ? 'opacity-80' : ''} ${justExecuted ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/10' : ''} ${scenario.unreachable ? 'is-unreachable' : ''} ${isEditMode && iconHiddenState ? 'opacity-50 grayscale' : ''}`}
      style={{ position: 'relative' }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (isEditMode && onToggleVisibility) {
            onToggleVisibility(`scenario_${scenario.id}`);
          } else {
            onToggleFavorite(scenario.id);
          }
        }}
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 5,
          width: 22, height: 22, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          opacity: isEditMode || isFavorite ? 1 : 0,
          transition: 'opacity 150ms ease',
          color: isEditMode ? 'var(--muted)' : isFavorite ? 'var(--fav-star)' : 'var(--border)',
        }}
        className="scenario-fav-btn"
      >
        {isEditMode && onToggleVisibility ? (
          iconHiddenState ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />
        ) : (
          <Star className="w-3 h-3" fill={isFavorite ? 'currentColor' : 'none'} />
        )}
      </div>

      {editable && (
        <span
          role="button" tabIndex={-1} className="scenario-edit" title={t('scenarioEditor.edit')} aria-label={t('scenarioEditor.edit')}
          onClick={e => { e.stopPropagation(); e.preventDefault(); setEditing(true); }}
        >
          <Settings2 className="w-3.5 h-3.5" />
        </span>
      )}

      <div className="scenario-icon">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : justExecuted ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} /> : React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })}
      </div>
      <span className="scenario-name">{scenario.name}<ProviderBadge providerId={scenario.provider_id} unreachable={scenario.unreachable} /></span>
    </button>
    {/* Окно вне кнопки: иначе щелчки в нём доходили бы до карточки и запускали сценарий */}
    {editing && (
      <ScenarioDialog
        mode={custom ? 'edit' : 'create'}
        scenarioId={custom ? scenario.id : undefined}
        source={custom ? undefined : { id: scenario.id, name: scenario.name, steps: scenario.steps }}
        onClose={() => setEditing(false)}
      />
    )}
    </>
  );
};
