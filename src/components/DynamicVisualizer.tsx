import React from 'react';
import { useTimeline } from '../context/TimelineContext';
import { t } from '../i18n/translations';
import './DynamicVisualizer.css';

export const DynamicVisualizer: React.FC = () => {
  const { steps, currentIndex } = useTimeline();
  const currentStep = steps[currentIndex];
  
  if (!currentStep || !currentStep.visualData) {
    return (
      <div className="visualizer-empty">
        <div className="scanning-line"></div>
        <p>{t('awaitingData')}</p>
      </div>
    );
  }

  const { visualData } = currentStep;

  const renderVisualData = () => {
    switch (visualData.type) {
      case 'array':
        return (
          <div className="visual-array">
            {visualData.values.map((val: any, idx: number) => {
              const pointersObj = visualData.pointers || {};
              // Check if pointersObj is still an array (for backward compatibility if old mock is stuck)
              const isArray = Array.isArray(pointersObj);
              
              let matchingPointers: string[] = [];
              if (isArray) {
                if (pointersObj.includes(idx)) matchingPointers.push("P");
              } else {
                matchingPointers = Object.keys(pointersObj).filter(k => pointersObj[k] === idx);
              }
              
              const isPointer = matchingPointers.length > 0;
              const pointerColors = ['var(--neon-lime)', 'var(--neon-magenta)', 'var(--neon-cyan)', '#ff9900'];
              const color = isPointer ? pointerColors[Object.keys(pointersObj).indexOf(matchingPointers[0]) % pointerColors.length || 0] : undefined;
              
              return (
                <div key={idx} className="array-cell-wrapper">
                  <div className="pointers-container">
                    {matchingPointers.map((p) => {
                       const pColor = pointerColors[Object.keys(pointersObj).indexOf(p) % pointerColors.length || 0];
                       return (
                         <span key={p} className="pointer-label" style={{ color: pColor, borderColor: pColor }}>
                           {p}
                         </span>
                       );
                    })}
                  </div>
                  <div 
                    className={`array-cell ${isPointer ? 'active-pointer' : ''}`}
                    style={isPointer ? { borderColor: color, boxShadow: `0 0 15px ${color}, inset 0 0 10px ${color}` } : {}}
                  >
                    <div className="cell-index">{idx}</div>
                    <div className="cell-value">{val}</div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      case 'graph':
        return (
          <div className="visual-graph">
            <svg className="graph-edges" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {visualData.edges?.map((edge: any, idx: number) => {
                const fromNode = visualData.nodes.find((n: any) => n.id === edge.from);
                const toNode = visualData.nodes.find((n: any) => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                
                // An edge is active if both nodes it connects are active, or if explicitly marked
                const isActive = edge.active || (fromNode.active && toNode.active);
                
                return (
                  <line 
                    key={`edge-${idx}`}
                    x1={`${fromNode.x}%`} y1={`${fromNode.y}%`} 
                    x2={`${toNode.x}%`} y2={`${toNode.y}%`} 
                    stroke={isActive ? 'var(--neon-magenta)' : 'rgba(0, 243, 255, 0.3)'}
                    strokeWidth={isActive ? "3" : "2"}
                  />
                );
              })}
            </svg>
            {visualData.nodes?.map((node: any, idx: number) => (
              <div 
                key={node.id || idx} 
                className={`graph-node ${node.active ? 'active-node' : ''}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                {node.label}
              </div>
            ))}
          </div>
        );
      case 'variables':
        return (
          <div className="visual-variables">
            {Object.entries(visualData.vars).map(([key, val]) => (
              <div key={key} className="variable-card">
                <span className="var-name">{key}</span>
                <span className="var-value">{String(val)}</span>
              </div>
            ))}
          </div>
        );
      default:
        return <div className="json-fallback"><pre>{JSON.stringify(visualData, null, 2)}</pre></div>;
    }
  };

  return (
    <div className="dynamic-visualizer">
      <div className="visualizer-header">
        <h2>{t('simulationView')}</h2>
      </div>
      <div className="visualizer-content">
        {renderVisualData()}
      </div>
    </div>
  );
};
