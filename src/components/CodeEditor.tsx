import React from 'react';
import { useTimeline } from '../context/TimelineContext';
import { algorithmRegistry } from '../services/codeRegistry';
import { generateSimulationSteps } from '../services/aiService';
import { t } from '../i18n/translations';
import './CodeEditor.css';

export const CodeEditor: React.FC = () => {
  const { code, setCode, steps, setSteps, currentIndex, setCurrentIndex, setAnalysis, inputVars, setInputVars, language, apiKey, pause } = useTimeline();
  const currentStep = steps[currentIndex];

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    setSteps([]);
    setCurrentIndex(0);
    setAnalysis(null);
  };

  const handlePresetClick = async (preset: string) => {
    setInputVars(preset);
    if (!code.trim()) return;
    try {
      const newSteps = await generateSimulationSteps(code, language, apiKey, preset);
      setSteps(newSteps);
      setCurrentIndex(0);
      pause();
      setAnalysis(null);
    } catch (error) {
      console.error("Simulation generation failed", error);
    }
  };

  return (
    <div className="code-editor">
      <div className="editor-header">
        <h2>{t('sourceCode', language)}</h2>
        <select 
          className="registry-select"
          onChange={(e) => handleCodeChange(e.target.value)}
          defaultValue=""
        >
          <option value="" disabled>{t('presets', language)}</option>
          {algorithmRegistry.map((algo, idx) => {
            const label = language === 'en' ? algo.name_en : algo.name_tr;
            const icon = algo.isSupported ? '✅' : '🚧';
            return (
              <option key={algo.name_en} value={algo.code}>
                {idx + 1}- {icon} {label}
              </option>
            );
          })}
        </select>
      </div>
      
      <div className="input-config">
        <label>{t('simulationInput', language)}</label>
        {algorithmRegistry.find(a => a.code === code)?.isSupported && (
          <div className="preset-buttons">
            <button 
              className={`preset-btn ${inputVars === 'preset:i1' ? 'active' : ''}`}
              onClick={() => handlePresetClick('preset:i1')}
            >i1</button>
            <button 
              className={`preset-btn ${inputVars === 'preset:i2' ? 'active' : ''}`}
              onClick={() => handlePresetClick('preset:i2')}
            >i2</button>
            <button 
              className={`preset-btn ${inputVars === 'preset:i3' ? 'active' : ''}`}
              onClick={() => handlePresetClick('preset:i3')}
            >i3</button>
          </div>
        )}
        <input 
          type="text" 
          placeholder='Özel input: s = "AABA"' 
          value={inputVars.startsWith('preset:') ? '' : inputVars}
          onChange={(e) => setInputVars(e.target.value)}
        />
      </div>

      <div className="editor-content">
        {steps.length === 0 ? (
          <textarea
            className="code-textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('placeholderCode', language)}
            spellCheck="false"
          />
        ) : (
          <div className="code-display">
            {code.split('\n').map((line, index) => {
              const isHighlighted = currentStep?.lineNumber === index + 1;
              return (
                <div 
                  key={index} 
                  className={`code-line ${isHighlighted ? 'highlighted' : ''}`}
                >
                  <span className="line-number">{index + 1}</span>
                  <pre>{line}</pre>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
