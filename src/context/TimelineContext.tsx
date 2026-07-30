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

export type LocalAiStatus = 'idle' | 'loading' | 'ready' | 'unsupported' | 'error';

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
  aiStatus: LocalAiStatus;
  setAiStatus: (status: LocalAiStatus) => void;
  aiProgress: string;
  setAiProgress: (progress: string) => void;
}

const STORAGE_KEY = 'codexray.workspace.v1';
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
  const [aiModel, setAiModel] = useState('Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC');
  const [aiStatus, setAiStatus] = useState<LocalAiStatus>('idle');
  const [aiProgress, setAiProgress] = useState('');

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
      aiStatus,
      setAiStatus,
      aiProgress,
      setAiProgress,
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
