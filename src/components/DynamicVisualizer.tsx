import { CheckCircle2, LoaderCircle, Maximize2, Minimize2, PinOff } from 'lucide-react';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTimeline } from '../context/TimelineContext';
import type {
  ArrayVisualData,
  GraphVisualData,
  MatrixVisualData,
  StringMatchVisualData,
  BarVisualData,
  IntervalVisualData,
  RowsVisualData,
  TraceValue,
  VisualData,
} from '../types/simulation';
import { localizeAlgorithmName, t, translateRuntimeText } from '../i18n/translations';
import { GraphInputEditor } from './GraphInputEditor';
import { isVisualizationV2 } from '../services/visualizationDesigner';
import { calculateVisualAutoFitScale } from '../services/visualAutoFit';
import './DynamicVisualizer.css';

const TopologicalOutput = lazy(() => import('./TopologicalOutput'));

const pointerColors = ['var(--neon-lime)', 'var(--neon-magenta)', 'var(--neon-cyan)', '#ff9900'];

const formatPinnedValue = (value: TraceValue, locale: 'en' | 'tr'): string =>
  typeof value === 'string' ? translateRuntimeText(value, locale) : JSON.stringify(value);

const AutoFitVisual = ({
  children,
  fitKey,
  fill = false,
}: {
  children: ReactNode;
  fitKey: string;
  fill?: boolean;
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || fill) {
      setScale(1);
      return;
    }

    const measure = () => {
      const nextScale = calculateVisualAutoFitScale(
        Math.max(0, viewport.clientWidth - 12),
        Math.max(0, viewport.clientHeight - 12),
        Math.max(content.scrollWidth, content.offsetWidth),
        Math.max(content.scrollHeight, content.offsetHeight),
      );
      setScale((current) => Math.abs(current - nextScale) < 0.001 ? current : nextScale);
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measure);
    observer?.observe(viewport);
    observer?.observe(content);
    window.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fill, fitKey]);

  return (
    <div
      ref={viewportRef}
      className={`visual-auto-fit-viewport ${fill ? 'fill' : 'intrinsic'}`}
      data-auto-scaled={scale < 0.999 ? 'true' : 'false'}
      data-visual-scale={scale.toFixed(3)}
    >
      <div
        ref={contentRef}
        className="visual-auto-fit-content"
        style={{ '--visual-auto-scale': scale } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
};

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
  const { locale, activeSimulationPackage } = useTimeline();
  const legend = activeSimulationPackage
    && isVisualizationV2(activeSimulationPackage.visualization)
    ? activeSimulationPackage.visualization.legend
    : null;
  const traceRecord = (key: string): Record<string, TraceValue> | null => {
    const value = data.vars[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, TraceValue>
      : null;
  };
  const distances = traceRecord('distances');
  const fScores = traceRecord('fScores');
  const components = traceRecord('components');
  const componentOf = traceRecord('componentOf');
  const indegree = traceRecord('indegree');
  const keys = traceRecord('keys');
  const levels = traceRecord('level');
  const colors = traceRecord('colors');
  const nodeBadge = (nodeId: string): string | null => {
    if (fScores?.[nodeId] !== undefined) return `f:${String(fScores[nodeId])}`;
    if (distances?.[nodeId] !== undefined) return `d:${String(distances[nodeId])}`;
    if (keys?.[nodeId] !== undefined) return `k:${String(keys[nodeId])}`;
    if (levels?.[nodeId] !== undefined) return `L:${String(levels[nodeId])}`;
    if (colors?.[nodeId] !== undefined) return `c:${String(colors[nodeId])}`;
    if (indegree?.[nodeId] !== undefined) return `in:${String(indegree[nodeId])}`;
    if (componentOf?.[nodeId] !== undefined) return `SCC:${String(componentOf[nodeId])}`;
    if (components?.[nodeId] !== undefined) return `C:${String(components[nodeId])}`;
    return null;
  };
  const phase = typeof data.vars.phase === 'string' ? data.vars.phase : null;
  const decision = typeof data.vars.decision === 'string' ? data.vars.decision : null;
  const isTopological = phase?.startsWith('Topological Sort') ?? false;
  return (
    <div className={`visual-graph ${isTopological ? 'topological-graph' : ''}`}>
      <div className="graph-stage">
      <svg className="graph-edges" aria-label={t('graphEdges', locale)}>
        <defs>
          <marker id="arrow-idle" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(0, 243, 255, 0.45)" />
          </marker>
          <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#ff00ff" />
          </marker>
          <marker id="arrow-rejected" markerWidth="8" markerHeight="8" refX="22" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#ff5b6e" />
          </marker>
        </defs>
        {data.edges.map((edge) => {
          const start = data.nodes.find((node) => node.id === edge.from);
          const end = data.nodes.find((node) => node.id === edge.to);
          if (!start || !end) return null;
          const state = edge.state ?? 'idle';
          const edgeStyle = edge.semanticStyle;
          const marker = data.directed
            ? `url(#arrow-${state === 'idle' ? 'idle' : state === 'rejected' ? 'rejected' : 'active'})`
            : undefined;
          return (
            <g
              key={edge.id}
              className={`graph-edge ${state}`}
              data-semantic-roles={edge.semanticRoles?.join(' ') ?? ''}
              role="img"
              aria-label={`${t('edge', locale)} ${start.label} → ${end.label}: ${t(state, locale)}${edge.semanticRoles?.length ? ` — ${edge.semanticRoles.join(', ')}` : ''}`}
            >
              <line
                x1={`${start.x}%`}
                y1={`${start.y}%`}
                x2={`${end.x}%`}
                y2={`${end.y}%`}
                markerEnd={marker}
                style={edgeStyle ? {
                  stroke: edgeStyle.color,
                  strokeWidth: edgeStyle.width,
                  opacity: edgeStyle.opacity,
                } : undefined}
              />
              {(edge.displayLabel !== undefined || edge.weight !== undefined) && (
                <text x={`${(start.x + end.x) / 2}%`} y={`${(start.y + end.y) / 2}%`}>
                  {edge.displayLabel ?? edge.weight}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {data.nodes.map((node) => (
        <div
          key={node.id}
          className={`graph-node node-${node.state ?? 'idle'} shape-${node.semanticStyle?.shape ?? 'circle'} ${node.semanticStyle?.pulse ? `pulse-${node.semanticStyle.pulse}` : ''}`}
          data-semantic-roles={node.semanticRoles?.join(' ') ?? ''}
          role="img"
          aria-label={`${t('node', locale)} ${node.label}: ${t(node.state ?? 'idle', locale)}${node.semanticRoles?.length ? ` — ${node.semanticRoles.join(', ')}` : ''}`}
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: node.semanticStyle ? `${node.semanticStyle.size}px` : undefined,
            height: node.semanticStyle ? `${node.semanticStyle.size}px` : undefined,
            borderColor: node.semanticStyle?.stroke,
            background: node.semanticStyle?.fill,
            '--node-glow-color': node.semanticStyle?.stroke,
            '--node-glow-strength': node.semanticStyle?.glow ?? 0.5,
          } as CSSProperties}
          title={`${t('node', locale)} ${node.label}: ${t(node.state ?? 'idle', locale)}${node.semanticRoles?.length ? ` — ${node.semanticRoles.join(', ')}` : ''}`}
        >
          <span className="graph-node-label">{node.label}</span>
          {nodeBadge(node.id) && <small className="graph-node-badge">{nodeBadge(node.id)}</small>}
        </div>
      ))}
      </div>
      {isTopological && (
        <Suspense fallback={null}><TopologicalOutput locale={locale} nodeCount={data.nodes.length} vars={data.vars} /></Suspense>
      )}
      {(phase || decision) && (
        <div className="graph-teaching-hud" role="status">
          {phase && <strong>{translateRuntimeText(phase, locale)}</strong>}
          {decision && <span>{translateRuntimeText(decision, locale)}</span>}
        </div>
      )}
      <div className="graph-legend" aria-label={t('graphLegend', locale)}>
        {legend ? legend.map((item) => (
          <span
            key={item.role}
            className={`semantic-legend shape-${item.shape ?? 'circle'}`}
            style={{ '--legend-color': item.color } as CSSProperties}
          >
            {item.label}
          </span>
        )) : (
          <>
            <span className="legend-queued">{t('queued', locale)}</span>
            <span className="legend-active">{t('active', locale)}</span>
            <span className="legend-visited">{t('visited', locale)}</span>
            <span className="legend-path">{t('path', locale)}</span>
            {data.edges.some((edge) => edge.state === 'rejected') && <span className="legend-rejected">{locale === 'tr' ? 'reddedildi' : 'rejected'}</span>}
            {(data.nodes.some((node) => node.state === 'removed') || data.edges.some((edge) => edge.state === 'removed'))
              && <span className="legend-removed">{t('removed', locale)}</span>}
          </>
        )}
      </div>
    </div>
  );
};

const MatrixView = ({ data }: { data: MatrixVisualData }) => {
  const { locale } = useTimeline();
  const phase = typeof data.vars.phase === 'string' ? data.vars.phase : null;
  const decision = typeof data.vars.decision === 'string' ? data.vars.decision : null;
  const roleAt = (row: number, column: number) =>
    data.highlights.find((cell) => cell.row === row && cell.column === column);
  return (
    <div className="visual-matrix-shell">
      {(phase || decision) && (
        <div className="matrix-teaching-hud" role="status">
          {phase && <strong>{translateRuntimeText(phase, locale)}</strong>}
          {decision && <span>{translateRuntimeText(decision, locale)}</span>}
        </div>
      )}
      <div className="matrix-fill-direction">
        {locale === 'tr' ? 'Dolum yönü' : 'Fill direction'}: {data.fillDirection === 'diagonal'
          ? locale === 'tr' ? 'köşegen / artan aralık' : 'diagonal / increasing interval'
          : data.fillDirection}
      </div>
      <div
        className="visual-matrix"
        role="grid"
        aria-label={locale === 'tr' ? 'DP tablosu' : 'DP table'}
        style={{ '--matrix-columns': data.columnLabels.length } as CSSProperties}
      >
        <div className="matrix-corner" aria-hidden="true">i\j</div>
        {data.columnLabels.map((label, column) => (
          <div className="matrix-axis-label column" role="columnheader" key={`column-${column}`}>{label}</div>
        ))}
        {data.values.map((row, rowIndex) => (
          <div className="matrix-row" role="row" key={`row-${rowIndex}`}>
            <div className="matrix-axis-label row" role="rowheader">{data.rowLabels[rowIndex]}</div>
            {row.map((value, columnIndex) => {
              const highlight = roleAt(rowIndex, columnIndex);
              const role = highlight?.role ?? (value === null ? 'empty' : 'computed');
              return (
                <div
                  key={`${rowIndex}-${columnIndex}`}
                  role="gridcell"
                  className={`matrix-cell matrix-${role}`}
                  data-row={rowIndex}
                  data-column={columnIndex}
                  data-role={role}
                  aria-label={`dp[${rowIndex}][${columnIndex}]: ${value ?? (locale === 'tr' ? 'boş' : 'empty')}; ${highlight?.label ?? role}`}
                  title={highlight?.label ?? `dp[${rowIndex}][${columnIndex}]`}
                >
                  <span className="matrix-coordinate">{rowIndex},{columnIndex}</span>
                  <strong>{value ?? '·'}</strong>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="matrix-legend" aria-label={locale === 'tr' ? 'DP tablo açıklaması' : 'DP table legend'}>
        <span className="legend-base">{locale === 'tr' ? 'Taban durum' : 'Base case'}</span>
        <span className="legend-dependency">{locale === 'tr' ? 'Bağımlılık' : 'Dependency'}</span>
        <span className="legend-active">{locale === 'tr' ? 'Hesaplanan hücre' : 'Active cell'}</span>
        <span className="legend-result">{locale === 'tr' ? 'Nihai sonuç' : 'Final result'}</span>
      </div>
    </div>
  );
};

const StringMatchView = ({ data }: { data: StringMatchVisualData }) => {
  const { locale } = useTimeline();
  const activeText = new Set(data.activeText ?? []);
  const activePattern = new Set(data.activePattern ?? []);
  const matchedText = new Set(data.matchedText ?? []);
  const cell = (character: string, index: number, row: 'text' | 'pattern') => {
    const textIndex = row === 'text' ? index : index + (data.alignment ?? 0);
    const state = row === 'text'
      ? data.mismatchText === index ? 'mismatch' : activeText.has(index) ? 'active' : matchedText.has(index) ? 'matched' : 'idle'
      : activePattern.has(index) ? 'active' : 'idle';
    return <span key={`${row}-${index}`} className={`string-cell string-${state}`} data-index={textIndex}><small>{textIndex}</small>{character}</span>;
  };
  const phase = typeof data.vars.phase === 'string' ? data.vars.phase : null;
  return (
    <div className="string-match-view" role="region" aria-label={locale === 'tr' ? 'Dizge eşleştirme görünümü' : 'String matching view'}>
      {phase && <strong className="string-phase" role="status">{translateRuntimeText(phase, locale)}</strong>}
      <div className="string-row"><b>{locale === 'tr' ? 'Metin' : 'Text'}</b>{[...data.text].map((char, index) => cell(char, index, 'text'))}</div>
      {data.pattern !== undefined && (
        <div className="string-row pattern-row" style={{ '--pattern-offset': data.alignment ?? 0 } as CSSProperties}>
          <b>{locale === 'tr' ? 'Desen' : 'Pattern'}</b><span className="pattern-offset" />
          {[...data.pattern].map((char, index) => cell(char, index, 'pattern'))}
        </div>
      )}
      {data.window && <div className="string-window-label">[{data.window[0]}, {data.window[1]}]</div>}
    </div>
  );
};

const BarView = ({ data }: { data: BarVisualData }) => {
  const { locale } = useTimeline();
  const maximum = Math.max(1, ...data.values.map((value, index) => value + (data.water[index] ?? 0)));
  return <div className="bar-view" role="img" aria-label={locale === 'tr' ? 'Yükseklik çubukları ve biriken su' : 'Height bars and trapped water'}>{data.values.map((value, index) => (
    <div className="bar-column" key={index} role="img" aria-label={locale === 'tr'
      ? `Sütun ${index}: yükseklik ${value}, su ${data.water[index] ?? 0}`
      : `Column ${index}: height ${value}, water ${data.water[index] ?? 0}`}>
      <span className="water-block" style={{ height: `${((data.water[index] ?? 0) / maximum) * 180}px` }}>{data.water[index] || ''}</span>
      <span className="height-block" style={{ height: `${(value / maximum) * 180}px` }}>{value}</span>
      <small>{index}</small>
      {Object.entries(data.pointers ?? {}).filter(([, at]) => at === index).map(([name]) => <b key={name}>{name}</b>)}
    </div>
  ))}</div>;
};

const IntervalView = ({ data }: { data: IntervalVisualData }) => {
  const { locale } = useTimeline();
  const domain = [...data.intervals, ...data.merged, ...(data.current ? [data.current] : [])];
  if (domain.length === 0) return <div className="interval-view" role="region" aria-label={locale === 'tr' ? 'Sayı doğrusundaki aralıklar' : 'Intervals on number line'} />;
  const minimum = Math.min(...domain.map(([start]) => start));
  const maximum = Math.max(...domain.map(([, end]) => end));
  const span = Math.max(1, maximum - minimum);
  return <div className="interval-view" role="region" aria-label={locale === 'tr' ? 'Sayı doğrusundaki aralıklar' : 'Intervals on number line'}>
    {[...data.intervals, ...data.merged].map(([start, end], index) => {
      const merged = index >= data.intervals.length;
      const current = data.current?.[0] === start && data.current?.[1] === end;
      return <div className={`interval-line ${merged ? 'interval-merged' : ''} ${current ? 'interval-current' : ''}`} key={`${merged}-${index}`}
        role="img" aria-label={locale === 'tr'
          ? `${merged ? 'Birleşmiş' : 'Girdi'} aralığı ${start} ile ${end}${current ? ', geçerli' : ''}`
          : `${merged ? 'Merged' : 'Input'} interval ${start} to ${end}${current ? ', current' : ''}`}>
        <span style={{ left: `${((start - minimum) / span) * 100}%`, width: `${((end - start) / span) * 100}%` }}>{start}–{end}</span>
      </div>;
    })}
  </div>;
};

const RowsView = ({ data }: { data: RowsVisualData }) => {
  const { locale } = useTimeline();
  return <div className={`rows-view rows-${data.mode}`} role="grid" aria-label={locale === 'tr' ? `${data.mode} öğretim satırları` : `${data.mode} teaching rows`}>
  {data.rows.map((row, rowIndex) => <div className="rows-line" key={`${row.label}-${rowIndex}`} role="row">
    <b>{translateRuntimeText(row.label, locale)}</b>
    <div className="rows-cells">{row.values.map((value, column) => {
      const role = data.active?.find((cell) => cell.row === rowIndex && cell.column === column)?.role ?? 'idle';
      return <span className={`rows-cell rows-${role}`} key={column} role="gridcell" aria-label={`${translateRuntimeText(row.label, locale)}[${column}]: ${String(value)}; ${translateRuntimeText(role, locale)}`}><small>{column}</small>{String(value)}</span>;
    })}</div>
  </div>)}
</div>;
};

const VisualDataView = ({ visualData }: { visualData: VisualData }) => {
  if (visualData.type === 'array') return <ArrayView data={visualData} />;
  if (visualData.type === 'graph') return <GraphView data={visualData} />;
  if (visualData.type === 'matrix') return <MatrixView data={visualData} />;
  if (visualData.type === 'string-match') return <StringMatchView data={visualData} />;
  if (visualData.type === 'bars') return <BarView data={visualData} />;
  if (visualData.type === 'intervals') return <IntervalView data={visualData} />;
  if (visualData.type === 'rows') return <RowsView data={visualData} />;
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
  maximized?: boolean;
  onToggleCollapse: () => void;
  onToggleMaximize?: () => void;
}

export const DynamicVisualizer = ({
  collapsed,
  maximized = false,
  onToggleCollapse,
  onToggleMaximize = () => undefined,
}: DynamicVisualizerProps) => {
  const {
    algorithmName,
    steps,
    currentIndex,
    simulationInput,
    applyGraphTransaction,
    setInputError,
    locale,
    isEditingInput,
    setIsEditingInput,
    pinnedVariables,
    togglePinnedVariable,
    aiStatus,
    aiModel,
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

  const handleOpenAiSettings = () => window.dispatchEvent(new Event('codexray:openAiSettings'));

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
  const showBuilder = supportsBuilder && isEditingInput;
  const panelTitle = showBuilder ? t('inputBuilder', locale) : t('simulationView', locale);
  const modeToggle = supportsBuilder ? (
    <div className="visualizer-mode-toggle">
      <button
        type="button"
        aria-pressed={showBuilder}
        onClick={() => setIsEditingInput(!showBuilder)}
      >
        {showBuilder ? t('showSimulation', locale) : t('editInput', locale)}
      </button>
    </div>
  ) : null;
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
          {modeToggle}
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
              ? `${t('modelLoadingNotice', locale)} ${aiModel}`
              : t('modelLoadedNotice', locale)}
          </span>
          {modelLoadNotice === 'loading' && (
            <strong>{displayedAiProgress}%</strong>
          )}
        </div>
      )}
      
      {showAiLoadWarning && !modelLoadNotice && (aiStatus === 'idle' || aiStatus === 'error' || aiStatus === 'unsupported') && !collapsed && (
        <div className="ai-load-warning-banner">
          <span>{t(aiStatus === 'unsupported' ? 'aiUnsupportedBrowser' : 'aiModelMissing', locale)}</span>
          <div className="banner-actions">
            {aiStatus !== 'unsupported' && (
              <button type="button" className="action-btn load-btn" onClick={handleLoadModel}>{t('load', locale)}</button>
            )}
            <button type="button" className="action-btn hide-btn" onClick={() => setShowAiLoadWarning(false)}>{t('hide', locale)}</button>
            <button type="button" className="action-btn" aria-label={t('localAiConfigure', locale)} onClick={handleOpenAiSettings}>{t('settings', locale)}</button>
          </div>
        </div>
      )}
      <div className="dynamic-visualizer">
      <div className="visualizer-header">
        <h2>{panelTitle}</h2>
        <div className="visualizer-header-actions">
          {modeToggle}
          {!showBuilder && currentStep && <span>{currentIndex + 1} / {steps.length}</span>}
          <button
            type="button"
            className={`visualizer-maximize-btn ${maximized ? 'active' : ''}`}
            aria-label={t(maximized ? 'minimizeSimulationPanel' : 'maximizeSimulationPanel', locale)}
            title={t(maximized ? 'minimizeSimulationPanel' : 'maximizeSimulationPanel', locale)}
            onClick={onToggleMaximize}
          >
            {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
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
                  {available ? formatPinnedValue(value, locale) : t('variableUnavailable', locale)}
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
          onChange={applyGraphTransaction}
          onError={setInputError}
        />
      ) : currentStep ? (
        <>
          <div className="visualizer-content">
            <AutoFitVisual
              fitKey={`${currentIndex}:${currentStep.visualData.type}`}
              fill={currentStep.visualData.type === 'graph'}
            >
              <VisualDataView visualData={currentStep.visualData} />
            </AutoFitVisual>
          </div>
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
