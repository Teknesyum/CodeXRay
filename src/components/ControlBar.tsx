import { useState } from 'react';
import { FastForward, Pause, Play, Settings, StepBack, StepForward } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { generateQuestions } from '../services/aiService';
import {
  initializeLocalAi,
  LOCAL_AI_MODELS,
  resetLocalAi,
  supportsLocalAi,
} from '../services/localAiService';
import { t } from '../i18n/translations';
import './ControlBar.css';

interface ControlBarProps {
  onSimulate: () => void;
  onAnalyze: () => void;
}

export const ControlBar = ({ onSimulate, onAnalyze }: ControlBarProps) => {
  const {
    algorithmName,
    code,
    isPlaying,
    play,
    pause,
    stepForward,
    stepBackward,
    speed,
    setSpeed,
    steps,
    setSelectedExampleQuestion,
    aiModel,
    setAiModel,
    aiStatus,
    setAiStatus,
    aiProgress,
    setAiProgress,
  } = useTimeline();
  const [showSettings, setShowSettings] = useState(false);
  const [showQuestionsMenu, setShowQuestionsMenu] = useState(false);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);

  const loadModel = async () => {
    if (!supportsLocalAi()) {
      setAiStatus('unsupported');
      setAiProgress('WebGPU is unavailable. Simulations still work without AI.');
      return;
    }
    setAiStatus('loading');
    try {
      await initializeLocalAi(aiModel, setAiProgress);
      setAiStatus('ready');
      setAiProgress('Local model ready. No code or prompts leave this browser.');
    } catch (error) {
      setAiStatus('error');
      setAiProgress(error instanceof Error ? error.message : 'Local model failed to load.');
    }
  };

  const openExamples = () => {
    if (!code) return;
    setExampleQuestions(generateQuestions(algorithmName, code));
    setShowQuestionsMenu(true);
  };

  return (
    <div className="control-bar">
      <div className="control-group">
        <button className="neon-button simulate-btn" onClick={onSimulate}>
          ⚡ {t('simulate')}
        </button>
        <button className="neon-button analyze-btn" onClick={onAnalyze}>
          🔍 {t('analyze')}
        </button>
        <div className="qs-menu-container">
          <button className="neon-button qs-btn" onClick={openExamples} disabled={!code}>
            💡 {t('examples')}
          </button>
          {showQuestionsMenu && exampleQuestions.length > 0 && (
            <div className="qs-dropdown">
              <div className="qs-dropdown-header">
                <span>{t('exampleQuestions')}</span>
                <button className="close-btn" onClick={() => setShowQuestionsMenu(false)}>×</button>
              </div>
              <div className="qs-list">
                {exampleQuestions.map((question, index) => (
                  <button
                    key={question}
                    className="qs-list-item"
                    title={question}
                    onClick={() => {
                      setSelectedExampleQuestion(question);
                      setShowQuestionsMenu(false);
                    }}
                  >
                    {t('example')} {index + 1}: {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="control-group playback-controls">
        <button aria-label="Previous step" className="icon-btn primary-step" onClick={stepBackward} disabled={steps.length === 0}>
          <StepBack size={28} />
        </button>
        {isPlaying ? (
          <button aria-label="Pause" className="icon-btn tiny-play" onClick={pause} disabled={steps.length === 0}>
            <Pause size={16} />
          </button>
        ) : (
          <button aria-label="Play" className="icon-btn tiny-play" onClick={play} disabled={steps.length === 0}>
            <Play size={16} />
          </button>
        )}
        <button aria-label="Next step" className="icon-btn primary-step" onClick={stepForward} disabled={steps.length === 0}>
          <StepForward size={28} />
        </button>
      </div>

      <div className="control-group right-controls">
        <div className="speed-control">
          <FastForward size={16} className="speed-icon" />
          <input
            aria-label="Playback speed"
            type="range"
            min="1"
            max="10"
            value={Math.round((2000 - speed) / 180)}
            onChange={(event) => setSpeed(2000 - Number(event.target.value) * 180)}
            className="neon-slider"
          />
        </div>
        <div className="settings-container">
          <button aria-label="Settings" className="icon-btn settings-btn" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} />
          </button>
          {showSettings && (
            <div className="settings-modal glass-panel" role="dialog" aria-label="Settings">
              <div className="settings-modal-header">
                <h2>Local AI Settings</h2>
                <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
              </div>
              <div className="settings-modal-content">
                <div className="settings-section">
                  <div className="settings-title">On-device model</div>
                  <select
                    className="api-provider-select"
                    value={aiModel}
                    disabled={aiStatus === 'loading'}
                    onChange={(event) => {
                      resetLocalAi();
                      setAiModel(event.target.value);
                      setAiStatus('idle');
                      setAiProgress('');
                    }}
                  >
                    {LOCAL_AI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>{model.label}</option>
                    ))}
                  </select>
                </div>
                <p className="local-ai-note">
                  The model downloads once and runs in your browser with WebGPU. Code and questions are never sent to an API.
                </p>
                <button
                  className="neon-button"
                  onClick={loadModel}
                  disabled={aiStatus === 'loading' || aiStatus === 'ready'}
                >
                  {aiStatus === 'loading' ? 'Loading…' : aiStatus === 'ready' ? 'Model ready' : 'Load local model'}
                </button>
                {aiProgress && <p className={`ai-status ${aiStatus}`}>{aiProgress}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
