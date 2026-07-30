export interface AlgorithmPreset {
  name: string;
  code: string;
  isSupported: boolean;
}

export const algorithmRegistry: AlgorithmPreset[] = [
  {
    "name": "Depth First Search (DFS)",
    "code": "void DFS(int v) {\n    visited[v] = true;\n    cout << v << \" \";\n    for (int i : adj[v]) {\n        if (!visited[i])\n            DFS(i);\n    }\n}",
    "isSupported": true
  },
  {
    "name": "Breadth First Search (BFS)",
    "code": "void BFS(int s) {\n    vector<bool> visited(V, false);\n    queue<int> q;\n    visited[s] = true;\n    q.push(s);\n    while(!q.empty()) {\n        s = q.front();\n        cout << s << \" \";\n        q.pop();\n        for (auto i : adj[s]) {\n            if (!visited[i]) {\n                visited[i] = true;\n                q.push(i);\n            }\n        }\n    }\n}",
    "isSupported": true
  },
  {
    "name": "Dijkstra's Shortest Path",
    "code": "void dijkstra(int src) {\n    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;\n    vector<int> dist(V, INF);\n    pq.push(make_pair(0, src));\n    dist[src] = 0;\n    while (!pq.empty()) {\n        int u = pq.top().second;\n        pq.pop();\n        for (auto x : adj[u]) {\n            int v = x.first;\n            int weight = x.second;\n            if (dist[v] > dist[u] + weight) {\n                dist[v] = dist[u] + weight;\n                pq.push(make_pair(dist[v], v));\n            }\n        }\n    }\n}",
    "isSupported": true
  },
  {
    "name": "A* Search Algorithm",
    "code": "int aStar(Node start, Node target) {\n    priority_queue<Node, vector<Node>, CompareNode> openSet;\n    start.g = 0; start.f = heuristic(start, target);\n    openSet.push(start);\n    while(!openSet.empty()) {\n        Node current = openSet.top(); openSet.pop();\n        if(current == target) return current.g;\n        for(Node neighbor : current.neighbors) {\n            int tentative_g = current.g + cost(current, neighbor);\n            if(tentative_g < neighbor.g) {\n                neighbor.g = tentative_g;\n                neighbor.f = tentative_g + heuristic(neighbor, target);\n                openSet.push(neighbor);\n            }\n        }\n    }\n    return -1;\n}",
    "isSupported": true
  },
  {
    "name": "Kruskal's MST",
    "code": "int kruskalMST() {\n    int mst_wt = 0;\n    sort(edges.begin(), edges.end());\n    DisjointSets ds(V);\n    for (auto it=edges.begin(); it!=edges.end(); it++) {\n        int u = it->second.first;\n        int v = it->second.second;\n        int set_u = ds.find(u);\n        int set_v = ds.find(v);\n        if (set_u != set_v) {\n            mst_wt += it->first;\n            ds.merge(set_u, set_v);\n        }\n    }\n    return mst_wt;\n}",
    "isSupported": false
  },
  {
    "name": "Prim's MST",
    "code": "void primMST() {\n    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;\n    int src = 0;\n    vector<int> key(V, INF);\n    vector<int> parent(V, -1);\n    vector<bool> inMST(V, false);\n    pq.push(make_pair(0, src));\n    key[src] = 0;\n    while (!pq.empty()) {\n        int u = pq.top().second;\n        pq.pop();\n        inMST[u] = true;\n        for (auto x : adj[u]) {\n            int v = x.first;\n            int weight = x.second;\n            if (inMST[v] == false && key[v] > weight) {\n                key[v] = weight;\n                pq.push(make_pair(key[v], v));\n                parent[v] = u;\n            }\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Bellman-Ford Algorithm",
    "code": "void BellmanFord(int src) {\n    vector<int> dist(V, INT_MAX);\n    dist[src] = 0;\n    for (int i = 1; i <= V - 1; i++) {\n        for (int j = 0; j < E; j++) {\n            int u = graph->edge[j].src;\n            int v = graph->edge[j].dest;\n            int weight = graph->edge[j].weight;\n            if (dist[u] != INT_MAX && dist[u] + weight < dist[v])\n                dist[v] = dist[u] + weight;\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Floyd-Warshall Algorithm",
    "code": "void floydWarshall(int graph[][V]) {\n    int dist[V][V], i, j, k;\n    for (i = 0; i < V; i++)\n        for (j = 0; j < V; j++)\n            dist[i][j] = graph[i][j];\n    for (k = 0; k < V; k++) {\n        for (i = 0; i < V; i++) {\n            for (j = 0; j < V; j++) {\n                if (dist[i][k] + dist[k][j] < dist[i][j])\n                    dist[i][j] = dist[i][k] + dist[k][j];\n            }\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Topological Sort",
    "code": "void topologicalSortUtil(int v, bool visited[], stack<int>& Stack) {\n    visited[v] = true;\n    for (int i : adj[v])\n        if (!visited[i])\n            topologicalSortUtil(i, visited, Stack);\n    Stack.push(v);\n}\nvoid topologicalSort() {\n    stack<int> Stack;\n    bool* visited = new bool[V];\n    for (int i = 0; i < V; i++) visited[i] = false;\n    for (int i = 0; i < V; i++)\n        if (visited[i] == false)\n            topologicalSortUtil(i, visited, Stack);\n    while (!Stack.empty()) {\n        cout << Stack.top() << \" \";\n        Stack.pop();\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Kosaraju's SCC",
    "code": "void fillOrder(int v, bool visited[], stack<int> &Stack) {\n    visited[v] = true;\n    for(auto i : adj[v])\n        if(!visited[i]) fillOrder(i, visited, Stack);\n    Stack.push(v);\n}\nvoid printSCCs() {\n    stack<int> Stack;\n    bool *visited = new bool[V];\n    for(int i = 0; i < V; i++) visited[i] = false;\n    for(int i = 0; i < V; i++) if(!visited[i]) fillOrder(i, visited, Stack);\n    Graph gr = getTranspose();\n    for(int i = 0; i < V; i++) visited[i] = false;\n    while(!Stack.empty()) {\n        int v = Stack.top(); Stack.pop();\n        if(!visited[v]) {\n            gr.DFSUtil(v, visited);\n            cout << endl;\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Tarjan's SCC",
    "code": "void SCCUtil(int u, int disc[], int low[], stack<int> *st, bool stackMember[]) {\n    static int time = 0;\n    disc[u] = low[u] = ++time;\n    st->push(u);\n    stackMember[u] = true;\n    for (int v : adj[u]) {\n        if (disc[v] == -1) {\n            SCCUtil(v, disc, low, st, stackMember);\n            low[u]  = min(low[u], low[v]);\n        } else if (stackMember[v] == true)\n            low[u]  = min(low[u], disc[v]);\n    }\n    int w = 0;\n    if (low[u] == disc[u]) {\n        while (st->top() != u) {\n            w = (int) st->top();\n            cout << w << \" \";\n            stackMember[w] = false;\n            st->pop();\n        }\n        w = (int) st->top();\n        cout << w << \"\\n\";\n        stackMember[w] = false;\n        st->pop();\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Edmonds-Karp Max Flow",
    "code": "bool bfs(int rGraph[V][V], int s, int t, int parent[]) {\n    bool visited[V];\n    memset(visited, 0, sizeof(visited));\n    queue<int> q;\n    q.push(s);\n    visited[s] = true;\n    parent[s] = -1;\n    while (!q.empty()) {\n        int u = q.front(); q.pop();\n        for (int v = 0; v < V; v++) {\n            if (!visited[v] && rGraph[u][v] > 0) {\n                if (v == t) { parent[v] = u; return true; }\n                q.push(v); parent[v] = u; visited[v] = true;\n            }\n        }\n    }\n    return false;\n}\nint fordFulkerson(int graph[V][V], int s, int t) {\n    int rGraph[V][V];\n    for (int u = 0; u < V; u++) for (int v = 0; v < V; v++) rGraph[u][v] = graph[u][v];\n    int parent[V];\n    int max_flow = 0;\n    while (bfs(rGraph, s, t, parent)) {\n        int path_flow = INT_MAX;\n        for (int v = t; v != s; v = parent[v]) {\n            int u = parent[v];\n            path_flow = min(path_flow, rGraph[u][v]);\n        }\n        for (int v = t; v != s; v = parent[v]) {\n            int u = parent[v];\n            rGraph[u][v] -= path_flow;\n            rGraph[v][u] += path_flow;\n        }\n        max_flow += path_flow;\n    }\n    return max_flow;\n}",
    "isSupported": false
  },
  {
    "name": "Dinic's Max Flow",
    "code": "bool BFS(int s, int t) {\n    memset(level, -1, sizeof(level));\n    level[s] = 0;\n    queue<int> q;\n    q.push(s);\n    while (!q.empty()) {\n        int u = q.front(); q.pop();\n        for (auto edge : adj[u]) {\n            if (level[edge.v] < 0 && edge.flow < edge.C) {\n                level[edge.v] = level[u] + 1;\n                q.push(edge.v);\n            }\n        }\n    }\n    return level[t] >= 0;\n}\nint sendFlow(int u, int flow, int t, int start[]) {\n    if (u == t) return flow;\n    for (int &i = start[u]; i < adj[u].size(); i++) {\n        Edge &e = adj[u][i];\n        if (level[e.v] == level[u] + 1 && e.flow < e.C) {\n            int curr_flow = min(flow, e.C - e.flow);\n            int temp_flow = sendFlow(e.v, curr_flow, t, start);\n            if (temp_flow > 0) {\n                e.flow += temp_flow;\n                adj[e.v][e.rev].flow -= temp_flow;\n                return temp_flow;\n            }\n        }\n    }\n    return 0;\n}",
    "isSupported": false
  },
  {
    "name": "Bipartite Matching (Hopcroft-Karp)",
    "code": "bool HopcroftKarp::bfs() {\n    queue<int> Q;\n    for (int u=1; u<=m; u++) {\n        if (pairU[u]==0) { dist[u] = 0; Q.push(u); }\n        else dist[u] = INF;\n    }\n    dist[0] = INF;\n    while (!Q.empty()) {\n        int u = Q.front(); Q.pop();\n        if (dist[u] < dist[0]) {\n            for (int v : adj[u]) {\n                if (dist[pairV[v]] == INF) {\n                    dist[pairV[v]] = dist[u] + 1;\n                    Q.push(pairV[v]);\n                }\n            }\n        }\n    }\n    return (dist[0] != INF);\n}",
    "isSupported": false
  },
  {
    "name": "Graph Coloring",
    "code": "bool graphColoringUtil(bool graph[V][V], int m, int color[], int v) {\n    if (v == V) return true;\n    for (int c = 1; c <= m; c++) {\n        if (isSafe(v, graph, color, c)) {\n            color[v] = c;\n            if (graphColoringUtil(graph, m, color, v + 1))\n                return true;\n            color[v] = 0;\n        }\n    }\n    return false;\n}",
    "isSupported": false
  },
  {
    "name": "Eulerian Path/Circuit",
    "code": "void findEulerPath() {\n    vector<int> path;\n    stack<int> curr_path;\n    curr_path.push(0);\n    int curr_v = 0;\n    while (!curr_path.empty()) {\n        if (edge_count[curr_v]) {\n            curr_path.push(curr_v);\n            int next_v = adj[curr_v].back();\n            edge_count[curr_v]--;\n            adj[curr_v].pop_back();\n            curr_v = next_v;\n        } else {\n            path.push_back(curr_v);\n            curr_v = curr_path.top();\n            curr_path.pop();\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Hamiltonian Cycle",
    "code": "bool hamCycleUtil(bool graph[V][V], int path[], int pos) {\n    if (pos == V) {\n        if (graph[path[pos - 1]][path[0]] == 1)\n            return true;\n        else\n            return false;\n    }\n    for (int v = 1; v < V; v++) {\n        if (isSafe(v, graph, path, pos)) {\n            path[pos] = v;\n            if (hamCycleUtil(graph, path, pos + 1) == true)\n                return true;\n            path[pos] = -1;\n        }\n    }\n    return false;\n}",
    "isSupported": false
  },
  {
    "name": "Articulation Points",
    "code": "void APUtil(int u, bool visited[], int disc[], int low[], int& time, int parent, bool isAP[]) {\n    int children = 0;\n    visited[u] = true;\n    disc[u] = low[u] = ++time;\n    for (auto v : adj[u]) {\n        if (!visited[v]) {\n            children++;\n            APUtil(v, visited, disc, low, time, u, isAP);\n            low[u]  = min(low[u], low[v]);\n            if (parent != -1 && low[v] >= disc[u])\n                isAP[u] = true;\n        } else if (v != parent)\n            low[u]  = min(low[u], disc[v]);\n    }\n    if (parent == -1 && children > 1)\n        isAP[u] = true;\n}",
    "isSupported": false
  },
  {
    "name": "Bridges in Graph",
    "code": "void bridgeUtil(int u, bool visited[], int disc[], int low[], int parent) {\n    static int time = 0;\n    visited[u] = true;\n    disc[u] = low[u] = ++time;\n    for (int v : adj[u]) {\n        if (!visited[v]) {\n            bridgeUtil(v, visited, disc, low, u);\n            low[u]  = min(low[u], low[v]);\n            if (low[v] > disc[u])\n                cout << u << \" \" << v << endl;\n        } else if (v != parent)\n            low[u]  = min(low[u], disc[v]);\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Johnson's Algorithm",
    "code": "void JohnsonsAlgorithm(int graph[V][V]) {\n    vector<int> h(V, 0);\n    // Bellman ford calculates h\n    // Reweight edges: w(u, v) = w(u, v) + h(u) - h(v)\n    // Run Dijkstra for each vertex\n    cout << \"Johnson's algorithm executed.\\n\";\n}",
    "isSupported": false
  },
  {
    "name": "Z-Algorithm",
    "code": "vector<int> zFunction(string s) {\n    int n = (int) s.length();\n    vector<int> z(n);\n    for (int i = 1, l = 0, r = 0; i < n; ++i) {\n        if (i <= r) z[i] = min(r - i + 1, z[i - l]);\n        while (i + z[i] < n && s[z[i]] == s[i + z[i]]) ++z[i];\n        if (i + z[i] - 1 > r) l = i, r = i + z[i] - 1;\n    }\n    return z;\n}",
    "isSupported": true
  },
  {
    "name": "Knuth-Morris-Pratt (KMP)",
    "code": "void computeLPSArray(char* pat, int M, int* lps) {\n    int len = 0;\n    lps[0] = 0;\n    int i = 1;\n    while (i < M) {\n        if (pat[i] == pat[len]) {\n            len++;\n            lps[i] = len;\n            i++;\n        } else {\n            if (len != 0) len = lps[len - 1];\n            else { lps[i] = 0; i++; }\n        }\n    }\n}\nvoid KMPSearch(char* pat, char* txt) {\n    int M = strlen(pat);\n    int N = strlen(txt);\n    int lps[M];\n    computeLPSArray(pat, M, lps);\n    int i = 0, j = 0;\n    while (i < N) {\n        if (pat[j] == txt[i]) { j++; i++; }\n        if (j == M) {\n            cout << \"Found pattern at index \" << i - j;\n            j = lps[j - 1];\n        } else if (i < N && pat[j] != txt[i]) {\n            if (j != 0) j = lps[j - 1];\n            else i = i + 1;\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Rabin-Karp Algorithm",
    "code": "void search(char pat[], char txt[], int q) {\n    int M = strlen(pat);\n    int N = strlen(txt);\n    int i, j;\n    int p = 0, t = 0, h = 1, d = 256;\n    for (i = 0; i < M - 1; i++) h = (h * d) % q;\n    for (i = 0; i < M; i++) {\n        p = (d * p + pat[i]) % q;\n        t = (d * t + txt[i]) % q;\n    }\n    for (i = 0; i <= N - M; i++) {\n        if (p == t) {\n            for (j = 0; j < M; j++) if (txt[i + j] != pat[j]) break;\n            if (j == M) cout << \"Pattern found at \" << i << endl;\n        }\n        if (i < N - M) {\n            t = (d * (t - txt[i] * h) + txt[i + M]) % q;\n            if (t < 0) t = (t + q);\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Boyer-Moore Algorithm",
    "code": "void badCharHeuristic(string str, int size, int badchar[256]) {\n    for (int i = 0; i < 256; i++) badchar[i] = -1;\n    for (int i = 0; i < size; i++) badchar[(int) str[i]] = i;\n}\nvoid search(string txt, string pat) {\n    int m = pat.size(), n = txt.size();\n    int badchar[256];\n    badCharHeuristic(pat, m, badchar);\n    int s = 0;\n    while(s <= (n - m)) {\n        int j = m - 1;\n        while(j >= 0 && pat[j] == txt[s + j]) j--;\n        if (j < 0) {\n            cout << \"Pattern found at \" << s << endl;\n            s += (s + m < n) ? m - badchar[txt[s + m]] : 1;\n        } else s += max(1, j - badchar[txt[s + j]]);\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Kadane's Algorithm",
    "code": "int maxSubArraySum(int a[], int size) {\n    int max_so_far = a[0];\n    int curr_max = a[0];\n    for (int i = 1; i < size; i++) {\n        curr_max = max(a[i], curr_max + a[i]);\n        max_so_far = max(max_so_far, curr_max);\n    }\n    return max_so_far;\n}",
    "isSupported": false
  },
  {
    "name": "Sliding Window Maximum",
    "code": "vector<int> maxSlidingWindow(vector<int>& nums, int k) {\n    deque<int> dq;\n    vector<int> res;\n    for(int i=0; i<nums.size(); i++){\n        if(!dq.empty() && dq.front() == i-k) dq.pop_front();\n        while(!dq.empty() && nums[dq.back()] < nums[i]) dq.pop_back();\n        dq.push_back(i);\n        if(i >= k-1) res.push_back(nums[dq.front()]);\n    }\n    return res;\n}",
    "isSupported": false
  },
  {
    "name": "Longest Palindromic Substring (Manacher's)",
    "code": "string longestPalindrome(string s) {\n    string t = \"#\";\n    for(char c: s) { t+=c; t+=\"#\"; }\n    vector<int> p(t.size(), 0);\n    int c=0, r=0, maxLen=0, maxCenter=0;\n    for(int i=1; i<t.size()-1; i++) {\n        int i_mirror = c - (i - c);\n        if(r > i) p[i] = min(r-i, p[i_mirror]);\n        while(i-1-p[i]>=0 && i+1+p[i]<t.size() && t[i+1+p[i]] == t[i-1-p[i]]) p[i]++;\n        if(i + p[i] > r) { c = i; r = i + p[i]; }\n        if(p[i] > maxLen) { maxLen = p[i]; maxCenter = i; }\n    }\n    return s.substr((maxCenter - maxLen)/2, maxLen);\n}",
    "isSupported": false
  },
  {
    "name": "Trie Insert & Search",
    "code": "struct TrieNode {\n    TrieNode* children[26];\n    bool isEndOfWord;\n    TrieNode() { isEndOfWord = false; for(int i=0; i<26; i++) children[i]=NULL; }\n};\nvoid insert(TrieNode* root, string key) {\n    TrieNode* pCrawl = root;\n    for (int i = 0; i < key.length(); i++) {\n        int index = key[i] - 'a';\n        if (!pCrawl->children[index]) pCrawl->children[index] = new TrieNode();\n        pCrawl = pCrawl->children[index];\n    }\n    pCrawl->isEndOfWord = true;\n}\nbool search(TrieNode* root, string key) {\n    TrieNode* pCrawl = root;\n    for (int i = 0; i < key.length(); i++) {\n        int index = key[i] - 'a';\n        if (!pCrawl->children[index]) return false;\n        pCrawl = pCrawl->children[index];\n    }\n    return (pCrawl != NULL && pCrawl->isEndOfWord);\n}",
    "isSupported": false
  },
  {
    "name": "Two Pointers Technique",
    "code": "bool hasArrayTwoCandidates(int A[], int arr_size, int sum) {\n    int l, r;\n    sort(A, A + arr_size);\n    l = 0; r = arr_size - 1;\n    while (l < r) {\n        if(A[l] + A[r] == sum) return true;\n        else if(A[l] + A[r] < sum) l++;\n        else r--;\n    }\n    return false;\n}",
    "isSupported": false
  },
  {
    "name": "Prefix Sum Array",
    "code": "void fillPrefixSum(int arr[], int n, int prefixSum[]) {\n    prefixSum[0] = arr[0];\n    for (int i = 1; i < n; i++)\n        prefixSum[i] = prefixSum[i - 1] + arr[i];\n}",
    "isSupported": false
  },
  {
    "name": "Dutch National Flag",
    "code": "void sort012(int a[], int arr_size) {\n    int lo = 0, hi = arr_size - 1, mid = 0;\n    while (mid <= hi) {\n        switch (a[mid]) {\n        case 0:\n            swap(a[lo++], a[mid++]);\n            break;\n        case 1:\n            mid++;\n            break;\n        case 2:\n            swap(a[mid], a[hi--]);\n            break;\n        }\n    }\n}",
    "isSupported": false
  },
  {
    "name": "Moore's Voting Algorithm",
    "code": "int findCandidate(int a[], int size) {\n    int maj_index = 0, count = 1;\n    for (int i = 1; i < size; i++) {\n        if (a[maj_index] == a[i]) count++;\n        else count--;\n        if (count == 0) {\n            maj_index = i;\n            count = 1;\n        }\n    }\n    return a[maj_index];\n}",
    "isSupported": false
  },
  {
    "name": "Minimum Window Substring",
    "code": "string minWindow(string s, string t) {\n    vector<int> map(128,0);\n    for(auto c: t) map[c]++;\n    int counter=t.size(), begin=0, end=0, d=INT_MAX, head=0;\n    while(end < s.size()){\n        if(map[s[end++]]-- > 0) counter--;\n        while(counter == 0){\n            if(end - begin < d) d = end - (head = begin);\n            if(map[s[begin++]]++ == 0) counter++;\n        }\n    }\n    return d == INT_MAX ? \"\" : s.substr(head, d);\n}",
    "isSupported": false
  },
  {
    "name": "Trapping Rain Water",
    "code": "int findWater(int arr[], int n) {\n    int left[n], right[n], water = 0;\n    left[0] = arr[0];\n    for (int i = 1; i < n; i++) left[i] = max(left[i - 1], arr[i]);\n    right[n - 1] = arr[n - 1];\n    for (int i = n - 2; i >= 0; i--) right[i] = max(right[i + 1], arr[i]);\n    for (int i = 0; i < n; i++) water += min(left[i], right[i]) - arr[i];\n    return water;\n}",
    "isSupported": false
  },
  {
    "name": "Merge Intervals",
    "code": "vector<vector<int>> merge(vector<vector<int>>& intervals) {\n    if(intervals.empty()) return vector<vector<int>>();\n    vector<vector<int>> res;\n    sort(intervals.begin(), intervals.end());\n    res.push_back(intervals[0]);\n    for(int i=1; i<intervals.size(); i++) {\n        if(res.back()[1] >= intervals[i][0]) res.back()[1] = max(res.back()[1], intervals[i][1]);\n        else res.push_back(intervals[i]);\n    }\n    return res;\n}",
    "isSupported": false
  },
  {
    "name": "Quick Sort",
    "code": "int partition(int arr[], int low, int high) {\n    int pivot = arr[high];\n    int i = (low - 1);\n    for (int j = low; j <= high - 1; j++) {\n        if (arr[j] < pivot) {\n            i++;\n            swap(&arr[i], &arr[j]);\n        }\n    }\n    swap(&arr[i + 1], &arr[high]);\n    return (i + 1);\n}\nvoid quickSort(int arr[], int low, int high) {\n    if (low < high) {\n        int pi = partition(arr, low, high);\n        quickSort(arr, low, pi - 1);\n        quickSort(arr, pi + 1, high);\n    }\n}",
    "isSupported": true
  },
  {
    "name": "Merge Sort",
    "code": "void merge(int arr[], int l, int m, int r) {\n    int n1 = m - l + 1, n2 = r - m;\n    int L[n1], R[n2];\n    for (int i = 0; i < n1; i++) L[i] = arr[l + i];\n    for (int j = 0; j < n2; j++) R[j] = arr[m + 1 + j];\n    int i = 0, j = 0, k = l;\n    while (i < n1 && j < n2) {\n        if (L[i] <= R[j]) arr[k++] = L[i++];\n        else arr[k++] = R[j++];\n    }\n    while (i < n1) arr[k++] = L[i++];\n    while (j < n2) arr[k++] = R[j++];\n}\nvoid mergeSort(int arr[], int l, int r) {\n    if (l < r) {\n        int m = l + (r - l) / 2;\n        mergeSort(arr, l, m);\n        mergeSort(arr, m + 1, r);\n        merge(arr, l, m, r);\n    }\n}",
    "isSupported": true
  },
  {
    "name": "Binary Search",
    "code": "int binarySearch(int arr[], int l, int r, int x) {\n    if (r >= l) {\n        int mid = l + (r - l) / 2;\n        if (arr[mid] == x) return mid;\n        if (arr[mid] > x) return binarySearch(arr, l, mid - 1, x);\n        return binarySearch(arr, mid + 1, r, x);\n    }\n    return -1;\n}",
    "isSupported": false
  },
  {
    "name": "Heap Sort",
    "code": "void heapify(int arr[], int n, int i) {\n    int largest = i, l = 2*i + 1, r = 2*i + 2;\n    if (l < n && arr[l] > arr[largest]) largest = l;\n    if (r < n && arr[r] > arr[largest]) largest = r;\n    if (largest != i) {\n        swap(arr[i], arr[largest]);\n        heapify(arr, n, largest);\n    }\n}\nvoid heapSort(int arr[], int n) {\n    for (int i = n / 2 - 1; i >= 0; i--) heapify(arr, n, i);\n    for (int i = n - 1; i >= 0; i--) {\n        swap(arr[0], arr[i]);\n        heapify(arr, i, 0);\n    }\n}",
    "isSupported": true
  },
  {
    "name": "Radix Sort",
    "code": "int getMax(int arr[], int n) {\n    int mx = arr[0];\n    for (int i = 1; i < n; i++) if (arr[i] > mx) mx = arr[i];\n    return mx;\n}\nvoid countSort(int arr[], int n, int exp) {\n    int output[n];\n    int i, count[10] = { 0 };\n    for (i = 0; i < n; i++) count[(arr[i] / exp) % 10]++;\n    for (i = 1; i < 10; i++) count[i] += count[i - 1];\n    for (i = n - 1; i >= 0; i--) {\n        output[count[(arr[i] / exp) % 10] - 1] = arr[i];\n        count[(arr[i] / exp) % 10]--;\n    }\n    for (i = 0; i < n; i++) arr[i] = output[i];\n}\nvoid radixsort(int arr[], int n) {\n    int m = getMax(arr, n);\n    for (int exp = 1; m / exp > 0; exp *= 10) countSort(arr, n, exp);\n}",
    "isSupported": true
  },
  {
    "name": "Counting Sort",
    "code": "void countSort(vector<int>& arr) {\n    int max = *max_element(arr.begin(), arr.end());\n    int min = *min_element(arr.begin(), arr.end());\n    int range = max - min + 1;\n    vector<int> count(range), output(arr.size());\n    for (int i = 0; i < arr.size(); i++) count[arr[i] - min]++;\n    for (int i = 1; i < count.size(); i++) count[i] += count[i - 1];\n    for (int i = arr.size() - 1; i >= 0; i--) {\n        output[count[arr[i] - min] - 1] = arr[i];\n        count[arr[i] - min]--;\n    }\n    for (int i = 0; i < arr.size(); i++) arr[i] = output[i];\n}",
    "isSupported": true
  },
  {
    "name": "Bubble Sort",
    "code": "void bubbleSort(int arr[], int n) {\n    for (int i = 0; i < n - 1; i++)\n        for (int j = 0; j < n - i - 1; j++)\n            if (arr[j] > arr[j + 1])\n                swap(arr[j], arr[j + 1]);\n}",
    "isSupported": true
  },
  {
    "name": "Insertion Sort",
    "code": "void insertionSort(int arr[], int n) {\n    for (int i = 1; i < n; i++) {\n        int key = arr[i];\n        int j = i - 1;\n        while (j >= 0 && arr[j] > key) {\n            arr[j + 1] = arr[j];\n            j = j - 1;\n        }\n        arr[j + 1] = key;\n    }\n}",
    "isSupported": true
  },
  {
    "name": "Selection Sort",
    "code": "void selectionSort(int arr[], int n) {\n    for (int i = 0; i < n - 1; i++) {\n        int min_idx = i;\n        for (int j = i + 1; j < n; j++)\n            if (arr[j] < arr[min_idx])\n                min_idx = j;\n        swap(arr[min_idx], arr[i]);\n    }\n}",
    "isSupported": true
  },
  {
    "name": "Ternary Search",
    "code": "int ternarySearch(int l, int r, int key, int ar[]) {\n    if (r >= l) {\n        int mid1 = l + (r - l) / 3;\n        int mid2 = r - (r - l) / 3;\n        if (ar[mid1] == key) return mid1;\n        if (ar[mid2] == key) return mid2;\n        if (key < ar[mid1]) return ternarySearch(l, mid1 - 1, key, ar);\n        else if (key > ar[mid2]) return ternarySearch(mid2 + 1, r, key, ar);\n        else return ternarySearch(mid1 + 1, mid2 - 1, key, ar);\n    }\n    return -1;\n}",
    "isSupported": false
  },
  {
    "name": "0/1 Knapsack",
    "code": "int knapSack(int W, int wt[], int val[], int n) {\n    int i, w;\n    vector<vector<int>> K(n + 1, vector<int>(W + 1));\n    for(i = 0; i <= n; i++) {\n        for(w = 0; w <= W; w++) {\n            if (i == 0 || w == 0) K[i][w] = 0;\n            else if (wt[i - 1] <= w)\n                K[i][w] = max(val[i - 1] + K[i - 1][w - wt[i - 1]], K[i - 1][w]);\n            else\n                K[i][w] = K[i - 1][w];\n        }\n    }\n    return K[n][W];\n}",
    "isSupported": false
  },
  {
    "name": "Longest Common Subsequence",
    "code": "int lcs(char *X, char *Y, int m, int n) {\n    int L[m + 1][n + 1];\n    for (int i = 0; i <= m; i++) {\n        for (int j = 0; j <= n; j++) {\n            if (i == 0 || j == 0) L[i][j] = 0;\n            else if (X[i - 1] == Y[j - 1]) L[i][j] = L[i - 1][j - 1] + 1;\n            else L[i][j] = max(L[i - 1][j], L[i][j - 1]);\n        }\n    }\n    return L[m][n];\n}",
    "isSupported": false
  },
  {
    "name": "Longest Increasing Subsequence",
    "code": "int lis(int arr[], int n) {\n    int lis[n];\n    lis[0] = 1;\n    for (int i = 1; i < n; i++) {\n        lis[i] = 1;\n        for (int j = 0; j < i; j++)\n            if (arr[i] > arr[j] && lis[i] < lis[j] + 1)\n                lis[i] = lis[j] + 1;\n    }\n    return *max_element(lis, lis + n);\n}",
    "isSupported": false
  },
  {
    "name": "Matrix Chain Multiplication",
    "code": "int MatrixChainOrder(int p[], int n) {\n    int m[n][n];\n    for (int i = 1; i < n; i++) m[i][i] = 0;\n    for (int L = 2; L < n; L++) {\n        for (int i = 1; i < n - L + 1; i++) {\n            int j = i + L - 1;\n            m[i][j] = INT_MAX;\n            for (int k = i; k <= j - 1; k++) {\n                int q = m[i][k] + m[k + 1][j] + p[i - 1] * p[k] * p[j];\n                if (q < m[i][j]) m[i][j] = q;\n            }\n        }\n    }\n    return m[1][n - 1];\n}",
    "isSupported": false
  },
  {
    "name": "Edit Distance",
    "code": "int editDistDP(string str1, string str2, int m, int n) {\n    int dp[m + 1][n + 1];\n    for (int i = 0; i <= m; i++) {\n        for (int j = 0; j <= n; j++) {\n            if (i == 0) dp[i][j] = j;\n            else if (j == 0) dp[i][j] = i;\n            else if (str1[i - 1] == str2[j - 1]) dp[i][j] = dp[i - 1][j - 1];\n            else dp[i][j] = 1 + min({dp[i][j - 1], dp[i - 1][j], dp[i - 1][j - 1]});\n        }\n    }\n    return dp[m][n];\n}",
    "isSupported": false
  },
  {
    "name": "Coin Change",
    "code": "int countWays(int coins[], int n, int sum) {\n    int table[sum + 1];\n    memset(table, 0, sizeof(table));\n    table[0] = 1;\n    for(int i=0; i<n; i++)\n        for(int j=coins[i]; j<=sum; j++)\n            table[j] += table[j-coins[i]];\n    return table[sum];\n}",
    "isSupported": false
  },
  {
    "name": "Unique Paths",
    "code": "int uniquePaths(int m, int n) {\n    vector<vector<int>> dp(m, vector<int>(n, 1));\n    for(int i = 1; i < m; i++){\n        for(int j = 1; j < n; j++){\n            dp[i][j] = dp[i-1][j] + dp[i][j-1];\n        }\n    }\n    return dp[m-1][n-1];\n}",
    "isSupported": false
  },
  {
    "name": "Binary Tree Inorder Traversal",
    "code": "void inorder(Node* temp) {\n    if (temp == NULL) return;\n    inorder(temp->left);\n    cout << temp->data << \" \";\n    inorder(temp->right);\n}",
    "isSupported": false
  },
  {
    "name": "Binary Tree Preorder Traversal",
    "code": "void preorder(Node* temp) {\n    if (temp == NULL) return;\n    cout << temp->data << \" \";\n    preorder(temp->left);\n    preorder(temp->right);\n}",
    "isSupported": false
  },
  {
    "name": "Binary Tree Postorder Traversal",
    "code": "void postorder(Node* temp) {\n    if (temp == NULL) return;\n    postorder(temp->left);\n    postorder(temp->right);\n    cout << temp->data << \" \";\n}",
    "isSupported": false
  },
  {
    "name": "Lowest Common Ancestor (LCA)",
    "code": "Node* lca(Node* root, int n1, int n2) {\n    if (root == NULL) return NULL;\n    if (root->data > n1 && root->data > n2)\n        return lca(root->left, n1, n2);\n    if (root->data < n1 && root->data < n2)\n        return lca(root->right, n1, n2);\n    return root;\n}",
    "isSupported": false
  },
  {
    "name": "Sieve of Eratosthenes",
    "code": "void SieveOfEratosthenes(int n) {\n    bool prime[n + 1];\n    memset(prime, true, sizeof(prime));\n    for (int p = 2; p * p <= n; p++) {\n        if (prime[p] == true) {\n            for (int i = p * p; i <= n; i += p)\n                prime[i] = false;\n        }\n    }\n    for (int p = 2; p <= n; p++)\n        if (prime[p]) cout << p << \" \";\n}",
    "isSupported": false
  },
  {
    "name": "Fast Exponentiation (Modular)",
    "code": "long long power(long long x, unsigned int y, int p) {\n    long long res = 1;     \n    x = x % p; \n    if (x == 0) return 0; \n    while (y > 0) {  \n        if (y & 1) res = (res*x) % p;  \n        y = y>>1;\n        x = (x*x) % p;  \n    }  \n    return res;  \n}",
    "isSupported": false
  },
  {
    "name": "Reverse Linked List",
    "code": "Node* reverseList(Node* head) {\n    Node* current = head;\n    Node *prev = NULL, *next = NULL;\n    while (current != NULL) {\n        next = current->next;\n        current->next = prev;\n        prev = current;\n        current = next;\n    }\n    return prev;\n}",
    "isSupported": false
  },
  {
    "name": "Detect Cycle in Linked List",
    "code": "bool hasCycle(ListNode *head) {\n    if(!head) return false;\n    ListNode *slow = head, *fast = head;\n    while(fast->next && fast->next->next){\n        slow = slow->next;\n        fast = fast->next->next;\n        if(slow == fast) return true;\n    }\n    return false;\n}",
    "isSupported": false
  }
];
