import { useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { GraphDocumentV1, GraphNode } from '../types/simulation';
import { parseBinaryTree, validateGraphDocument } from '../services/inputParsers';
import { t, translateRuntimeText } from '../i18n/translations';
import type { Locale } from '../i18n/translations';
import './GraphInputEditor.css';

interface GraphInputEditorProps {
  document: GraphDocumentV1;
  onChange: (document: GraphDocumentV1) => void;
  onError: (message: string | null) => void;
  locale: Locale;
}

const nextNodeId = (nodes: GraphNode[]): string => {
  const numericIds = nodes.map((node) => Number(node.id)).filter(Number.isFinite);
  return numericIds.length === nodes.length
    ? String(Math.max(0, ...numericIds) + 1)
    : `n${nodes.length + 1}`;
};

export const GraphInputEditor = ({
  document,
  onChange,
  onError,
  locale,
}: GraphInputEditorProps) => {
  const [serialized, setSerialized] = useState('');
  const [from, setFrom] = useState(document.startId);
  const [to, setTo] = useState(document.nodes[1]?.id ?? document.startId);
  const [weight, setWeight] = useState('1');
  const [dragging, setDragging] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const exportJson = useMemo(() => JSON.stringify(document, null, 2), [document]);

  const addNodeAt = (x: number, y: number) => {
    const id = nextNodeId(document.nodes);
    const nodes = [...document.nodes, { id, label: id, x, y }];
    const candidate = {
      ...document,
      nodes,
      startId: document.startId || id,
      rootId: document.mode === 'tree' ? document.rootId || id : document.rootId,
    };
    onChange(candidate);
    setFrom(document.nodes.at(-1)?.id ?? id);
    setTo(id);
    onError(null);
  };

  const positionFromEvent = (event: ReactMouseEvent<HTMLDivElement>) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 50, y: 50 };
    return {
      x: Math.min(96, Math.max(4, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.min(94, Math.max(6, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
  };

  const addEdge = () => {
    if (from === to) {
      onError(translateRuntimeText('Choose two different nodes.', locale));
      return;
    }
    if (document.edges.some((edge) => edge.from === from && edge.to === to)) {
      onError(translateRuntimeText('That edge already exists.', locale));
      return;
    }
    const parsedWeight = Number(weight);
    if (document.weighted && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      onError(translateRuntimeText('Weight must be a non-negative number.', locale));
      return;
    }
    onChange({
      ...document,
      edges: [...document.edges, {
        id: `e-${crypto.randomUUID()}`,
        from,
        to,
        weight: document.weighted ? parsedWeight : undefined,
      }],
    });
    onError(null);
  };

  const removeNode = (id: string) => {
    if (document.nodes.length === 1) {
      onError(translateRuntimeText('A graph must keep at least one node.', locale));
      return;
    }
    const nodes = document.nodes.filter((node) => node.id !== id);
    const edges = document.edges.filter((edge) => edge.from !== id && edge.to !== id);
    const fallback = nodes[0].id;
    onChange({
      ...document,
      nodes,
      edges,
      startId: document.startId === id ? fallback : document.startId,
      rootId: document.rootId === id ? fallback : document.rootId,
      targetId: document.targetId === id ? undefined : document.targetId,
    });
    onError(null);
  };

  const handleImport = (asTree: boolean) => {
    try {
      const imported = asTree
        ? parseBinaryTree(serialized)
        : validateGraphDocument(JSON.parse(serialized));
      onChange(imported);
      onError(null);
    } catch (error) {
      onError(translateRuntimeText(error instanceof Error ? error.message : 'Import failed.', locale));
    }
  };

  return (
    <div className="graph-input-editor">
      <div className="graph-toolbar">
        <label>
          {t('mode', locale)}
          <select
            value={document.mode}
            onChange={(event) => onChange({
              ...document,
              mode: event.target.value as 'tree' | 'graph',
              directed: event.target.value === 'tree' ? true : document.directed,
              rootId: event.target.value === 'tree' ? document.rootId ?? document.startId : document.rootId,
            })}
          >
            <option value="graph">{t('graph', locale)}</option>
            <option value="tree">{t('tree', locale)}</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={document.directed}
            disabled={document.mode === 'tree'}
            onChange={(event) => onChange({ ...document, directed: event.target.checked })}
          />
          {t('directed', locale)}
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={document.weighted}
            onChange={(event) => onChange({
              ...document,
              weighted: event.target.checked,
              edges: document.edges.map((edge) => ({
                ...edge,
                weight: event.target.checked ? edge.weight ?? 1 : undefined,
              })),
            })}
          />
          {t('weighted', locale)}
        </label>
        <label>
          {t('start', locale)}
          <select value={document.startId} onChange={(event) => onChange({ ...document, startId: event.target.value })}>
            {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
          </select>
        </label>
        {document.mode === 'tree' && (
          <label>
            {t('root', locale)}
            <select value={document.rootId} onChange={(event) => onChange({ ...document, rootId: event.target.value, startId: event.target.value })}>
              {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
            </select>
          </label>
        )}
        <label>
          {t('target', locale)}
          <select value={document.targetId ?? ''} onChange={(event) => onChange({ ...document, targetId: event.target.value || undefined })}>
            <option value="">{t('none', locale)}</option>
            {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
          </select>
        </label>
      </div>

      <div
        className="graph-builder-canvas"
        ref={canvasRef}
        onDoubleClick={(event) => {
          const position = positionFromEvent(event);
          addNodeAt(position.x, position.y);
        }}
        onMouseMove={(event) => {
          if (!dragging) return;
          const position = positionFromEvent(event);
          onChange({
            ...document,
            nodes: document.nodes.map((node) => node.id === dragging ? { ...node, ...position } : node),
          });
        }}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
        aria-label={t('graphCanvas', locale)}
      >
        <svg className="builder-edges" aria-hidden="true">
          {document.edges.map((edge) => {
            const start = document.nodes.find((node) => node.id === edge.from);
            const end = document.nodes.find((node) => node.id === edge.to);
            if (!start || !end) return null;
            return (
              <g key={edge.id}>
                <line x1={`${start.x}%`} y1={`${start.y}%`} x2={`${end.x}%`} y2={`${end.y}%`} />
                {document.weighted && (
                  <text x={`${(start.x + end.x) / 2}%`} y={`${(start.y + end.y) / 2}%`}>{edge.weight ?? 1}</text>
                )}
              </g>
            );
          })}
        </svg>
        {document.nodes.map((node) => (
          <button
            type="button"
            key={node.id}
            className="builder-node"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onMouseDown={(event) => {
              event.stopPropagation();
              setDragging(node.id);
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              removeNode(node.id);
            }}
            title={t('nodeMoveTitle', locale)}
          >
            {node.label}
          </button>
        ))}
        <span className="canvas-hint">{t('canvasHint', locale)}</span>
      </div>

      <div className="edge-controls">
        <select value={from} onChange={(event) => setFrom(event.target.value)}>
          {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
        </select>
        <span>→</span>
        <select value={to} onChange={(event) => setTo(event.target.value)}>
          {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
        </select>
        {document.weighted && (
          <input aria-label={t('edgeWeight', locale)} type="number" min="0" value={weight} onChange={(event) => setWeight(event.target.value)} />
        )}
        <button type="button" onClick={addEdge}>{t('addEdge', locale)}</button>
        <button
          type="button"
          onClick={() => onChange({ ...document, edges: document.edges.slice(0, -1) })}
          disabled={document.edges.length === 0}
        >
          {t('undoEdge', locale)}
        </button>
      </div>

      <details className="graph-import-export">
        <summary>{t('importExport', locale)}</summary>
        <p>{t('importHelp', locale)}</p>
        <textarea
          value={serialized}
          onChange={(event) => setSerialized(event.target.value)}
          placeholder={exportJson}
        />
        <div>
          <button type="button" onClick={() => handleImport(false)}>{t('importJson', locale)}</button>
          <button type="button" onClick={() => handleImport(true)}>{t('importTree', locale)}</button>
          <button type="button" onClick={() => setSerialized(exportJson)}>{t('exportEditor', locale)}</button>
        </div>
      </details>
    </div>
  );
};
