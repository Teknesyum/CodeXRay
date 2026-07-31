import { CheckCircle2, LoaderCircle, PinOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTimeline } from '../context/TimelineContext';
import type {
  ArrayVisualData,
  GraphVisualData,
  TraceValue,
  VisualData,
} from '../types/simulation';
import { localizeAlgorithmName, t, translateRuntimeText } from '../i18n/translations';
import { GraphInputEditor } from './GraphInputEditor';
import './DynamicVisualizer.css';

const pointerColors = ['var(--neon-lime)', 'var(--neon-magenta)', 'var(--neon-cyan)', '#ff9900'];

const formatPinnedValue = (value: TraceValue): string =>
  typeof value === 'string' ? value : JSON.stringify(value);

const ArrayView = ({ data }: { data: ArrayVisualData }) => (
  <div className="visual-array">
    {data.values.map((value, index) => {
      const pointers = Object.entries(data.pointers ?? {})
        .filter(([, pointerIndex]) => pointerIndex === index)
        .map(([name]) => name);
      const activeColor = pointerColors[Math.max(0, Object.keys(data.pointers ?? {}).indexOf(pointers[0])) % pointerColors.length];
      const sorted = data.sortedIndices?.includes(index);
      return (
        <div key={index} className="array-cell-wrapper">
          <div className="pointers-container">
            {pointers.map((pointer, pointerIndex) => (
              <span
                key={pointer}
                className="pointer-label"
                style={{ color: pointerColors[pointerIndex % pointerColors.length] }}
              >
                {pointer}
              </span>
            ))}
          </div>
          <div
            className={`array-cell ${pointers.length ? 'active-pointer' : ''} ${sorted ? 'sorted-cell' : ''}`}
            style={pointers.length ? { borderColor: activeColor } : undefined}
          >
            <div className="cell-index">{index}</div>
            <div className="cell-value">{String(value)}</div>
          </div>
        </div>
      );
    })}
  </div>
);

const GraphView = ({ data }: { data: GraphVisualData }) => {
  const { locale } = useTimeline();
  return (
    <div className="visual-graph">
      <svg className="graph-edges" aria-label={t('graphEdges', locale)}>
        <defs>
          <marker id="arrow-idle" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(0, 243, 255, 0.45)" />
          </marker>
          <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#ff00ff" />
          </marker>
        </defs>
        {data.edges.map((edge) => {
          const start = data.nodes.find((node) => node.id === edge.from);
          const end = data.nodes.find((node) => node.id === edge.to);
          if (!start || !end) return null;
          const state = edge.state ?? 'idle';
          const marker = data.directed
            ? `url(#arrow-${state === 'idle' ? 'idle' : 'active'})`
            : undefined;
          return (
            <g key={edge.id} className={`graph-edge ${state}`}>
              <line
                x1={`${start.x}%`}
                y1={`${start.y}%`}
                x2={`${end.x}%`}
                y2={`${end.y}%`}
                markerEnd={marker}
              />
              {edge.weight !== undefined && (
                <text x={`${(start.x + end.x) / 2}%`} y={`${(start.y + end.y) / 2}%`}>
                  {edge.weight}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {data.nodes.map((node) => (
        <div
          key={node.id}
          className={`graph-node node-${node.state ?? 'idle'}`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          title={`${t('node', locale)} ${node.label}: ${t(node.state ?? 'idle', locale)}`}
        >
          {node.label}
        </div>
      ))}
      <div className="graph-legend" aria-label={t('graphLegend', locale)}>
        <span className="legend-queued">{t('queued', locale)}</span>
        <span className="legend-active">{t('active', locale)}</span>
        <span className="legend-visited">{t('visited', locale)}</span>
        <span className="legend-path">{t('path', locale)}</span>
      </div>
    </div>
  );
};

const VisualDataView = ({ visualData }: { visualData: VisualData }) => {
  if (visualData.type === 'array') return <ArrayView data={visualData} />;
  if (visualData.type === 'graph') return <GraphView data={visualData} />;
  return (
    <div className="visual-variables">
      {Object.entries(visualData.vars).map(([key, value]) => (
        <div key={key} className="variable-card">
          <span className="var-name">{key}</span>
          <span className="var-value">{JSON.stringify(value)}</span>
        </div>
      ))}
    </div>
  );
};

interface DynamicVisualizerProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const DynamicVisualizer = ({
  collapsed,
  onToggleCollapse,
}: DynamicVisualizerProps) => {
  const {
    algorithmName,
    steps,
    currentIndex,
    simulationInput,
    setSimulationInput,
    setInputError,
    locale,
    isEditingInput,
    setIsEditingInput,
    pinnedVariables,
    togglePinnedVariable,
    aiStatus,
    aiProgressPercent,
    showAiLoadWarning,
    setShowAiLoadWarning,
    showAiLoadProgress,
  } = useTimeline();

  const [modelLoadNotice, setModelLoadNotice] = useState<'loading' | 'ready' | null>(null);
  const [pseudoAiProgress, setPseudoAiProgress] = useState(0);

  const handleLoadModel = () => {
    setModelLoadNotice('loading');
    window.dispatchEvent(new Event('codexray:loadModel'));
  };

  useEffect(() => {
    if (modelLoadNotice !== 'loading') return;
    if (aiStatus === 'ready') setModelLoadNotice('ready');
    if (aiStatus === 'error' || aiStatus === 'unsupported') setModelLoadNotice(null);
  }, [aiStatus, modelLoadNotice]);

  useEffect(() => {
    if (modelLoadNotice !== 'ready') return;
    const timer = window.setTimeout(() => setModelLoadNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [modelLoadNotice]);

  useEffect(() => {
    if (aiStatus !== 'loading') {
      setPseudoAiProgress(0);
      return;
    }
    setPseudoAiProgress(0);
    const timer = window.setInterval(() => {
      setPseudoAiProgress((current) => {
        if (current >= 20) {
          window.clearInterval(timer);
          return 20;
        }
        return current + 1;
      });
    }, 300);
    return () => window.clearInterval(timer);
  }, [aiStatus]);

  const displayedAiProgress = aiStatus === 'loading'
    ? Math.max(aiProgressPercent ?? 0, pseudoAiProgress)
    : aiProgressPercent ?? 0;
  const currentStep = steps[currentIndex];
  const previousStep = currentIndex > 0 ? steps[currentIndex - 1] : undefined;
  const supportsBuilder = (simulationInput.kind === 'graph' || simulationInput.kind === 'tree')
    && Boolean(simulationInput.graph);
  const showBuilder = supportsBuilder && (isEditingInput || !currentStep);
  const panelTitle = showBuilder ? t('inputBuilder', locale) : t('simulationView', locale);
  const currentVariables = currentStep?.visualData.vars ?? {};
  const previousVariables = previousStep?.visualData.vars ?? {};
  const pinnedEntries = pinnedVariables.map((name) => {
    const available = Object.prototype.hasOwnProperty.call(currentVariables, name);
    return {
      name,
      value: available ? currentVariables[name] : null,
      available,
      changed: available
        && JSON.stringify(currentVariables[name]) !== JSON.stringify(previousVariables[name]),
    };
  });

  if (collapsed) {
    return (
      <div className="dynamic-visualizer">
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
    <>
      {showAiLoadProgress && aiStatus === 'loading' && !collapsed && (
        <div className="ai-progress-bar-container">
          <div className="ai-progress-bar" style={{ width: `${displayedAiProgress}%` }} />
        </div>
      )}

      {modelLoadNotice && !collapsed && (
        <div
          className={`ai-model-load-notice ${modelLoadNotice}`}
          role="status"
          aria-live="polite"
        >
          {modelLoadNotice === 'loading'
            ? <LoaderCircle size={16} className="ai-model-notice-spinner" />
            : <CheckCircle2 size={16} />}
          <span>
            {modelLoadNotice === 'loading'
              ? t('modelLoadingNotice', locale)
              : t('modelLoadedNotice', locale)}
          </span>
          {modelLoadNotice === 'loading' && (
            <strong>{displayedAiProgress}%</strong>
          )}
        </div>
      )}
      
      {showAiLoadWarning && !modelLoadNotice && (aiStatus === 'idle' || aiStatus === 'error' || aiStatus === 'unsupported') && !collapsed && (
        <div className="ai-load-warning-banner">
          <span>{aiStatus === 'unsupported' ? 'Yapay Zeka bu tarayıcıda desteklenmiyor.' : 'Model Yüklenmedi! Gelişmiş özellikler için lütfen modeli yükleyin.'}</span>
          <div className="banner-actions">
            {aiStatus !== 'unsupported' && (
              <button type="button" className="action-btn load-btn" onClick={handleLoadModel}>Yükle</button>
            )}
            <button type="button" className="action-btn hide-btn" onClick={() => setShowAiLoadWarning(false)}>Gizle</button>
          </div>
        </div>
      )}
      <div className="dynamic-visualizer">
      <div className="visualizer-header">
        <h2>{panelTitle}</h2>
        <div className="visualizer-header-actions">
          {supportsBuilder && (
            <div className="visualizer-mode-toggle">
              {!showBuilder && (
                <button type="button" onClick={() => setIsEditingInput(true)}>
                  {t('editInput', locale)}
                </button>
              )}
              {showBuilder && currentStep && (
                <button type="button" onClick={() => setIsEditingInput(false)}>
                  {t('showSimulation', locale)}
                </button>
              )}
            </div>
          )}
          {!showBuilder && currentStep && <span>{currentIndex + 1} / {steps.length}</span>}
          <button
            type="button"
            className="panel-toggle"
            aria-label={t('collapsePanel', locale, { panel: panelTitle })}
            onClick={onToggleCollapse}
          >
            −
          </button>
        </div>
      </div>
      {!showBuilder && pinnedEntries.length > 0 && (
        <section className="pinned-watch-strip" aria-label={t('pinnedVariables', locale)}>
          <span className="pinned-watch-title">{t('pinnedVariables', locale)}</span>
          <div className="pinned-watch-list">
            {pinnedEntries.map(({ name, value, available, changed }) => (
              <div
                key={name}
                className={`pinned-watch-item ${changed ? 'changed' : ''} ${available ? '' : 'unavailable'}`}
              >
                <span className="pinned-watch-name">{name}</span>
                <span className="pinned-watch-value">
                  {available ? formatPinnedValue(value) : t('variableUnavailable', locale)}
                </span>
                <button
                  type="button"
                  aria-label={t('unpinVariable', locale, { name })}
                  onClick={() => togglePinnedVariable(name)}
                >
                  <PinOff size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {showBuilder && simulationInput.graph ? (
        <GraphInputEditor
          document={simulationInput.graph}
          locale={locale}
          onChange={(graph) => setSimulationInput({
            kind: graph.mode,
            text: JSON.stringify(graph),
            graph,
          })}
          onError={setInputError}
        />
      ) : currentStep ? (
        <>
          <div className="visualizer-content"><VisualDataView visualData={currentStep.visualData} /></div>
          <div className="step-explanation">
            <strong>{localizeAlgorithmName(algorithmName, locale)}</strong>
            <span>{translateRuntimeText(currentStep.explanation, locale)}</span>
          </div>
        </>
      ) : (
        <div className="visualizer-empty">
          <div className="scanning-line" />
          <p>{t('awaitingData', locale)}</p>
        </div>
      )}
    </div>
    </>
  );
};
