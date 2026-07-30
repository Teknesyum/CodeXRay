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
  const { steps, currentIndex, locale } = useTimeline();
  const variables = steps[currentIndex]?.visualData.vars ?? {};
  const previousVariables = currentIndex > 0 ? steps[currentIndex - 1]?.visualData.vars ?? {} : {};
  const keys = Object.keys(variables);
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
              return (
                <section key={key} className={`var-item ${changed ? 'changed' : 'unchanged'}`}>
                  <span className="var-name">{key}</span>
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
