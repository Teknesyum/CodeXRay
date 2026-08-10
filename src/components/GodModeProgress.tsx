import {
  Ban,
  Check,
  Circle,
  Cog,
  RotateCcw,
  RefreshCw,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ManagerPlanV1 } from '../types/godMode';
import type { ManagerPlanV2 } from '../types/webSource';
import type { Locale } from '../i18n/translations';
import { t } from '../i18n/translations';

interface GodModeProgressProps {
  plan: ManagerPlanV1 | ManagerPlanV2;
  locale: Locale;
  onCancel: () => void;
  onDismiss: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRetry: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const agentKey = (role: string) => `godAgent_${role}`;

const jobElapsed = (
  job: ManagerPlanV1['jobs'][number] | ManagerPlanV2['jobs'][number],
  now: number,
): number | null => {
  const elapsed = 'durationMs' in job && typeof job.durationMs === 'number'
    ? job.durationMs
    : job.startedAt
      ? (job.finishedAt ?? now) - job.startedAt
      : null;
  return elapsed === null ? null : Math.max(0, elapsed);
};

const jobDetails = (
  job: ManagerPlanV1['jobs'][number] | ManagerPlanV2['jobs'][number],
  now: number,
): string | undefined => {
  const elapsed = jobElapsed(job, now);
  const timing = elapsed === null
    ? ''
    : `Time: ${(elapsed / 1_000).toFixed(2)}s${'queueMs' in job && typeof job.queueMs === 'number'
      ? ` · queue ${(job.queueMs / 1_000).toFixed(2)}s${typeof job.firstTokenMs === 'number'
        ? ` · first token ${(job.firstTokenMs / 1_000).toFixed(2)}s`
        : ''} · inference ${((job.inferenceMs ?? 0) / 1_000).toFixed(2)}s${typeof job.completionTokens === 'number'
        ? ` · ${job.completionTokens} tokens`
        : ''}${job.finishReason ? ` · ${job.finishReason}` : ''}`
      : ''}`;
  return [job.error ?? job.summary, timing].filter(Boolean).join(' · ') || undefined;
};

interface AgentTooltip {
  role: string;
  status?: string;
  details?: string;
  x: number;
  y: number;
}

export const GodModeProgress = ({
  plan,
  locale,
  onCancel,
  onDismiss,
  onUndo,
  onRedo,
  onRetry,
  canUndo,
  canRedo,
}: GodModeProgressProps) => {
  const [tooltip, setTooltip] = useState<AgentTooltip | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reasoningOpen, setReasoningOpen] = useState(true);
  const autoOpenedReasoningRef = useRef<string | null>(null);
  const totalWeight = plan.jobs.reduce((sum, job) => sum + ('weight' in job ? job.weight : 1), 0);
  const completedWeight = plan.jobs.reduce((sum, job) =>
    job.status === 'completed' || job.status === 'completed_with_fallback'
      ? sum + ('weight' in job ? job.weight : 1)
      : sum, 0);
  const progress = totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0;
  const running = plan.jobs.find((job) => job.status === 'running' || job.status === 'retrying');
  const failed = plan.jobs.some((job) => job.status === 'failed');
  const cancelled = plan.jobs.some((job) => job.status === 'cancelled');
  const completed = progress === 100;
  const liveReasoningJob = [...plan.jobs].reverse().find((job) =>
    (job.status === 'running' || job.status === 'retrying') && job.reasoning?.trim());
  const reasoningJob = liveReasoningJob ?? [...plan.jobs].reverse().find((job) => job.reasoning?.trim());
  const liveReasoningKey = liveReasoningJob ? `${plan.runId}:${liveReasoningJob.id}` : null;

  useEffect(() => {
    if (!liveReasoningKey || autoOpenedReasoningRef.current === liveReasoningKey) return;
    autoOpenedReasoningRef.current = liveReasoningKey;
    setReasoningOpen(true);
  }, [liveReasoningKey]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running]);

  const positionTooltip = (bounds: DOMRect, role: string, status?: string, details?: string) => {
    const tooltipHalfWidth = 170;
    const x = Math.min(
      Math.max(bounds.left + bounds.width / 2, tooltipHalfWidth + 8),
      window.innerWidth - tooltipHalfWidth - 8,
    );
    setTooltip({ role, status, details, x, y: bounds.bottom + 7 });
  };

  const showAgentTooltip = (
    event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>,
    role: string,
    status: string,
    details?: string,
  ) => {
    positionTooltip(event.currentTarget.getBoundingClientRect(), role, status, details);
  };

  const showControlTooltip = (
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>,
    label: string,
  ) => positionTooltip(event.currentTarget.getBoundingClientRect(), label);

  return (
    <section className={`god-mode-progress ${failed ? 'failed' : ''} ${completed ? 'completed' : ''} ${reasoningJob ? 'has-reasoning' : ''}`}>
      <div className="god-mode-progress-main">
      <div className="god-mode-progress-header">
        <span className="god-mode-title"><Zap size={14} /> {t('godModeRun', locale)}</span>
        <span className="god-mode-percent">{progress}%</span>
        <button
          type="button"
          className="god-mode-mini-btn"
          onClick={onUndo}
          disabled={!canUndo || Boolean(running)}
          aria-label={t('godModeUndo', locale)}
          onMouseEnter={(event) => showControlTooltip(event, t('godModeUndo', locale))}
          onMouseLeave={() => setTooltip(null)}
          onFocus={(event) => showControlTooltip(event, t('godModeUndo', locale))}
          onBlur={() => setTooltip(null)}
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          className="god-mode-mini-btn"
          onClick={onRedo}
          disabled={!canRedo || Boolean(running)}
          aria-label={t('godModeRedo', locale)}
          onMouseEnter={(event) => showControlTooltip(event, t('godModeRedo', locale))}
          onMouseLeave={() => setTooltip(null)}
          onFocus={(event) => showControlTooltip(event, t('godModeRedo', locale))}
          onBlur={() => setTooltip(null)}
        >
          <RotateCcw size={13} />
        </button>
        {!completed && !failed && !cancelled && (
          <button
            type="button"
            className="god-mode-mini-btn danger"
            onPointerDown={(event) => {
              if (event.button === 0) onCancel();
            }}
            onClick={(event) => {
              if (event.detail === 0) onCancel();
            }}
            aria-label={t('godModeCancel', locale)}
            onMouseEnter={(event) => showControlTooltip(event, t('godModeCancel', locale))}
            onMouseLeave={() => setTooltip(null)}
            onFocus={(event) => showControlTooltip(event, t('godModeCancel', locale))}
            onBlur={() => setTooltip(null)}
          >
            <X size={13} />
          </button>
        )}
        {failed && (
          <button
            type="button"
            className="god-mode-mini-btn"
            onClick={onRetry}
            aria-label={t('godModeRetry', locale)}
            onMouseEnter={(event) => showControlTooltip(event, t('godModeRetry', locale))}
            onMouseLeave={() => setTooltip(null)}
            onFocus={(event) => showControlTooltip(event, t('godModeRetry', locale))}
            onBlur={() => setTooltip(null)}
          >
            <RefreshCw size={13} />
          </button>
        )}
        {(completed || failed || cancelled) && (
          <button
            type="button"
            className="god-mode-mini-btn"
            onClick={onDismiss}
            aria-label={t('godModeDismiss', locale)}
            onMouseEnter={(event) => showControlTooltip(event, t('godModeDismiss', locale))}
            onMouseLeave={() => setTooltip(null)}
            onFocus={(event) => showControlTooltip(event, t('godModeDismiss', locale))}
            onBlur={() => setTooltip(null)}
          >
            <X size={13} />
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
            aria-label={`${t(agentKey(job.role), locale)}: ${t(`godStatus_${job.status}`, locale)}`}
            tabIndex={0}
            onMouseEnter={(event) => showAgentTooltip(
              event,
              t(agentKey(job.role), locale),
              t(`godStatus_${job.status}`, locale),
              jobDetails(job, now),
            )}
            onMouseLeave={() => setTooltip(null)}
            onFocus={(event) => showAgentTooltip(
              event,
              t(agentKey(job.role), locale),
              t(`godStatus_${job.status}`, locale),
              jobDetails(job, now),
            )}
            onBlur={() => setTooltip(null)}
          >
            <span className="agent-state-icon" aria-hidden="true">
              {job.status === 'completed' || job.status === 'completed_with_fallback'
                ? <Check size={12} />
                : job.status === 'running' || job.status === 'retrying'
                  ? <Cog size={12} />
                  : job.status === 'failed' || job.status === 'cancelled'
                    ? <Ban size={12} />
                    : <Circle size={9} />}
            </span>
            <span className="agent-role">{t(agentKey(job.role), locale)}</span>
            {jobElapsed(job, now) !== null && (
              <span className="agent-duration">
                {(jobElapsed(job, now)! / 1_000).toFixed(1)}s
              </span>
            )}
            {(job.summary || job.error) && (
              <span className="agent-summary" title={job.error ?? job.summary}>
                {job.error ?? job.summary}
              </span>
            )}
          </div>
        ))}
      </div>
      </div>
      {reasoningJob && (
        <details
          className={`god-mode-agent-reasoning ${liveReasoningJob?.id === reasoningJob.id ? 'live' : ''}`}
          open={reasoningOpen}
          onToggle={(event) => setReasoningOpen(event.currentTarget.open)}
        >
          <summary>
            <span>{t(agentKey(reasoningJob.role), locale)}</span>
            <span>{t('godAgentThinking', locale)}</span>
            {liveReasoningJob?.id === reasoningJob.id && (
              <span className="god-mode-thinking-live">{t('godAgentThinkingLive', locale)}</span>
            )}
          </summary>
          <pre>{reasoningJob.reasoning}</pre>
        </details>
      )}
      {tooltip && createPortal(
        <div
          className="god-mode-agent-tooltip"
          role="tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="agent-tooltip-heading">
            <Zap size={12} aria-hidden="true" />
            <strong>{tooltip.role}</strong>
            {tooltip.status && <span>{tooltip.status}</span>}
          </div>
          {tooltip.details && <div className="agent-tooltip-details">{tooltip.details}</div>}
        </div>,
        document.body,
      )}
    </section>
  );
};
