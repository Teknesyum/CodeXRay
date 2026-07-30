import React from 'react';
import { TimelineProvider, useTimeline } from './context/TimelineContext';
import { CodeEditor } from './components/CodeEditor';
import { DynamicVisualizer } from './components/DynamicVisualizer';
import { ControlBar } from './components/ControlBar';
import { AiAssistant } from './components/AiAssistant';
import { VariablesPanel } from './components/VariablesPanel';
import { generateSimulationSteps, generateAnalysis } from './services/aiService';
import './App.css';

const CodeRayApp: React.FC = () => {
  const { code, setSteps, jumpTo, pause, setAnalysis, apiKey, inputVars } = useTimeline();

  const handleSimulate = async () => {
    if (!code.trim()) return;
    
    try {
      const steps = await generateSimulationSteps(code, apiKey, inputVars);
      setSteps(steps);
      jumpTo(0);
      pause();
      setAnalysis(null);
    } catch (error) {
      console.error("Simulation generation failed", error);
    }
  };

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    try {
      const analysisData = await generateAnalysis(code, apiKey);
      setAnalysis(analysisData);
    } catch (error) {
      console.error("Analysis generation failed", error);
    }
  };

  return (
    <div className="app-container">
      <div className="split-layout">
        <div className="panel-left">
          <div className="left-top">
            <CodeEditor />
          </div>
          <div className="left-bottom">
            <VariablesPanel />
          </div>
        </div>
        <div className="panel-right">
          <div className="visualizer-container">
            <DynamicVisualizer />
          </div>
          <div className="assistant-container">
            <AiAssistant />
          </div>
          <div className="control-container">
            <ControlBar onSimulate={handleSimulate} onAnalyze={handleAnalyze} />
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <TimelineProvider>
      <CodeRayApp />
    </TimelineProvider>
  );
}

export default App;
