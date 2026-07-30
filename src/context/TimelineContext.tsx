import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface SimulationStep {
  lineNumber: number | null;
  visualData: any; // Dynamic data (nodes, arrays, strings)
  explanation: string;
}

interface TimelineContextType {
  code: string;
  setCode: (code: string) => void;
  steps: SimulationStep[];
  setSteps: (steps: SimulationStep[]) => void;
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  speed: number; // delay in ms
  play: () => void;
  pause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  setSpeed: (speed: number) => void;
  jumpTo: (index: number) => void;
  language: string;
  setLanguage: (lang: string) => void;
  analysis: string | null;
  setAnalysis: (analysis: string | null) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  inputVars: string;
  setInputVars: (vars: string) => void;
  selectedExampleQuestion: string | null;
  setSelectedExampleQuestion: (q: string | null) => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export const TimelineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [code, setCode] = useState<string>('');
  const [steps, setSteps] = useState<SimulationStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1000); // ms per step
  const [language, setLanguage] = useState<string>('tr');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [inputVars, setInputVars] = useState<string>('');
  const [selectedExampleQuestion, setSelectedExampleQuestion] = useState<string | null>(null);

  const stepForward = useCallback(() => {
    setCurrentIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
  }, [steps.length]);

  const stepBackward = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const jumpTo = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) setCurrentIndex(index);
  }, [steps.length]);

  useEffect(() => {
    let timer: number | null = null;
    if (isPlaying) {
      timer = window.setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev < steps.length - 1) return prev + 1;
          setIsPlaying(false);
          return prev;
        });
      }, speed);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isPlaying, speed, steps.length]);

  return (
    <TimelineContext.Provider value={{
        code, setCode,
        steps, setSteps,
        currentIndex, setCurrentIndex,
        isPlaying, play, pause,
        stepForward, stepBackward, jumpTo,
        speed, setSpeed,
        language, setLanguage,
        analysis, setAnalysis,
        apiKey, setApiKey,
        inputVars, setInputVars,
        selectedExampleQuestion, setSelectedExampleQuestion
      }}>
      {children}
    </TimelineContext.Provider>
  );
};

export const useTimeline = () => {
  const context = useContext(TimelineContext);
  if (!context) throw new Error('useTimeline must be used within TimelineProvider');
  return context;
};
