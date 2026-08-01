import { useTimeline } from '../context/TimelineContext';
import { algorithmRegistry } from '../services/codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from '../services/inputPresets';
import { getAlgorithmParameterDefinitions } from '../services/algorithmInputs';
import type { InputKind } from '../types/simulation';
import { localizeAlgorithmName, t, translateRuntimeText } from '../i18n/translations';
import './CodeEditor.css';

const inputHelpKeys: Record<InputKind, string> = {
  array: 'arrayHelp',
  string: 'stringHelp',
  tree: 'treeHelp',
  graph: 'graphHelp',
};

const inputHelpKeyForAlgorithm = (name: string, kind: InputKind): string => {
  if (/Dutch National Flag/i.test(name)) return 'dutchInputHelp';
  if (/Matrix Chain Multiplication/i.test(name)) return 'matrixChainInputHelp';
  if (/Unique Paths/i.test(name)) return 'uniquePathsInputHelp';
  if (/Sieve of Eratosthenes/i.test(name)) return 'sieveInputHelp';
  if (/Fast Exponentiation/i.test(name)) return 'modularPowerInputHelp';
  if (/Max Flow/i.test(name)) return 'maxFlowInputHelp';
  if (/Lowest Common Ancestor/i.test(name)) return 'lcaInputHelp';
  if (/Trie Insert/i.test(name)) return 'wordCollectionHelp';
  if (/Merge Intervals/i.test(name)) return 'intervalPairsHelp';
  if (/0\/1 Knapsack/i.test(name)) return 'weightsHelp';
  if (/Detect Cycle/i.test(name)) return 'linkedListValuesHelp';
  return inputHelpKeys[kind];
};

const recentTypingStart = (source: string, visibleWords = 3): number => {
  let wordCount = 0;
  let insideWord = false;
  for (let index = source.length - 1; index >= 0; index -= 1) {
    if (/\s/.test(source[index])) {
      if (!insideWord) continue;
      insideWord = false;
      wordCount += 1;
      if (wordCount >= visibleWords) return index + 1;
    } else {
      insideWord = true;
    }
  }
  return 0;
};

interface CodeEditorProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const CodeEditor = ({ collapsed, onToggleCollapse }: CodeEditorProps) => {
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
    isGodModeTypingSource,
  } = useTimeline();
  const currentStep = steps[currentIndex];
  const panelTitle = t('sourceCode', locale);
  const inputHelpKey = inputHelpKeyForAlgorithm(algorithmName, simulationInput.kind);
  const parameterDefinitions = getAlgorithmParameterDefinitions(algorithmName);
  const neonTypingStart = recentTypingStart(code);

  if (collapsed) {
    return (
      <div className="code-editor">
        <div className="collapsed-panel-header">
          <span>{panelTitle}</span>
          <button
            type="button"
            className="panel-toggle"
            aria-label={t('expandPanel', locale, { panel: panelTitle })}
            onClick={onToggleCollapse}
          >
            +
          </button>
        </div>
      </div>
    );
  }

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
      setSimulationInput(createInputPreset(kind, 1, algorithm.name));
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
        <h2>{panelTitle}</h2>
        <select
          aria-label={t('algorithmPreset', locale)}
          className="registry-select"
          onChange={(event) => selectAlgorithm(event.target.value)}
          value={algorithmRegistry.some((algorithm) => algorithm.code === code) ? code : ''}
        >
          <option value="">{t('presets', locale)}</option>
          {algorithmRegistry.map((algorithm, index) => (
            <option
              key={algorithm.name}
              value={algorithm.code}
              disabled={!algorithm.isSupported}
            >
              {index + 1} – {algorithm.isSupported ? '✓' : '⛔'} {localizeAlgorithmName(algorithm.name, locale)}
              {!algorithm.isSupported && ` — ${t('blocked', locale)}: ${translateRuntimeText(algorithm.blockedReason ?? '', locale)}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="panel-toggle"
          aria-label={t('collapsePanel', locale, { panel: panelTitle })}
          onClick={onToggleCollapse}
        >
          −
        </button>
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
                setSimulationInput(createInputPreset(
                  simulationInput.kind,
                  presetIndex,
                  algorithmName,
                ));
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
            placeholder={t(inputHelpKey, locale)}
            value={simulationInput.text}
            onChange={(event) => {
              setSimulationInput({ ...simulationInput, text: event.target.value, origin: 'user' });
              setInputError(null);
            }}
          />
        )}
        {parameterDefinitions.map((definition) => (
          <label className="parameter-field" key={definition.key}>
            <span>{t(definition.labelKey, locale)}</span>
            <input
              aria-label={t(definition.labelKey, locale)}
              type={definition.type ?? 'text'}
              placeholder={t(definition.placeholderKey, locale)}
              value={simulationInput.parameters?.[definition.key] ?? ''}
              onChange={(event) => {
                setSimulationInput({
                  ...simulationInput,
                  origin: 'user',
                  parameters: {
                    ...simulationInput.parameters,
                    [definition.key]: event.target.value,
                  },
                });
                setInputError(null);
              }}
            />
          </label>
        ))}
        <span className="input-format-help">{t(inputHelpKey, locale)}</span>
      </div>
      {inputError && <div className="input-error" role="alert">{translateRuntimeText(inputError, locale)}</div>}

      <div className="editor-content" tabIndex={0} aria-label={t('sourceCodeLabel', locale)}>
        {steps.length === 0 ? (
          isGodModeTypingSource ? (
            <pre
              className="god-mode-code-typing"
              aria-label={t('sourceCodeLabel', locale)}
              aria-live="polite"
            >
              <span>{code.slice(0, neonTypingStart)}</span>
              <span key={code.length} className="god-mode-code-new-text">
                {code.slice(neonTypingStart)}
              </span>
              <span className="god-mode-code-caret" aria-hidden="true" />
            </pre>
          ) : (
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
          )
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
