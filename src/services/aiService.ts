import type { SimulationInput, SimulationStep } from '../types/simulation';
import { simulateAlgorithm, UnsupportedCustomSimulationError } from './simulators';
import {
  askLocalModel,
  askLocalModelDetailed,
  type LocalModelAnswer,
  type LocalModelStreamUpdate,
} from './localAiService';
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
): Promise<SimulationStep[]> => {
  try {
    return Promise.resolve(simulateAlgorithm(algorithmName, code, input));
  } catch (error) {
    if (!(error instanceof UnsupportedCustomSimulationError)) throw error;
    return import('./trace/customSimulation')
      .then(({ traceCustomSimulation }) => traceCustomSimulation(code, input));
  }
};

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
  const contextWindow = workspace.contextWindow ?? 4096;
  const profile = contextWindow >= 32768
    ? { question: 2_400, history: 9_600, total: 50_000, system: 3_200, messages: 24 }
    : contextWindow >= 16384
      ? { question: 1_800, history: 4_800, total: 26_000, system: 2_600, messages: 16 }
      : contextWindow >= 8192
        ? { question: 1_200, history: 2_400, total: 13_000, system: 2_200, messages: 8 }
        : { question: 800, history: 1_000, total: 7_200, system: 1_800, messages: 8 };
  const questionLimit = profile.question;
  const boundedQuestion = question.length > questionLimit
    ? `${question.slice(0, questionLimit - 40)}\n[Question shortened for the local model context window.]`
    : question;
  const context = buildAssistantContext(workspace, boundedQuestion);
  const historyBudget = Math.max(
    0,
    Math.min(
      profile.history,
      profile.total - profile.system - context.length - boundedQuestion.length,
    ),
  );
  return askLocalModel(
    boundedQuestion,
    context,
    selectAssistantHistory(chatHistory, historyBudget, profile.messages),
    workspace.locale,
  );
};

export const askQuestionDetailed = async (
  question: string,
  workspace: AssistantWorkspace,
  chatHistory: AssistantMessage[] = [],
  onStream?: (update: LocalModelStreamUpdate) => void,
): Promise<LocalModelAnswer> => {
  const contextWindow = workspace.contextWindow ?? 4096;
  const questionLimit = contextWindow >= 32768 ? 2_400 : contextWindow >= 16384 ? 1_800 : contextWindow >= 8192 ? 1_200 : 800;
  const boundedQuestion = question.length > questionLimit
    ? `${question.slice(0, questionLimit - 40)}\n[Question shortened for the local model context window.]`
    : question;
  const context = buildAssistantContext(workspace, boundedQuestion);
  const historyBudget = contextWindow >= 32768 ? 9_600 : contextWindow >= 16384 ? 4_800 : contextWindow >= 8192 ? 2_400 : 1_000;
  const messageLimit = contextWindow >= 16384 ? 16 : 8;
  return askLocalModelDetailed(
    boundedQuestion,
    context,
    selectAssistantHistory(chatHistory, historyBudget, messageLimit),
    workspace.locale,
    onStream,
  );
};
