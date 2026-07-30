import { Pin } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import type { TraceValue } from '../types/simulation';
import { t } from '../i18n/translations';
import './VariablesPanel.css';

const isRecord = (value: TraceValue): value is Record<string, TraceValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const TraceValueView = ({
  value,
  locale,
  depth = 0,
}: {
  value: TraceValue;
  locale: 'en' | 'tr';
  depth?: number;
}) => {
  if (Array.isArray(value)) {
    return (
      <details className="trace-collection" open={depth === 0}>
        <summary>{t('arrayCount', locale, { count: value.length })}</summary>
        <ol>
          {value.map((item, index) => (
            <li key={index}>
              <span className="trace-key">[{index}]</span>
              <TraceValueView value={item} locale={locale} depth={depth + 1} />
            </li>
          ))}
        </ol>
      </details>
    );
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    return (
      <details className="trace-collection" open={depth === 0}>
        <summary>{t('objectCount', locale, { count: entries.length })}</summary>
        <ul>
          {entries.map(([key, item]) => (
            <li key={key}>
              <span className="trace-key">{key}</span>
              <TraceValueView value={item} locale={locale} depth={depth + 1} />
            </li>
          ))}
        </ul>
      </details>
    );
  }
  return <span className="trace-primitive">{value === null ? 'null' : String(value)}</span>;
};

interface VariablesPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const VariablesPanel = ({ collapsed, onToggleCollapse }: VariablesPanelProps) => {
  const {
    steps,
    currentIndex,
    locale,
    pinnedVariables,
    togglePinnedVariable,
  } = useTimeline();
  const variables = steps[currentIndex]?.visualData.vars ?? {};
  const previousVariables = currentIndex > 0 ? steps[currentIndex - 1]?.visualData.vars ?? {} : {};
  const keys = Object.keys(variables).sort((left, right) =>
    Number(pinnedVariables.includes(right)) - Number(pinnedVariables.includes(left)),
  );
  const panelTitle = t('variablesTrace', locale);

  if (collapsed) {
    return (
      <div className="variables-panel">
        <div className="collapsed-panel-header">
          <span>{panelTitle}</span>
          <button
            type="button"
            className="panel-toggle"
            aria-label={t('expandPanel', locale, { panel: panelTitle })}
            onClick={onToggleCollapse}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="variables-panel glass-panel">
      <div className="variables-header">
        <h2>{panelTitle}</h2>
        {keys.length > 0 && <span>{keys.length} {t('tracked', locale)}</span>}
        <button
          type="button"
          className="panel-toggle"
          aria-label={t('collapsePanel', locale, { panel: panelTitle })}
          onClick={onToggleCollapse}
        >
          −
        </button>
      </div>
      <div className="variables-content">
        {keys.length === 0 ? (
          <div className="no-vars">{t('noVariables', locale)}</div>
        ) : (
          <div className="vars-grid">
            {keys.map((key) => {
              const value = variables[key];
              const changed = JSON.stringify(value) !== JSON.stringify(previousVariables[key]);
              const pinned = pinnedVariables.includes(key);
              return (
                <section
                  key={key}
                  data-testid={`variable-${key}`}
                  className={`var-item ${changed ? 'changed' : 'unchanged'} ${pinned ? 'pinned' : ''}`}
                >
                  <div className="var-item-header">
                    <span className="var-name">{key}</span>
                    <button
                      type="button"
                      className="variable-pin-button"
                      aria-label={t(pinned ? 'unpinVariable' : 'pinVariable', locale, { name: key })}
                      aria-pressed={pinned}
                      onClick={() => togglePinnedVariable(key)}
                    >
                      <Pin size={13} fill={pinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="var-value"><TraceValueView value={value} locale={locale} /></div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
