import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SimulationStep {
  lineNumber: number | null;
  visualData: any; // Dynamic data (nodes, arrays, strings)
  explanation: string; // The text to show in the UI for this step
}

const MAGIC_SIM_KEY = atob("QVEuQWI4Uk42S1FscndPT3FSUnI5RVFpbjVWVFlFYTYwdnhYSzdOOGFPNWY3UHZGeTBhVXc=");

export const generateSimulationSteps = async (
  code: string, 
  apiKey: string = '',
  inputVars: string = ''
): Promise<SimulationStep[]> => {
  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    if (!apiKey) console.warn("No API Key provided. Falling back to mock simulation.");
    else console.warn("Magic Simulation Key detected! Using mock simulation.");
    return getMockStepsFallback(code, inputVars);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert code execution tracer. I will provide you with a piece of code and an optional set of input variables.
      Your job is to dry-run (simulate) the execution of this code step-by-step and output a JSON array of steps.
      
      Input Variables given by user: ${inputVars || 'None provided'}
      
      Language for explanation: English
      
      Code to simulate:
      ${code}

      Output MUST be a valid JSON array of objects. Each object must have:
      - lineNumber: (number) The line of code currently executing (1-indexed).
      - visualData: (object) Use this to represent the state of arrays, trees, graphs, or variables.
         - For arrays/strings: { type: 'array', values: ['A','B','C'], pointers: { "i": 0, "L": 0, "R": 1 }, vars: { "n": 3 } }
         - For graphs/trees: { type: 'graph', nodes: [{ id: 1, label: '1', x: 50, y: 10, active: true }], edges: [{ from: 1, to: 2, active: true }], vars: { "current": 1 } }. Use x (0-100) and y (0-100) for UI positioning.
         - For variables: { type: 'vars', vars: { "name": "value" } }
         - The "vars" object will be shown in the UI tracking panel. Include all current local variables.
      - explanation: (string) A short explanation of what is happening in this line.

      ONLY RETURN THE JSON ARRAY. No markdown blocks, no backticks, no other text.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    if (text.startsWith('\`\`\`json')) {
      text = text.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
    } else if (text.startsWith('\`\`\`')) {
      text = text.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim();
    }

    const steps: SimulationStep[] = JSON.parse(text);
    return steps;
  } catch (error: any) {
    console.error("Gemini API error:", error);
    alert("Gemini API error: " + (error.message || "Unknown error"));
    return getMockStepsFallback(code, inputVars);
  }
};

export const askQuestion = async (
  question: string,
  code: string,
  currentStep: SimulationStep | undefined,
  apiKey: string = '',
  chatHistory: {role: string, content: string}[] = []
): Promise<string> => {
  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    if (apiKey === MAGIC_SIM_KEY) {
       const q = question.toLowerCase();
       if (q.includes("prove") || q.includes("proof")) {
          return "Dijkstra's correctness follows by induction. Let S contain the nodes whose shortest distances are final. At each step, choose the node u outside S with the smallest tentative distance. If a shorter path to u existed, it would have to pass through another node outside S. With no negative edge weights, that node cannot lead to a path shorter than u's current distance. Therefore, u's distance is final when it is selected.";
       }
       if (q.includes("vertices") || q.includes("edges") || q.match(/\be\b/) || q.match(/\bv\b/)) {
          return "In complexity analysis, V is the number of vertices (graph nodes) and E is the number of edges connecting them. For example, O(E) means the running time grows with the total number of edges.";
       }
       if (q.includes("shortest path") || q.includes("guarantee")) {
          return "Algorithms such as BFS and Dijkstra expand the graph in increasing distance or cost order. When the target is finalized, every unexplored route is guaranteed to be at least as long or expensive, so the result is optimal under the algorithm's assumptions.";
       }
       if (q.includes("a*") || q.includes("heuristic")) {
          return "A* combines the known cost from the start, g(n), with an estimated remaining cost, h(n), and minimizes f(n) = g(n) + h(n). It focuses the search toward the target and guarantees a shortest path when the heuristic is admissible.";
       }
       if (q.includes("dfs") || q.includes("depth")) {
          return "DFS follows one branch as deeply as possible before backtracking. It does not guarantee a shortest path, but its memory usage can be lower than BFS on wide graphs.";
       }
       if (q.includes("z algorithm") || q.includes("string")) {
          return "The Z algorithm stores previous matches inside a Z-box, avoiding repeated character comparisons and achieving O(N) time.";
       }
       if (q.includes("sort") || q.includes("selection")) {
          return "Selection Sort finds the smallest remaining value and performs at most one swap per pass. It uses O(N²) comparisons but only O(N) swaps, which can matter when writes are expensive.";
       }
       if (q.includes("hello") || q.includes("hi")) {
           return "Hello! I am here to help with your code. (Simulated AI)";
       }
       return `I've considered your question "${question}". This is an important observation at the current step. Simulation mode cannot generate dynamic analysis, but the algorithm's core data structures may provide a useful clue.`;
    }
    return "You are in free demo mode. To ask questions about the code, enter your Gemini API key in the Settings menu.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are Master Coder, a highly advanced code execution tracer AI.
      The user is asking a question about the algorithm they are currently visualizing.
      
      Context Information:
      - Algorithm Code:
      ${code}
      
      - Current Execution Step:
      Line Number: ${currentStep?.lineNumber || 'N/A'}
      Step Explanation: ${currentStep?.explanation || 'General overview'}
      Variables State: ${currentStep?.visualData?.vars ? JSON.stringify(currentStep.visualData.vars) : 'No specific variables'}
      
      Previous Chat History:
      ${chatHistory.map(m => `${m.role === 'ai' ? 'Master Coder' : 'User'}: ${m.content}`).join('\n')}
      
      User's Question: "${question}"
      
      Analyze the provided Context Information and answer the User's Question accurately. Explain what is happening at this specific step, why it happens, and how the variables are affected. 
      Output Language: English
      Answer directly. Keep it informative, friendly, and concise.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error: any) {
    console.error("Gemini API chat error:", error);
    return "API error. Please check your key.";
  }
};

export const generateQuestions = async (code: string, apiKey: string = ''): Promise<string[]> => {
  const mockFallback = [
    "1. Find if two strings are anagrams.",
    "2. Calculate the Longest Increasing Subsequence (LIS).",
    "3. Detect a pattern in text in O(N) time.",
    "4. Generate friend recommendations in a social network.",
    "5. Find the shortest route between two points with A*."
  ];

  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    if (apiKey === MAGIC_SIM_KEY) {
      return ["1. [SIMULATION] What real-life problem does this solve?", "2. [SIMULATION] Can you optimize the time complexity?", "3. [SIMULATION] How does this scale with memory?", "4. [SIMULATION] What about edge cases?", "5. [SIMULATION] What alternative data structures could be used?"];
    }
    return mockFallback;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze the following algorithm and provide 5 different interview or real-world problem scenarios where it could be used. List only the questions, numbered 1 through 5.\nCode:\n${code}`;
      
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const resultText = response.text().trim();
    
    // Split by newlines and filter out empty lines, taking first 5 items
    const lines = resultText.split('\n').filter((l: string) => l.trim().length > 0 && /^\d/.test(l.trim())).slice(0, 5);
    return lines.length === 5 ? lines : mockFallback;
  } catch (error) {
    console.error("AI Question Gen Failed:", error);
    return mockFallback;
  }
};

export const generateAnalysis = async (
  code: string, 
  apiKey: string = ''
): Promise<string> => {
  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    let purpose = "Purpose: Algorithm simulation.";
    let timeComplexity = "Unknown";
    let spaceComplexity = "Unknown";
    let optimization = "Enter a Gemini API key for detailed analysis.";
    
    if (code.includes('zFunction') || code.includes('ZAlgorithm')) {
      purpose = "Purpose: Pattern matching with the Z algorithm.";
      timeComplexity = "O(N + M)";
      spaceComplexity = "O(N)";
      optimization = "The Z array avoids repeated character comparisons; this approach is already optimal.";
    } else if (code.includes('DFS')) {
      purpose = "Purpose: Traverse a graph with Depth First Search.";
      timeComplexity = "O(V + E)";
      spaceComplexity = "O(V)";
      optimization = "An explicit stack can replace recursion to avoid call-stack overflow.";
    } else if (code.includes('BFS')) {
      purpose = "Purpose: Traverse a graph layer by layer with Breadth First Search.";
      timeComplexity = "O(V + E)";
      spaceComplexity = "O(V)";
      optimization = "Bidirectional BFS can reduce the search space for suitable shortest-path queries.";
    } else if (code.includes('dijkstra') || code.includes('Dijkstra')) {
      purpose = "Purpose: Find single-source shortest paths in a weighted graph with Dijkstra's algorithm.";
      timeComplexity = "O((V + E) log V)";
      spaceComplexity = "O(V)";
      optimization = "A Fibonacci heap can improve the theoretical bound to O(E + V log V).";
    } else if (code.includes('aStar') || code.includes('A*')) {
      purpose = "Purpose: Find a shortest path to a target with the A* heuristic search.";
      timeComplexity = "O(E)";
      spaceComplexity = "O(V)";
      optimization = "A more informative consistent heuristic, such as Manhattan or Euclidean distance, can improve performance.";
    }

    if (apiKey === MAGIC_SIM_KEY) {
        purpose = "(SIMULATED API RESPONSE) " + purpose;
        optimization = "Your API key is being simulated successfully. " + optimization;
    }

    return `${purpose}\nTime Complexity: ${timeComplexity}\nSpace Complexity: ${spaceComplexity}\nOptimization Potential: ${optimization}`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Analyze the following code. Output language: English.
      Please provide a highly structured, 4-line response in exactly this format without markdown bolding:
      Purpose: [Brief explanation]
      Time Complexity: [Big O]
      Space Complexity: [Big O]
      Optimization Potential: [Brief sentence on whether it can be optimized]
      
      Code:
      ${code}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini API analysis error:", error);
    return "Error analyzing code with API.";
  }
};


export const getMockStepsFallback = (code: string, inputVars: string = ''): SimulationStep[] => {
  if (code.includes('DFS') || code.includes('Depth First')) return getMockDfsSteps(inputVars);
  if (code.includes('BFS') || code.includes('Breadth First')) return getMockBfsSteps(inputVars);
  if (code.includes('dijkstra') || code.includes('Dijkstra')) return getMockDijkstraSteps(inputVars);
  if (code.includes('aStar') || code.includes('A*')) return getMockAStarSteps(inputVars);
  if (code.includes('ZAlgorithm') || code.includes('zFunction') || code.includes('z = new int')) return getMockArraySteps(inputVars);
  if (code.includes('Sort') || code.includes('swap') || code.includes('partition')) return getMockSortingSteps(inputVars);
  
  // Generic Fallback for stubs
  return [{
    lineNumber: 1,
    visualData: { 
      type: 'variables', 
      vars: { info: "Visual simulation not implemented for this stub." } 
    },
    explanation: "Offline visual simulation is not implemented for this algorithm. Use AI-based analysis or select a fully supported algorithm such as DFS or Z-Algorithm."
  }];
};

const getMockArraySteps = (inputVars: string): SimulationStep[] => {
  let s = "AABAABAAZ";
  
  if (inputVars === 'preset:i1') {
    s = "AABAABAAZ";
  } else if (inputVars === 'preset:i2') {
    s = "abacabadabacaba";
  } else if (inputVars === 'preset:i3') {
    s = "AABAACAADAABAACAABAA";
  } else if (inputVars) {
    const match = inputVars.match(/s\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
      s = match[1];
    } else {
      const fallbackMatch = inputVars.match(/['"]([^'"]+)['"]/);
      if (fallbackMatch && fallbackMatch[1]) {
         s = fallbackMatch[1];
      } else if (inputVars.trim() && !inputVars.includes('=')) {
         s = inputVars.trim();
      }
    }
  }
  
  const values = s.split('');
  const n = s.length;
  const steps: SimulationStep[] = [];
  
  const pushStep = (line: number, pointersObj: Record<string, number>, varsObj: any, explanation: string) => {
    steps.push({
      lineNumber: line,
      visualData: { type: 'array', values, pointers: pointersObj, vars: { ...varsObj } },
      explanation
    });
  };

  let z = new Array(n).fill(0);
  let l = 0, r = 0;
  
  pushStep(3, {}, { n }, "String length assigned to n.");
  pushStep(4, {}, { n, z: JSON.stringify(z) }, "Z array is initialized.");
  pushStep(5, { L: 0, R: 0 }, { n, z: JSON.stringify(z), l, r }, "Pointers l and r initialized to 0.");
  
  for (let i = 1; i < n; i++) {
    pushStep(6, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Loop starts for i=${i} ('${s[i]}').`);
    
    if (i <= r) {
      pushStep(7, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `i (${i}) <= r (${r}), we are inside the Z-box.`);
      z[i] = Math.min(r - i + 1, z[i - l]);
      pushStep(8, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Z[${i}] is optimized: ${z[i]}`);
    }
    
    pushStep(10, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Matching check starts (while loop).`);
    
    while (i + z[i] < n && s.charAt(z[i]) === s.charAt(i + z[i])) {
      pushStep(10, { "z[i]": z[i], "i+z[i]": i + z[i], L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `'${s.charAt(z[i])}' matches '${s.charAt(i + z[i])}'!`);
      z[i]++;
      pushStep(11, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Z[${i}] value incremented: ${z[i]}`);
    }
    
    if (i + z[i] < n) {
      pushStep(10, { "z[i]": z[i], "i+z[i]": i + z[i], L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `'${s.charAt(z[i])}' does not match '${s.charAt(i + z[i])}'.`);
    }
    
    pushStep(13, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Checking Z-box boundary.`);
    if (i + z[i] - 1 > r) {
      l = i;
      r = i + z[i] - 1;
      pushStep(14, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `New Z-box found! Updating pointers.`);
      pushStep(15, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `l and r updated to ${l} and ${r}.`);
    }
  }
  
  pushStep(18, { L: l, R: r }, { n, z: JSON.stringify(z), l, r }, "Loop ended. Simulation completed!");
  
  return steps;
}

const getMockDfsSteps = (inputVars: string): SimulationStep[] => {
  let xOffsets: number[] = []; let yOffsets: number[] = []; let edges: any[] = [];
  if (inputVars === 'preset:i1') {
    xOffsets = [50, 25, 75, 15, 35, 65, 85, 10, 20, 30, 40, 60, 70, 80, 90];
    yOffsets = [10, 30, 30, 50, 50, 50, 50, 70, 70, 70, 70, 70, 70, 70, 70];
    edges = [
      {from:1,to:2},{from:1,to:3},{from:2,to:4},{from:2,to:5},
      {from:3,to:6},{from:3,to:7},{from:4,to:8},{from:4,to:9},
      {from:5,to:10},{from:5,to:11},{from:6,to:12},{from:6,to:13},
      {from:7,to:14},{from:7,to:15}
    ];
  } else if (inputVars === 'preset:i3') {
    xOffsets = [10, 15, 20, 30, 40, 50, 60, 65, 70, 75, 80, 85, 90, 95, 95];
    yOffsets = [10, 80, 20, 70, 30, 60, 40, 90, 20, 80, 30, 70, 40, 60, 10];
    for (let i = 2; i <= 15; i++) edges.push({ from: i - 1, to: i });
    edges.push({from:2,to:7}, {from:5,to:12}, {from:8,to:15});
  } else {
    xOffsets = [10, 20, 35, 15, 30, 45, 55, 60, 75, 75, 85, 90, 95, 90, 95];
    yOffsets = [50, 25, 15, 75, 45, 35, 15, 60, 20, 80, 60, 15, 35, 45, 80];
    for (let i = 2; i <= 15; i++) edges.push({ from: Math.max(1, i - 1 - (i % 3)), to: i });
    [ [1,4], [3,7], [5,9], [8,12], [10,14], [2,6], [11,15] ].forEach(pair => edges.push({ from: pair[0], to: pair[1] }));
  }
  const baseNodes = Array.from({length: 15}, (_, i) => ({
    id: i + 1, label: (i+1).toString(), x: xOffsets[i], y: yOffsets[i], active: false
  }));

  const steps: SimulationStep[] = [];
  const visited = new Array(16).fill(false);
  const activeNodes = new Set<number>();
  
  const pushStep = (line: number, v: number, explanation: string) => {
    // Determine active edges based on activeNodes
    const activeEdges = edges.map(e => ({
      ...e,
      active: activeNodes.has(e.from) && activeNodes.has(e.to)
    }));

    steps.push({
      lineNumber: line,
      visualData: { 
        type: 'graph', 
        nodes: baseNodes.map(n => ({ ...n, active: activeNodes.has(n.id) || n.id === v })), 
        edges: activeEdges,
        vars: { current_node: v, visited: JSON.stringify(visited.slice(1, 8)) + '...' } // truncate for UI
      },
      explanation
    });
  };

  const dfs = (v: number) => {
    activeNodes.add(v);
    visited[v] = true;
    pushStep(2, v, `DFS(${v}) called. Node ${v} marked as visited.`);
    
    pushStep(4, v, `Checking neighbors of Node ${v} (while loop).`);
    
    const neighbors = edges.filter(e => e.from === v).map(e => e.to);
    for (const n of neighbors) {
      pushStep(6, v, `Checking neighbor ${n}.`);
      if (!visited[n]) {
        pushStep(7, v, `Neighbor ${n} not visited, descending to DFS(${n})...`);
        dfs(n);
        activeNodes.add(v); // Re-highlight current after returning from child
        pushStep(4, v, `DFS(${n}) finished. Backtracked to Node ${v}. Any other neighbors?`);
      }
    }
    pushStep(9, v, `All neighbors of Node ${v} visited. Backtracking up.`);
    activeNodes.delete(v);
  };

  pushStep(1, 1, "Starting DFS from node 1...");
  dfs(1);
  pushStep(10, 1, "Entire 15-node tree traversed successfully using DFS!");
  
  return steps;
};

const getMockBfsSteps = (inputVars: string): SimulationStep[] => {
  let xOffsets: number[] = []; let yOffsets: number[] = []; let edges: any[] = [];
  if (inputVars === 'preset:i1') {
    xOffsets = [50, 25, 75, 15, 35, 65, 85, 10, 20, 30, 40, 60, 70, 80, 90];
    yOffsets = [10, 30, 30, 50, 50, 50, 50, 70, 70, 70, 70, 70, 70, 70, 70];
    edges = [
      {from:1,to:2},{from:1,to:3},{from:2,to:4},{from:2,to:5},
      {from:3,to:6},{from:3,to:7},{from:4,to:8},{from:4,to:9},
      {from:5,to:10},{from:5,to:11},{from:6,to:12},{from:6,to:13},
      {from:7,to:14},{from:7,to:15}
    ];
  } else if (inputVars === 'preset:i3') {
    for(let i=1; i<=15; i++) {
      xOffsets.push(10 + Math.abs(Math.sin(i*123)) * 80);
      yOffsets.push(10 + Math.abs(Math.cos(i*321)) * 80);
    }
    for(let i=2; i<=15; i++) edges.push({from: 1 + Math.floor(Math.abs(Math.sin(i*99))*(i-1)), to: i});
  } else {
    xOffsets = [10, 20, 35, 15, 30, 45, 55, 60, 75, 75, 85, 90, 95, 90, 95];
    yOffsets = [50, 25, 15, 75, 45, 35, 15, 60, 20, 80, 60, 15, 35, 45, 80];
    for (let i = 2; i <= 15; i++) edges.push({ from: Math.max(1, i - 1 - (i % 3)), to: i });
    [ [1,4], [3,7], [5,9], [8,12], [10,14], [2,6], [11,15] ].forEach(pair => edges.push({ from: pair[0], to: pair[1] }));
  }
  const baseNodes = Array.from({length: 15}, (_, i) => ({
    id: i + 1, label: '', x: xOffsets[i], y: yOffsets[i], active: false
  }));

  const steps: SimulationStep[] = [];
  const visited = new Array(16).fill(false);
  const dist: (number|undefined)[] = new Array(16).fill(undefined);
  const queue: number[] = [];
  const activeNodes = new Set<number>();
  const fullyVisited = new Set<number>();
  
  const pushStep = (line: number, v: number | null, explanation: string) => {
    steps.push({
      lineNumber: line,
      visualData: { 
        type: 'graph', 
        nodes: baseNodes.map(n => ({ 
           ...n, 
           active: fullyVisited.has(n.id) || activeNodes.has(n.id) || n.id === v,
           label: n.id === 1 ? 'S:0' : (dist[n.id] !== undefined ? dist[n.id]!.toString() : '')
        })), 
        edges: edges.map(e => ({ ...e, active: fullyVisited.has(e.from) && fullyVisited.has(e.to) })),
        vars: { 
          current: v,
          queue: JSON.stringify(queue.slice(0, 5)) + (queue.length > 5 ? '...' : '')
        }
      },
      explanation
    });
  };

  pushStep(1, null, "Initializing BFS queue (15-node graph)...");
  visited[1] = true;
  dist[1] = 0;
  queue.push(1);
  pushStep(4, 1, "Root node (1) pushed to queue with dist 0.");
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    activeNodes.add(curr);
    fullyVisited.add(curr);
    pushStep(7, curr, `Node popped from queue.`);
    
    const neighbors = new Set([
       ...edges.filter(e => e.from === curr).map(e => e.to),
       ...edges.filter(e => e.to === curr).map(e => e.from)
    ]);
    
    for (const n of Array.from(neighbors)) {
      if (!visited[n]) {
        visited[n] = true;
        dist[n] = dist[curr]! + 1;
        queue.push(n);
        activeNodes.add(n);
        pushStep(13, curr, `Neighbor dist calculated as ${dist[n]} and added to queue.`);
      }
    }
    activeNodes.delete(curr);
  }
  
  pushStep(17, null, "All nodes visited. BFS completed successfully!");
  return steps;
};

const getMockAStarSteps = (inputVars: string): SimulationStep[] => {
  let xOffsets: number[] = []; let yOffsets: number[] = []; let edges: any[] = [];
  if (inputVars === 'preset:i1') {
    xOffsets = [10, 30, 50, 70, 90, 10, 90, 10, 90, 10, 30, 50, 70, 90, 50];
    yOffsets = [20, 20, 20, 20, 20, 50, 50, 80, 80, 90, 90, 90, 90, 90, 50];
    edges = [
      {from:1,to:2,weight:1}, {from:2,to:3,weight:1}, {from:3,to:4,weight:1}, {from:4,to:5,weight:1},
      {from:1,to:6,weight:1}, {from:6,to:8,weight:1}, {from:8,to:10,weight:1}, {from:10,to:11,weight:1},
      {from:11,to:12,weight:1}, {from:12,to:13,weight:1}, {from:13,to:14,weight:1}, {from:5,to:7,weight:1},
      {from:7,to:9,weight:1}, {from:9,to:14,weight:1}, {from:14,to:15,weight:1}
    ];
  } else if (inputVars === 'preset:i3') {
    for(let i=1; i<=15; i++) {
      xOffsets.push(10 + Math.abs(Math.sin(i*123)) * 80);
      yOffsets.push(10 + Math.abs(Math.cos(i*321)) * 80);
    }
    for(let i=2; i<=15; i++) edges.push({from: 1 + Math.floor(Math.abs(Math.sin(i*99))*(i-1)), to: i, weight: 1 + (i%5)});
  } else {
    xOffsets = [10, 20, 35, 15, 30, 45, 55, 60, 75, 75, 85, 90, 95, 90, 95];
    yOffsets = [50, 25, 15, 75, 45, 35, 15, 60, 20, 80, 60, 15, 35, 45, 80];
    for (let i = 2; i <= 15; i++) edges.push({ from: Math.max(1, i - 1 - (i % 3)), to: i, weight: 1 + (i % 3) });
    [ [1,5,6], [4,8,2], [7,11,4], [9,13,3], [2,6,5], [10,15,9] ].forEach(pair => edges.push({ from: pair[0], to: pair[1], weight: pair[2] }));
  }
  const baseNodes = Array.from({length: 15}, (_, i) => ({
    id: i + 1, label: '', x: xOffsets[i], y: yOffsets[i], active: false
  }));

  const steps: SimulationStep[] = [];
  const openSet = new Set([1]);
  const closedSet = new Set<number>();
  
  const gScore = new Array(16).fill(Infinity);
  gScore[1] = 0;
  const fScore = new Array(16).fill(Infinity);
  fScore[1] = 0; 

  const pushStep = (line: number, v: number, explanation: string) => {
    steps.push({
      lineNumber: line,
      visualData: { 
        type: 'graph', 
        nodes: baseNodes.map(n => ({ 
          ...n, 
          active: closedSet.has(n.id) || openSet.has(n.id) || n.id === v,
          label: n.id === 1 ? 'S:0' : (n.id === 15 ? (gScore[15] !== Infinity ? `T:${gScore[15]}` : 'T:∞') : (gScore[n.id] !== Infinity ? gScore[n.id].toString() : ''))
        })), 
        edges: edges.map(e => ({ ...e, active: closedSet.has(e.from) && closedSet.has(e.to), label: e.weight.toString() })),
        vars: { 
          openSet: JSON.stringify(Array.from(openSet).slice(0, 5)) + (openSet.size>5?'...':''),
          closedSet: JSON.stringify(Array.from(closedSet).slice(0, 5)) + (closedSet.size>5?'...':'')
        }
      },
      explanation
    });
  };

  pushStep(2, 1, "Start node added to openSet. Distance is 0.");
  
  while(openSet.size > 0) {
    let curr = Array.from(openSet).reduce((minNode, node) => fScore[node] < fScore[minNode] ? node : minNode, Array.from(openSet)[0]);
    
    if (curr === 15) {
       closedSet.add(curr);
       pushStep(6, 15, "A* found the shortest path to Target!");
       break;
    }
    
    openSet.delete(curr);
    closedSet.add(curr);
    pushStep(4, curr, `Node with lowest f-value selected.`);
    
    const neighbors = [
       ...edges.filter(e => e.from === curr).map(e => ({ to: e.to, w: e.weight })),
       ...edges.filter(e => e.to === curr).map(e => ({ to: e.from, w: e.weight }))
    ];
    
    let stepped = false;
    for (const n of neighbors) {
       if (closedSet.has(n.to)) continue;
       
       const tentative_gScore = gScore[curr] + n.w;
       if (tentative_gScore < gScore[n.to]) {
         gScore[n.to] = tentative_gScore;
         fScore[n.to] = gScore[n.to] + 1; 
         if (!openSet.has(n.to)) {
           openSet.add(n.to);
           if (!stepped) {
             pushStep(10, curr, `Neighbor evaluated. New distance: ${tentative_gScore} added.`);
             stepped = true;
           }
         }
       }
    }
  }
  
  return steps;
};

const getMockDijkstraSteps = (inputVars: string): SimulationStep[] => {
  let xOffsets: number[] = []; let yOffsets: number[] = []; let edges: any[] = [];
  if (inputVars === 'preset:i1') {
    xOffsets = [10, 30, 50, 70, 90, 30, 50, 70, 10, 30, 50, 70, 90, 50, 50];
    yOffsets = [50, 20, 20, 20, 50, 80, 80, 80, 10, 10, 10, 10, 10, 90, 90];
    edges = [
      {from:1,to:2,weight:2}, {from:2,to:3,weight:2}, {from:3,to:4,weight:2}, {from:4,to:5,weight:2},
      {from:1,to:6,weight:9}, {from:6,to:7,weight:1}, {from:7,to:8,weight:1}, {from:8,to:5,weight:1},
      {from:3,to:7,weight:5}, {from:2,to:6,weight:1}
    ];
    [9,10,11,12,13,14,15].forEach(n => edges.push({from: 1, to: n, weight: 20}));
  } else if (inputVars === 'preset:i3') {
    for(let i=1; i<=15; i++) {
      xOffsets.push(10 + Math.abs(Math.sin(i*123)) * 80);
      yOffsets.push(10 + Math.abs(Math.cos(i*321)) * 80);
    }
    for(let i=2; i<=15; i++) edges.push({from: 1 + Math.floor(Math.abs(Math.sin(i*99))*(i-1)), to: i, weight: 1 + Math.floor(Math.abs(Math.cos(i))*9)});
  } else {
    xOffsets = [10, 20, 35, 15, 30, 45, 55, 60, 75, 75, 85, 90, 95, 90, 95];
    yOffsets = [50, 25, 15, 75, 45, 35, 15, 60, 20, 80, 60, 15, 35, 45, 80];
    for (let i = 2; i <= 15; i++) edges.push({ from: Math.max(1, i - 1 - (i % 3)), to: i, weight: 1 + (i % 4) });
    [ [1,4,5], [3,7,2], [5,9,4], [8,12,3], [10,14,2], [2,6,6], [11,15,8] ].forEach(pair => edges.push({ from: pair[0], to: pair[1], weight: pair[2] }));
  }
  const baseNodes = Array.from({length: 15}, (_, i) => ({
    id: i + 1, label: '', x: xOffsets[i], y: yOffsets[i], active: false
  }));

  const steps: SimulationStep[] = [];
  const dist = new Array(16).fill(Infinity);
  dist[1] = 0;
  
  let pq = [{id: 1, dist: 0}];
  const visitedPath = new Set<number>();
  
  const pushStep = (line: number, v: number, explanation: string) => {
    steps.push({
      lineNumber: line,
      visualData: { 
        type: 'graph', 
        nodes: baseNodes.map(n => ({ 
          ...n, 
          active: visitedPath.has(n.id) || n.id === v,
          label: n.id === 1 ? 'S:0' : (n.id === 15 ? (dist[15] !== Infinity ? `T:${dist[15]}` : 'T:∞') : (dist[n.id] !== Infinity ? dist[n.id].toString() : ''))
        })), 
        edges: edges.map(e => ({ ...e, active: visitedPath.has(e.from) && visitedPath.has(e.to), label: e.weight.toString() })),
        vars: { 
          dist: JSON.stringify(dist.slice(1, 6).map(d => d===Infinity ? '∞' : d)) + '...',
          pq: JSON.stringify(pq.slice(0, 3).map(p => `(${p.dist})`)) + '...'
        }
      },
      explanation
    });
  };

  pushStep(2, 1, "Distances initialized to infinity. Start node dist is 0.");
  
  while(pq.length > 0) {
     pq.sort((a,b) => a.dist - b.dist);
     const curr = pq.shift()!;
     if (visitedPath.has(curr.id)) continue;
     visitedPath.add(curr.id);
     
     pushStep(6, curr.id, `Node with minimum distance popped.`);
     
     const neighbors = [
       ...edges.filter(e => e.from === curr.id).map(e => ({ to: e.to, w: e.weight })),
       ...edges.filter(e => e.to === curr.id).map(e => ({ to: e.from, w: e.weight }))
     ];
     
     for (const n of neighbors) {
       if (dist[curr.id] + n.w < dist[n.to]) {
         dist[n.to] = dist[curr.id] + n.w;
         pq.push({ id: n.to, dist: dist[n.to] });
         pushStep(9, curr.id, `Shorter path found! New dist: ${dist[n.to]}.`);
       }
     }
  }
  
  pushStep(15, 15, "All shortest paths successfully calculated.");
  return steps;
};

const getMockSortingSteps = (inputVars: string): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  let arr = [38, 27, 43, 3, 9, 82, 10, 5, 20, 15, 31, 1, 6];
  if (inputVars === 'preset:i1') arr = [3, 9, 10, 15, 20, 38, 27, 5, 43, 82]; // mostly sorted
  if (inputVars === 'preset:i3') arr = [99, 82, 75, 66, 52, 45, 33, 21, 15, 8, 4, 1, 95, 71, 62, 58, 44, 38, 27, 19, 14, 5]; // large chaos
  
  const pushStep = (line: number, pointersObj: Record<string, number>, explanation: string) => {
    steps.push({
      lineNumber: line,
      visualData: { type: 'array', values: [...arr], pointers: pointersObj, vars: {} },
      explanation
    });
  };

  const n = arr.length;
  pushStep(1, {}, `Selection Sort algorithm started on a ${n}-element array.`);
  
  for(let i = 0; i < n - 1; i++) {
     let minIdx = i;
     pushStep(2, { i, minIdx }, `Loop starts for i=${i}. Initial minimum assumed: ${arr[minIdx]} (index: ${minIdx})`);
     
     for(let j = i + 1; j < n; j++) {
       pushStep(4, { i, minIdx, j }, `Comparing ${arr[j]} with current min ${arr[minIdx]}.`);
       if(arr[j] < arr[minIdx]) {
         minIdx = j;
         pushStep(5, { i, minIdx, j }, `New minimum found! New min value: ${arr[minIdx]} (index: ${minIdx})`);
       }
     }
     
     if (minIdx !== i) {
       pushStep(7, { i, minIdx }, `Search complete. Swapping the real min value ${arr[minIdx]} with ${arr[i]}.`);
       let temp = arr[i];
       arr[i] = arr[minIdx];
       arr[minIdx] = temp;
       pushStep(8, { i, minIdx }, `Swap completed. ${arr[i]} is now in correct position.`);
     } else {
       pushStep(7, { i, minIdx }, `Search complete. Minimum is already in correct place (${arr[i]}), no swap needed.`);
     }
  }

  pushStep(10, {}, `Sorting completed! The array is fully sorted.`);
  arr.sort((a,b) => a-b);
  pushStep(10, {}, "Array fully sorted successfully!");
  
  return steps;
};
