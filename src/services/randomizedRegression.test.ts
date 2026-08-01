import { describe, expect, it } from 'vitest';
import type { GraphDocumentV1 } from '../types/simulation';
import { algorithmRegistry } from './codeRegistry';
import { simulateAlgorithm } from './simulators';

const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
};

const algorithm = (name: string) => {
  const found = algorithmRegistry.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`Missing algorithm fixture: ${name}`);
  return found;
};

describe('seeded unknown-input regression', () => {
  it('matches an independent sort for varied negative, duplicate, and ordered arrays', () => {
    const names = [
      'Quick Sort',
      'Merge Sort',
      'Heap Sort',
      'Bubble Sort',
      'Insertion Sort',
      'Selection Sort',
    ];
    const random = createRandom(0xC0DE_2026);
    const arrays = Array.from({ length: 24 }, (_, caseIndex) => {
      const length = 1 + Math.floor(random() * 22);
      const values = Array.from({ length }, () => Math.floor(random() * 31) - 15);
      if (caseIndex % 6 === 0) values.sort((a, b) => a - b);
      if (caseIndex % 6 === 1) values.sort((a, b) => b - a);
      return values;
    });

    for (const name of names) {
      const preset = algorithm(name);
      for (const [caseIndex, values] of arrays.entries()) {
        const expected = [...values].sort((a, b) => a - b);
        const steps = simulateAlgorithm(preset.name, preset.code, {
          kind: 'array', text: JSON.stringify(values), origin: 'user',
        });
        const final = steps.at(-1)?.visualData;
        expect(final?.type, `${name}, seed case ${caseIndex}, input ${JSON.stringify(values)}`)
          .toBe('array');
        expect(final?.type === 'array' ? final.values : [],
          `${name}, seed case ${caseIndex}, input ${JSON.stringify(values)}`)
          .toEqual(expected);
      }
    }
  });

  it('matches native substring positions for Unicode and repeated-pattern strings', () => {
    const names = [
      'Knuth-Morris-Pratt (KMP)',
      'Rabin-Karp Algorithm',
      'Boyer-Moore Algorithm',
    ];
    const random = createRandom(0x51A1_2026);
    const alphabet = ['a', 'b', 'ç', 'ğ', 'İ', 'ö'];
    for (let caseIndex = 0; caseIndex < 20; caseIndex += 1) {
      const text = Array.from({ length: 8 + Math.floor(random() * 18) }, () =>
        alphabet[Math.floor(random() * alphabet.length)]).join('');
      const patternStart = Math.floor(random() * Math.max(1, text.length - 3));
      const pattern = caseIndex % 4 === 0
        ? 'yok'
        : text.slice(patternStart, patternStart + 1 + Math.floor(random() * 3));
      const expected: number[] = [];
      for (let index = text.indexOf(pattern); index >= 0; index = text.indexOf(pattern, index + 1)) {
        expected.push(index);
      }

      for (const name of names) {
        const preset = algorithm(name);
        const final = simulateAlgorithm(preset.name, preset.code, {
          kind: 'string',
          text,
          parameters: { pattern, modulus: '1009' },
          origin: 'user',
        }).at(-1)?.visualData.vars;
        expect(final?.matches, `${name}, case ${caseIndex}, text=${text}, pattern=${pattern}`)
          .toEqual(expected);
      }
    }
  });

  it('matches an independent shortest-path result on generated connected graphs', () => {
    const preset = algorithm("Dijkstra's Shortest Path");
    const random = createRandom(0xD1A5_2026);
    for (let caseIndex = 0; caseIndex < 12; caseIndex += 1) {
      const ids = Array.from({ length: 7 }, (_, index) => `v${index}`);
      const edges: GraphDocumentV1['edges'] = ids.slice(1).map((id, index) => ({
        id: `chain-${index}`,
        from: ids[index],
        to: id,
        weight: 1 + Math.floor(random() * 9),
      }));
      for (let from = 0; from < ids.length; from += 1) {
        for (let to = from + 2; to < ids.length; to += 1) {
          if (random() < 0.28) edges.push({
            id: `extra-${from}-${to}`,
            from: ids[from],
            to: ids[to],
            weight: 1 + Math.floor(random() * 9),
          });
        }
      }
      const graph: GraphDocumentV1 = {
        version: 1,
        mode: 'graph',
        directed: false,
        weighted: true,
        nodes: ids.map((id, index) => ({ id, label: id, x: 8 + index * 14, y: 50 })),
        edges,
        startId: ids[0],
        targetId: ids.at(-1),
      };

      const expected = Object.fromEntries(ids.map((id) => [id, Number.POSITIVE_INFINITY]));
      expected[ids[0]] = 0;
      const visited = new Set<string>();
      while (visited.size < ids.length) {
        const current = ids
          .filter((id) => !visited.has(id))
          .sort((left, right) => expected[left] - expected[right])[0];
        visited.add(current);
        for (const edge of edges) {
          const neighbor = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
          if (neighbor) expected[neighbor] = Math.min(
            expected[neighbor], expected[current] + (edge.weight ?? 1),
          );
        }
      }

      const final = simulateAlgorithm(preset.name, preset.code, {
        kind: 'graph', text: '', graph, origin: 'user',
      }).at(-1)?.visualData.vars;
      expect((final?.distances as Record<string, number> | undefined)?.[ids.at(-1)!],
        `graph seed case ${caseIndex}: ${JSON.stringify(edges)}`)
        .toBe(expected[ids.at(-1)!]);
    }
  });

  it('rejects every seeded negative-edge graph before producing a partial shortest-path trace', () => {
    const random = createRandom(0xBAD_ED9E);
    for (let caseIndex = 0; caseIndex < 24; caseIndex += 1) {
      const ids = Array.from({ length: 3 + (caseIndex % 6) }, (_, index) => `n${index}`);
      const negativeIndex = 1 + Math.floor(random() * (ids.length - 1));
      const graph: GraphDocumentV1 = {
        version: 1,
        mode: 'graph',
        directed: caseIndex % 2 === 0,
        weighted: true,
        nodes: ids.map((id, index) => ({ id, label: id, x: 8 + index * 12, y: 50 })),
        edges: ids.slice(1).map((id, index) => ({
          id: `e${index}`,
          from: ids[index],
          to: id,
          weight: index + 1 === negativeIndex ? -(1 + caseIndex) : 1 + Math.floor(random() * 9),
        })),
        startId: ids[0],
        targetId: ids.at(-1),
      };

      for (const name of ["Dijkstra's Shortest Path", 'A* Search Algorithm']) {
        const preset = algorithm(name);
        expect(() => simulateAlgorithm(preset.name, preset.code, {
          kind: 'graph', text: '', graph, origin: 'user',
        }), `${name}, seeded case ${caseIndex}`).toThrow('Negative edge weights');
      }
    }
  });

  it('matches independent shortest paths and keeps the derived A* heuristic admissible on diverse graphs', () => {
    const random = createRandom(0xA57A_2026);
    const shortestDistances = (graph: GraphDocumentV1, start: string) => {
      const distances = Object.fromEntries(graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
      distances[start] = 0;
      for (let pass = 1; pass < graph.nodes.length; pass += 1) {
        let changed = false;
        for (const edge of graph.edges) {
          const weight = edge.weight ?? 1;
          if (distances[edge.from] + weight < distances[edge.to]) {
            distances[edge.to] = distances[edge.from] + weight;
            changed = true;
          }
          if (!graph.directed && distances[edge.to] + weight < distances[edge.from]) {
            distances[edge.from] = distances[edge.to] + weight;
            changed = true;
          }
        }
        if (!changed) break;
      }
      return distances;
    };

    for (let caseIndex = 0; caseIndex < 30; caseIndex += 1) {
      const ids = ['baş', 'node 2', 'x/y', 'δ', 'equal!', 'goal', 'isolated'];
      const nodes = ids.map((id, index) => ({
        id,
        label: id,
        x: 8 + (index % 4) * 27,
        y: 18 + Math.floor(index / 4) * 58,
      }));
      const directed = caseIndex % 2 === 0;
      const edges: GraphDocumentV1['edges'] = [
        { id: 'a', from: ids[0], to: ids[1], weight: 2 },
        { id: 'b', from: ids[0], to: ids[2], weight: 2 },
        { id: 'c', from: ids[1], to: ids[3], weight: 2 },
        { id: 'd', from: ids[2], to: ids[3], weight: 2 },
        { id: 'e', from: ids[3], to: ids[5], weight: 3 },
        { id: 'cycle-out', from: ids[1], to: ids[4], weight: 1 },
        { id: 'cycle-back', from: ids[4], to: ids[1], weight: 1 },
      ];
      if (caseIndex % 3 === 0) edges.splice(4, 1);
      if (caseIndex % 5 !== 0) edges.push({ id: 'alternate-goal', from: ids[4], to: ids[5], weight: 4 });
      if (random() > 0.5) edges.push({ id: 'cross', from: ids[2], to: ids[4], weight: 1 + Math.floor(random() * 4) });
      const graph: GraphDocumentV1 = {
        version: 1,
        mode: 'graph',
        directed,
        weighted: true,
        nodes,
        edges,
        startId: ids[0],
        targetId: ids[5],
      };
      const expected = shortestDistances(graph, graph.startId);
      const reverse: GraphDocumentV1 = {
        ...graph,
        directed: true,
        edges: graph.edges.flatMap((edge) => graph.directed
          ? [{ ...edge, from: edge.to, to: edge.from }]
          : [
              { ...edge, id: `${edge.id}-r1`, from: edge.to, to: edge.from },
              { ...edge, id: `${edge.id}-r2` },
            ]),
      };
      const remaining = shortestDistances(reverse, graph.targetId!);
      const ratios = graph.edges.map((edge) => {
        const from = graph.nodes.find((node) => node.id === edge.from)!;
        const to = graph.nodes.find((node) => node.id === edge.to)!;
        return (edge.weight ?? 1) / Math.hypot(from.x - to.x, from.y - to.y);
      });
      const scale = ratios.length ? Math.min(...ratios) : 0;
      for (const node of graph.nodes) {
        const goal = graph.nodes.find((candidate) => candidate.id === graph.targetId)!;
        const heuristic = Math.hypot(node.x - goal.x, node.y - goal.y) * scale;
        expect(heuristic, `case=${caseIndex} node=${node.id}`).toBeLessThanOrEqual(remaining[node.id] + 1e-9);
      }

      for (const name of ["Dijkstra's Shortest Path", 'A* Search Algorithm']) {
        const preset = algorithm(name);
        const steps = simulateAlgorithm(preset.name, preset.code, { kind: 'graph', text: '', graph, origin: 'user' });
        const actual = steps.at(-1)?.visualData.vars.distances as Record<string, number | string>;
        const expectedTarget = expected[graph.targetId!];
        expect(actual[graph.targetId!], `${name} case=${caseIndex} graph=${JSON.stringify(graph)}`)
          .toEqual(Number.isFinite(expectedTarget) ? expectedTarget : '∞');
        expect(actual[ids[6]]).toBe('∞');
        expect(steps.length).toBeLessThanOrEqual(graph.nodes.length + graph.edges.length + 1);
      }
    }
  });

  it('matches independent MST, SCC, and max-flow oracles on seeded graph families', () => {
    const random = createRandom(0xF10A_2026);
    const normalizeComponents = (value: unknown): string[] =>
      (value as string[][]).map((component) => [...component].sort().join('|')).sort();

    for (let caseIndex = 0; caseIndex < 18; caseIndex += 1) {
      const ids = Array.from({ length: 5 + (caseIndex % 3) }, (_, index) => `g${caseIndex}-${index}`);
      const mstEdges: GraphDocumentV1['edges'] = ids.slice(1).map((id, index) => ({
        id: `tree-${index}`,
        from: ids[index],
        to: id,
        weight: 1 + Math.floor(random() * 12),
      }));
      for (let left = 0; left < ids.length; left += 1) {
        for (let right = left + 2; right < ids.length; right += 1) {
          if (random() < 0.42) mstEdges.push({
            id: `extra-${left}-${right}`,
            from: ids[left],
            to: ids[right],
            weight: 1 + Math.floor(random() * 12),
          });
        }
      }
      const mstGraph: GraphDocumentV1 = {
        version: 1, mode: 'graph', directed: false, weighted: true,
        nodes: ids.map((id, index) => ({ id, label: id, x: 8 + index * 12, y: 50 })),
        edges: mstEdges, startId: ids[0], targetId: ids.at(-1),
      };
      const parent = new Map(ids.map((id) => [id, id]));
      const find = (id: string): string => {
        const value = parent.get(id)!;
        if (value === id) return id;
        const root = find(value);
        parent.set(id, root);
        return root;
      };
      let expectedWeight = 0;
      for (const edge of [...mstEdges].sort((left, right) => (left.weight ?? 1) - (right.weight ?? 1))) {
        const from = find(edge.from);
        const to = find(edge.to);
        if (from === to) continue;
        parent.set(from, to);
        expectedWeight += edge.weight ?? 1;
      }
      for (const name of ["Kruskal's MST", "Prim's MST"]) {
        const preset = algorithm(name);
        const final = simulateAlgorithm(preset.name, preset.code, {
          kind: 'graph', text: '', graph: mstGraph, origin: 'user',
        }).at(-1)?.visualData.vars;
        expect(final?.totalWeight, `${name} seeded MST case ${caseIndex}`).toBe(expectedWeight);
      }

      const sccEdges: GraphDocumentV1['edges'] = [];
      for (let from = 0; from < ids.length; from += 1) {
        for (let to = 0; to < ids.length; to += 1) {
          if (from !== to && random() < 0.28) sccEdges.push({
            id: `scc-${from}-${to}`, from: ids[from], to: ids[to],
          });
        }
      }
      const sccGraph: GraphDocumentV1 = {
        ...mstGraph, directed: true, weighted: false, edges: sccEdges,
      };
      const reachable = (start: string, target: string) => {
        const seen = new Set([start]);
        const queue = [start];
        while (queue.length) {
          const current = queue.shift()!;
          for (const edge of sccEdges.filter((candidate) => candidate.from === current)) {
            if (edge.to === target) return true;
            if (!seen.has(edge.to)) { seen.add(edge.to); queue.push(edge.to); }
          }
        }
        return start === target;
      };
      const remaining = new Set(ids);
      const expectedComponents: string[][] = [];
      while (remaining.size) {
        const first = remaining.values().next().value as string;
        const component = ids.filter((id) => reachable(first, id) && reachable(id, first));
        component.forEach((id) => remaining.delete(id));
        expectedComponents.push(component);
      }
      for (const name of ["Kosaraju's SCC", "Tarjan's SCC"]) {
        const preset = algorithm(name);
        const final = simulateAlgorithm(preset.name, preset.code, {
          kind: 'graph', text: '', graph: sccGraph, origin: 'user',
        }).at(-1)?.visualData.vars;
        expect(normalizeComponents(final?.components), `${name} seeded SCC case ${caseIndex}`)
          .toEqual(normalizeComponents(expectedComponents));
      }

      const flowIds = ['source', 'a', 'b', 'c', 'sink'];
      const flowEdges: GraphDocumentV1['edges'] = [
        { id: 'sa', from: 'source', to: 'a', weight: 1 + Math.floor(random() * 8) },
        { id: 'sb', from: 'source', to: 'b', weight: 1 + Math.floor(random() * 8) },
        { id: 'ac', from: 'a', to: 'c', weight: 1 + Math.floor(random() * 8) },
        { id: 'bc', from: 'b', to: 'c', weight: 1 + Math.floor(random() * 8) },
        { id: 'at', from: 'a', to: 'sink', weight: 1 + Math.floor(random() * 5) },
        { id: 'bt', from: 'b', to: 'sink', weight: 1 + Math.floor(random() * 5) },
        { id: 'ct', from: 'c', to: 'sink', weight: 1 + Math.floor(random() * 8) },
      ];
      const flowGraph: GraphDocumentV1 = {
        version: 1, mode: 'graph', directed: true, weighted: true,
        nodes: flowIds.map((id, index) => ({ id, label: id, x: 10 + index * 20, y: 50 })),
        edges: flowEdges, startId: 'source', targetId: 'sink',
      };
      const capacity = new Map<string, number>();
      for (const edge of flowEdges) {
        capacity.set(`${edge.from}|${edge.to}`, edge.weight ?? 1);
        capacity.set(`${edge.to}|${edge.from}`, 0);
      }
      let expectedFlow = 0;
      while (true) {
        const predecessor = new Map<string, string>();
        const queue = ['source'];
        const seen = new Set(queue);
        while (queue.length && !seen.has('sink')) {
          const current = queue.shift()!;
          for (const candidate of flowIds) {
            if (seen.has(candidate) || (capacity.get(`${current}|${candidate}`) ?? 0) <= 0) continue;
            seen.add(candidate);
            predecessor.set(candidate, current);
            queue.push(candidate);
          }
        }
        if (!seen.has('sink')) break;
        let increment = Number.POSITIVE_INFINITY;
        for (let node = 'sink'; node !== 'source'; node = predecessor.get(node)!) {
          const previous = predecessor.get(node)!;
          increment = Math.min(increment, capacity.get(`${previous}|${node}`) ?? 0);
        }
        for (let node = 'sink'; node !== 'source'; node = predecessor.get(node)!) {
          const previous = predecessor.get(node)!;
          capacity.set(`${previous}|${node}`, (capacity.get(`${previous}|${node}`) ?? 0) - increment);
          capacity.set(`${node}|${previous}`, (capacity.get(`${node}|${previous}`) ?? 0) + increment);
        }
        expectedFlow += increment;
      }
      for (const name of ['Edmonds-Karp Max Flow', "Dinic's Max Flow"]) {
        const preset = algorithm(name);
        const final = simulateAlgorithm(preset.name, preset.code, {
          kind: 'graph', text: '', graph: flowGraph, origin: 'user',
        }).at(-1)?.visualData.vars;
        expect(final?.maxFlow, `${name} seeded flow case ${caseIndex}`).toBe(expectedFlow);
      }
    }
  });
});
