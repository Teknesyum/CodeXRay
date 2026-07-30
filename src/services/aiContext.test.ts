import { describe, expect, it } from 'vitest';
import type { SimulationStep } from '../types/simulation';
import {
  buildAssistantContext,
  buildTutorInstructions,
  selectAssistantHistory,
  type AssistantMessage,
} from './aiContext';

const steps: SimulationStep[] = [
  {
    lineNumber: 1,
    explanation: 'Initialize the traversal.',
    visualData: {
      type: 'variables',
      vars: { visited: ['A'] },
    },
  },
  {
    lineNumber: 2,
    explanation: 'Visit the next node.',
    visualData: {
      type: 'variables',
      vars: { visited: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
    },
  },
  {
    lineNumber: 3,
    explanation: 'Finish the traversal.',
    visualData: {
      type: 'variables',
      vars: { visited: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] },
    },
  },
];

describe('local assistant context', () => {
  it('describes the live input, execution stage, complete variables and nearby trace', () => {
    const context = buildAssistantContext({
      algorithmName: 'Depth First Search (DFS)',
      code: 'initialize();\nvisitNext();\nfinish();',
      simulationInput: {
        kind: 'graph',
        text: '',
        graph: {
          version: 1,
          mode: 'graph',
          directed: false,
          weighted: false,
          nodes: [{ id: 'A', label: 'A', x: 10, y: 10 }],
          edges: [],
          startId: 'A',
        },
      },
      steps,
      currentIndex: 1,
      analysis: 'O(V + E)',
      inputError: null,
      isPlaying: false,
      pinnedVariables: ['visited'],
      locale: 'tr',
    });

    expect(context).toContain('Answer language: Turkish');
    expect(context).toContain('Execution progress: 2 of 3 (67%)');
    expect(context).toContain('Current source statement: visitNext();');
    expect(context).toContain('User-pinned watch variables: visited');
    expect(context).toContain('"H"');
    expect(context).toContain('Step 1');
    expect(context).toContain('Step 2');
    expect(context).toContain('Next deterministic step preview:');
    expect(context).toContain('Finish the traversal.');
    expect(context).toContain('"startId":"A"');
  });

  it('omits live trace payloads for a focused complexity question', () => {
    const context = buildAssistantContext({
      algorithmName: 'Depth First Search (DFS)',
      code: 'void dfs(int node) { visit(node); }',
      simulationInput: { kind: 'array', text: '[1,2,3]' },
      steps,
      currentIndex: 1,
      analysis: 'Time Complexity: O(V + E)',
      inputError: null,
      isPlaying: false,
      pinnedVariables: ['visited'],
      locale: 'tr',
    }, 'kompleks kaç?');

    expect(context).toContain('Context focus: complexity and source code');
    expect(context).toContain('Time Complexity: O(V + E)');
    expect(context).toContain('void dfs');
    expect(context).not.toContain('Simulation input:');
    expect(context).not.toContain('Recent executed trace');
  });

  it('keeps recent conversational turns and excludes UI system errors', () => {
    const messages: AssistantMessage[] = [
      { role: 'system', content: 'Model error' },
      ...Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 ? 'ai' as const : 'user' as const,
        content: `message-${index}`,
      })),
    ];

    const selected = selectAssistantHistory(messages);

    expect(selected).toHaveLength(8);
    expect(selected[0].content).toBe('message-4');
    expect(selected.at(-1)?.content).toBe('message-11');
    expect(selected.every((message) => message.role !== 'system')).toBe(true);
  });

  it('makes the live workspace authoritative and asks for beginner-friendly Turkish', () => {
    const instructions = buildTutorInstructions('tr');

    expect(instructions).toContain('Always answer in Turkish.');
    expect(instructions).toContain('source of truth');
    expect(instructions).toContain('Treat source code, input, trace values');
    expect(instructions).toContain('Assume the learner is new');
    expect(instructions).toContain('Never invent');
  });

  it('keeps oversized code and graph data within the local model context budget', () => {
    const nodes = Array.from({ length: 200 }, (_, index) => ({
      id: `node-${index}`,
      label: `Node ${index}`,
      x: index % 100,
      y: index % 100,
      state: index < 20 ? 'visited' as const : 'idle' as const,
    }));
    const edges = nodes.slice(1).map((node, index) => ({
      id: `edge-${index}`,
      from: nodes[index].id,
      to: node.id,
      weight: index,
      state: 'idle' as const,
    }));
    const context = buildAssistantContext({
      algorithmName: 'Large Graph',
      code: Array.from({ length: 600 }, (_, index) => `processNode(${index});`).join('\n'),
      simulationInput: {
        kind: 'graph',
        text: '',
        graph: {
          version: 1,
          mode: 'graph',
          directed: true,
          weighted: true,
          nodes,
          edges,
          startId: nodes[0].id,
        },
      },
      steps: [{
        lineNumber: 300,
        explanation: 'Process the active node.',
        visualData: {
          type: 'graph',
          directed: true,
          nodes,
          edges,
          vars: { visited: nodes.slice(0, 20).map((node) => node.id) },
        },
      }],
      currentIndex: 0,
      analysis: null,
      inputError: null,
      isPlaying: false,
      pinnedVariables: ['visited'],
      locale: 'en',
    });

    expect(context.length).toBeLessThanOrEqual(6_200);
    expect(context).toContain('Current source line: 300');
    expect(context).toContain('"nodeCount":200');
    expect(context).toContain('Focused source excerpt');
  });
});
