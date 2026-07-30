import { useEffect, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { TimelineProvider, useTimeline } from './context/TimelineContext';
import { CodeEditor } from './components/CodeEditor';
import { DynamicVisualizer } from './components/DynamicVisualizer';
import { ControlBar } from './components/ControlBar';
import { AiAssistant } from './components/AiAssistant';
import { VariablesPanel } from './components/VariablesPanel';
import { generateAnalysis, generateSimulationSteps } from './services/aiService';
import { parseSimulationInput } from './services/inputParsers';
import './App.css';

type PanelName = 'code' | 'variables' | 'visualizer' | 'assistant' | 'controls';

interface LayoutState {
  leftWidth: number;
  leftTopHeight: number;
  visualizerHeight: number;
  assistantHeight: number;
  collapsed: Record<PanelName, boolean>;
}

const LAYOUT_STORAGE_KEY = 'codexray.layout.v1';
const defaultLayout: LayoutState = {
  leftWidth: 440,
  leftTopHeight: 500,
  visualizerHeight: 420,
  assistantHeight: 250,
  collapsed: {
    code: false,
    variables: false,
    visualizer: false,
    assistant: false,
    controls: false,
  },
};

const loadLayout = (): LayoutState => {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}') as Partial<LayoutState>;
    return {
      ...defaultLayout,
      ...saved,
      collapsed: { ...defaultLayout.collapsed, ...saved.collapsed },
    };
  } catch {
    return defaultLayout;
  }
};

const CodeRayApp = () => {
  const {
    algorithmName,
    code,
    setSteps,
    setCurrentIndex,
    pause,
    setAnalysis,
    simulationInput,
    setInputError,
    locale,
    setLocale,
    setIsEditingInput,
  } = useTimeline();
  const [layout, setLayout] = useState<LayoutState>(loadLayout);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // The workspace still works when storage is unavailable or full.
    }
  }, [layout]);

  const handleSimulate = () => {
    if (!code.trim()) {
      setInputError('Select an algorithm or enter source code first.');
      return;
    }
    const validation = parseSimulationInput(
      simulationInput.kind,
      simulationInput.text,
      simulationInput.graph,
    );
    if (!validation.input) {
      setInputError(validation.error ?? 'Invalid simulation input.');
      return;
    }
    try {
      const generatedSteps = generateSimulationSteps(algorithmName, code, validation.input);
      setSteps(generatedSteps);
      setCurrentIndex(0);
      pause();
      setAnalysis(null);
      setInputError(null);
      setIsEditingInput(false);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Simulation failed.');
    }
  };

  const handleAnalyze = () => {
    if (!code.trim()) return;
    setAnalysis(generateAnalysis(algorithmName, code));
  };

  const togglePanel = (panel: PanelName) => {
    setLayout((current) => ({
      ...current,
      collapsed: {
        ...current.collapsed,
        [panel]: !current.collapsed[panel],
      },
    }));
  };

  const beginResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    axis: 'x' | 'y',
    initialValue: number,
    update: (value: number) => void,
    minimum: number,
    maximum: number,
  ) => {
    if (window.innerWidth <= 900) return;
    event.preventDefault();
    const startPosition = axis === 'x' ? event.clientX : event.clientY;
    document.body.classList.add('panel-resizing');
    const handleMove = (moveEvent: PointerEvent) => {
      const position = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      update(Math.min(maximum, Math.max(minimum, initialValue + position - startPosition)));
    };
    const handleEnd = () => {
      document.body.classList.remove('panel-resizing');
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd, { once: true });
    window.addEventListener('pointercancel', handleEnd, { once: true });
  };

  const setSize = (key: keyof Pick<LayoutState, 'leftWidth' | 'leftTopHeight' | 'visualizerHeight' | 'assistantHeight'>) =>
    (value: number) => setLayout((current) => ({ ...current, [key]: value }));

  const resizeWithKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    axis: 'x' | 'y',
    currentValue: number,
    update: (value: number) => void,
    minimum: number,
    maximum: number,
  ) => {
    const decreaseKey = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const increaseKey = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    if (event.key !== decreaseKey && event.key !== increaseKey) return;
    event.preventDefault();
    const delta = event.key === decreaseKey ? -20 : 20;
    update(Math.min(maximum, Math.max(minimum, currentValue + delta)));
  };

  const codeCollapsed = layout.collapsed.code;
  const variablesCollapsed = layout.collapsed.variables;
  const visualizerCollapsed = layout.collapsed.visualizer;
  const assistantCollapsed = layout.collapsed.assistant;
  const controlsCollapsed = layout.collapsed.controls;

  return (
    <div className="app-container">
      <button
        className="language-toggle"
        type="button"
        onClick={() => setLocale(locale === 'en' ? 'tr' : 'en')}
        aria-label={locale === 'en' ? 'Türkçeye geç' : 'Switch to English'}
      >
        {locale === 'en' ? 'TR' : 'EN'}
      </button>
      <div className="split-layout">
        <div className="panel-left" style={{ width: layout.leftWidth }}>
          <section
            className={`left-top panel-region ${codeCollapsed ? 'collapsed' : ''}`}
            style={codeCollapsed ? { height: 44 } : variablesCollapsed ? { flex: 1 } : { height: layout.leftTopHeight }}
          >
            <CodeEditor collapsed={codeCollapsed} onToggleCollapse={() => togglePanel('code')} />
          </section>
          {!codeCollapsed && !variablesCollapsed && (
            <div
              className="panel-splitter horizontal"
              role="separator"
              tabIndex={0}
              aria-valuemin={180}
              aria-valuemax={Math.max(180, window.innerHeight - 180)}
              aria-valuenow={Math.round(layout.leftTopHeight)}
              aria-label={locale === 'tr' ? 'Kod ve değişken panellerini yeniden boyutlandır' : 'Resize code and variables panels'}
              onKeyDown={(event) => resizeWithKeyboard(
                event,
                'y',
                layout.leftTopHeight,
                setSize('leftTopHeight'),
                180,
                window.innerHeight - 180,
              )}
              onPointerDown={(event) => beginResize(
                event,
                'y',
                layout.leftTopHeight,
                setSize('leftTopHeight'),
                180,
                window.innerHeight - 180,
              )}
            />
          )}
          <section
            className={`left-bottom panel-region ${variablesCollapsed ? 'collapsed' : ''}`}
            style={variablesCollapsed ? { height: 44 } : { flex: 1 }}
          >
            <VariablesPanel collapsed={variablesCollapsed} onToggleCollapse={() => togglePanel('variables')} />
          </section>
        </div>

        <div
          className="panel-splitter vertical"
          role="separator"
          tabIndex={0}
          aria-valuemin={280}
          aria-valuemax={Math.max(280, window.innerWidth - 420)}
          aria-valuenow={Math.round(layout.leftWidth)}
          aria-label={locale === 'tr' ? 'Sol ve sağ panelleri yeniden boyutlandır' : 'Resize left and right panels'}
          onKeyDown={(event) => resizeWithKeyboard(
            event,
            'x',
            layout.leftWidth,
            setSize('leftWidth'),
            280,
            window.innerWidth - 420,
          )}
          onPointerDown={(event) => beginResize(
            event,
            'x',
            layout.leftWidth,
            setSize('leftWidth'),
            280,
            window.innerWidth - 420,
          )}
        />

        <div className="panel-right">
          <section
            className={`visualizer-container panel-region ${visualizerCollapsed ? 'collapsed' : ''}`}
            style={visualizerCollapsed ? { height: 44 } : assistantCollapsed && controlsCollapsed ? { flex: 1 } : { height: layout.visualizerHeight }}
          >
            <DynamicVisualizer collapsed={visualizerCollapsed} onToggleCollapse={() => togglePanel('visualizer')} />
          </section>
          {!visualizerCollapsed && !assistantCollapsed && (
            <div
              className="panel-splitter horizontal"
              role="separator"
              tabIndex={0}
              aria-valuemin={200}
              aria-valuemax={Math.max(200, window.innerHeight - 220)}
              aria-valuenow={Math.round(layout.visualizerHeight)}
              aria-label={locale === 'tr' ? 'Görselleştirici ve asistan panellerini yeniden boyutlandır' : 'Resize visualizer and assistant panels'}
              onKeyDown={(event) => resizeWithKeyboard(
                event,
                'y',
                layout.visualizerHeight,
                setSize('visualizerHeight'),
                200,
                window.innerHeight - 220,
              )}
              onPointerDown={(event) => beginResize(
                event,
                'y',
                layout.visualizerHeight,
                setSize('visualizerHeight'),
                200,
                window.innerHeight - 220,
              )}
            />
          )}
          <section
            className={`assistant-container panel-region ${assistantCollapsed ? 'collapsed' : ''}`}
            style={assistantCollapsed ? { height: 44 } : controlsCollapsed ? { flex: 1 } : { height: layout.assistantHeight }}
          >
            <AiAssistant collapsed={assistantCollapsed} onToggleCollapse={() => togglePanel('assistant')} />
          </section>
          {!assistantCollapsed && !controlsCollapsed && (
            <div
              className="panel-splitter horizontal"
              role="separator"
              tabIndex={0}
              aria-valuemin={140}
              aria-valuemax={Math.max(140, window.innerHeight - 180)}
              aria-valuenow={Math.round(layout.assistantHeight)}
              aria-label={locale === 'tr' ? 'Asistan ve kontrol panellerini yeniden boyutlandır' : 'Resize assistant and controls panels'}
              onKeyDown={(event) => resizeWithKeyboard(
                event,
                'y',
                layout.assistantHeight,
                setSize('assistantHeight'),
                140,
                window.innerHeight - 180,
              )}
              onPointerDown={(event) => beginResize(
                event,
                'y',
                layout.assistantHeight,
                setSize('assistantHeight'),
                140,
                window.innerHeight - 180,
              )}
            />
          )}
          <section className={`control-container panel-region ${controlsCollapsed ? 'collapsed' : ''}`}>
            <ControlBar
              collapsed={controlsCollapsed}
              onToggleCollapse={() => togglePanel('controls')}
              onSimulate={handleSimulate}
              onAnalyze={handleAnalyze}
            />
          </section>
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <TimelineProvider>
    <CodeRayApp />
  </TimelineProvider>
);

export default App;
