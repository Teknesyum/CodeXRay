import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { GraphDocumentV1 } from '../types/simulation';
import { nextNodeId } from '../services/graphEditorUtils';
import { GraphInputEditor } from './GraphInputEditor';

const initialDocument: GraphDocumentV1 = {
  version: 1,
  mode: 'graph',
  directed: true,
  weighted: false,
  nodes: [
    { id: '1', label: 'One', x: 20, y: 35 },
    { id: '2', label: 'Two', x: 70, y: 35 },
    { id: '4', label: 'Four', x: 30, y: 70 },
    { id: '11', label: 'Eleven', x: 70, y: 70 },
  ],
  edges: [{ id: 'e-1', from: '11', to: '2' }],
  startId: '11',
  rootId: '11',
  targetId: '11',
};

const Harness = ({ value = initialDocument }: { value?: GraphDocumentV1 }) => {
  const [document, setDocument] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <GraphInputEditor
        document={document}
        locale="en"
        onChange={setDocument}
        onError={setError}
      />
      <output data-testid="graph-document">{JSON.stringify(document)}</output>
      {error && <div role="alert">{error}</div>}
    </>
  );
};

afterEach(() => cleanup());

describe('GraphInputEditor', () => {
  it('fills the first available ID gap instead of using the largest ID', () => {
    expect(nextNodeId(initialDocument.nodes)).toBe('3');
    expect(nextNodeId([{ id: '7', label: '7', x: 50, y: 50 }])).toBe('1');
    expect(nextNodeId([
      { id: 'A', label: 'A', x: 10, y: 10 },
      { id: 'n1', label: 'n1', x: 20, y: 20 },
      { id: 'n3', label: 'n3', x: 30, y: 30 },
    ])).toBe('n2');
  });

  it('renames a node and updates every graph reference safely', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Node Eleven' }));
    await user.clear(screen.getByLabelText('Node ID'));
    await user.type(screen.getByLabelText('Node ID'), '5');
    await user.clear(screen.getByLabelText('Node label'));
    await user.type(screen.getByLabelText('Node label'), 'Five');
    await user.click(screen.getByRole('button', { name: 'Save node' }));

    const currentDocument = JSON.parse(
      screen.getByTestId('graph-document').textContent ?? '{}',
    ) as GraphDocumentV1;
    expect(currentDocument.nodes.find((node) => node.id === '5')?.label).toBe('Five');
    expect(currentDocument.edges[0]).toMatchObject({ from: '5', to: '2' });
    expect(currentDocument.startId).toBe('5');
    expect(currentDocument.rootId).toBe('5');
    expect(currentDocument.targetId).toBe('5');
  });

  it('rejects a duplicate node ID without changing graph references', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Node Eleven' }));
    await user.clear(screen.getByLabelText('Node ID'));
    await user.type(screen.getByLabelText('Node ID'), '2');
    await user.click(screen.getByRole('button', { name: 'Save node' }));

    expect(screen.getByRole('alert')).toHaveTextContent('That node ID already exists.');
    const currentDocument = JSON.parse(
      screen.getByTestId('graph-document').textContent ?? '{}',
    ) as GraphDocumentV1;
    expect(currentDocument.nodes.some((node) => node.id === '11')).toBe(true);
    expect(currentDocument.edges[0]).toMatchObject({ from: '11', to: '2' });
  });

  it('creates an edge by dragging a node handle onto another node', () => {
    render(<Harness value={{ ...initialDocument, edges: [] }} />);
    const canvas = screen.getByLabelText(/Graph builder canvas/);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Connect from node One' }));
    fireEvent.pointerMove(canvas, { clientX: 200, clientY: 120 });
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Node Two' }));

    const currentDocument = JSON.parse(
      screen.getByTestId('graph-document').textContent ?? '{}',
    ) as GraphDocumentV1;
    expect(currentDocument.edges).toHaveLength(1);
    expect(currentDocument.edges[0]).toMatchObject({ from: '1', to: '2' });
  });
});
