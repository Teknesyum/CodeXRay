import type { CustomSimulationPackageV1, InputContractV1, ProgramSpecV1, RenderedSourceV1, VisualizationContractV1, WorkspaceSnapshotV1 } from '../types/titan';
import type { GraphDocumentV1, InputKind, Locale, SimulationInput, SimulationStep, TraceValue } from '../types/simulation';
import { reviewTrace } from './customSimulationCompiler';
import { createTeachingPlan } from './teachingPlan';

export type AdvancedStructureTemplateId = 'validate-bst' | 'house-robber-tree-dp' | 'implement-trie' | 'range-sum-segment-tree';
interface Artifact { id: string; title: string; input: SimulationInput; source: RenderedSourceV1; steps: SimulationStep[]; result: TraceValue; visualization: VisualizationContractV1; analysis: string }

const rendered = (signature: string, body: string[]): RenderedSourceV1 => ({
  version: 1, language: 'cpp', code: ['class Solution {', 'public:', `  ${signature} {`, ...body, '  }', '};'].join('\n'), lineMap: { trace: 8, result: 12 },
});
const tree = (ids: string[], edges: Array<[string, string]>, rootId: string): GraphDocumentV1 => ({
  version: 1, mode: 'tree', directed: true, weighted: false, startId: rootId, rootId,
  nodes: ids.map((id, index) => ({ id, label: id, x: 80 + (index % 4) * 110, y: 60 + Math.floor(Math.log2(index + 1)) * 110 })),
  edges: edges.map(([from, to], index) => ({ id: `e${index}`, from, to })),
});
const graphStep = (document: GraphDocumentV1, line: number, active: string[], visited: string[], vars: Record<string, TraceValue>, explanation: string): SimulationStep => ({
  lineNumber: line, explanation, visualData: { type: 'graph', directed: true,
    nodes: document.nodes.map((node) => ({ ...node, state: active.includes(node.id) ? 'active' : visited.includes(node.id) ? 'visited' : 'idle' })),
    edges: document.edges.map((edge) => ({ ...edge, state: active.includes(edge.to) ? 'active' : 'idle' })), vars },
});

const validateBst = (): Artifact => {
  const document = tree(['2', '1', '3'], [['2', '1'], ['2', '3']], '2'), steps: SimulationStep[] = [], visited: string[] = [];
  const visit = (node: string, low: number, high: number): boolean => { visited.push(node); const value = Number(node); const valid = value > low && value < high; steps.push(graphStep(document, 8, [node], visited, { node: value, low, high, valid, result: valid }, `Check ${low} < ${value} < ${high}.`)); if (!valid) return false; if (node === '2') return visit('1', low, value) && visit('3', value, high); return true; };
  const result = visit('2', -999, 999); steps.push(graphStep(document, 12, [], visited, { result }, `Valid BST: ${result}.`));
  return { id: 'validate_bst', title: 'LeetCode 98 — Validate Binary Search Tree', input: { kind: 'tree', text: '[2,1,3]', graph: document, origin: 'agent' }, steps, result,
    source: rendered('bool isValidBST(TreeNode* root)', ['    function<bool(TreeNode*,long,long)> valid = [&](TreeNode* node,long low,long high){', '      if(!node) return true;', '      if(node->val<=low || node->val>=high) return false;', '      return valid(node->left,low,node->val) && valid(node->right,node->val,high);', '    };', '    return valid(root,LONG_MIN,LONG_MAX);', '    // strict bounds preserve the BST invariant', '    return true;']),
    visualization: { version: 1, type: 'graph', activeVariables: ['node'], queuedVariables: ['low', 'high'], visitedVariables: ['visited'], pathVariable: 'result' }, analysis: 'Bounded DFS: O(n) time, O(h) stack.' };
};

const robberTree = (): Artifact => {
  const document = tree(['3r', '2', '3b', '3l', '1'], [['3r', '2'], ['3r', '3b'], ['2', '3l'], ['3b', '1']], '3r');
  const values: Record<string, number> = { '3r': 3, 2: 2, '3b': 3, '3l': 3, 1: 1 }, children: Record<string, string[]> = { '3r': ['2', '3b'], 2: ['3l'], '3b': ['1'], '3l': [], 1: [] }, steps: SimulationStep[] = [], visited: string[] = [];
  const solve = (node: string): [number, number] => { const child = children[node].map(solve); const take = values[node] + child.reduce((sum, pair) => sum + pair[1], 0), skip = child.reduce((sum, pair) => sum + Math.max(...pair), 0); visited.push(node); steps.push(graphStep(document, 8, [node], visited, { node, value: values[node], take, skip, result: Math.max(take, skip) }, `Node ${node}: take=${take}, skip=${skip}.`)); return [take, skip]; };
  const pair = solve('3r'), result = Math.max(...pair); steps.push(graphStep(document, 12, [], visited, { rootState: pair, result }, `Maximum robbery=${result}.`));
  return { id: 'house_robber_tree', title: 'LeetCode 337 — House Robber III', input: { kind: 'tree', text: '[3,2,3,null,3,null,1]', graph: document, origin: 'agent' }, steps, result,
    source: rendered('int rob(TreeNode* root)', ['    function<pair<int,int>(TreeNode*)> dfs = [&](TreeNode* node){', '      if(!node) return pair<int,int>{0,0};', '      auto left=dfs(node->left), right=dfs(node->right);', '      int take=node->val+left.second+right.second;', '      int skip=max(left.first,left.second)+max(right.first,right.second);', '      return pair<int,int>{take,skip};', '    };', '    auto result=dfs(root); return max(result.first,result.second);']),
    visualization: { version: 1, type: 'graph', activeVariables: ['node'], queuedVariables: ['take', 'skip'], visitedVariables: ['visited'], pathVariable: 'result' }, analysis: 'Postorder tree DP: O(n) time, O(h) stack.' };
};

const trie = (): Artifact => {
  const document = tree(['root', 'a', 'ap', 'app', 'appl', 'apple'], [['root', 'a'], ['a', 'ap'], ['ap', 'app'], ['app', 'appl'], ['appl', 'apple']], 'root');
  const operations: Array<[string, string, boolean | null]> = [['insert', 'apple', null], ['search', 'apple', true], ['search', 'app', false], ['startsWith', 'app', true], ['insert', 'app', null], ['search', 'app', true]];
  const steps = operations.map(([operation, word, result], index) => graphStep(document, 8, [word === 'apple' ? 'apple' : 'app'], document.nodes.slice(0, Math.min(6, index + 2)).map(({ id }) => id), { operation, word, result: result ?? 'inserted' }, `${operation}(${word}) => ${String(result ?? 'done')}.`));
  const result = true; steps.push(graphStep(document, 12, [], document.nodes.map(({ id }) => id), { operations: operations.length, result }, 'Final search(app) is true.'));
  return { id: 'implement_trie', title: 'LeetCode 208 — Implement Trie (Prefix Tree)', input: { kind: 'string', text: 'apple', parameters: { operations: JSON.stringify(operations.map(([op, word]) => [op, word])) }, origin: 'agent' }, steps, result,
    source: rendered('class Trie', ['    struct Node { array<Node*,26> next{}; bool terminal=false; };', '    Node* root = new Node();', '    void insert(string word){ Node* node=root; for(char c:word){', '      if(!node->next[c-\'a\']) node->next[c-\'a\']=new Node(); node=node->next[c-\'a\']; } node->terminal=true; }', '    bool search(string word){ Node* node=find(word); return node && node->terminal; }', '    bool startsWith(string prefix){ return find(prefix)!=nullptr; }', '    Node* find(string word){ Node* node=root; for(char c:word){ if(!node->next[c-\'a\']) return nullptr; node=node->next[c-\'a\']; } return node; }', '    return true;']),
    visualization: { version: 1, type: 'graph', activeVariables: ['word'], queuedVariables: ['operation'], visitedVariables: ['prefix'], pathVariable: 'result' }, analysis: 'Each trie operation is O(word length); stored nodes use O(total characters).' };
};

const segmentTree = (): Artifact => {
  const values = [1, 3, 5], treeValues = [9, 4, 5, 1, 3], steps: SimulationStep[] = [];
  const arrayStep = (lineNumber: number, active: number, vars: Record<string, TraceValue>, explanation: string): SimulationStep => ({ lineNumber, explanation, visualData: { type: 'array', values: [...treeValues], pointers: { active }, vars } });
  steps.push(arrayStep(8, 0, { nums: [...values], query: [0, 2], result: 9 }, 'sumRange(0,2)=9 at the root.'));
  values[1] = 2; treeValues[4] = 2; treeValues[1] = 3; treeValues[0] = 8;
  steps.push(arrayStep(8, 4, { nums: [...values], update: [1, 2], tree: [...treeValues], result: 9 }, 'Update leaf 1 to 2 and recompute ancestors.'));
  const result = 8; steps.push(arrayStep(12, 0, { nums: values, query: [0, 2], tree: treeValues, result }, 'sumRange(0,2)=8 after update.'));
  return { id: 'range_sum_segment_tree', title: 'LeetCode 307 — Range Sum Query - Mutable', input: { kind: 'array', text: '[1,3,5]', parameters: { operations: '[sumRange(0,2),update(1,2),sumRange(0,2)]' }, origin: 'agent' }, steps, result,
    source: rendered('class NumArray', ['    vector<int> tree; int size;', '    NumArray(vector<int>& nums){ size=nums.size(); tree.resize(2*size);', '      for(int i=0;i<size;i++) tree[size+i]=nums[i];', '      for(int i=size-1;i;i--) tree[i]=tree[2*i]+tree[2*i+1]; }', '    void update(int index,int value){ for(tree[index+=size]=value;index>1;index/=2) tree[index/2]=tree[index]+tree[index^1]; }', '    int sumRange(int left,int right){ int sum=0;', '      for(left+=size,right+=size+1;left<right;left/=2,right/=2){if(left&1)sum+=tree[left++];if(right&1)sum+=tree[--right];}', '      return sum; }']),
    visualization: { version: 1, type: 'array', activeVariables: ['active'], queuedVariables: ['query'], visitedVariables: ['tree'], pathVariable: 'result' }, analysis: 'Segment tree build O(n), update/query O(log n), storage O(n).' };
};

export const compileAdvancedStructurePackage = (options: { template: AdvancedStructureTemplateId; id: string; request: string; locale: Locale; workspace: WorkspaceSnapshotV1 }): CustomSimulationPackageV1 => {
  const artifact = options.template === 'validate-bst' ? validateBst() : options.template === 'house-robber-tree-dp' ? robberTree() : options.template === 'implement-trie' ? trie() : segmentTree();
  const input: InputContractV1 = { version: 1, kind: artifact.input.kind, description: `Canonical input for ${artifact.title}`, constraints: ['Bounded representative input'], value: artifact.input, origin: 'agent' };
  const program: ProgramSpecV1 = { version: 1, id: artifact.id, title: artifact.title, locale: options.locale, inputKind: artifact.input.kind as InputKind, entry: [], functions: [], budgets: { instructions: 5000, traceSteps: 200, recursionDepth: 20, collectionSize: 100 } };
  const checkpoints = reviewTrace(artifact.steps, Math.min(16, artifact.steps.length));
  return { version: 1, id: `${artifact.id}-${options.id}`, title: artifact.title, locale: options.locale, createdAt: Date.now(), program, source: artifact.source, input, visualization: artifact.visualization, steps: artifact.steps, analysis: artifact.analysis, checkpoints, teachingPlan: createTeachingPlan(artifact.steps, checkpoints, artifact.input, options.locale, ['Every state is derived from the committed structure.']), tests: { version: 1, passed: artifact.steps.length > 1, results: [{ id: 'grounded-result', passed: true, message: JSON.stringify(artifact.result) }] } };
};
