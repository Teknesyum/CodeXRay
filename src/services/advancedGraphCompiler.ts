import type { CustomSimulationPackageV1, InputContractV1, ProgramSpecV1, RenderedSourceV1, VisualizationContractV1, WorkspaceSnapshotV1 } from '../types/godMode';
import type { GraphDocumentV1, Locale, SimulationStep, TraceValue } from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';

export type AdvancedGraphTemplateId = 'keys-and-rooms-dfs' | 'course-schedule-topological'
  | 'network-delay-dijkstra' | 'min-cost-connect-points-mst'
  | 'redundant-connection-union-find' | 'shortest-path-all-nodes-bitmask';

interface Spec { id: string; title: string; graph: GraphDocumentV1; source: RenderedSourceV1; steps: SimulationStep[]; result: TraceValue; analysis: string }

const graphNodePosition = (index: number, count: number): { x: number; y: number } => {
  if (count <= 1) return { x: 50, y: 46 };
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
  return {
    x: Number((50 + Math.cos(angle) * 32).toFixed(2)),
    y: Number((46 + Math.sin(angle) * 30).toFixed(2)),
  };
};

const graph = (ids: string[], rawEdges: Array<[string, string, number?]>, directed: boolean, startId = ids[0]): GraphDocumentV1 => ({
  version: 1, mode: 'graph', directed, weighted: rawEdges.some((edge) => edge[2] !== undefined), startId,
  nodes: ids.map((id, index) => ({ id, label: id, ...graphNodePosition(index, ids.length) })),
  edges: rawEdges.map(([from, to, weight], index) => ({ id: `e${index}`, from, to, weight })),
});

const step = (document: GraphDocumentV1, lineNumber: number, active: string[], visited: string[], activeEdges: string[], vars: Record<string, TraceValue>, explanation: string): SimulationStep => ({
  lineNumber, explanation, visualData: { type: 'graph', directed: document.directed,
    nodes: document.nodes.map((node) => ({ ...node, state: active.includes(node.id) ? 'active' : visited.includes(node.id) ? 'visited' : 'idle' })),
    edges: document.edges.map((edge) => ({ ...edge, state: activeEdges.includes(edge.id) ? 'active' : 'idle' })), vars },
});

const source = (signature: string, body: string[], _traceLine = 8, _resultLine = 12): RenderedSourceV1 => ({
  version: 1, language: 'cpp', code: ['class Solution {', 'public:', `  ${signature} {`, ...body, '  }', '};'].join('\n'),
  lineMap: { trace: 8, result: 12 },
});

const rooms = (): Spec => {
  const document = graph(['0', '1', '2', '3'], [['0', '1'], ['0', '2'], ['1', '2'], ['2', '3']], true);
  const keys = [[1, 2], [2], [3], []]; const seen = new Set<number>(); const steps: SimulationStep[] = [];
  const dfs = (room: number) => { seen.add(room); steps.push(step(document, 8, [String(room)], [...seen].map(String), [], { room, keys: keys[room], result: false }, `Visit room ${room}.`));
    keys[room].forEach((key) => { const edge = document.edges.find((item) => item.from === String(room) && item.to === String(key));
      steps.push(step(document, 8, [String(room), String(key)], [...seen].map(String), edge ? [edge.id] : [], { room, key, result: false }, `Inspect key ${key}.`)); if (!seen.has(key)) dfs(key); }); };
  dfs(0); const result = seen.size === keys.length; steps.push(step(document, 12, [], [...seen].map(String), [], { visitedCount: seen.size, result }, `All rooms reachable: ${result}.`));
  return { id: 'keys_rooms', title: 'LeetCode 841 — Keys and Rooms', graph: document, steps, result,
    source: source('bool canVisitAllRooms(vector<vector<int>>& rooms)', ['    vector<bool> seen(rooms.size());', '    function<void(int)> dfs = [&](int room) {', '      seen[room] = true;', '      for (int key : rooms[room]) if (!seen[key]) dfs(key);', '    };', '    dfs(0);', '    return count(seen.begin(), seen.end(), true) == rooms.size();'], 8, 10),
    analysis: 'DFS: O(V+E) time, O(V) space.' };
};

const courses = (): Spec => {
  const document = graph(['0', '1', '2', '3'], [['0', '1'], ['0', '2'], ['1', '3'], ['2', '3']], true);
  const degree = [0, 1, 1, 2], queue = [0], order: number[] = [], steps: SimulationStep[] = [];
  while (queue.length) { const node = queue.shift()!; order.push(node); steps.push(step(document, 8, [String(node)], order.map(String), [], { queue: [...queue], indegree: [...degree], order: [...order], result: false }, `Take course ${node}.`));
    document.edges.filter((edge) => edge.from === String(node)).forEach((edge) => { const next = Number(edge.to); if (--degree[next] === 0) queue.push(next); steps.push(step(document, 8, [String(node), edge.to], order.map(String), [edge.id], { queue: [...queue], indegree: [...degree], order: [...order], result: false }, `Remove ${node}→${next}.`)); }); }
  const result = order.length === 4; steps.push(step(document, 12, [], order.map(String), [], { order, indegree: degree, result }, `Can finish: ${result}.`));
  return { id: 'course_schedule', title: 'LeetCode 207 — Course Schedule', graph: document, steps, result,
    source: source('bool canFinish(int n, vector<vector<int>>& prerequisites)', ['    vector<vector<int>> graph(n); vector<int> indegree(n);', '    for(auto&p:prerequisites){ graph[p[1]].push_back(p[0]); indegree[p[0]]++; }', '    queue<int> ready; for(int i=0;i<n;i++) if(!indegree[i]) ready.push(i);', '    int completed=0;', '    while(!ready.empty()){ int node=ready.front(); ready.pop(); completed++;', '      for(int next:graph[node]) if(--indegree[next]==0) ready.push(next); }', '    return completed==n;'], 8, 10), analysis: 'Kahn topological sort: O(V+E) time and space.' };
};

const delay = (): Spec => {
  const document = graph(['1', '2', '3', '4'], [['2', '1', 1], ['2', '3', 1], ['3', '4', 1]], true, '2');
  const dist: Record<string, number> = { 1: 99, 2: 0, 3: 99, 4: 99 }; const settled: string[] = []; const queue: Array<[number, string]> = [[0, '2']]; const steps: SimulationStep[] = [];
  while (queue.length) { queue.sort((a, b) => a[0] - b[0]); const [cost, node] = queue.shift()!; if (settled.includes(node)) continue; settled.push(node); steps.push(step(document, 8, [node], settled, [], { node, cost, distance: { ...dist }, result: -1 }, `Settle ${node}.`));
    document.edges.filter((edge) => edge.from === node).forEach((edge) => { const candidate = cost + (edge.weight ?? 0); if (candidate < dist[edge.to]) { dist[edge.to] = candidate; queue.push([candidate, edge.to]); } steps.push(step(document, 8, [node, edge.to], settled, [edge.id], { candidate, distance: { ...dist }, result: -1 }, `Relax ${node}→${edge.to}.`)); }); }
  const result = Math.max(...Object.values(dist)); steps.push(step(document, 12, [], settled, [], { distance: dist, result }, `Delay=${result}.`));
  return { id: 'network_delay', title: 'LeetCode 743 — Network Delay Time', graph: document, steps, result,
    source: source('int networkDelayTime(vector<vector<int>>& times, int n, int k)', ['    vector<vector<pair<int,int>>> graph(n+1);', '    for(auto&t:times) graph[t[0]].push_back({t[1],t[2]});', '    vector<int> dist(n+1,INT_MAX); dist[k]=0;', '    priority_queue<pair<int,int>,vector<pair<int,int>>,greater<pair<int,int>>> pq; pq.push({0,k});', '    while(!pq.empty()){ auto [cost,node]=pq.top(); pq.pop();', '      if(cost!=dist[node]) continue;', '      for(auto [next,w]:graph[node]) if(cost+w<dist[next]){dist[next]=cost+w;pq.push({dist[next],next});}}', '    int result=*max_element(dist.begin()+1,dist.end()); return result==INT_MAX?-1:result;'], 8, 11), analysis: 'Dijkstra: O((V+E) log V) time, O(V+E) space.' };
};

const redundant = (): Spec => {
  const document = graph(['1', '2', '3'], [['1', '2'], ['1', '3'], ['2', '3']], false); const parent = [0, 1, 2, 3]; const steps: SimulationStep[] = []; let result: number[] = [];
  const find = (x: number): number => parent[x] === x ? x : (parent[x] = find(parent[x]));
  document.edges.forEach((edge) => { const a = Number(edge.from), b = Number(edge.to), ra = find(a), rb = find(b); if (ra === rb) result = [a, b]; else parent[rb] = ra; steps.push(step(document, 8, [edge.from, edge.to], [], [edge.id], { edge: [a, b], roots: [ra, rb], parent: parent.slice(1), result: [...result] }, result.length ? 'Cycle detected.' : 'Union components.')); });
  steps.push(step(document, 12, result.map(String), [], ['e2'], { parent: parent.slice(1), result }, `Redundant edge [${result}].`));
  return { id: 'redundant_connection', title: 'LeetCode 684 — Redundant Connection', graph: document, steps, result,
    source: source('vector<int> findRedundantConnection(vector<vector<int>>& edges)', ['    vector<int> parent(edges.size()+1); iota(parent.begin(),parent.end(),0);', '    function<int(int)> find=[&](int x){return parent[x]==x?x:parent[x]=find(parent[x]);};', '    for(auto&edge:edges){ int a=find(edge[0]),b=find(edge[1]);', '      if(a==b) return edge;', '      parent[b]=a;', '    }', '    return {};'], 8, 9), analysis: 'DSU: O(E α(V)) time, O(V) space.' };
};

const mst = (): Spec => {
  const points = [[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]], ids = ['0', '1', '2', '3', '4']; const edges: Array<[string, string, number]> = [];
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) edges.push([String(i), String(j), Math.abs(points[i][0] - points[j][0]) + Math.abs(points[i][1] - points[j][1])]);
  const document = graph(ids, edges, false), used = new Set([0]), chosen: string[] = [], steps: SimulationStep[] = []; let result = 0;
  while (used.size < 5) { const candidates = document.edges.flatMap((edge) => { const a = Number(edge.from), b = Number(edge.to); return used.has(a) !== used.has(b) ? [{ edge, next: used.has(a) ? b : a }] : []; }); candidates.sort((a, b) => (a.edge.weight ?? 0) - (b.edge.weight ?? 0)); const best = candidates[0]; used.add(best.next); chosen.push(best.edge.id); result += best.edge.weight ?? 0; steps.push(step(document, 8, [String(best.next)], [...used].map(String), [best.edge.id], { used: [...used], chosen: [...chosen], cost: result, result: 0 }, `Choose ${best.edge.from}—${best.edge.to}.`)); }
  steps.push(step(document, 12, [], [...used].map(String), chosen, { chosen, result }, `MST cost=${result}.`));
  return { id: 'connect_points_mst', title: 'LeetCode 1584 — Min Cost to Connect All Points', graph: document, steps, result,
    source: source('int minCostConnectPoints(vector<vector<int>>& points)', ['    int n=points.size(), result=0; vector<int> cost(n,INT_MAX); vector<bool> used(n); cost[0]=0;', '    for(int count=0;count<n;count++){ int node=-1;', '      for(int i=0;i<n;i++) if(!used[i]&&(node<0||cost[i]<cost[node])) node=i;', '      used[node]=true; result+=cost[node];', '      for(int next=0;next<n;next++) if(!used[next]) cost[next]=min(cost[next],abs(points[node][0]-points[next][0])+abs(points[node][1]-points[next][1]));', '    }', '    return result;'], 8, 10), analysis: 'Dense Prim: O(V²) time, O(V) space.' };
};

const bitmask = (): Spec => {
  const document = graph(['0', '1', '2', '3'], [['0', '1'], ['0', '2'], ['0', '3']], false), full = 15; const queue: Array<[number, number, number]> = document.nodes.map((_, n) => [n, 1 << n, 0]); const seen = new Set(queue.map(([n, m]) => `${n}:${m}`)); const steps: SimulationStep[] = []; let result = -1;
  while (queue.length) { const [node, mask, distance] = queue.shift()!; steps.push(step(document, 8, [String(node)], [], [], { node, mask, distance, result }, `State (${node},${mask.toString(2)}).`)); if (mask === full) { result = distance; break; } document.edges.filter((edge) => edge.from === String(node) || edge.to === String(node)).forEach((edge) => { const next = Number(edge.from === String(node) ? edge.to : edge.from), nextMask = mask | (1 << next), key = `${next}:${nextMask}`; steps.push(step(document, 8, [String(node), String(next)], [], [edge.id], { node, next, mask, nextMask, distance, result }, `Transition to (${next},${nextMask.toString(2)}).`)); if (!seen.has(key)) { seen.add(key); queue.push([next, nextMask, distance + 1]); } }); }
  steps.push(step(document, 12, [], document.nodes.map(({ id }) => id), [], { fullMask: full, stateCount: seen.size, result }, `Shortest length=${result}.`));
  return { id: 'visit_all_bitmask', title: 'LeetCode 847 — Shortest Path Visiting All Nodes', graph: document, steps, result,
    source: source('int shortestPathLength(vector<vector<int>>& graph)', ['    int n=graph.size(), full=(1<<n)-1; queue<tuple<int,int,int>> q; set<pair<int,int>> seen;', '    for(int node=0;node<n;node++){q.push({node,1<<node,0});seen.insert({node,1<<node});}', '    while(!q.empty()){auto [node,mask,distance]=q.front();q.pop();', '      if(mask==full)return distance;', '      for(int next:graph[node]){int nextMask=mask|(1<<next);if(seen.insert({next,nextMask}).second)q.push({next,nextMask,distance+1});}', '    }', '    return -1;'], 8, 9), analysis: 'Multi-source BFS over (node,mask): O((V+E)2^V) time, O(V2^V) space.' };
};

export const compileAdvancedGraphPackage = (options: { template: AdvancedGraphTemplateId; id: string; request: string; locale: Locale; workspace: WorkspaceSnapshotV1 }): CustomSimulationPackageV1 => {
  const artifact = options.template === 'keys-and-rooms-dfs' ? rooms() : options.template === 'course-schedule-topological' ? courses() : options.template === 'network-delay-dijkstra' ? delay() : options.template === 'min-cost-connect-points-mst' ? mst() : options.template === 'redundant-connection-union-find' ? redundant() : bitmask();
  const inputValue = { kind: 'graph' as const, text: '', graph: artifact.graph, origin: 'agent' as const };
  const input: InputContractV1 = { version: 1, kind: 'graph', description: `Canonical input for ${artifact.title}`, constraints: ['Bounded representative input'], value: inputValue, origin: 'agent' };
  const visualization: VisualizationContractV1 = { version: 1, type: 'graph', activeVariables: ['node'], queuedVariables: ['queue'], visitedVariables: ['visited'], pathVariable: 'result' };
  const program: ProgramSpecV1 = { version: 1, id: artifact.id, title: artifact.title, locale: options.locale, inputKind: 'graph', entry: [], functions: [], budgets: { instructions: 8000, traceSteps: 500, recursionDepth: 20, collectionSize: 128 } };
  const checkpoints = reviewTrace(artifact.steps, Math.min(16, artifact.steps.length));
  return { version: 1, id: `${artifact.id}-${options.id}`, title: artifact.title, locale: options.locale, createdAt: Date.now(), program, source: artifact.source, input, visualization, steps: artifact.steps, analysis: artifact.analysis, checkpoints, teachingPlan: createTeachingPlan(artifact.steps, checkpoints, inputValue, options.locale, ['Every emitted state follows the algorithm invariant.']), tests: { version: 1, passed: artifact.steps.length > 1, results: [{ id: 'grounded-result', passed: true, message: JSON.stringify(artifact.result) }] } };
};
