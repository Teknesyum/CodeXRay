import { useTimeline } from '../context/TimelineContext';
import { algorithmRegistry } from '../services/codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from '../services/inputPresets';
import type { InputKind } from '../types/simulation';
import { localizeAlgorithmName, t, translateRuntimeText } from '../i18n/translations';
import './CodeEditor.css';

const inputHelpKeys: Record<InputKind, string> = {
  array: 'arrayHelp',
  string: 'stringHelp',
  tree: 'treeHelp',
  graph: 'graphHelp',
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
    locale,
    setIsEditingInput,
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
      setIsEditingInput(kind === 'graph' || kind === 'tree');
    }
    resetTimeline();
  };

  const selectInputKind = (kind: InputKind) => {
    setSimulationInput(createInputPreset(kind, 1));
    setIsEditingInput(kind === 'graph' || kind === 'tree');
    setInputError(null);
    resetTimeline();
  };

  return (
    <div className="code-editor">
      <div className="editor-header">
        <h2>{t('sourceCode', locale)}</h2>
        <select
          aria-label={t('algorithmPreset', locale)}
          className="registry-select"
          onChange={(event) => selectAlgorithm(event.target.value)}
          value={algorithmRegistry.some((algorithm) => algorithm.code === code) ? code : ''}
        >
          <option value="">{t('presets', locale)}</option>
          {algorithmRegistry.map((algorithm, index) => (
            <option key={algorithm.name} value={algorithm.code}>
              {index + 1} – {algorithm.isSupported ? '✓' : '◇'} {localizeAlgorithmName(algorithm.name, locale)}
            </option>
          ))}
        </select>
      </div>

      <div className="input-config">
        <label htmlFor="input-kind">{t('simulationInput', locale)}</label>
        <select
          id="input-kind"
          value={simulationInput.kind}
          onChange={(event) => selectInputKind(event.target.value as InputKind)}
        >
          <option value="array">{t('array', locale)}</option>
          <option value="string">{t('string', locale)}</option>
          <option value="tree">{t('tree', locale)}</option>
          <option value="graph">{t('graph', locale)}</option>
        </select>
        <div className="preset-buttons" aria-label={t('inputPresets', locale)}>
          {[0, 1, 2].map((presetIndex) => (
            <button
              type="button"
              className="preset-btn"
              key={presetIndex}
              onClick={() => {
                setSimulationInput(createInputPreset(simulationInput.kind, presetIndex));
                setIsEditingInput(simulationInput.kind === 'graph' || simulationInput.kind === 'tree');
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
            aria-label={`${t(simulationInput.kind, locale)} ${t('simulationInput', locale)}`}
            type="text"
            placeholder={t(inputHelpKeys[simulationInput.kind], locale)}
            value={simulationInput.text}
            onChange={(event) => {
              setSimulationInput({ ...simulationInput, text: event.target.value });
              setInputError(null);
            }}
          />
        )}
        <span className="input-format-help">{t(inputHelpKeys[simulationInput.kind], locale)}</span>
      </div>
      {inputError && <div className="input-error" role="alert">{translateRuntimeText(inputError, locale)}</div>}

      <div className="editor-content">
        {steps.length === 0 ? (
          <textarea
            aria-label={t('sourceCodeLabel', locale)}
            className="code-textarea"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setAlgorithmName('Custom Code');
              resetTimeline();
            }}
            placeholder={t('placeholderCode', locale)}
            spellCheck="false"
          />
        ) : (
          <div className="code-display" aria-label={`${localizeAlgorithmName(algorithmName, locale)} ${t('execution', locale)}`}>
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
