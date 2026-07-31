import {
  Activity,
  Ban,
  Check,
  Circle,
  RotateCcw,
  RefreshCw,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import type { ManagerPlanV1 } from '../types/godMode';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';
import { godModePlanProgress } from '../services/godModeOrchestrator';

interface GodModeProgressProps {
  plan: ManagerPlanV1;
  locale: Locale;
  onCancel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRetry: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const agentKey = (role: string) => `godAgent_${role}`;

export const GodModeProgress = ({
  plan,
  locale,
  onCancel,
  onUndo,
  onRedo,
  onRetry,
  canUndo,
  canRedo,
}: GodModeProgressProps) => {
  const progress = godModePlanProgress(plan);
  const running = plan.jobs.find((job) => job.status === 'running');
  const failed = plan.jobs.some((job) => job.status === 'failed');
  const cancelled = plan.jobs.some((job) => job.status === 'cancelled');
  const completed = progress === 100;

  return (
    <section className={`god-mode-progress ${failed ? 'failed' : ''} ${completed ? 'completed' : ''}`}>
      <div className="god-mode-progress-header">
        <span className="god-mode-title"><Zap size={14} /> {t('godModeRun', locale)}</span>
        <span className="god-mode-percent">{progress}%</span>
        <button
          type="button"
          className="god-mode-mini-btn"
          onClick={onUndo}
          disabled={!canUndo || Boolean(running)}
          title={t('godModeUndo', locale)}
          aria-label={t('godModeUndo', locale)}
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          className="god-mode-mini-btn"
          onClick={onRedo}
          disabled={!canRedo || Boolean(running)}
          title={t('godModeRedo', locale)}
          aria-label={t('godModeRedo', locale)}
        >
          <RotateCcw size={13} />
        </button>
        {!completed && !failed && !cancelled && (
          <button
            type="button"
            className="god-mode-mini-btn danger"
            onClick={onCancel}
            title={t('godModeCancel', locale)}
            aria-label={t('godModeCancel', locale)}
          >
            <X size={13} />
          </button>
        )}
        {failed && (
          <button
            type="button"
            className="god-mode-mini-btn"
            onClick={onRetry}
            title={t('godModeRetry', locale)}
            aria-label={t('godModeRetry', locale)}
          >
            <RefreshCw size={13} />
          </button>
        )}
      </div>
      <div className="god-mode-real-progress" aria-label={t('godModeProgress', locale)}>
        <div style={{ width: `${progress}%` }} />
      </div>
      <div className="god-mode-agent-list">
        {plan.jobs.map((job) => (
          <div
            className={`god-mode-agent ${job.status}`}
            key={job.id}
            title={job.error ?? job.summary}
          >
            <span className="agent-state-icon" aria-hidden="true">
              {job.status === 'completed'
                ? <Check size={12} />
                : job.status === 'running' || job.status === 'retrying'
                  ? <Activity size={12} />
                  : job.status === 'failed' || job.status === 'cancelled'
                    ? <Ban size={12} />
                    : <Circle size={9} />}
            </span>
            <span className="agent-role">{t(agentKey(job.role), locale)}</span>
            <span className="agent-status">{t(`godStatus_${job.status}`, locale)}</span>
            {(job.summary || job.error) && (
              <span className="agent-summary" title={job.error ?? job.summary}>
                {job.error ?? job.summary}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
