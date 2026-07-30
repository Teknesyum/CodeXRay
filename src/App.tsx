import { TimelineProvider, useTimeline } from './context/TimelineContext';
import { CodeEditor } from './components/CodeEditor';
import { DynamicVisualizer } from './components/DynamicVisualizer';
import { ControlBar } from './components/ControlBar';
import { AiAssistant } from './components/AiAssistant';
import { VariablesPanel } from './components/VariablesPanel';
import { generateAnalysis, generateSimulationSteps } from './services/aiService';
import { parseSimulationInput } from './services/inputParsers';
import './App.css';

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
  } = useTimeline();

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
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Simulation failed.');
    }
  };

  const handleAnalyze = () => {
    if (!code.trim()) return;
    setAnalysis(generateAnalysis(algorithmName, code));
  };

  return (
    <div className="app-container">
      <div className="split-layout">
        <div className="panel-left">
          <div className="left-top"><CodeEditor /></div>
          <div className="left-bottom"><VariablesPanel /></div>
        </div>
        <div className="panel-right">
          <div className="visualizer-container"><DynamicVisualizer /></div>
          <div className="assistant-container"><AiAssistant /></div>
          <div className="control-container">
            <ControlBar onSimulate={handleSimulate} onAnalyze={handleAnalyze} />
          </div>
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
