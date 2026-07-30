import { useTimeline } from '../context/TimelineContext';
import type { ArrayVisualData, GraphVisualData, VisualData } from '../types/simulation';
import { t } from '../i18n/translations';
import './DynamicVisualizer.css';

const pointerColors = ['var(--neon-lime)', 'var(--neon-magenta)', 'var(--neon-cyan)', '#ff9900'];

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

const GraphView = ({ data }: { data: GraphVisualData }) => (
  <div className="visual-graph">
    <svg className="graph-edges" aria-label="Graph edges">
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
        title={`Node ${node.label}: ${node.state ?? 'idle'}`}
      >
        {node.label}
      </div>
    ))}
    <div className="graph-legend" aria-label="Graph state legend">
      <span className="legend-queued">Queued</span>
      <span className="legend-active">Active</span>
      <span className="legend-visited">Visited</span>
      <span className="legend-path">Path</span>
    </div>
  </div>
);

const renderVisualData = (visualData: VisualData) => {
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

export const DynamicVisualizer = () => {
  const { steps, currentIndex } = useTimeline();
  const currentStep = steps[currentIndex];
  if (!currentStep) {
    return (
      <div className="visualizer-empty">
        <div className="scanning-line" />
        <p>{t('awaitingData')}</p>
      </div>
    );
  }
  return (
    <div className="dynamic-visualizer">
      <div className="visualizer-header">
        <h2>{t('simulationView')}</h2>
        <span>{currentIndex + 1} / {steps.length}</span>
      </div>
      <div className="visualizer-content">{renderVisualData(currentStep.visualData)}</div>
    </div>
  );
};
