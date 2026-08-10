import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { GraphDocumentV1, SimulationInput, SimulationStep } from '../types/simulation';
import { createInputPreset } from '../services/inputPresets';
import { LOCAL_AI_MODELS } from '../services/localAiService';
import type { Locale } from '../i18n/translations';
import type { CustomSimulationPackageV1 } from '../types/godMode';
import { compileCustomSimulationPackage } from '../services/customSimulationCompiler';
import { classifyGraphChange, patchPackageGraphLayout } from '../services/graphTransactions';
import { parseSimulationInput } from '../services/inputParsers';
import { parseLocalAiContextWindow } from '../services/localAiModels';
import type { AiConnectionProfileV1, AiProviderKind, AiRuntimeSelection } from '../types/aiProvider';
import {
  AI_SELECTION_KEY,
  loadAiRuntimeSelection,
  loadExternalAiProfiles,
  saveExternalAiProfiles,
} from '../services/aiProviderProfiles';
import { isDesktopRuntime } from '../services/desktopAiService';

export type LocalAiStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';
export type Theme = 'neon' | 'dark' | 'light';

interface TimelineContextType {
  code: string;
  setCode: (code: string) => void;
  algorithmName: string;
  setAlgorithmName: (name: string) => void;
  steps: SimulationStep[];
  setSteps: (steps: SimulationStep[]) => void;
  currentIndex: number;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  isPlaying: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  setSpeed: (speed: number) => void;
  jumpTo: (index: number) => void;
  analysis: string | null;
  setAnalysis: (analysis: string | null) => void;
  simulationInput: SimulationInput;
  setSimulationInput: Dispatch<SetStateAction<SimulationInput>>;
  applyGraphTransaction: (graph: GraphDocumentV1) => 'layout' | 'structural' | 'failed';
  inputError: string | null;
  setInputError: (error: string | null) => void;
  selectedExampleQuestion: string | null;
  setSelectedExampleQuestion: (question: string | null) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  aiProvider: AiProviderKind;
  setAiProvider: (provider: AiProviderKind) => void;
  aiProfiles: AiConnectionProfileV1[];
  setAiProfiles: Dispatch<SetStateAction<AiConnectionProfileV1[]>>;
  aiBearerToken: string;
  setAiBearerToken: (token: string) => void;
  aiContextWindow: number;
  setAiContextWindow: (size: number) => void;
  aiStatus: LocalAiStatus;
  setAiStatus: (status: LocalAiStatus) => void;
  aiProgress: string;
  setAiProgress: (progress: string) => void;
  aiProgressPercent: number | null;
  setAiProgressPercent: (percent: number | null) => void;
  showAiLoadWarning: boolean;
  setShowAiLoadWarning: (show: boolean) => void;
  showAiLoadProgress: boolean;
  setShowAiLoadProgress: (show: boolean) => void;
  isAiMaximized: boolean;
  setIsAiMaximized: (max: boolean) => void;
  autoLoadAiModel: boolean;
  setAutoLoadAiModel: (auto: boolean) => void;
  radioMinimizeSeconds: number;
  setRadioMinimizeSeconds: (seconds: number) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isEditingInput: boolean;
  setIsEditingInput: (editing: boolean) => void;
  pinnedVariables: string[];
  togglePinnedVariable: (name: string) => void;
  radioPlaylistId: string;
  setRadioPlaylistId: (id: string) => void;
  radioOpenRequest: number;
  requestRadioOpen: () => void;
  radioAutoplay: boolean;
  setRadioAutoplay: (autoplay: boolean) => void;
  godModeEnabled: boolean;
  setGodModeEnabled: (enabled: boolean) => void;
  isGodModeTypingSource: boolean;
  setIsGodModeTypingSource: (typing: boolean) => void;
  activeSimulationPackage: CustomSimulationPackageV1 | null;
  packageOutOfSync: boolean;
  applySimulationPackage: (value: CustomSimulationPackageV1, runId: string) => void;
  applyVisualPackageTransaction: (value: CustomSimulationPackageV1, runId: string) => void;
  applyInputTransaction: (
    input: SimulationInput,
    steps: SimulationStep[],
    runId: string,
  ) => void;
  applyPresetTransaction: (value: {
    algorithmName: string;
    code: string;
    input: SimulationInput;
    steps: SimulationStep[];
    analysis: string | null;
  }, runId: string) => void;
  undoWorkspaceTransaction: () => void;
  redoWorkspaceTransaction: () => void;
  canUndoWorkspace: boolean;
  canRedoWorkspace: boolean;
  guidedMode: boolean;
  setGuidedMode: (enabled: boolean) => void;
}

const STORAGE_KEY = 'codexray.workspace.v1';
const PINNED_VARIABLES_KEY = 'codexray.pinned-variables.v1';
const AI_MODEL_KEY = 'codexray.ai-model.v1';
const AI_CONTEXT_WINDOW_KEY = 'codexray.ai-context-window.v1';
const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences remain available for the current session when storage is unavailable.
  }
};

interface WorkspaceState {
  code: string;
  algorithmName: string;
  steps: SimulationStep[];
  currentIndex: number;
  analysis: string | null;
  simulationInput: SimulationInput;
  inputError: string | null;
  activePackage: CustomSimulationPackageV1 | null;
  packageOutOfSync: boolean;
  undo: WorkspaceSnapshot[];
  redo: WorkspaceSnapshot[];
  lastTransactionId: string | null;
}

type WorkspaceSnapshot = Omit<WorkspaceState, 'undo' | 'redo' | 'lastTransactionId'>;

type WorkspaceAction =
  | { type: 'set-code'; value: string }
  | { type: 'set-algorithm'; value: string }
  | { type: 'set-steps'; value: SimulationStep[] }
  | { type: 'set-index'; value: SetStateAction<number> }
  | { type: 'set-analysis'; value: string | null }
  | { type: 'set-input'; value: SetStateAction<SimulationInput> }
  | { type: 'set-input-error'; value: string | null }
  | { type: 'apply-package'; value: CustomSimulationPackageV1; runId: string }
  | { type: 'apply-graph-layout'; value: CustomSimulationPackageV1; runId: string }
  | { type: 'apply-input'; input: SimulationInput; steps: SimulationStep[]; runId: string }
  | {
    type: 'apply-preset';
    value: {
      algorithmName: string;
      code: string;
      input: SimulationInput;
      steps: SimulationStep[];
      analysis: string | null;
    };
    runId: string;
  }
  | { type: 'undo' }
  | { type: 'redo' };

const workspaceSnapshot = (state: WorkspaceState): WorkspaceSnapshot => ({
  code: state.code,
  algorithmName: state.algorithmName,
  steps: state.steps,
  currentIndex: state.currentIndex,
  analysis: state.analysis,
  simulationInput: state.simulationInput,
  inputError: state.inputError,
  activePackage: state.activePackage,
  packageOutOfSync: state.packageOutOfSync,
});

const WORKSPACE_HISTORY_LIMIT = 12;

const workspaceReducer = (state: WorkspaceState, action: WorkspaceAction): WorkspaceState => {
  switch (action.type) {
    case 'set-code':
      return {
        ...state,
        code: action.value,
        packageOutOfSync: Boolean(
          state.activePackage && action.value !== state.activePackage.source.code,
        ),
      };
    case 'set-algorithm': return { ...state, algorithmName: action.value };
    case 'set-steps': return { ...state, steps: action.value };
    case 'set-index': {
      const next = typeof action.value === 'function'
        ? action.value(state.currentIndex)
        : action.value;
      return { ...state, currentIndex: next };
    }
    case 'set-analysis': return { ...state, analysis: action.value };
    case 'set-input': {
      const next = typeof action.value === 'function'
        ? action.value(state.simulationInput)
        : action.value;
      return {
        ...state,
        simulationInput: next,
        packageOutOfSync: Boolean(
          state.activePackage
          && JSON.stringify(next) !== JSON.stringify(state.activePackage.input.value),
        ),
      };
    }
    case 'set-input-error': return { ...state, inputError: action.value };
    case 'apply-package':
      return {
        ...state,
        code: action.value.source.code,
        algorithmName: action.value.title,
        steps: action.value.steps,
        currentIndex: 0,
        analysis: action.value.analysis,
        simulationInput: action.value.input.value,
        inputError: null,
        activePackage: action.value,
        packageOutOfSync: false,
        undo: [...state.undo, workspaceSnapshot(state)].slice(-WORKSPACE_HISTORY_LIMIT),
        redo: [],
        lastTransactionId: action.runId,
      };
    case 'apply-graph-layout':
      return {
        ...state,
        steps: action.value.steps,
        simulationInput: action.value.input.value,
        inputError: null,
        activePackage: action.value,
        packageOutOfSync: false,
        undo: state.lastTransactionId?.startsWith('graph-layout-')
          ? state.undo
          : [...state.undo, workspaceSnapshot(state)].slice(-WORKSPACE_HISTORY_LIMIT),
        redo: [],
        lastTransactionId: action.runId,
      };
    case 'apply-input': {
      const nextPackage = state.activePackage
        ? {
          ...state.activePackage,
          input: { ...state.activePackage.input, value: action.input },
          steps: action.steps,
        }
        : null;
      return {
        ...state,
        simulationInput: action.input,
        steps: action.steps,
        currentIndex: 0,
        analysis: nextPackage?.analysis ?? state.analysis,
        inputError: null,
        activePackage: nextPackage,
        packageOutOfSync: false,
        undo: [...state.undo, workspaceSnapshot(state)].slice(-WORKSPACE_HISTORY_LIMIT),
        redo: [],
        lastTransactionId: action.runId,
      };
    }
    case 'apply-preset':
      return {
        ...state,
        algorithmName: action.value.algorithmName,
        code: action.value.code,
        simulationInput: action.value.input,
        steps: action.value.steps,
        currentIndex: 0,
        analysis: action.value.analysis,
        inputError: null,
        activePackage: null,
        packageOutOfSync: false,
        undo: [...state.undo, workspaceSnapshot(state)].slice(-WORKSPACE_HISTORY_LIMIT),
        redo: [],
        lastTransactionId: action.runId,
      };
    case 'undo': {
      const previous = state.undo.at(-1);
      if (!previous) return state;
      return {
        ...previous,
        undo: state.undo.slice(0, -1),
        redo: [workspaceSnapshot(state), ...state.redo].slice(0, WORKSPACE_HISTORY_LIMIT),
        lastTransactionId: 'undo',
      };
    }
    case 'redo': {
      const next = state.redo[0];
      if (!next) return state;
      return {
        ...next,
        undo: [...state.undo, workspaceSnapshot(state)].slice(-WORKSPACE_HISTORY_LIMIT),
        redo: state.redo.slice(1),
        lastTransactionId: 'redo',
      };
    }
    default: return state;
  }
};

const loadInput = (): SimulationInput => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { simulationInput?: unknown; input?: unknown };
      const candidate = (parsed.simulationInput ?? parsed.input) as Partial<SimulationInput> | undefined;
      if (candidate && ['array', 'string', 'tree', 'graph'].includes(candidate.kind ?? '')) {
        const validated = parseSimulationInput(
          candidate.kind as SimulationInput['kind'],
          typeof candidate.text === 'string' ? candidate.text : '',
          candidate.graph,
          candidate.parameters,
        );
        if (validated.input) return { ...validated.input, origin: candidate.origin };
      }
    }
  } catch {
    // Ignore invalid or unavailable browser storage.
  }
  return createInputPreset('array', 1);
};

const loadPinnedVariables = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_VARIABLES_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((value): value is string =>
      typeof value === 'string' && value.trim().length > 0 && value.length <= 120,
    ))].slice(0, 20);
  } catch {
    return [];
  }
};

const loadInitialAiState = (): {
  profiles: AiConnectionProfileV1[];
  selection: AiRuntimeSelection;
} => {
  try {
    const profiles = loadExternalAiProfiles();
    const selection = loadAiRuntimeSelection(profiles);
    if (selection.provider !== 'webllm' && !isDesktopRuntime()) {
      return {
        profiles,
        selection: {
          version: 2,
          provider: 'webllm',
          model: LOCAL_AI_MODELS[0].id,
          contextWindow: 4096,
        },
      };
    }
    return { profiles, selection };
  } catch {
    return {
      profiles: loadExternalAiProfiles(),
      selection: {
        version: 2,
        provider: 'webllm',
        model: LOCAL_AI_MODELS[0].id,
        contextWindow: 4096,
      },
    };
  }
};

export const TimelineProvider = ({ children }: { children: ReactNode }) => {
  const [initialAiState] = useState(loadInitialAiState);
  const [workspace, dispatchWorkspace] = useReducer(workspaceReducer, null, () => ({
    code: '',
    algorithmName: 'Custom Code',
    steps: [],
    currentIndex: 0,
    analysis: null,
    simulationInput: loadInput(),
    inputError: null,
    activePackage: null,
    packageOutOfSync: false,
    undo: [],
    redo: [],
    lastTransactionId: null,
  }));
  const {
    code,
    algorithmName,
    steps,
    currentIndex,
    analysis,
    simulationInput,
    inputError,
  } = workspace;
  const setCode = useCallback((value: string) => dispatchWorkspace({ type: 'set-code', value }), []);
  const setAlgorithmName = useCallback((value: string) => dispatchWorkspace({ type: 'set-algorithm', value }), []);
  const setSteps = useCallback((value: SimulationStep[]) => dispatchWorkspace({ type: 'set-steps', value }), []);
  const setCurrentIndex: Dispatch<SetStateAction<number>> = useCallback(
    (value) => dispatchWorkspace({ type: 'set-index', value }),
    [],
  );
  const setAnalysis = useCallback((value: string | null) => dispatchWorkspace({ type: 'set-analysis', value }), []);
  const setSimulationInput: Dispatch<SetStateAction<SimulationInput>> = useCallback(
    (value) => dispatchWorkspace({ type: 'set-input', value }),
    [],
  );
  const setInputError = useCallback((value: string | null) => dispatchWorkspace({ type: 'set-input-error', value }), []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [selectedExampleQuestion, setSelectedExampleQuestion] = useState<string | null>(null);
  const initialProfileId = initialAiState.selection.provider === 'webllm'
    ? null
    : initialAiState.selection.profileId;
  const initialExternalProfile = initialProfileId === null
    ? null
    : initialAiState.profiles.find((profile) => profile.id === initialProfileId) ?? null;
  const [aiProvider, setAiProvider] = useState<AiProviderKind>(initialAiState.selection.provider);
  const [aiProfiles, setAiProfiles] = useState<AiConnectionProfileV1[]>(initialAiState.profiles);
  const [aiBearerToken, setAiBearerToken] = useState('');
  const [aiModel, setAiModel] = useState(() => initialAiState.selection.provider === 'webllm'
    ? initialAiState.selection.model
    : initialExternalProfile?.model ?? '');
  const [aiContextWindow, setAiContextWindow] = useState<number>(() =>
    initialAiState.selection.provider === 'webllm'
      ? initialAiState.selection.contextWindow
      : initialExternalProfile?.contextWindow ?? parseLocalAiContextWindow(readStorage(AI_CONTEXT_WINDOW_KEY) ?? 4096),
  );
  const [aiStatus, setAiStatus] = useState<LocalAiStatus>('idle');
  const [aiProgress, setAiProgress] = useState('');
  const [aiProgressPercent, setAiProgressPercent] = useState<number | null>(null);
  const [showAiLoadWarning, setShowAiLoadWarning] = useState(() => 
    readStorage('codexray.ai.showWarning') !== 'false'
  );
  const [showAiLoadProgress, setShowAiLoadProgress] = useState(() => 
    readStorage('codexray.ai.showProgress') !== 'false'
  );
  const [autoLoadAiModel, setAutoLoadAiModel] = useState(() => 
    readStorage('codexray.ai.autoLoad') !== 'false'
  );
  const [radioMinimizeSeconds, setRadioMinimizeSeconds] = useState(() => {
    const parsed = Number(readStorage('codexray.radio.minimizeSeconds'));
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 16 ? parsed : 2;
  });
  const [isAiMaximized, setIsAiMaximized] = useState(false);
  const [locale, setLocale] = useState<Locale>(() =>
    readStorage('codexray.locale') === 'en' ? 'en' : 'tr',
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = readStorage('codexray.theme');
    return saved === 'dark' || saved === 'light' || saved === 'neon' ? saved : 'neon';
  });
  const [isEditingInput, setIsEditingInput] = useState(false);
  const [pinnedVariables, setPinnedVariables] = useState<string[]>(loadPinnedVariables);
  const [radioPlaylistId, setRadioPlaylistId] = useState(() => 
    readStorage('codexray.radio.playlist') || 'https://youtube.com/playlist?list=OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0'
  );
  const [radioOpenRequest, setRadioOpenRequest] = useState(0);
  const [radioAutoplay, setRadioAutoplay] = useState(() => 
    readStorage('codexray.radio.autoplay') === 'true'
  );
  const [godModeEnabled, setGodModeEnabled] = useState(() =>
    readStorage('codexray.ai.godMode') !== 'false'
  );
  const [isGodModeTypingSource, setIsGodModeTypingSource] = useState(false);
  const [guidedMode, setGuidedMode] = useState(() =>
    readStorage('codexray.ai.guidedMode') !== 'false'
  );
  const requestRadioOpen = useCallback(() => {
    setRadioOpenRequest((request) => request + 1);
  }, []);
  const applySimulationPackage = useCallback((value: CustomSimulationPackageV1, runId: string) => {
    setIsPlaying(false);
    dispatchWorkspace({ type: 'apply-package', value, runId });
  }, []);
  const applyVisualPackageTransaction = useCallback((value: CustomSimulationPackageV1, runId: string) => {
    dispatchWorkspace({ type: 'apply-graph-layout', value, runId });
  }, []);
  const applyInputTransaction = useCallback((input: SimulationInput, value: SimulationStep[], runId: string) => {
    setIsPlaying(false);
    dispatchWorkspace({ type: 'apply-input', input, steps: value, runId });
  }, []);
  const applyPresetTransaction = useCallback((value: {
    algorithmName: string;
    code: string;
    input: SimulationInput;
    steps: SimulationStep[];
    analysis: string | null;
  }, runId: string) => {
    setIsPlaying(false);
    dispatchWorkspace({ type: 'apply-preset', value, runId });
  }, []);
  const applyGraphTransaction = useCallback((graph: GraphDocumentV1): 'layout' | 'structural' | 'failed' => {
    const activePackage = workspace.activePackage;
    const previousGraph = activePackage?.input.value.graph;
    if (!activePackage || !previousGraph) {
      dispatchWorkspace({
        type: 'set-input',
        value: { kind: graph.mode, text: JSON.stringify(graph), graph, origin: 'user' },
      });
      return 'structural';
    }
    const change = classifyGraphChange(previousGraph, graph);
    if (change === 'layout') {
      const patched = patchPackageGraphLayout(activePackage, graph);
      dispatchWorkspace({
        type: 'apply-graph-layout',
        value: patched,
        runId: `graph-layout-${Date.now().toString(36)}`,
      });
      return 'layout';
    }
    try {
      const patchedPackage = patchPackageGraphLayout(activePackage, graph);
      const value = compileCustomSimulationPackage({
        id: `${activePackage.id}-graph-${Date.now().toString(36)}`,
        title: activePackage.title,
        locale,
        program: activePackage.program,
        input: {
          ...activePackage.input,
          value: { kind: graph.mode, text: '', graph, origin: 'user' },
          origin: 'user',
        },
        visualization: patchedPackage.visualization,
        analysis: activePackage.analysis,
      });
      setIsPlaying(false);
      dispatchWorkspace({
        type: 'apply-package',
        value,
        runId: `graph-structural-${Date.now().toString(36)}`,
      });
      return 'structural';
    } catch (error) {
      dispatchWorkspace({
        type: 'set-input-error',
        value: error instanceof Error ? error.message : 'The custom graph could not be recompiled.',
      });
      return 'failed';
    }
  }, [locale, workspace.activePackage]);
  const undoWorkspaceTransaction = useCallback(() => {
    setIsPlaying(false);
    dispatchWorkspace({ type: 'undo' });
  }, []);
  const redoWorkspaceTransaction = useCallback(() => {
    setIsPlaying(false);
    dispatchWorkspace({ type: 'redo' });
  }, []);

  const stepForward = useCallback(() => {
    setCurrentIndex((previous) => Math.min(previous + 1, Math.max(steps.length - 1, 0)));
  }, [setCurrentIndex, steps.length]);
  const stepBackward = useCallback(() => {
    setCurrentIndex((previous) => Math.max(previous - 1, 0));
  }, [setCurrentIndex]);
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const jumpTo = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) setCurrentIndex(index);
  }, [setCurrentIndex, steps.length]);
  const togglePinnedVariable = useCallback((name: string) => {
    setPinnedVariables((current) =>
      current.includes(name)
        ? current.filter((variable) => variable !== name)
        : [...current, name].slice(-20),
    );
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((previous) => {
        if (previous < steps.length - 1) {
          const next = previous + 1;
          if (guidedMode && workspace.activePackage?.checkpoints.some((checkpoint) =>
            checkpoint.autoPause && checkpoint.stepIndex === next)) {
            setIsPlaying(false);
          }
          return next;
        }
        setIsPlaying(false);
        return previous;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [guidedMode, isPlaying, setCurrentIndex, speed, steps.length, workspace.activePackage]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ simulationInput }));
    } catch {
      // Storage can be unavailable in private browsing or constrained embeds.
    }
  }, [simulationInput]);

  useEffect(() => {
    writeStorage('codexray.locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    writeStorage('codexray.theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_VARIABLES_KEY, JSON.stringify(pinnedVariables));
    } catch {
      // Pinning still works for this session when storage is unavailable.
    }
  }, [pinnedVariables]);

  useEffect(() => {
    writeStorage('codexray.ai.showWarning', showAiLoadWarning.toString());
  }, [showAiLoadWarning]);

  useEffect(() => {
    writeStorage('codexray.ai.showProgress', showAiLoadProgress.toString());
  }, [showAiLoadProgress]);

  useEffect(() => {
    writeStorage('codexray.ai.autoLoad', autoLoadAiModel.toString());
  }, [autoLoadAiModel]);

  useEffect(() => {
    writeStorage('codexray.radio.minimizeSeconds', radioMinimizeSeconds.toString());
  }, [radioMinimizeSeconds]);

  useEffect(() => {
    writeStorage('codexray.radio.playlist', radioPlaylistId);
  }, [radioPlaylistId]);

  useEffect(() => {
    writeStorage('codexray.radio.autoplay', String(radioAutoplay));
  }, [radioAutoplay]);

  useEffect(() => {
    writeStorage('codexray.ai.godMode', String(godModeEnabled));
  }, [godModeEnabled]);

  useEffect(() => {
    writeStorage('codexray.ai.guidedMode', String(guidedMode));
  }, [guidedMode]);

  useEffect(() => {
    try {
      saveExternalAiProfiles(aiProfiles);
    } catch {
      // Profiles remain usable for the current desktop session.
    }
  }, [aiProfiles]);

  useEffect(() => {
    const externalProfile = aiProvider === 'webllm'
      ? null
      : aiProfiles.find((profile) => profile.provider === aiProvider) ?? null;
    const selection: AiRuntimeSelection = aiProvider === 'webllm'
      ? {
        version: 2,
        provider: 'webllm',
        model: aiModel,
        contextWindow: parseLocalAiContextWindow(aiContextWindow),
      }
      : {
        version: 2,
        provider: aiProvider,
        profileId: externalProfile?.id ?? `${aiProvider}-default`,
      };
    writeStorage(AI_SELECTION_KEY, JSON.stringify(selection));
  }, [aiContextWindow, aiModel, aiProfiles, aiProvider]);

  useEffect(() => {
    if (aiProvider !== 'webllm') return;
    try {
      localStorage.setItem(AI_MODEL_KEY, aiModel);
    } catch {
      // Model selection still works for this session when storage is unavailable.
    }
  }, [aiModel, aiProvider]);

  useEffect(() => {
    if (aiProvider !== 'webllm') return;
    try {
      localStorage.setItem(AI_CONTEXT_WINDOW_KEY, String(aiContextWindow));
    } catch {
      // Context selection still works for this session when storage is unavailable.
    }
  }, [aiContextWindow, aiProvider]);

  return (
    <TimelineContext.Provider value={{
      code,
      setCode,
      algorithmName,
      setAlgorithmName,
      steps,
      setSteps,
      currentIndex,
      setCurrentIndex,
      isPlaying,
      speed,
      play,
      pause,
      stepForward,
      stepBackward,
      setSpeed,
      jumpTo,
      analysis,
      setAnalysis,
      simulationInput,
      setSimulationInput,
      applyGraphTransaction,
      inputError,
      setInputError,
      selectedExampleQuestion,
      setSelectedExampleQuestion,
      aiModel,
      setAiModel,
      aiProvider,
      setAiProvider,
      aiProfiles,
      setAiProfiles,
      aiBearerToken,
      setAiBearerToken,
      aiContextWindow,
      setAiContextWindow,
      aiStatus,
      setAiStatus,
      aiProgress,
      setAiProgress,
      aiProgressPercent,
      setAiProgressPercent,
      showAiLoadWarning,
      setShowAiLoadWarning,
      showAiLoadProgress,
      setShowAiLoadProgress,
      autoLoadAiModel,
      setAutoLoadAiModel,
      radioMinimizeSeconds,
      setRadioMinimizeSeconds,
      isAiMaximized,
      setIsAiMaximized,
      locale,
      setLocale,
      theme,
      setTheme,
      isEditingInput,
      setIsEditingInput,
      pinnedVariables,
      togglePinnedVariable,
      radioPlaylistId,
      setRadioPlaylistId,
      radioOpenRequest,
      requestRadioOpen,
      radioAutoplay,
      setRadioAutoplay,
      godModeEnabled,
      setGodModeEnabled,
      isGodModeTypingSource,
      setIsGodModeTypingSource,
      activeSimulationPackage: workspace.activePackage,
      packageOutOfSync: workspace.packageOutOfSync,
      applySimulationPackage,
      applyVisualPackageTransaction,
      applyInputTransaction,
      applyPresetTransaction,
      undoWorkspaceTransaction,
      redoWorkspaceTransaction,
      canUndoWorkspace: workspace.undo.length > 0,
      canRedoWorkspace: workspace.redo.length > 0,
      guidedMode,
      setGuidedMode,
    }}>
      {children}
    </TimelineContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) throw new Error('useTimeline must be used within TimelineProvider');
  return context;
};
