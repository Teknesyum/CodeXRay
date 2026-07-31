import type {
  InputContractV1,
  ProgramSpecV1,
  SimLangExpression,
  SimLangStatement,
  VisualizationContractV1,
} from '../types/godMode';
import type { Locale } from '../i18n/translations';
import { createInputPreset } from './inputPresets';

const literal = (value: string | number | boolean | null | string[] | Record<string, never>): SimLangExpression => ({
  type: 'literal',
  value,
});
const variable = (name: string): SimLangExpression => ({ type: 'variable', name });
const inputField = (field: 'startId' | 'targetId'): SimLangExpression => ({ type: 'input-field', field });
const binary = (
  operator: '==' | '!=' | 'and' | '>',
  left: SimLangExpression,
  right: SimLangExpression,
): SimLangExpression => ({ type: 'binary', operator, left, right });
const length = (value: SimLangExpression): SimLangExpression => ({ type: 'length', value });
const contains = (collection: SimLangExpression, value: SimLangExpression): SimLangExpression => ({
  type: 'contains', collection, value,
});
const neighbors = (node: SimLangExpression): SimLangExpression => ({ type: 'neighbors', node });
const not = (value: SimLangExpression): SimLangExpression => ({ type: 'unary', operator: 'not', value });

const trace = (
  id: string,
  at: string,
  explanation: string,
  category: 'initialization' | 'frontier' | 'meeting' | 'result',
  importance: number,
): SimLangStatement => ({ type: 'trace', id, at, explanation, category, importance });

export const createBidirectionalBfsProgram = (locale: Locale): ProgramSpecV1 => {
  const text = locale === 'tr'
    ? {
      initialized: 'İki arama cephesi başlatıldı: başlangıç {{start}} ve hedef {{target}}.',
      startExpand: 'Başlangıç cephesi {{currentStart}} düğümünü genişletiyor.',
      startDiscover: 'Başlangıç tarafı {{neighbor}} düğümünü keşfedip kuyruğa ekledi.',
      startMeeting: 'İki cephe {{meeting}} düğümünde buluştu.',
      targetExpand: 'Hedef cephesi {{currentTarget}} düğümünü genişletiyor.',
      targetDiscover: 'Hedef tarafı {{neighbor}} düğümünü keşfedip kuyruğa ekledi.',
      targetMeeting: 'İki cephe {{meeting}} düğümünde buluştu.',
      frontier: 'Tur tamamlandı. Başlangıç kuyruğu {{frontierStart}}, hedef kuyruğu {{frontierTarget}}.',
      result: 'En kısa yol iki ebeveyn haritasından yeniden kuruldu: {{path}}.',
      unreachable: 'Cepheler birleşmeden tükendi; hedefe giden yol bulunamadı.',
    }
    : {
      initialized: 'Initialized two search frontiers at {{start}} and {{target}}.',
      startExpand: 'The start frontier expands node {{currentStart}}.',
      startDiscover: 'The start side discovered {{neighbor}} and queued it.',
      startMeeting: 'The two frontiers met at {{meeting}}.',
      targetExpand: 'The target frontier expands node {{currentTarget}}.',
      targetDiscover: 'The target side discovered {{neighbor}} and queued it.',
      targetMeeting: 'The two frontiers met at {{meeting}}.',
      frontier: 'The round ended with start queue {{frontierStart}} and target queue {{frontierTarget}}.',
      result: 'The shortest path was reconstructed from both parent maps: {{path}}.',
      unreachable: 'Both frontiers were exhausted without meeting; no path exists.',
    };

  const startNeighborBody: SimLangStatement[] = [
    {
      id: 'if_start_unvisited', type: 'if',
      condition: not(contains(variable('visitedStart'), variable('neighbor'))),
      then: [
        { id: 'visit_start_neighbor', type: 'set-add', set: 'visitedStart', value: variable('neighbor') },
        { id: 'parent_start_neighbor', type: 'map-set', map: 'parentFromStart', key: variable('neighbor'), value: variable('currentStart') },
        { id: 'queue_start_neighbor', type: 'array-push', array: 'frontierStart', value: variable('neighbor') },
        trace('trace_start_discover', 'queue_start_neighbor', text.startDiscover, 'frontier', 0.62),
        {
          id: 'if_start_meets_target', type: 'if',
          condition: contains(variable('visitedTarget'), variable('neighbor')),
          then: [
            { id: 'set_start_meeting', type: 'assign', name: 'meeting', value: variable('neighbor') },
            trace('trace_start_meeting', 'set_start_meeting', text.startMeeting, 'meeting', 1),
            { id: 'break_start_neighbors', type: 'break' },
          ],
        },
      ],
    },
  ];

  const targetNeighborBody: SimLangStatement[] = [
    {
      id: 'if_target_unvisited', type: 'if',
      condition: not(contains(variable('visitedTarget'), variable('neighborFromTarget'))),
      then: [
        { id: 'visit_target_neighbor', type: 'set-add', set: 'visitedTarget', value: variable('neighborFromTarget') },
        { id: 'parent_target_neighbor', type: 'map-set', map: 'parentFromTarget', key: variable('neighborFromTarget'), value: variable('currentTarget') },
        { id: 'queue_target_neighbor', type: 'array-push', array: 'frontierTarget', value: variable('neighborFromTarget') },
        trace('trace_target_discover', 'queue_target_neighbor', text.targetDiscover, 'frontier', 0.62),
        {
          id: 'if_target_meets_start', type: 'if',
          condition: contains(variable('visitedStart'), variable('neighborFromTarget')),
          then: [
            { id: 'set_target_meeting', type: 'assign', name: 'meeting', value: variable('neighborFromTarget') },
            trace('trace_target_meeting', 'set_target_meeting', text.targetMeeting, 'meeting', 1),
            { id: 'break_target_neighbors', type: 'break' },
          ],
        },
      ],
    },
  ];

  return {
    version: 1,
    id: 'bidirectional_bfs_custom',
    title: locale === 'tr' ? 'İki Yönlü BFS' : 'Bidirectional BFS',
    locale,
    inputKind: 'graph',
    functions: [],
    budgets: {
      instructions: 12_000,
      traceSteps: 800,
      recursionDepth: 24,
      collectionSize: 4_000,
    },
    entry: [
      { id: 'declare_start', type: 'declare', name: 'start', value: inputField('startId') },
      { id: 'declare_target', type: 'declare', name: 'target', value: inputField('targetId') },
      { id: 'declare_frontier_start', type: 'declare', name: 'frontierStart', value: literal([]) },
      { id: 'queue_initial_start', type: 'array-push', array: 'frontierStart', value: variable('start') },
      { id: 'declare_frontier_target', type: 'declare', name: 'frontierTarget', value: literal([]) },
      { id: 'queue_initial_target', type: 'array-push', array: 'frontierTarget', value: variable('target') },
      { id: 'declare_visited_start', type: 'declare', name: 'visitedStart', value: literal([]) },
      { id: 'visit_initial_start', type: 'set-add', set: 'visitedStart', value: variable('start') },
      { id: 'declare_visited_target', type: 'declare', name: 'visitedTarget', value: literal([]) },
      { id: 'visit_initial_target', type: 'set-add', set: 'visitedTarget', value: variable('target') },
      { id: 'declare_parent_start', type: 'declare', name: 'parentFromStart', value: literal({}) },
      { id: 'parent_initial_start', type: 'map-set', map: 'parentFromStart', key: variable('start'), value: literal(null) },
      { id: 'declare_parent_target', type: 'declare', name: 'parentFromTarget', value: literal({}) },
      { id: 'parent_initial_target', type: 'map-set', map: 'parentFromTarget', key: variable('target'), value: literal(null) },
      { id: 'declare_current_start', type: 'declare', name: 'currentStart', value: literal(null) },
      { id: 'declare_current_target', type: 'declare', name: 'currentTarget', value: literal(null) },
      { id: 'declare_meeting', type: 'declare', name: 'meeting', value: literal(null) },
      { id: 'declare_path', type: 'declare', name: 'path', value: literal([]) },
      trace('trace_initialized', 'declare_meeting', text.initialized, 'initialization', 0.9),
      {
        id: 'search_loop',
        type: 'while',
        maxIterations: 2_000,
        condition: binary('and',
          binary('and',
            binary('==', variable('meeting'), literal(null)),
            binary('>', length(variable('frontierStart')), literal(0))),
          binary('>', length(variable('frontierTarget')), literal(0))),
        body: [
          { id: 'dequeue_start', type: 'array-shift', array: 'frontierStart', target: 'currentStart' },
          trace('trace_start_expand', 'dequeue_start', text.startExpand, 'frontier', 0.74),
          {
            id: 'iterate_start_neighbors', type: 'for-each', item: 'neighbor',
            values: neighbors(variable('currentStart')),
            body: startNeighborBody,
          },
          {
            id: 'if_no_meeting_expand_target', type: 'if',
            condition: binary('==', variable('meeting'), literal(null)),
            then: [
              { id: 'dequeue_target', type: 'array-shift', array: 'frontierTarget', target: 'currentTarget' },
              trace('trace_target_expand', 'dequeue_target', text.targetExpand, 'frontier', 0.74),
              {
                id: 'iterate_target_neighbors', type: 'for-each', item: 'neighborFromTarget',
                values: neighbors(variable('currentTarget')),
                body: targetNeighborBody,
              },
            ],
          },
          trace('trace_frontiers', 'search_loop', text.frontier, 'frontier', 0.5),
        ],
      },
      {
        id: 'if_path_found', type: 'if',
        condition: binary('!=', variable('meeting'), literal(null)),
        then: [
          {
            id: 'reconstruct_path', type: 'assign', name: 'path',
            value: {
              type: 'reconstruct-bidirectional-path',
              meeting: variable('meeting'),
              parentFromStart: variable('parentFromStart'),
              parentFromTarget: variable('parentFromTarget'),
            },
          },
          trace('trace_result', 'reconstruct_path', text.result, 'result', 1),
        ],
        else: [trace('trace_unreachable', 'if_path_found', text.unreachable, 'result', 1)],
      },
    ],
  };
};

export const createBidirectionalBfsInput = (): InputContractV1 => {
  const value = createInputPreset('graph', 1, 'Breadth First Search (BFS)');
  return {
    version: 1,
    kind: 'graph',
    description: 'An unweighted graph with explicit start and target nodes.',
    constraints: [
      'The graph must contain both startId and targetId.',
      'Every edge endpoint must reference an existing node.',
      'Neighbor order is deterministic.',
    ],
    value,
  };
};

export const BIDIRECTIONAL_BFS_VISUALIZATION: VisualizationContractV1 = {
  version: 1,
  type: 'graph',
  activeVariables: ['currentStart', 'currentTarget'],
  queuedVariables: ['frontierStart', 'frontierTarget'],
  visitedVariables: ['visitedStart', 'visitedTarget'],
  pathVariable: 'path',
  activeEdges: [
    { fromVariable: 'currentStart', toVariable: 'neighbor' },
    { fromVariable: 'currentTarget', toVariable: 'neighborFromTarget' },
  ],
  traversedEdgeMapVariables: ['parentFromStart', 'parentFromTarget'],
};
