import type { SimulationInput, SimulationStep } from '../types/simulation';
import { simulateAlgorithm } from './simulators';
import { askLocalModel } from './localAiService';
import {
  buildAssistantContext,
  selectAssistantHistory,
  type AssistantMessage,
  type AssistantWorkspace,
} from './aiContext';

const algorithmFacts = (name: string, code: string) => {
  const source = `${name} ${code}`.toLowerCase();
  if (source.includes('dijkstra')) {
    return {
      purpose: 'Find shortest paths from one source in a graph with non-negative edge weights.',
      time: 'O((V + E) log V)',
      space: 'O(V + E)',
      note: 'A priority queue keeps the next minimum-distance node efficient.',
    };
  }
  if (source.includes('a*') || source.includes('astar')) {
    return {
      purpose: 'Find a shortest path while using an admissible heuristic to guide the search.',
      time: 'O(E log V) for the graph and heap operations shown here',
      space: 'O(V + E)',
      note: 'A stronger consistent heuristic usually explores fewer nodes.',
    };
  }
  if (source.includes('depth first') || source.includes('dfs')) {
    return {
      purpose: 'Traverse a graph by following each branch before backtracking.',
      time: 'O(V + E)',
      space: 'O(V)',
      note: 'An explicit stack avoids recursion-depth limits.',
    };
  }
  if (source.includes('breadth first') || source.includes('bfs')) {
    return {
      purpose: 'Traverse a graph level by level and find unweighted shortest paths.',
      time: 'O(V + E)',
      space: 'O(V)',
      note: 'Bidirectional BFS can reduce work when both endpoints are known.',
    };
  }
  if (source.includes('z-algorithm') || source.includes('zfunction')) {
    return {
      purpose: 'Calculate prefix-match lengths for linear-time string matching.',
      time: 'O(N)',
      space: 'O(N)',
      note: 'The Z-box reuses previous comparisons, so the bound is already optimal.',
    };
  }
  if (/quick|merge|heap|radix|counting|bubble|insertion|selection/.test(source)) {
    const linear = /radix|counting/.test(source);
    const quadratic = /bubble|insertion|selection/.test(source);
    return {
      purpose: 'Order the provided array while exposing comparisons and writes.',
      time: linear ? 'O(N + K)' : quadratic ? 'O(N²)' : 'O(N log N)',
      space: /merge|radix|counting/.test(source) ? 'O(N + K)' : 'O(log N) auxiliary',
      note: 'The best choice depends on stability, value range, memory and input order.',
    };
  }
  return {
    purpose: 'Inspect and discuss the supplied custom code.',
    time: 'Depends on the selected code and input',
    space: 'Depends on the selected code and input',
    note: 'A deterministic visual simulator is available for the marked presets.',
  };
};

export const generateSimulationSteps = (
  algorithmName: string,
  code: string,
  input: SimulationInput,
): SimulationStep[] => simulateAlgorithm(algorithmName, code, input);

export const generateAnalysis = (algorithmName: string, code: string): string => {
  const facts = algorithmFacts(algorithmName, code);
  return [
    `Purpose: ${facts.purpose}`,
    `Time Complexity: ${facts.time}`,
    `Space Complexity: ${facts.space}`,
    `Optimization Potential: ${facts.note}`,
  ].join('\n');
};

export const generateQuestions = (algorithmName: string, code: string): string[] => {
  const facts = algorithmFacts(algorithmName, code);
  return [
    `Why does this algorithm have ${facts.time} time complexity?`,
    'Which invariant makes this algorithm correct?',
    'What input is the worst case, and why?',
    'Which data structure is doing the most important work?',
    'When should I choose a different algorithm?',
  ];
};

export const askQuestion = async (
  question: string,
  workspace: AssistantWorkspace,
  chatHistory: AssistantMessage[] = [],
): Promise<string> => {
  const wideContext = (workspace.contextWindow ?? 4096) >= 8192;
  const questionLimit = wideContext ? 1_200 : 800;
  const boundedQuestion = question.length > questionLimit
    ? `${question.slice(0, questionLimit - 40)}\n[Question shortened for the local model context window.]`
    : question;
  const context = buildAssistantContext(workspace, boundedQuestion);
  const historyLimit = wideContext ? 2_400 : 1_000;
  const totalCharacterBudget = wideContext ? 13_000 : 7_200;
  const systemReserve = wideContext ? 2_200 : 1_800;
  const historyBudget = Math.max(
    0,
    Math.min(
      historyLimit,
      totalCharacterBudget - systemReserve - context.length - boundedQuestion.length,
    ),
  );
  return askLocalModel(
    boundedQuestion,
    context,
    selectAssistantHistory(chatHistory, historyBudget),
    workspace.locale,
  );
};
