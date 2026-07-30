import { useEffect, useState } from 'react';
import { FastForward, Pause, Play, Settings, StepBack, StepForward } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { generateQuestions } from '../services/aiService';
import {
  getPersistentStorageStatus,
  initializeLocalAi,
  isLocalModelCached,
  LOCAL_AI_MODELS,
  requestPersistentLocalAiStorage,
  resetLocalAi,
  supportsLocalAi,
} from '../services/localAiService';
import { t, translateRuntimeText } from '../i18n/translations';
import './ControlBar.css';

interface ControlBarProps {
  onSimulate: () => void;
  onAnalyze: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const ControlBar = ({
  onSimulate,
  onAnalyze,
  collapsed,
  onToggleCollapse,
}: ControlBarProps) => {
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
    locale,
  } = useTimeline();
  const [showSettings, setShowSettings] = useState(false);
  const [showQuestionsMenu, setShowQuestionsMenu] = useState(false);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
  const [modelCached, setModelCached] = useState<boolean | null>(null);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const panelTitle = t('controls', locale);
  const selectedModel = LOCAL_AI_MODELS.find((model) => model.id === aiModel)
    ?? LOCAL_AI_MODELS[0];

  useEffect(() => {
    if (!showSettings) return;
    let active = true;
    setModelCached(null);
    void Promise.all([
      isLocalModelCached(aiModel),
      getPersistentStorageStatus(),
    ]).then(([cached, persistent]) => {
      if (!active) return;
      setModelCached(cached);
      setStoragePersistent(persistent);
    }).catch(() => {
      if (active) setModelCached(false);
    });
    return () => {
      active = false;
    };
  }, [aiModel, showSettings]);

  if (collapsed) {
    return (
      <div className="control-bar">
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

  const loadModel = async () => {
    if (!await supportsLocalAi()) {
      setAiStatus('unsupported');
      setAiProgress(translateRuntimeText('WebGPU is unavailable. Simulations still work without AI.', locale));
      return;
    }
    setAiStatus('loading');
    try {
      setStoragePersistent(await requestPersistentLocalAiStorage());
      await initializeLocalAi(aiModel, (progress) => {
        setAiProgress(locale === 'tr' ? t('loading', locale) : progress);
      });
      setModelCached(true);
      setAiStatus('ready');
      setAiProgress(translateRuntimeText('Local model ready. No code or prompts leave this browser.', locale));
    } catch (error) {
      setAiStatus('error');
      setAiProgress(translateRuntimeText(error instanceof Error ? error.message : 'Local model failed to load.', locale));
    }
  };

  const openExamples = () => {
    if (!code) return;
    setExampleQuestions(generateQuestions(algorithmName, code).map((question) =>
      translateRuntimeText(question, locale),
    ));
    setShowQuestionsMenu(true);
  };

  return (
    <div className="control-bar">
      <div className="control-group">
        <button className="neon-button simulate-btn" onClick={onSimulate}>
          ⚡ {t('simulate', locale)}
        </button>
        <button className="neon-button analyze-btn" onClick={onAnalyze}>
          🔍 {t('analyze', locale)}
        </button>
        <div className="qs-menu-container">
          <button className="neon-button qs-btn" onClick={openExamples} disabled={!code}>
            💡 {t('examples', locale)}
          </button>
          {showQuestionsMenu && exampleQuestions.length > 0 && (
            <div className="qs-dropdown">
              <div className="qs-dropdown-header">
                <span>{t('exampleQuestions', locale)}</span>
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
                    {t('example', locale)} {index + 1}: {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="control-group playback-controls">
        <button aria-label={t('previousStep', locale)} className="icon-btn primary-step" onClick={stepBackward} disabled={steps.length === 0}>
          <StepBack size={28} />
        </button>
        {isPlaying ? (
          <button aria-label={t('pause', locale)} className="icon-btn tiny-play" onClick={pause} disabled={steps.length === 0}>
            <Pause size={16} />
          </button>
        ) : (
          <button aria-label={t('play', locale)} className="icon-btn tiny-play" onClick={play} disabled={steps.length === 0}>
            <Play size={16} />
          </button>
        )}
        <button aria-label={t('nextStep', locale)} className="icon-btn primary-step" onClick={stepForward} disabled={steps.length === 0}>
          <StepForward size={28} />
        </button>
      </div>

      <div className="control-group right-controls">
        <div className="speed-control">
          <FastForward size={16} className="speed-icon" />
          <input
            aria-label={t('playbackSpeed', locale)}
            type="range"
            min="1"
            max="10"
            value={Math.round((2000 - speed) / 180)}
            onChange={(event) => setSpeed(2000 - Number(event.target.value) * 180)}
            className="neon-slider"
          />
        </div>
        <div className="settings-container">
          <button aria-label={t('settings', locale)} className="icon-btn settings-btn" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} />
          </button>
          {showSettings && (
            <div className="settings-modal glass-panel" role="dialog" aria-label={t('settings', locale)}>
              <div className="settings-modal-header">
                <h2>{t('localAiSettings', locale)}</h2>
                <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
              </div>
              <div className="settings-modal-content">
                <div className="settings-section">
                  <div className="settings-title">{t('onDeviceModel', locale)}</div>
                  <select
                    aria-label={t('onDeviceModel', locale)}
                    className="api-provider-select"
                    value={aiModel}
                    disabled={aiStatus === 'loading'}
                    onChange={(event) => {
                      resetLocalAi();
                      setAiModel(event.target.value);
                      setModelCached(null);
                      setAiStatus('idle');
                      setAiProgress('');
                    }}
                  >
                    {LOCAL_AI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>{translateRuntimeText(model.label, locale)}</option>
                    ))}
                  </select>
                  <p className="model-requirement">
                    {t('modelRequirement', locale, {
                      memory: (selectedModel.vramMb / 1000).toFixed(1),
                    })}
                  </p>
                </div>
                <p className="local-ai-note">
                  {t('localAiPrivacy', locale)}
                </p>
                <div className="local-storage-status">
                  <span className={modelCached ? 'ready' : ''}>
                    {modelCached === null
                      ? t('checkingLocalModel', locale)
                      : modelCached
                        ? t('modelStoredLocally', locale)
                        : t('modelDownloadRequired', locale)}
                  </span>
                  <span className={storagePersistent ? 'ready' : ''}>
                    {storagePersistent === null
                      ? t('browserManagedStorage', locale)
                      : storagePersistent
                        ? t('persistentStorageGranted', locale)
                        : t('persistentStorageBestEffort', locale)}
                  </span>
                </div>
                <p className="local-ai-note">{t('localAiStorageNote', locale)}</p>
                <button
                  className="neon-button"
                  onClick={loadModel}
                  disabled={aiStatus === 'loading' || aiStatus === 'ready'}
                >
                  {aiStatus === 'loading'
                    ? t('loading', locale)
                    : aiStatus === 'ready'
                      ? t('modelReady', locale)
                      : modelCached
                        ? t('initializeStoredModel', locale)
                        : t('loadLocalModel', locale)}
                </button>
                {aiProgress && <p className={`ai-status ${aiStatus}`}>{aiProgress}</p>}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="panel-toggle"
          aria-label={t('collapsePanel', locale, { panel: panelTitle })}
          onClick={onToggleCollapse}
        >
          −
        </button>
      </div>
    </div>
  );
};
