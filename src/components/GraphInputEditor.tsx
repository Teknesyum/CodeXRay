import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import type { GraphDocumentV1, GraphNode } from '../types/simulation';
import { parseBinaryTree, validateGraphDocument } from '../services/inputParsers';
import { nextNodeId } from '../services/graphEditorUtils';
import { t, translateRuntimeText } from '../i18n/translations';
import type { Locale } from '../i18n/translations';
import './GraphInputEditor.css';

interface GraphInputEditorProps {
  document: GraphDocumentV1;
  onChange: (document: GraphDocumentV1) => void;
  onError: (message: string | null) => void;
  locale: Locale;
}

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
  const [edgeDrag, setEdgeDrag] = useState<{
    from: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draftNodeId, setDraftNodeId] = useState('');
  const [draftNodeLabel, setDraftNodeLabel] = useState('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const exportJson = useMemo(() => JSON.stringify(document, null, 2), [document]);
  const selectedNode = document.nodes.find((node) => node.id === selectedNodeId);

  useEffect(() => {
    if (!document.nodes.some((node) => node.id === from)) {
      setFrom(document.startId);
    }
    if (!document.nodes.some((node) => node.id === to)) {
      setTo(document.nodes.find((node) => node.id !== document.startId)?.id ?? document.startId);
    }
    if (selectedNodeId && !document.nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [document.nodes, document.startId, from, selectedNodeId, to]);

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

  const positionFromEvent = (
    event: Pick<ReactMouseEvent<HTMLDivElement>, 'clientX' | 'clientY'>,
  ) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 50, y: 50 };
    return {
      x: Math.min(96, Math.max(4, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.min(94, Math.max(6, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
  };

  const addEdgeBetween = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      onError(translateRuntimeText('Choose two different nodes.', locale));
      return false;
    }
    const edgeExists = document.edges.some((edge) =>
      (edge.from === sourceId && edge.to === targetId)
      || (!document.directed && edge.from === targetId && edge.to === sourceId),
    );
    if (edgeExists) {
      onError(translateRuntimeText('That edge already exists.', locale));
      return false;
    }
    const parsedWeight = Number(weight);
    if (document.weighted && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      onError(translateRuntimeText('Weight must be a non-negative number.', locale));
      return false;
    }
    onChange({
      ...document,
      edges: [...document.edges, {
        id: `e-${crypto.randomUUID()}`,
        from: sourceId,
        to: targetId,
        weight: document.weighted ? parsedWeight : undefined,
      }],
    });
    onError(null);
    return true;
  };

  const addEdge = () => addEdgeBetween(from, to);

  const selectNode = (node: GraphNode) => {
    setSelectedNodeId(node.id);
    setDraftNodeId(node.id);
    setDraftNodeLabel(node.label);
    onError(null);
  };

  const saveSelectedNode = () => {
    if (!selectedNode) return;
    const id = draftNodeId.trim();
    const label = draftNodeLabel.trim() || id;
    if (!id) {
      onError(t('nodeIdRequired', locale));
      return;
    }
    if (id !== selectedNode.id && document.nodes.some((node) => node.id === id)) {
      onError(t('nodeIdExists', locale));
      return;
    }
    const previousId = selectedNode.id;
    onChange({
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === previousId ? { ...node, id, label } : node,
      ),
      edges: document.edges.map((edge) => ({
        ...edge,
        from: edge.from === previousId ? id : edge.from,
        to: edge.to === previousId ? id : edge.to,
      })),
      startId: document.startId === previousId ? id : document.startId,
      rootId: document.rootId === previousId ? id : document.rootId,
      targetId: document.targetId === previousId ? id : document.targetId,
    });
    setFrom((current) => current === previousId ? id : current);
    setTo((current) => current === previousId ? id : current);
    setSelectedNodeId(id);
    setDraftNodeId(id);
    setDraftNodeLabel(label);
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
    setFrom((current) => current === id ? fallback : current);
    setTo((current) => current === id ? fallback : current);
    if (selectedNodeId === id) setSelectedNodeId(null);
    onError(null);
  };

  const handleImport = (asTree: boolean) => {
    try {
      const imported = asTree
        ? parseBinaryTree(serialized)
        : validateGraphDocument(JSON.parse(serialized));
      onChange(imported);
      setFrom(imported.startId);
      setTo(imported.nodes.find((node) => node.id !== imported.startId)?.id ?? imported.startId);
      setSelectedNodeId(null);
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
        onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (!edgeDrag) return;
          const position = positionFromEvent(event);
          setEdgeDrag({ ...edgeDrag, ...position });
        }}
        onPointerUp={(event) => {
          if (edgeDrag) {
            const target = (event.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
            const targetId = target?.dataset.nodeId;
            if (targetId) addEdgeBetween(edgeDrag.from, targetId);
            setEdgeDrag(null);
          }
          setDragging(null);
        }}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => {
          setDragging(null);
          setEdgeDrag(null);
        }}
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
          {edgeDrag && (
            <line
              className="edge-preview"
              x1={`${document.nodes.find((node) => node.id === edgeDrag.from)?.x ?? edgeDrag.x}%`}
              y1={`${document.nodes.find((node) => node.id === edgeDrag.from)?.y ?? edgeDrag.y}%`}
              x2={`${edgeDrag.x}%`}
              y2={`${edgeDrag.y}%`}
            />
          )}
        </svg>
        {document.nodes.map((node) => (
          <div
            key={node.id}
            className={`builder-node-shell ${selectedNodeId === node.id ? 'selected' : ''}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            data-node-id={node.id}
          >
            <button
              type="button"
              className="builder-node"
              data-node-id={node.id}
              aria-label={t('nodeButtonLabel', locale, { name: node.label })}
              onMouseDown={(event) => {
                event.stopPropagation();
                setDragging(node.id);
              }}
              onClick={() => selectNode(node)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                removeNode(node.id);
              }}
              title={t('nodeMoveTitle', locale)}
            >
              {node.label}
            </button>
            <button
              type="button"
              className="node-connector"
              data-node-id={node.id}
              aria-label={t('connectFromNode', locale, { name: node.label })}
              title={t('connectFromNode', locale, { name: node.label })}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragging(null);
                setEdgeDrag({ from: node.id, x: node.x, y: node.y });
              }}
              onDoubleClick={(event) => event.stopPropagation()}
            />
          </div>
        ))}
        <span className="canvas-hint">{t('canvasHint', locale)}</span>
      </div>

      {selectedNode && (
        <div className="node-edit-controls" aria-label={t('nodeEditor', locale)}>
          <strong>{t('nodeEditor', locale)}</strong>
          <label>
            {t('nodeId', locale)}
            <input
              aria-label={t('nodeId', locale)}
              value={draftNodeId}
              maxLength={64}
              onChange={(event) => setDraftNodeId(event.target.value)}
            />
          </label>
          <label>
            {t('nodeLabel', locale)}
            <input
              aria-label={t('nodeLabel', locale)}
              value={draftNodeLabel}
              maxLength={64}
              onChange={(event) => setDraftNodeLabel(event.target.value)}
            />
          </label>
          <button type="button" onClick={saveSelectedNode}>{t('saveNode', locale)}</button>
          <button type="button" onClick={() => removeNode(selectedNode.id)}>
            {t('deleteNode', locale)}
          </button>
        </div>
      )}

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
