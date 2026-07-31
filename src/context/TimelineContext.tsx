import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { SimulationInput, SimulationStep } from '../types/simulation';
import { createInputPreset } from '../services/inputPresets';
import { LOCAL_AI_MODELS } from '../services/localAiService';
import type { Locale } from '../i18n/translations';

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
  inputError: string | null;
  setInputError: (error: string | null) => void;
  selectedExampleQuestion: string | null;
  setSelectedExampleQuestion: (question: string | null) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
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
  radioAutoplay: boolean;
  setRadioAutoplay: (autoplay: boolean) => void;
}

const STORAGE_KEY = 'codexray.workspace.v1';
const PINNED_VARIABLES_KEY = 'codexray.pinned-variables.v1';
const AI_MODEL_KEY = 'codexray.ai-model.v1';
const AI_CONTEXT_WINDOW_KEY = 'codexray.ai-context-window.v1';
const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

const loadInput = (): SimulationInput => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { simulationInput?: SimulationInput };
      if (parsed.simulationInput) return parsed.simulationInput;
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

const loadAiModel = (): string => {
  try {
    const saved = localStorage.getItem(AI_MODEL_KEY);
    if (saved && LOCAL_AI_MODELS.some((model) => model.id === saved)) return saved;
  } catch {
    // Fall back to the fast model when storage is unavailable.
  }
  return LOCAL_AI_MODELS[0].id;
};

export const TimelineProvider = ({ children }: { children: ReactNode }) => {
  const [code, setCode] = useState('');
  const [algorithmName, setAlgorithmName] = useState('Custom Code');
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [simulationInput, setSimulationInput] = useState<SimulationInput>(loadInput);
  const [inputError, setInputError] = useState<string | null>(null);
  const [selectedExampleQuestion, setSelectedExampleQuestion] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState(loadAiModel);
  const [aiContextWindow, setAiContextWindow] = useState(() =>
    localStorage.getItem(AI_CONTEXT_WINDOW_KEY) === '8192' ? 8192 : 4096,
  );
  const [aiStatus, setAiStatus] = useState<LocalAiStatus>('idle');
  const [aiProgress, setAiProgress] = useState('');
  const [aiProgressPercent, setAiProgressPercent] = useState<number | null>(null);
  const [showAiLoadWarning, setShowAiLoadWarning] = useState(() => 
    localStorage.getItem('codexray.ai.showWarning') !== 'false'
  );
  const [showAiLoadProgress, setShowAiLoadProgress] = useState(() => 
    localStorage.getItem('codexray.ai.showProgress') !== 'false'
  );
  const [autoLoadAiModel, setAutoLoadAiModel] = useState(() => 
    localStorage.getItem('codexray.ai.autoLoad') !== 'false'
  );
  const [isAiMaximized, setIsAiMaximized] = useState(false);
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem('codexray.locale') === 'tr' ? 'tr' : 'en',
  );
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('codexray.theme') as Theme) || 'neon',
  );
  const [isEditingInput, setIsEditingInput] = useState(false);
  const [pinnedVariables, setPinnedVariables] = useState<string[]>(loadPinnedVariables);
  const [radioPlaylistId, setRadioPlaylistId] = useState(() => 
    localStorage.getItem('codexray.radio.playlist') || 'https://www.youtube.com/playlist?list=PLRBp0Fe2Gpglq-J-Hv0p-y0wk3lQk570u'
  );
  const [radioAutoplay, setRadioAutoplay] = useState(() => 
    localStorage.getItem('codexray.radio.autoplay') !== 'false'
  );

  const stepForward = useCallback(() => {
    setCurrentIndex((previous) => Math.min(previous + 1, Math.max(steps.length - 1, 0)));
  }, [steps.length]);
  const stepBackward = useCallback(() => {
    setCurrentIndex((previous) => Math.max(previous - 1, 0));
  }, []);
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const jumpTo = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) setCurrentIndex(index);
  }, [steps.length]);
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
        if (previous < steps.length - 1) return previous + 1;
        setIsPlaying(false);
        return previous;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed, steps.length]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ simulationInput }));
    } catch {
      // Storage can be unavailable in private browsing or constrained embeds.
    }
  }, [simulationInput]);

  useEffect(() => {
    localStorage.setItem('codexray.locale', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    localStorage.setItem('codexray.theme', theme);
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
    localStorage.setItem('codexray.ai.showWarning', showAiLoadWarning.toString());
  }, [showAiLoadWarning]);

  useEffect(() => {
    localStorage.setItem('codexray.ai.showProgress', showAiLoadProgress.toString());
  }, [showAiLoadProgress]);

  useEffect(() => {
    localStorage.setItem('codexray.ai.autoLoad', autoLoadAiModel.toString());
  }, [autoLoadAiModel]);

  useEffect(() => {
    localStorage.setItem('codexray.radio.playlist', radioPlaylistId);
  }, [radioPlaylistId]);

  useEffect(() => {
    localStorage.setItem('codexray.radio.autoplay', String(radioAutoplay));
  }, [radioAutoplay]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_MODEL_KEY, aiModel);
    } catch {
      // Model selection still works for this session when storage is unavailable.
    }
  }, [aiModel]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_CONTEXT_WINDOW_KEY, String(aiContextWindow));
    } catch {
      // Context selection still works for this session when storage is unavailable.
    }
  }, [aiContextWindow]);

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
      inputError,
      setInputError,
      selectedExampleQuestion,
      setSelectedExampleQuestion,
      aiModel,
      setAiModel,
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
      radioAutoplay,
      setRadioAutoplay,
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
