import React from 'react';
import { useTimeline } from '../context/TimelineContext';
import { t } from '../i18n/translations';
import './VariablesPanel.css';

export const VariablesPanel: React.FC = () => {
  const { steps, currentIndex, language } = useTimeline();
  const currentStep = steps[currentIndex];

  const vars = currentStep?.visualData?.vars || {};
  const prevVars = currentIndex > 0 ? steps[currentIndex - 1]?.visualData?.vars || {} : {};
  const varKeys = Object.keys(vars);

  return (
    <div className="variables-panel glass-panel">
      <div className="variables-header">
        <h2>{t('variablesTrace', language)}</h2>
      </div>
      <div className="variables-content">
        {varKeys.length === 0 ? (
          <div className="no-vars">No variables tracked yet...</div>
        ) : (
          <div className="vars-grid">
            {varKeys.map((key) => {
              const isChanged = vars[key] !== prevVars[key];
              return (
                <div key={key} className="var-item">
                  <span className="var-name">{key}</span>
                  <span className={`var-value ${isChanged ? 'changed' : 'unchanged'}`}>
                    {vars[key]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
