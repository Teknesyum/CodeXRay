import { useTimeline } from '../context/TimelineContext';
import { algorithmRegistry } from '../services/codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from '../services/inputPresets';
import type { InputKind } from '../types/simulation';
import { GraphInputEditor } from './GraphInputEditor';
import { t } from '../i18n/translations';
import './CodeEditor.css';

const inputHelp: Record<InputKind, string> = {
  array: 'JSON or comma-separated numbers, e.g. [8, 3, 5, 1]',
  string: 'Plain or quoted text, e.g. AABAABAAZ or s = "AABA"',
  tree: 'Use the builder or import level-order JSON: [1,2,3,null,4]',
  graph: 'Use the builder or import a GraphDocumentV1 JSON object',
};

export const CodeEditor = () => {
  const {
    code,
    setCode,
    algorithmName,
    setAlgorithmName,
    steps,
    setSteps,
    currentIndex,
    setCurrentIndex,
    setAnalysis,
    simulationInput,
    setSimulationInput,
    inputError,
    setInputError,
    pause,
  } = useTimeline();
  const currentStep = steps[currentIndex];

  const resetTimeline = () => {
    setSteps([]);
    setCurrentIndex(0);
    setAnalysis(null);
    setInputError(null);
    pause();
  };

  const selectAlgorithm = (selectedCode: string) => {
    const algorithm = algorithmRegistry.find((candidate) => candidate.code === selectedCode);
    setCode(selectedCode);
    setAlgorithmName(algorithm?.name ?? 'Custom Code');
    if (algorithm) {
      const kind = getInputKindForAlgorithm(algorithm.name);
      setSimulationInput(createInputPreset(kind, 1));
    }
    resetTimeline();
  };

  const selectInputKind = (kind: InputKind) => {
    setSimulationInput(createInputPreset(kind, 1));
    setInputError(null);
    resetTimeline();
  };

  return (
    <div className="code-editor">
      <div className="editor-header">
        <h2>{t('sourceCode')}</h2>
        <select
          aria-label="Algorithm preset"
          className="registry-select"
          onChange={(event) => selectAlgorithm(event.target.value)}
          value={algorithmRegistry.some((algorithm) => algorithm.code === code) ? code : ''}
        >
          <option value="">{t('presets')}</option>
          {algorithmRegistry.map((algorithm, index) => (
            <option key={algorithm.name} value={algorithm.code}>
              {index + 1} – {algorithm.isSupported ? '✓' : '◇'} {algorithm.name}
            </option>
          ))}
        </select>
      </div>

      <div className="input-config">
        <label htmlFor="input-kind">{t('simulationInput')}</label>
        <select
          id="input-kind"
          value={simulationInput.kind}
          onChange={(event) => selectInputKind(event.target.value as InputKind)}
        >
          <option value="array">Array</option>
          <option value="string">String</option>
          <option value="tree">Tree</option>
          <option value="graph">Graph</option>
        </select>
        <div className="preset-buttons" aria-label="Input presets">
          {[0, 1, 2].map((presetIndex) => (
            <button
              type="button"
              className="preset-btn"
              key={presetIndex}
              onClick={() => {
                setSimulationInput(createInputPreset(simulationInput.kind, presetIndex));
                setInputError(null);
                resetTimeline();
              }}
            >
              i{presetIndex + 1}
            </button>
          ))}
        </div>
        {(simulationInput.kind === 'array' || simulationInput.kind === 'string') && (
          <input
            aria-label={`${simulationInput.kind} input`}
            type="text"
            placeholder={inputHelp[simulationInput.kind]}
            value={simulationInput.text}
            onChange={(event) => {
              setSimulationInput({ ...simulationInput, text: event.target.value });
              setInputError(null);
            }}
          />
        )}
        <span className="input-format-help">{inputHelp[simulationInput.kind]}</span>
      </div>
      {inputError && <div className="input-error" role="alert">{inputError}</div>}

      {(simulationInput.kind === 'graph' || simulationInput.kind === 'tree') && simulationInput.graph && (
        <GraphInputEditor
          document={simulationInput.graph}
          onChange={(graph) => setSimulationInput({
            kind: graph.mode,
            text: JSON.stringify(graph),
            graph,
          })}
          onError={setInputError}
        />
      )}

      <div className="editor-content">
        {steps.length === 0 ? (
          <textarea
            aria-label="Source code"
            className="code-textarea"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setAlgorithmName('Custom Code');
              resetTimeline();
            }}
            placeholder={t('placeholderCode')}
            spellCheck="false"
          />
        ) : (
          <div className="code-display" aria-label={`${algorithmName} execution`}>
            {code.split('\n').map((line, index) => (
              <div
                key={`${index}-${line}`}
                className={`code-line ${currentStep?.lineNumber === index + 1 ? 'highlighted' : ''}`}
              >
                <span className="line-number">{index + 1}</span>
                <pre>{line}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
