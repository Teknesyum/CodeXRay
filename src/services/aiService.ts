import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SimulationStep {
  lineNumber: number | null;
  visualData: any; // Dynamic data (nodes, arrays, strings)
  explanation: string; // The text to show in the UI for this step
}

const MAGIC_SIM_KEY = atob("QVEuQWI4Uk42S1FscndPT3FSUnI5RVFpbjVWVFlFYTYwdnhYSzdOOGFPNWY3UHZGeTBhVXc=");

export const generateSimulationSteps = async (
  code: string, 
  language: string = 'tr',
  apiKey: string = '',
  inputVars: string = ''
): Promise<SimulationStep[]> => {
  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    if (!apiKey) console.warn("No API Key provided. Falling back to mock simulation.");
    else console.warn("Magic Simulation Key detected! Using mock simulation.");
    return getMockStepsFallback(code, language, inputVars);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert code execution tracer. I will provide you with a piece of code and an optional set of input variables.
      Your job is to dry-run (simulate) the execution of this code step-by-step and output a JSON array of steps.
      
      Input Variables given by user: ${inputVars || 'None provided'}
      
      Language for explanation: ${language === 'tr' ? 'Turkish' : 'English'}
      
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
    alert("Gemini API Hatası: " + (error.message || "Bilinmeyen Hata"));
    return getMockStepsFallback(code, language, inputVars);
  }
};

export const askQuestion = async (
  question: string,
  code: string,
  currentStep: SimulationStep | undefined,
  language: string = 'tr',
  apiKey: string = ''
): Promise<string> => {
  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    if (apiKey === MAGIC_SIM_KEY) {
       const q = question.toLowerCase();
       if (q.includes("ispat et") || q.includes("kanıtla") || q.includes("proof")) {
          return "Elbette. Dijkstra algoritmasının doğruluğu tümevarım (induction) ile ispatlanır:\n\n1. S kümesi, en kısa yolu kesin olarak bilinen düğümleri temsil etsin. Başlangıçta sadece kaynak düğüm S'dedir.\n2. Her adımda, S'ye eklenmeyen düğümler arasından en küçük mesafeli u düğümünü seçeriz.\n3. Eğer u'ya giden daha kısa bir yol olsaydı, bu yol mutlaka S'nin dışındaki başka bir y düğümünden geçmek zorunda kalırdı.\n4. Ancak y'nin mesafesi zaten u'dan büyük veya ona eşit olduğu için (negatif kenar ağırlığı yoksa), y üzerinden geçen herhangi bir yol u'nun mevcut mesafesinden daha kısa olamaz.\n\nBu çelişki, u'ya atanan mesafenin kesinlikle o anki en kısa yol olduğunu matematiksel olarak ispatlar.";
       }
       if (q.includes("neden en kısa yol") || q.includes("garanti")) {
          return "Dijkstra ve BFS gibi algoritmalar grafı katman katman (greedy yaklaşımıyla) genişleterek gezer. İlk hedefe ulaşıldığında, henüz taranmayan yolların daha uzun veya daha maliyetli olduğu garanti edilir. Bu yüzden buldukları ilk yol kesinlikle en kısa/en ucuz yoldur!";
       }
       if (q.includes("a*") || q.includes("sezgisel") || q.includes("heuristic")) {
          return "A* algoritması sadece başlangıçtan o anki düğüme olan uzaklığı (g(n)) değil, o düğümden hedefe olan tahmini uzaklığı (h(n)) da hesaba katar. f(n) = g(n) + h(n) fonksiyonunu minimize ederek, körlemesine taramak yerine hedef yönüne odaklanır. Heuristic fonksiyon admissible (asla gerçek maliyeti aşmayan) olduğu sürece A* en kısa yolu garanti eder.";
       }
       if (q.includes("dfs") || q.includes("derin")) {
          return "DFS, bir yol bulana kadar gidebildiği kadar derine iner. Bu yüzden bulduğu yolun en kısa yol olma garantisi yoktur, ancak hafıza (memory) açısından O(V) seviyesinde olduğu için BFS'den çok daha avantajlıdır.";
       }
       if (q.includes("z algorithm") || q.includes("z algoritması") || q.includes("string")) {
          return "Z algoritması, geçmişte bulduğu eşleşmeleri Z-box (pencere) içinde tutarak aynı harfleri tekrar tekrar kontrol etmeyi engeller. Bu sayede iç içe döngüler kullanmasına rağmen zaman karmaşıklığını O(N) seviyesine düşürür.";
       }
       if (q.includes("sıralama") || q.includes("sort") || q.includes("seçmeli")) {
          return "Sıralama algoritmalarında bellek içi yer değiştirme (swap) maliyetleri kritik olabilir. Seçmeli sıralamada (Selection Sort) her adımda kalan kısmın en küçüğü bulunup sadece 1 kez swap yapılır. O(N^2) karşılaştırma yapsa da maksimum O(N) swap yaptığı için bazı özel durumlarda tercih edilebilir.";
       }
       if (q.includes("merhaba") || q.includes("selam")) {
           return "Merhaba! Sana kodunda yardımcı olmak için buradayım. (Simüle Edilmiş YZ)";
       }
       return language === 'tr' 
          ? `Sorduğunuz "${question}" sorusu üzerine düşündüm. Mevcut kod adımında bu oldukça kritik bir nokta. Simülasyon modunda olduğumuz için dinamik analiz yapamıyorum, ancak algoritmanın temel veri yapılarına odaklanmak bu adımda size ipucu verebilir.` 
          : `I've considered your question "${question}". In this current step, this is a critical observation. Since we are in simulation mode I cannot generate a dynamic analysis, but focusing on the core data structures here might give you a hint.`;
    }
    return language === 'tr' 
      ? "Ücretsiz demo modundasınız. Kod hakkında YZ'ye soru sormak için lütfen Ayarlar (sağ alt) menüsünden kendi Gemini API anahtarınızı girin."
      : "You are in free demo mode. To ask questions to the AI, please enter your Gemini API Key in the Settings menu (bottom right).";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are Bilgiç Dede (Wise Grandpa), a highly advanced code execution tracer AI.
      The user is asking a question about a specific step in the execution of their code.
      Answer the question concisely and accurately based on the context provided.
      
      Output Language: ${language === 'tr' ? 'Turkish' : 'English'}
      
      Code Context:
      ${code}
      
      Current Simulation Step Focus:
      ${currentStep ? JSON.stringify(currentStep, null, 2) : 'General analysis'}
      
      User's Question:
      ${question}
      
      Answer directly without markdown wrapping unless necessary for code snippets. Keep it brief and friendly.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error: any) {
    console.error("Gemini API chat error:", error);
    return language === 'tr' ? "API hatası. Lütfen anahtarınızı kontrol edin." : "API Error. Please check your key.";
  }
};

export const generateQuestions = async (code: string, language: string = 'tr', apiKey: string = ''): Promise<string[]> => {
  const isTr = language === 'tr';
  const mockFallback = [
    isTr ? "1. İki stringin birbirinin anagramı olup olmadığını bulunuz." : "1. Find if two strings are anagrams.",
    isTr ? "2. Verilen dizideki en uzun artan alt diziyi (LIS) hesaplayın." : "2. Calculate Longest Increasing Subsequence (LIS).",
    isTr ? "3. Bir metin içinde şifreli bir kelimeyi (pattern) O(N) sürede tespit edin." : "3. Detect a ciphered pattern in text in O(N) time.",
    isTr ? "4. Sosyal ağdaki bir kişinin arkadaş tavsiyesi listesini çıkartın." : "4. Generate a friend recommendation list in a social network.",
    isTr ? "5. Harita üzerinde iki nokta arasındaki en kısa rotayı (A*) çizin." : "5. Draw the shortest path between two points on a map using A*."
  ];

  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    if (apiKey === MAGIC_SIM_KEY && isTr) {
      return ["1. [SİMÜLASYON] Bu algoritma ile gerçek hayatta hangi problemi çözerdiniz?", "2. [SİMÜLASYON] Zaman karmaşıklığını optimize edebilir misiniz?", "3. [SİMÜLASYON] Algoritma bellek sınırlarını nasıl zorlar?", "4. [SİMÜLASYON] Edge case durumlarda ne olur?", "5. [SİMÜLASYON] Başka hangi veri yapısı kullanılabilirdi?"];
    } else if (apiKey === MAGIC_SIM_KEY) {
      return ["1. [SIMULATION] What real-life problem does this solve?", "2. [SIMULATION] Can you optimize the time complexity?", "3. [SIMULATION] How does this scale with memory?", "4. [SIMULATION] What about edge cases?", "5. [SIMULATION] What alternative data structures could be used?"];
    }
    return mockFallback;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = isTr 
      ? `Aşağıdaki algoritma kodunu incele ve bu algoritmanın kullanılabileceği 5 farklı mülakat veya gerçek hayat problemini (Örnek soru) üret. Sadece soruları numaralandırarak (1. 2. 3. 4. 5.) ver, başka bir açıklama ekleme.\nKod:\n${code}`
      : `Analyze the following algorithm and provide 5 different interview or real-world problem scenarios where this would be used. Just list the questions numbered 1. to 5. without any extra text.\nCode:\n${code}`;
      
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
  language: string = 'tr',
  apiKey: string = ''
): Promise<string> => {
  if (!apiKey || apiKey === MAGIC_SIM_KEY) {
    let purpose = "Kodun amacı: Algoritma simülasyonu.";
    let timeComplexity = "Bilinmiyor";
    let spaceComplexity = "Bilinmiyor";
    let optimization = "Gemini API Key girerek detaylı analiz alabilirsiniz.";
    let purposeEn = "Purpose: Algorithm simulation.";
    
    if (code.includes('zFunction') || code.includes('ZAlgorithm')) {
      purpose = "Kodun amacı: Z Algoritması ile string içinde şifreli kelime/pattern aramak.";
      timeComplexity = "O(N + M)";
      spaceComplexity = "O(N)";
      optimization = "Z dizisi yardımıyla fazladan karakter karşılaştırmalarını önler, optimal bir yöntemdir.";
      purposeEn = "Purpose: Pattern matching using Z-Algorithm.";
    } else if (code.includes('DFS')) {
      purpose = "Kodun amacı: Derinlik Öncelikli Arama (DFS) ile grafı olabildiğince derine inerek gezmek.";
      timeComplexity = "O(V + E)";
      spaceComplexity = "O(V)";
      optimization = "Özyineli (recursive) yapı yerine Stack (yığıt) kullanılarak bellek taşması (Stack Overflow) önlenebilir.";
      purposeEn = "Purpose: Traverse graph using Depth First Search.";
    } else if (code.includes('BFS')) {
      purpose = "Kodun amacı: Sığlık Öncelikli Arama (BFS) ile grafı katman katman gezmek ve en kısa yolu bulmak.";
      timeComplexity = "O(V + E)";
      spaceComplexity = "O(V)";
      optimization = "Ağır graflarda, çift yönlü BFS (Bidirectional BFS) kullanılarak arama uzayı daraltılabilir.";
      purposeEn = "Purpose: Traverse graph layer by layer using Breadth First Search.";
    } else if (code.includes('dijkstra') || code.includes('Dijkstra')) {
      purpose = "Kodun amacı: Dijkstra Algoritması ile ağırlıklı graflarda tek kaynaktan tüm düğümlere en kısa yolu bulmak.";
      timeComplexity = "O((V + E) log V)";
      spaceComplexity = "O(V)";
      optimization = "Öncelik Kuyruğu (Priority Queue) için Fibonacci Heap kullanılırsa zaman karmaşıklığı O(E + V log V)'ye düşürülebilir.";
      purposeEn = "Purpose: Find shortest paths from a source using Dijkstra's Algorithm.";
    } else if (code.includes('aStar') || code.includes('A*')) {
      purpose = "Kodun amacı: A* (A-Star) Algoritması ile sezgisel (heuristic) bir fonksiyon kullanarak hedefe en kısa yolu bulmak.";
      timeComplexity = "O(E)";
      spaceComplexity = "O(V)";
      optimization = "Kullanılan Heuristic fonksiyonun (Örn: Manhattan/Euclidean) tutarlılığı (consistency) iyileştirilerek hız artırılabilir.";
      purposeEn = "Purpose: Find shortest path to target using A* heuristic algorithm.";
    }

    if (apiKey === MAGIC_SIM_KEY) {
        purpose = "(SİMÜLE APİ YANITI) " + purpose;
        purposeEn = "(SIMULATED API RESPONSE) " + purposeEn;
        optimization = language === 'tr' ? "API anahtarınız başarıyla simüle ediliyor! " + optimization : "Your API key is being successfully simulated! " + optimization;
    }

    if (language === 'tr') {
      return `${purpose}\nTime Complexity: ${timeComplexity}\nSpace Complexity: ${spaceComplexity}\nOptimizasyon Potansiyeli: ${optimization}`;
    }
    return `${purposeEn}\nTime Complexity: ${timeComplexity}\nSpace Complexity: ${spaceComplexity}\nOptimization Potential: ${optimization}`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Analyze the following code. Language for output: ${language === 'tr' ? 'Turkish' : 'English'}.
      Please provide a highly structured, 4-line response in exactly this format without markdown bolding:
      Kodun amacı: [Brief explanation]
      Time Complexity: [Big O]
      Space Complexity: [Big O]
      Optimizasyon Potansiyeli: [Brief sentence on if it can be optimized]
      
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


export const getMockStepsFallback = (code: string, language: string = 'tr', inputVars: string = ''): SimulationStep[] => {
  if (code.includes('DFS') || code.includes('Depth First')) return getMockDfsSteps(language, inputVars);
  if (code.includes('BFS') || code.includes('Breadth First')) return getMockBfsSteps(language, inputVars);
  if (code.includes('dijkstra') || code.includes('Dijkstra')) return getMockDijkstraSteps(language, inputVars);
  if (code.includes('aStar') || code.includes('A*')) return getMockAStarSteps(language, inputVars);
  if (code.includes('ZAlgorithm') || code.includes('zFunction') || code.includes('z = new int')) return getMockArraySteps(language, inputVars);
  if (code.includes('Sort') || code.includes('Sıralama') || code.includes('swap') || code.includes('partition')) return getMockSortingSteps(language, inputVars);
  
  // Generic Fallback for stubs
  return [{
    lineNumber: 1,
    visualData: { 
      type: 'variables', 
      vars: { info: "Visual simulation not implemented for this stub." } 
    },
    explanation: language === 'tr' ? "Bu algoritma için çevrimdışı görsel simülasyon henüz tanımlanmamış. Lütfen API Key girerek AI tabanlı analizi kullanın veya DFS / Z-Algorithm gibi tam destekli algoritmaları seçin." : "Offline visual simulation not implemented for this algorithm. Please use AI-based analysis or select fully supported ones like DFS or Z-Algorithm."
  }];
};

const getMockArraySteps = (lang: string, inputVars: string): SimulationStep[] => {
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
  
  const pushStep = (line: number, pointersObj: Record<string, number>, varsObj: any, expTr: string, expEn: string) => {
    steps.push({
      lineNumber: line,
      visualData: { type: 'array', values, pointers: pointersObj, vars: { ...varsObj } },
      explanation: lang === 'tr' ? expTr : expEn
    });
  };

  let z = new Array(n).fill(0);
  let l = 0, r = 0;
  
  pushStep(3, {}, { n }, "n değişkenine string'in uzunluğu atanıyor, böylece döngü limitimizi belirliyoruz.", "String length assigned to n.");
  pushStep(4, {}, { n, z: JSON.stringify(z) }, "Bulduğumuz eşleşme uzunluklarını hafızada tutmak için Z dizisini 0'larla dolduruyoruz.", "Z array is initialized.");
  pushStep(5, { L: 0, R: 0 }, { n, z: JSON.stringify(z), l, r }, "L ve R işaretçilerini 0 olarak başlatıyoruz. Bu işaretçiler bize daha önce bulduğumuz en sağdaki eşleşme penceresini (Z-box) gösterecek.", "Pointers l and r initialized to 0.");
  
  for (let i = 1; i < n; i++) {
    pushStep(6, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Döngü i=${i} ('${s[i]}') için başlıyor.`, `Loop starts for i=${i} ('${s[i]}').`);
    
    if (i <= r) {
      pushStep(7, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `i (${i}) <= R (${r}) olduğu için şu anki harfimiz daha önceden hesapladığımız Z-box penceresinin içinde kalıyor. Geçmişteki bilgiyi kullanabiliriz.`, `i (${i}) <= r (${r}), we are inside the Z-box.`);
      z[i] = Math.min(r - i + 1, z[i - l]);
      pushStep(8, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Z[${i}] değeri optimize ediliyor. Yeniden karakter karakter saymak yerine geçmişteki eşleşme miktarını (Z[i-l]) kopyalıyoruz: ${z[i]}`, `Z[${i}] is optimized: ${z[i]}`);
    }
    
    pushStep(10, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Kalan harfler için tek tek eşleşme kontrolüne başlıyoruz (while döngüsü).`, `Matching check starts (while loop).`);
    
    while (i + z[i] < n && s.charAt(z[i]) === s.charAt(i + z[i])) {
      pushStep(10, { "z[i]": z[i], "i+z[i]": i + z[i], L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Baştaki '${s.charAt(z[i])}' harfi ile i. indeksten sonraki '${s.charAt(i + z[i])}' harfi birbiriyle eşleştiği için Z değerimizi büyütebiliriz!`, `'${s.charAt(z[i])}' matches '${s.charAt(i + z[i])}'!`);
      z[i]++;
      pushStep(11, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Eşleşme başarılı olduğu için Z[${i}] değerimizi 1 artırdık: ${z[i]}`, `Z[${i}] value incremented: ${z[i]}`);
    }
    
    if (i + z[i] < n) {
      pushStep(10, { "z[i]": z[i], "i+z[i]": i + z[i], L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Baştaki '${s.charAt(z[i])}' harfi ile '${s.charAt(i + z[i])}' eşleşmediğinden daha fazla ileri gidemiyoruz. While döngüsünü sonlandırıyoruz.`, `'${s.charAt(z[i])}' does not match '${s.charAt(i + z[i])}'.`);
    }
    
    pushStep(13, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Bulduğumuz yeni eşleşmenin sağ sınırı (i + Z[i] - 1), eski R sınırımızı (R=${r}) aşıyor mu diye kontrol ediyoruz.`, `Checking Z-box boundary.`);
    if (i + z[i] - 1 > r) {
      l = i;
      r = i + z[i] - 1;
      pushStep(14, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `Evet aşıyor! Bu yüzden Z-box penceremizi yeni eşleşme aralığına kaydırıyoruz.`, `New Z-box found! Updating pointers.`);
      pushStep(15, { i, L: l, R: r }, { n, z: JSON.stringify(z), l, r, i }, `L ve R işaretçileri bulunduğumuz eşleşme sınırlarına çekildi (L=${l}, R=${r}).`, `l and r updated to ${l} and ${r}.`);
    }
  }
  
  pushStep(18, { L: l, R: r }, { n, z: JSON.stringify(z), l, r }, "Döngü bitti. Z-Algoritması tüm harfler için ön ek eşleşme uzunluklarını buldu. Z dizisini döndürüyoruz!", "Loop ended. Simulation completed!");
  
  return steps;
}

const getMockDfsSteps = (lang: string, inputVars: string): SimulationStep[] => {
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
  
  const pushStep = (line: number, v: number, expTr: string, expEn: string) => {
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
        vars: { [lang === 'tr' ? 'mevcut_dugum' : 'current_node']: v, [lang === 'tr' ? 'ziyaret_edilen' : 'visited']: JSON.stringify(visited.slice(1, 8)) + '...' } // truncate for UI
      },
      explanation: lang === 'tr' ? expTr : expEn
    });
  };

  const dfs = (v: number) => {
    activeNodes.add(v);
    visited[v] = true;
    pushStep(2, v, `DFS(${v}) çağrıldı. Düğüm ${v} ziyaret edildi (visited=true).`, `DFS(${v}) called. Node ${v} marked as visited.`);
    
    pushStep(4, v, `Düğüm ${v}'nin komşuları kontrol ediliyor (while).`, `Checking neighbors of Node ${v} (while loop).`);
    
    const neighbors = edges.filter(e => e.from === v).map(e => e.to);
    for (const n of neighbors) {
      pushStep(6, v, `Komşu ${n} kontrol ediliyor.`, `Checking neighbor ${n}.`);
      if (!visited[n]) {
        pushStep(7, v, `Komşu ${n} henüz ziyaret edilmemiş, DFS(${n}) için daha derine iniliyor...`, `Neighbor ${n} not visited, descending to DFS(${n})...`);
        dfs(n);
        activeNodes.add(v); // Re-highlight current after returning from child
        pushStep(4, v, `DFS(${n}) bitti. Düğüm ${v}'ye geri (backtrack) döndük. Başka komşusu var mı?`, `DFS(${n}) finished. Backtracked to Node ${v}. Any other neighbors?`);
      }
    }
    pushStep(9, v, `Düğüm ${v}'nin tüm komşuları bitti. Geldiği yola geri dönüyor (Backtrack).`, `All neighbors of Node ${v} visited. Backtracking up.`);
    activeNodes.delete(v);
  };

  pushStep(1, 1, "DFS 1. düğümden başlatılıyor...", "Starting DFS from node 1...");
  dfs(1);
  pushStep(10, 1, "Tüm 15 düğümlük ağaç (graph) yapısı başarıyla DFS ile gezildi!", "Entire 15-node tree traversed successfully using DFS!");
  
  return steps;
};

const getMockBfsSteps = (lang: string, inputVars: string): SimulationStep[] => {
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
  
  const pushStep = (line: number, v: number | null, expTr: string, expEn: string) => {
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
          [lang === 'tr' ? 'mevcut_dugum' : 'current']: v, 
          [lang === 'tr' ? 'kuyruk' : 'queue']: JSON.stringify(queue.slice(0, 5)) + (queue.length > 5 ? '...' : '')
        }
      },
      explanation: lang === 'tr' ? expTr : expEn
    });
  };

  pushStep(1, null, "BFS kuyruğu başlatılıyor (15 Düğümlü Graf)...", "Initializing BFS queue (15-node graph)...");
  visited[1] = true;
  dist[1] = 0;
  queue.push(1);
  pushStep(4, 1, "Kök düğüm (1) kuyruğa eklendi ve uzaklığı 0 olarak ayarlandı.", "Root node (1) pushed to queue with dist 0.");
  
  while (queue.length > 0) {
    const curr = queue.shift()!;
    activeNodes.add(curr);
    fullyVisited.add(curr);
    pushStep(7, curr, `Düğüm kuyruktan çıkarıldı.`, `Node popped from queue.`);
    
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
        pushStep(13, curr, `Komşu düğüm uzaklığı ${dist[n]} hesaplandı ve kuyruğa eklendi.`, `Neighbor dist calculated as ${dist[n]} and added to queue.`);
      }
    }
    activeNodes.delete(curr);
  }
  
  pushStep(17, null, "Tüm düğümler gezildi. BFS başarıyla tamamlandı!", "All nodes visited. BFS completed successfully!");
  return steps;
};

const getMockAStarSteps = (lang: string, inputVars: string): SimulationStep[] => {
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

  const pushStep = (line: number, v: number, expTr: string, expEn: string) => {
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
          [lang === 'tr' ? 'acik_liste' : 'openSet']: JSON.stringify(Array.from(openSet).slice(0, 5)) + (openSet.size>5?'...':''),
          [lang === 'tr' ? 'kapali_liste' : 'closedSet']: JSON.stringify(Array.from(closedSet).slice(0, 5)) + (closedSet.size>5?'...':'')
        }
      },
      explanation: lang === 'tr' ? expTr : expEn
    });
  };

  pushStep(2, 1, "Başlangıç noktası (Start) açık listeye eklendi. Uzaklık 0.", "Start node added to openSet. Distance is 0.");
  
  while(openSet.size > 0) {
    let curr = Array.from(openSet).reduce((minNode, node) => fScore[node] < fScore[minNode] ? node : minNode, Array.from(openSet)[0]);
    
    if (curr === 15) {
       closedSet.add(curr);
       pushStep(6, 15, "A* algoritması Hedefe giden en kısa yolu başarıyla buldu!", "A* found the shortest path to Target!");
       break;
    }
    
    openSet.delete(curr);
    closedSet.add(curr);
    pushStep(4, curr, `Açık listedeki en düşük f-değerine sahip düğüm seçildi.`, `Node with lowest f-value selected.`);
    
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
             pushStep(10, curr, `Komşu incelendi. Yeni uzaklık: ${tentative_gScore} bulundu ve açık listeye eklendi.`, `Neighbor evaluated. New distance: ${tentative_gScore} added.`);
             stepped = true;
           }
         }
       }
    }
  }
  
  return steps;
};

const getMockDijkstraSteps = (lang: string, inputVars: string): SimulationStep[] => {
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
  
  const pushStep = (line: number, v: number, expTr: string, expEn: string) => {
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
          [lang === 'tr' ? 'mesafeler' : 'dist']: JSON.stringify(dist.slice(1, 6).map(d => d===Infinity ? '∞' : d)) + '...', 
          [lang === 'tr' ? 'kuyruk' : 'pq']: JSON.stringify(pq.slice(0, 3).map(p => `(${p.dist})`)) + '...'
        }
      },
      explanation: lang === 'tr' ? expTr : expEn
    });
  };

  pushStep(2, 1, "Mesafe dizisi sonsuz olarak başlatıldı. Başlangıç noktası uzaklığı 0 yapıldı.", "Distances initialized to infinity. Start node dist is 0.");
  
  while(pq.length > 0) {
     pq.sort((a,b) => a.dist - b.dist);
     const curr = pq.shift()!;
     if (visitedPath.has(curr.id)) continue;
     visitedPath.add(curr.id);
     
     pushStep(6, curr.id, `En düşük mesafeli düğüm kuyruktan çıkarıldı.`, `Node with minimum distance popped.`);
     
     const neighbors = [
       ...edges.filter(e => e.from === curr.id).map(e => ({ to: e.to, w: e.weight })),
       ...edges.filter(e => e.to === curr.id).map(e => ({ to: e.from, w: e.weight }))
     ];
     
     for (const n of neighbors) {
       if (dist[curr.id] + n.w < dist[n.to]) {
         dist[n.to] = dist[curr.id] + n.w;
         pq.push({ id: n.to, dist: dist[n.to] });
         pushStep(9, curr.id, `Daha kısa bir yol bulundu! Yeni uzaklık: ${dist[n.to]}.`, `Shorter path found! New dist: ${dist[n.to]}.`);
       }
     }
  }
  
  pushStep(15, 15, "Tüm en kısa yollar başarıyla hesaplandı.", "All shortest paths successfully calculated.");
  return steps;
};

const getMockSortingSteps = (lang: string, inputVars: string): SimulationStep[] => {
  const steps: SimulationStep[] = [];
  let arr = [38, 27, 43, 3, 9, 82, 10, 5, 20, 15, 31, 1, 6];
  if (inputVars === 'preset:i1') arr = [3, 9, 10, 15, 20, 38, 27, 5, 43, 82]; // mostly sorted
  if (inputVars === 'preset:i3') arr = [99, 82, 75, 66, 52, 45, 33, 21, 15, 8, 4, 1, 95, 71, 62, 58, 44, 38, 27, 19, 14, 5]; // large chaos
  
  const pushStep = (line: number, pointersObj: Record<string, number>, expTr: string, expEn: string) => {
    steps.push({
      lineNumber: line,
      visualData: { type: 'array', values: [...arr], pointers: pointersObj, vars: {} },
      explanation: lang === 'tr' ? expTr : expEn
    });
  };

  const n = arr.length;
  pushStep(1, {}, `${n} elemanlı dizi üzerinde Seçmeli Sıralama (Selection Sort) algoritması başlatılıyor.`, `Selection Sort algorithm started on a ${n}-element array.`);
  
  for(let i = 0; i < n - 1; i++) {
     let minIdx = i;
     pushStep(2, { i, minIdx }, `Döngü i=${i} için başlıyor. Başlangıçtaki en küçük eleman varsayımı: ${arr[minIdx]} (indeks: ${minIdx})`, `Loop starts for i=${i}. Initial minimum assumed: ${arr[minIdx]} (index: ${minIdx})`);
     
     for(let j = i + 1; j < n; j++) {
       pushStep(4, { i, minIdx, j }, `${arr[j]} ile mevcut minimum olan ${arr[minIdx]} karşılaştırılıyor.`, `Comparing ${arr[j]} with current min ${arr[minIdx]}.`);
       if(arr[j] < arr[minIdx]) {
         minIdx = j;
         pushStep(5, { i, minIdx, j }, `Yeni minimum bulundu! Yeni en küçük değer: ${arr[minIdx]} (indeks: ${minIdx})`, `New minimum found! New min value: ${arr[minIdx]} (index: ${minIdx})`);
       }
     }
     
     if (minIdx !== i) {
       pushStep(7, { i, minIdx }, `Arama bitti. Gerçek minimum değer olan ${arr[minIdx]} ile i. sıradaki ${arr[i]} yer değiştiriyor (swap).`, `Search complete. Swapping the real min value ${arr[minIdx]} with ${arr[i]}.`);
       let temp = arr[i];
       arr[i] = arr[minIdx];
       arr[minIdx] = temp;
       pushStep(8, { i, minIdx }, `Yer değiştirme tamamlandı. ${arr[i]} doğru konuma yerleşti.`, `Swap completed. ${arr[i]} is now in correct position.`);
     } else {
       pushStep(7, { i, minIdx }, `Arama bitti. En küçük değer zaten doğru yerde (${arr[i]}), yer değiştirmeye gerek yok.`, `Search complete. Minimum is already in correct place (${arr[i]}), no swap needed.`);
     }
  }

  pushStep(10, {}, `Sıralama tamamlandı! Dizi tamamen sıralı duruma getirildi.`, `Sorting completed! The array is fully sorted.`);
  arr.sort((a,b) => a-b);
  pushStep(10, {}, "Dizi tamamen başarıyla sıralandı!", "Array fully sorted successfully!");
  
  return steps;
};
