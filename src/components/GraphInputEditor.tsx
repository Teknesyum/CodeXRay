import { useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { GraphDocumentV1, GraphNode } from '../types/simulation';
import { parseBinaryTree, validateGraphDocument } from '../services/inputParsers';
import './GraphInputEditor.css';

interface GraphInputEditorProps {
  document: GraphDocumentV1;
  onChange: (document: GraphDocumentV1) => void;
  onError: (message: string | null) => void;
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
      onError('Choose two different nodes.');
      return;
    }
    if (document.edges.some((edge) => edge.from === from && edge.to === to)) {
      onError('That edge already exists.');
      return;
    }
    const parsedWeight = Number(weight);
    if (document.weighted && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      onError('Weight must be a non-negative number.');
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
      onError('A graph must keep at least one node.');
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
      onError(error instanceof Error ? error.message : 'Import failed.');
    }
  };

  return (
    <div className="graph-input-editor">
      <div className="graph-toolbar">
        <label>
          Mode
          <select
            value={document.mode}
            onChange={(event) => onChange({
              ...document,
              mode: event.target.value as 'tree' | 'graph',
              directed: event.target.value === 'tree' ? true : document.directed,
              rootId: event.target.value === 'tree' ? document.rootId ?? document.startId : document.rootId,
            })}
          >
            <option value="graph">Graph</option>
            <option value="tree">Tree</option>
          </select>
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={document.directed}
            disabled={document.mode === 'tree'}
            onChange={(event) => onChange({ ...document, directed: event.target.checked })}
          />
          Directed
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
          Weighted
        </label>
        <label>
          Start
          <select value={document.startId} onChange={(event) => onChange({ ...document, startId: event.target.value })}>
            {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
          </select>
        </label>
        {document.mode === 'tree' && (
          <label>
            Root
            <select value={document.rootId} onChange={(event) => onChange({ ...document, rootId: event.target.value, startId: event.target.value })}>
              {document.nodes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}
            </select>
          </label>
        )}
        <label>
          Target
          <select value={document.targetId ?? ''} onChange={(event) => onChange({ ...document, targetId: event.target.value || undefined })}>
            <option value="">None</option>
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
        aria-label="Graph builder canvas. Double-click to add a node."
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
            title="Drag to move; double-click to remove"
          >
            {node.label}
          </button>
        ))}
        <span className="canvas-hint">Double-click empty space to add · drag to move · double-click a node to remove</span>
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
          <input aria-label="Edge weight" type="number" min="0" value={weight} onChange={(event) => setWeight(event.target.value)} />
        )}
        <button type="button" onClick={addEdge}>Add edge</button>
        <button
          type="button"
          onClick={() => onChange({ ...document, edges: document.edges.slice(0, -1) })}
          disabled={document.edges.length === 0}
        >
          Undo edge
        </button>
      </div>

      <details className="graph-import-export">
        <summary>Import / export</summary>
        <p>Tree: level-order JSON such as <code>[1,2,3,null,4]</code>. Graph: GraphDocumentV1 JSON.</p>
        <textarea
          value={serialized}
          onChange={(event) => setSerialized(event.target.value)}
          placeholder={exportJson}
        />
        <div>
          <button type="button" onClick={() => handleImport(false)}>Import JSON</button>
          <button type="button" onClick={() => handleImport(true)}>Import level-order tree</button>
          <button type="button" onClick={() => setSerialized(exportJson)}>Export to editor</button>
        </div>
      </details>
    </div>
  );
};
