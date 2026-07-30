import React, { useState } from 'react';
import { Play, Pause, StepBack, StepForward, FastForward, Settings } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { generateQuestions } from '../services/aiService';
import { t } from '../i18n/translations';
import './ControlBar.css';

interface ControlBarProps {
  onSimulate: () => void;
  onAnalyze: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({ onSimulate, onAnalyze }) => {
  const { 
    code,
    isPlaying, play, pause, 
    stepForward, stepBackward, 
    speed, setSpeed,
    steps,
    language, setLanguage,
    apiKey, setApiKey,
    setSelectedExampleQuestion
  } = useTimeline();

  const [showSettings, setShowSettings] = useState(false);
  const [showQuestionsMenu, setShowQuestionsMenu] = useState(false);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
  const [isGeneratingQs, setIsGeneratingQs] = useState(false);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    const newSpeed = 2000 - (val * 180);
    setSpeed(newSpeed);
  };

  const getSpeedSliderValue = () => {
    return Math.round((2000 - speed) / 180);
  };

  const handleGenerateExamples = async () => {
    if (!code) return;
    setIsGeneratingQs(true);
    setShowQuestionsMenu(true);
    const qs = await generateQuestions(code, language, apiKey);
    setExampleQuestions(qs);
    setIsGeneratingQs(false);
  };

  return (
    <div className="control-bar">
      
      <div className="control-group">
        <button className="neon-button simulate-btn" onClick={onSimulate}>
          ⚡ {t('simulate', language)}
        </button>
        <button className="neon-button analyze-btn" onClick={onAnalyze}>
          🔍 {t('analyze', language)}
        </button>
        
        <div className="qs-menu-container">
          <button 
            className="neon-button qs-btn" 
            onClick={handleGenerateExamples}
            disabled={isGeneratingQs || !code}
          >
            {isGeneratingQs ? `⏳ ${t('generating', language)}` : `💡 ${t('examples', language)}`}
          </button>
          
          {showQuestionsMenu && exampleQuestions.length > 0 && (
            <div className="qs-dropdown">
              <div className="qs-dropdown-header">
                <span>{t('exampleQuestions', language)}</span>
                <button className="close-btn" onClick={() => setShowQuestionsMenu(false)}>✕</button>
              </div>
              <div className="qs-list">
                {exampleQuestions.map((q, idx) => (
                  <button 
                    key={idx} 
                    className="qs-list-item"
                    onClick={() => {
                      setSelectedExampleQuestion(q);
                      setShowQuestionsMenu(false);
                    }}
                  >
                    {t('example', language)} {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="control-group playback-controls">
        <button className="icon-btn primary-step" onClick={stepBackward} disabled={steps.length === 0}>
          <StepBack size={28} />
        </button>
        
        {isPlaying ? (
          <button className="icon-btn tiny-play" onClick={pause} disabled={steps.length === 0}>
            <Pause size={16} />
          </button>
        ) : (
          <button className="icon-btn tiny-play" onClick={play} disabled={steps.length === 0}>
            <Play size={16} />
          </button>
        )}
        
        <button className="icon-btn primary-step" onClick={stepForward} disabled={steps.length === 0}>
          <StepForward size={28} />
        </button>
      </div>

      <div className="control-group right-controls">
        <div className="speed-control">
          <FastForward size={16} className="speed-icon" />
          <input 
            type="range" 
            min="1" 
            max="10" 
            value={getSpeedSliderValue()} 
            onChange={handleSpeedChange}
            className="neon-slider"
          />
        </div>

        <div className="settings-container">
          <button className="icon-btn settings-btn" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} />
          </button>
          
          {showSettings && (
            <div className="settings-modal glass-panel">
              <div className="settings-modal-header">
                <h2>Ayarlar / Settings</h2>
                <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
              </div>
              <div className="settings-modal-content">
                <div className="settings-section">
                  <div className="settings-title">Language / Dil</div>
                  <div className="lang-toggles">
                    <button 
                      className={`lang-btn ${language === 'tr' ? 'active' : ''}`}
                      onClick={() => { setLanguage('tr'); }}
                    >TR</button>
                    <button 
                      className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                      onClick={() => { setLanguage('en'); }}
                    >EN</button>
                  </div>
                </div>

                <div className="settings-section">
                  <div className="settings-title">AI Provider (Yapay Zeka)</div>
                  <select className="api-provider-select">
                    <option value="gemini">Google Gemini (Recommended/Free Tier)</option>
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="groq">Groq (Llama 3 - Ultra Fast)</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </select>
                </div>

                <div className="settings-section">
                  <div className="settings-title">API Key</div>
                  <input 
                    type="password" 
                    className="api-key-input"
                    placeholder="Paste Key (Optional for offline demo)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
