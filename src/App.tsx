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
import { PlaylistRadio } from './components/PlaylistRadio';
import { generateAnalysis, generateSimulationSteps } from './services/aiService';
import { parseSimulationInput } from './services/inputParsers';
import {
  constrainRightPanelSizes,
  createDefaultRightPanelSizes,
  RIGHT_PANEL_LIMITS,
} from './services/workspaceLayout';
import {
  GOD_MODE_UI_EVENT,
  isGodModeUiEvent,
} from './services/godModeUiControl';
import './App.css';

type PanelName = 'code' | 'variables' | 'visualizer' | 'assistant' | 'controls';

interface LayoutState {
  version: 6;
  leftWidth: number;
  leftTopHeight: number;
  visualizerHeight: number;
  assistantHeight: number;
  controlHeight: number;
  collapsed: Record<PanelName, boolean>;
}

const LAYOUT_STORAGE_KEY = 'codexray.layout.v2';
const createDefaultLayout = (): LayoutState => {
  const right = createDefaultRightPanelSizes(window.innerHeight);
  return {
    version: 6,
    leftWidth: 440,
    leftTopHeight: Math.max(320, Math.round(window.innerHeight * 0.56)),
    visualizerHeight: right.visualizerHeight,
    assistantHeight: right.assistantHeight,
    controlHeight: right.controlHeight,
    collapsed: {
      code: false,
      variables: false,
      visualizer: false,
      assistant: false,
      controls: false,
    },
  };
};

const loadLayout = (): LayoutState => {
  const defaults = createDefaultLayout();
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}') as Partial<LayoutState>;
    const loaded: LayoutState = {
      ...defaults,
      ...saved,
      version: 6,
      collapsed: { ...defaults.collapsed, ...saved.collapsed },
    };
    if (saved.version !== 6) {
      loaded.visualizerHeight = defaults.visualizerHeight;
      loaded.assistantHeight = defaults.assistantHeight;
      loaded.controlHeight = RIGHT_PANEL_LIMITS.controls;
    }
    const normalizedRight = constrainRightPanelSizes(
      window.innerHeight,
      loaded.visualizerHeight,
      loaded.assistantHeight,
      loaded.controlHeight,
    );
    return { ...loaded, ...normalizedRight };
  } catch {
    return defaults;
  }
};

const CodeRayApp = () => {
  const {
    algorithmName,
    code,
    steps,
    setSteps,
    setCurrentIndex,
    pause,
    setAnalysis,
    simulationInput,
    setInputError,
    locale,
    isEditingInput,
    setIsEditingInput,
    isAiMaximized,
    setIsAiMaximized,
  } = useTimeline();
  const [layout, setLayout] = useState<LayoutState>(loadLayout);
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // The workspace still works when storage is unavailable or full.
    }
  }, [layout]);

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setLayout((current) => ({
      ...current,
      ...constrainRightPanelSizes(
        viewportHeight,
        current.visualizerHeight,
        current.assistantHeight,
        current.controlHeight,
      ),
    }));
  }, [viewportHeight]);

  useEffect(() => {
    const handleGodModeUiAction = (event: Event) => {
      if (!isGodModeUiEvent(event)) return;
      const action = event.detail;
      if (action.type === 'set-workspace-layout') {
        if (action.layout === 'focus-assistant') {
          setIsAiMaximized(true);
          setLayout((current) => ({
            ...current,
            collapsed: { ...current.collapsed, assistant: false },
          }));
          return;
        }
        setIsAiMaximized(false);
        setLayout((current) => {
          if (action.layout === 'focus-code') return {
            ...current,
            leftWidth: Math.min(Math.max(620, current.leftWidth), window.innerWidth - 420),
            collapsed: { ...current.collapsed, code: false, variables: true },
          };
          if (action.layout === 'focus-simulation') return {
            ...current,
            collapsed: { ...current.collapsed, visualizer: false, assistant: true },
          };
          return {
            ...createDefaultLayout(),
            collapsed: { ...createDefaultLayout().collapsed },
          };
        });
        return;
      }
      if ('panel' in action) {
        setLayout((current) => ({
          ...current,
          collapsed: {
            ...current.collapsed,
            [action.panel]: action.type === 'collapse-panel',
          },
        }));
      }
    };
    window.addEventListener(GOD_MODE_UI_EVENT, handleGodModeUiAction);
    return () => window.removeEventListener(GOD_MODE_UI_EVENT, handleGodModeUiAction);
  }, [setIsAiMaximized]);

  const handleSimulate = () => {
    if (!code.trim()) {
      setInputError('Select an algorithm or enter source code first.');
      return;
    }
    const validation = parseSimulationInput(
      simulationInput.kind,
      simulationInput.text,
      simulationInput.graph,
      simulationInput.parameters,
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

  const setSize = (key: keyof Pick<LayoutState, 'leftWidth' | 'leftTopHeight'>) =>
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

  const beginPairedResize = (
    event: ReactPointerEvent<HTMLDivElement>,
    initialUpper: number,
    initialLower: number,
    minimumUpper: number,
    minimumLower: number,
    update: (upper: number, lower: number) => void,
  ) => {
    event.preventDefault();
    const startPosition = event.clientY;
    const pairHeight = initialUpper + initialLower;
    document.body.classList.add('panel-resizing');
    const handleMove = (moveEvent: PointerEvent) => {
      const upper = Math.min(
        pairHeight - minimumLower,
        Math.max(minimumUpper, initialUpper + moveEvent.clientY - startPosition),
      );
      update(upper, pairHeight - upper);
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

  const resizePairWithKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    upper: number,
    lower: number,
    minimumUpper: number,
    minimumLower: number,
    update: (nextUpper: number, nextLower: number) => void,
  ) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const pairHeight = upper + lower;
    const nextUpper = Math.min(
      pairHeight - minimumLower,
      Math.max(minimumUpper, upper + (event.key === 'ArrowUp' ? -20 : 20)),
    );
    update(nextUpper, pairHeight - nextUpper);
  };

  const codeCollapsed = layout.collapsed.code;
  const variablesCollapsed = layout.collapsed.variables;
  const visualizerCollapsed = layout.collapsed.visualizer;
  const assistantCollapsed = layout.collapsed.assistant;
  const controlsCollapsed = layout.collapsed.controls;
  const rightSizes = constrainRightPanelSizes(
    viewportHeight,
    layout.visualizerHeight,
    layout.assistantHeight,
    layout.controlHeight,
  );
  const graphBuilderActive = (simulationInput.kind === 'graph' || simulationInput.kind === 'tree')
    && (isEditingInput || steps.length === 0);
  const rightPairHeight = rightSizes.visualizerHeight + rightSizes.assistantHeight;
  const builderVisualizerHeight = Math.min(
    Math.max(360, rightSizes.visualizerHeight),
    rightPairHeight - RIGHT_PANEL_LIMITS.assistant,
  );
  const displayedRightSizes = graphBuilderActive
    ? {
      ...rightSizes,
      visualizerHeight: builderVisualizerHeight,
      assistantHeight: rightPairHeight - builderVisualizerHeight,
    }
    : rightSizes;
  const updateVisualizerAssistant = (visualizerHeight: number, assistantHeight: number) =>
    setLayout((current) => ({ ...current, visualizerHeight, assistantHeight }));
  const updateAssistantControls = (assistantHeight: number, controlHeight: number) =>
    setLayout((current) => ({
      ...current,
      visualizerHeight: graphBuilderActive
        ? displayedRightSizes.visualizerHeight
        : current.visualizerHeight,
      assistantHeight,
      controlHeight,
    }));

  return (
    <div className="app-container">
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
            style={isAiMaximized 
              ? { display: 'none' } 
              : visualizerCollapsed
                ? { height: 44 }
                : assistantCollapsed && controlsCollapsed
                  ? { flex: 1 }
                  : { height: displayedRightSizes.visualizerHeight }}
          >
            <DynamicVisualizer collapsed={visualizerCollapsed} onToggleCollapse={() => togglePanel('visualizer')} />
          </section>
          {!visualizerCollapsed && !assistantCollapsed && !isAiMaximized && (
            <div
              className="panel-splitter horizontal"
              role="separator"
              tabIndex={0}
              aria-valuemin={RIGHT_PANEL_LIMITS.visualizer}
              aria-valuemax={Math.round(
                displayedRightSizes.visualizerHeight
                + displayedRightSizes.assistantHeight
                - RIGHT_PANEL_LIMITS.assistant,
              )}
              aria-valuenow={Math.round(displayedRightSizes.visualizerHeight)}
              aria-label={locale === 'tr' ? 'Görselleştirici ve asistan panellerini yeniden boyutlandır' : 'Resize visualizer and assistant panels'}
              onKeyDown={(event) => resizePairWithKeyboard(
                event,
                displayedRightSizes.visualizerHeight,
                displayedRightSizes.assistantHeight,
                RIGHT_PANEL_LIMITS.visualizer,
                RIGHT_PANEL_LIMITS.assistant,
                updateVisualizerAssistant,
              )}
              onPointerDown={(event) => beginPairedResize(
                event,
                displayedRightSizes.visualizerHeight,
                displayedRightSizes.assistantHeight,
                RIGHT_PANEL_LIMITS.visualizer,
                RIGHT_PANEL_LIMITS.assistant,
                updateVisualizerAssistant,
              )}
            />
          )}
          <section
            className={`assistant-container panel-region ${assistantCollapsed ? 'collapsed' : ''} ${isAiMaximized ? 'maximized' : ''}`}
            style={isAiMaximized
              ? { flex: 1 }
              : assistantCollapsed
                ? { height: 44 }
                : controlsCollapsed
                  ? { flex: 1 }
                  : { height: displayedRightSizes.assistantHeight }}
          >
            <AiAssistant collapsed={assistantCollapsed} onToggleCollapse={() => togglePanel('assistant')} />
          </section>
          {!assistantCollapsed && !controlsCollapsed && !isAiMaximized && (
            <div
              className="panel-splitter horizontal"
              role="separator"
              tabIndex={0}
              aria-valuemin={RIGHT_PANEL_LIMITS.assistant}
              aria-valuemax={Math.round(
                displayedRightSizes.assistantHeight
                + displayedRightSizes.controlHeight
                - RIGHT_PANEL_LIMITS.controls,
              )}
              aria-valuenow={Math.round(displayedRightSizes.assistantHeight)}
              aria-label={locale === 'tr' ? 'Asistan ve kontrol panellerini yeniden boyutlandır' : 'Resize assistant and controls panels'}
              onKeyDown={(event) => resizePairWithKeyboard(
                event,
                displayedRightSizes.assistantHeight,
                displayedRightSizes.controlHeight,
                RIGHT_PANEL_LIMITS.assistant,
                RIGHT_PANEL_LIMITS.controls,
                updateAssistantControls,
              )}
              onPointerDown={(event) => beginPairedResize(
                event,
                displayedRightSizes.assistantHeight,
                displayedRightSizes.controlHeight,
                RIGHT_PANEL_LIMITS.assistant,
                RIGHT_PANEL_LIMITS.controls,
                updateAssistantControls,
              )}
            />
          )}
          <section
            className={`control-container panel-region ${controlsCollapsed ? 'collapsed' : ''}`}
            style={!controlsCollapsed && (isAiMaximized
              || (!visualizerCollapsed && !assistantCollapsed))
                ? { height: displayedRightSizes.controlHeight, flex: '0 0 auto' }
                : undefined}
          >
            <ControlBar
              collapsed={controlsCollapsed}
              onToggleCollapse={() => togglePanel('controls')}
              onSimulate={handleSimulate}
              onAnalyze={handleAnalyze}
            />
          </section>
        </div>
      </div>
      <PlaylistRadio />
    </div>
  );
};

const App = () => (
  <TimelineProvider>
    <CodeRayApp />
  </TimelineProvider>
);

export default App;
