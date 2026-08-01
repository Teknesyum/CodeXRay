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
    ])).toBe('1');
    expect(nextNodeId([
      { id: '1', label: 'One', x: 10, y: 10 },
      { id: 'named', label: 'Named', x: 20, y: 20 },
      { id: '3', label: 'Three', x: 30, y: 30 },
    ])).toBe('2');
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

  it('adds a node from a keyboard-accessible control using the smallest numeric gap', async () => {
    const user = userEvent.setup();
    render(<Harness value={{
      ...initialDocument,
      nodes: [
        { id: '1', label: 'One', x: 20, y: 20 },
        { id: 'named', label: 'Named', x: 80, y: 80 },
        { id: '3', label: 'Three', x: 50, y: 50 },
      ],
      edges: [],
      startId: '1',
      targetId: 'named',
    }} />);

    await user.click(screen.getByRole('button', { name: 'Add node' }));
    const currentDocument = JSON.parse(
      screen.getByTestId('graph-document').textContent ?? '{}',
    ) as GraphDocumentV1;
    expect(currentDocument.nodes.map((node) => node.id)).toContain('2');
    expect(currentDocument.nodes.find((node) => node.id === '2')).toMatchObject({ x: 10, y: 10 });
  });

  it('edits and quickly deletes a selected weighted edge', async () => {
    const user = userEvent.setup();
    render(<Harness value={{
      ...initialDocument,
      weighted: true,
      edges: [{ ...initialDocument.edges[0], weight: 3 }],
    }} />);

    await user.click(screen.getByRole('button', { name: 'Edit edge Eleven to Two' }));
    const weightInput = screen.getByLabelText('Edge Eleven to Two weight');
    await user.clear(weightInput);
    await user.type(weightInput, '9');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    let currentDocument = JSON.parse(
      screen.getByTestId('graph-document').textContent ?? '{}',
    ) as GraphDocumentV1;
    expect(currentDocument.edges[0].weight).toBe(9);

    await user.click(screen.getByRole('button', { name: 'Delete edge Eleven to Two' }));
    currentDocument = JSON.parse(
      screen.getByTestId('graph-document').textContent ?? '{}',
    ) as GraphDocumentV1;
    expect(currentDocument.edges).toHaveLength(0);
  });

  it('imports a sparse tree and preserves it when a cyclic replacement is rejected', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Import / export'));
    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, { target: { value: '[1,2,3,null,4]' } });
    await user.click(screen.getByRole('button', { name: 'Import level-order tree' }));

    const imported = JSON.parse(
      screen.getByTestId('graph-document').textContent ?? '{}',
    ) as GraphDocumentV1;
    expect(imported.mode).toBe('tree');
    expect(imported.nodes.map((node) => node.label)).toEqual(['1', '2', '3', '4']);
    expect(imported.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'n1', to: 'n4' }),
    ]));

    const cyclic = {
      version: 1,
      mode: 'tree',
      directed: true,
      weighted: false,
      nodes: [
        { id: 'root', label: 'Root', x: 10, y: 10 },
        { id: 'leaf', label: 'Leaf', x: 30, y: 30 },
        { id: 'a', label: 'A', x: 60, y: 30 },
        { id: 'b', label: 'B', x: 80, y: 60 },
      ],
      edges: [
        { id: 'root-leaf', from: 'root', to: 'leaf' },
        { id: 'a-b', from: 'a', to: 'b' },
        { id: 'b-a', from: 'b', to: 'a' },
      ],
      rootId: 'root',
      startId: 'root',
    };
    fireEvent.change(editor, { target: { value: JSON.stringify(cyclic) } });
    await user.click(screen.getByRole('button', { name: 'Import JSON' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/reachable|cycle/i);
    expect(JSON.parse(screen.getByTestId('graph-document').textContent ?? '{}')).toEqual(imported);
  });
});
