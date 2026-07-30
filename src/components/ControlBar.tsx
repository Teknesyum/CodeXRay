import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FastForward,
  Pause,
  Play,
  Settings,
  StepBack,
  StepForward,
  Trash2,
} from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { generateQuestions } from '../services/aiService';
import {
  deleteLocalModel,
  getCachedLocalModels,
  getPersistentStorageStatus,
  initializeLocalAi,
  LOCAL_AI_MODELS,
  requestPersistentLocalAiStorage,
  resetLocalAi,
  supportsLocalAi,
} from '../services/localAiService';
import { t, translateRuntimeText } from '../i18n/translations';
import { selectCachedModelForAutoLoad } from '../services/localAiModels';
import { resetCodeXRaySiteState } from '../services/siteReset';
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
    aiContextWindow,
    setAiContextWindow,
    aiStatus,
    setAiStatus,
    aiProgress,
    setAiProgress,
    locale,
  } = useTimeline();
  const [showSettings, setShowSettings] = useState(false);
  const [showQuestionsMenu, setShowQuestionsMenu] = useState(false);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
  const [cachedModels, setCachedModels] = useState<string[]>([]);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const startupCacheFallback = useRef(true);
  const autoLoadAttempts = useRef(new Set<string>());
  const panelTitle = t('controls', locale);
  const selectedModel = LOCAL_AI_MODELS.find((model) => model.id === aiModel)
    ?? LOCAL_AI_MODELS[0];
  const modelCached = cacheChecked ? cachedModels.includes(aiModel) : null;

  const activateModel = useCallback(async (model: string, contextWindow: number) => {
    if (!await supportsLocalAi()) {
      setAiStatus('unsupported');
      setAiProgress(translateRuntimeText('WebGPU is unavailable. Simulations still work without AI.', locale));
      return;
    }
    setAiStatus('loading');
    try {
      setStoragePersistent(await requestPersistentLocalAiStorage());
      await initializeLocalAi(model, contextWindow, (progress) => {
        setAiProgress(locale === 'tr' ? t('loading', locale) : progress);
      });
      setCachedModels((current) => [...new Set([...current, model])]);
      setCacheChecked(true);
      setAiStatus('ready');
      setAiProgress(translateRuntimeText('Local model ready. No code or prompts leave this browser.', locale));
    } catch (error) {
      setAiStatus('error');
      setAiProgress(translateRuntimeText(error instanceof Error ? error.message : 'Local model failed to load.', locale));
    }
  }, [locale, setAiProgress, setAiStatus]);

  useEffect(() => {
    if (aiContextWindow <= selectedModel.maxContextWindow) return;
    resetLocalAi();
    setAiContextWindow(selectedModel.contextWindow);
    setAiStatus('idle');
    setAiProgress('');
  }, [
    aiContextWindow,
    selectedModel.contextWindow,
    selectedModel.maxContextWindow,
    setAiContextWindow,
    setAiProgress,
    setAiStatus,
  ]);

  useEffect(() => {
    if (aiContextWindow > selectedModel.maxContextWindow) return;
    let active = true;
    setCacheChecked(false);
    void getCachedLocalModels().then((cached) => {
      if (!active) return;
      setCachedModels(cached);
      setCacheChecked(true);

      const autoLoadModel = selectCachedModelForAutoLoad(
        aiModel,
        cached,
        startupCacheFallback.current,
      );
      if (autoLoadModel && autoLoadModel !== aiModel) {
        startupCacheFallback.current = false;
        setAiModel(autoLoadModel);
        return;
      }
      startupCacheFallback.current = false;
      const loadKey = `${autoLoadModel}:${aiContextWindow}`;
      if (autoLoadModel && !autoLoadAttempts.current.has(loadKey)) {
        autoLoadAttempts.current.add(loadKey);
        void activateModel(autoLoadModel, aiContextWindow);
      }
    }).catch(() => {
      if (active) setCacheChecked(true);
    });
    return () => {
      active = false;
    };
  }, [
    activateModel,
    aiContextWindow,
    aiModel,
    selectedModel.maxContextWindow,
    setAiModel,
  ]);

  useEffect(() => {
    if (!showSettings) return;
    let active = true;
    void getPersistentStorageStatus().then((persistent) => {
      if (active) setStoragePersistent(persistent);
    });
    return () => {
      active = false;
    };
  }, [showSettings]);

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

  const deleteStoredModel = async (model: string) => {
    const definition = LOCAL_AI_MODELS.find((candidate) => candidate.id === model);
    if (!window.confirm(t('confirmDeleteModel', locale, {
      name: translateRuntimeText(definition?.label ?? model, locale),
    }))) return;
    setDeletingModel(model);
    try {
      await deleteLocalModel(model);
      setCachedModels((current) => current.filter((id) => id !== model));
      if (model === aiModel) {
        setAiStatus('idle');
        setAiProgress(t('modelDeleted', locale));
        autoLoadAttempts.current.delete(model);
      }
    } catch (error) {
      setAiStatus('error');
      setAiProgress(error instanceof Error ? error.message : t('modelDeleteFailed', locale));
    } finally {
      setDeletingModel(null);
    }
  };

  const resetSite = () => {
    if (!window.confirm(t('confirmResetSite', locale))) return;
    resetLocalAi();
    resetCodeXRaySiteState();
    resetCodeXRaySiteState(sessionStorage);
    window.location.reload();
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
                      startupCacheFallback.current = false;
                      const nextModel = LOCAL_AI_MODELS.find((model) =>
                        model.id === event.target.value,
                      ) ?? LOCAL_AI_MODELS[0];
                      autoLoadAttempts.current.delete(
                        `${nextModel.id}:${nextModel.contextWindow}`,
                      );
                      resetLocalAi();
                      setAiModel(nextModel.id);
                      setAiContextWindow(nextModel.contextWindow);
                      setCacheChecked(false);
                      setAiStatus('idle');
                      setAiProgress('');
                    }}
                  >
                    {LOCAL_AI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>{translateRuntimeText(model.label, locale)}</option>
                    ))}
                  </select>
                  <select
                    aria-label={t('contextWindow', locale)}
                    className="api-provider-select"
                    value={aiContextWindow}
                    disabled={aiStatus === 'loading'}
                    onChange={(event) => {
                      const contextWindow = Number(event.target.value);
                      startupCacheFallback.current = false;
                      autoLoadAttempts.current.delete(`${aiModel}:${contextWindow}`);
                      resetLocalAi();
                      setAiContextWindow(contextWindow);
                      setAiStatus('idle');
                      setAiProgress('');
                    }}
                  >
                    <option value={4096}>{t('context4k', locale)}</option>
                    {selectedModel.maxContextWindow >= 8192 && (
                      <option value={8192}>{t('context8kExperimental', locale)}</option>
                    )}
                  </select>
                  <p className="model-requirement">
                    {t('modelRequirement', locale, {
                      memory: (selectedModel.vramMb / 1000).toFixed(1),
                    })}
                  </p>
                  <p className="model-requirement">
                    {t('modelTokenProfile', locale, {
                      context: aiContextWindow,
                      output: selectedModel.maxOutputTokens + (aiContextWindow >= 8192 ? 300 : 0),
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
                <div className="stored-models">
                  <div className="settings-title">{t('storedModels', locale)}</div>
                  {cacheChecked && cachedModels.length === 0 && (
                    <p className="local-ai-note">{t('noStoredModels', locale)}</p>
                  )}
                  {cachedModels.map((modelId) => {
                    const model = LOCAL_AI_MODELS.find((candidate) => candidate.id === modelId);
                    return (
                      <div className="stored-model-row" key={modelId}>
                        <span>{translateRuntimeText(model?.label ?? modelId, locale)}</span>
                        <button
                          type="button"
                          aria-label={t('deleteStoredModel', locale, {
                            name: translateRuntimeText(model?.label ?? modelId, locale),
                          })}
                          disabled={deletingModel !== null || aiStatus === 'loading'}
                          onClick={() => void deleteStoredModel(modelId)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="neon-button"
                  onClick={() => void activateModel(aiModel, aiContextWindow)}
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
                <div className="site-reset-section">
                  <div>
                    <div className="settings-title">{t('resetSiteTitle', locale)}</div>
                    <p className="local-ai-note">{t('resetSiteHelp', locale)}</p>
                  </div>
                  <button
                    type="button"
                    className="reset-site-button"
                    onClick={resetSite}
                    disabled={aiStatus === 'loading' || deletingModel !== null}
                  >
                    {t('resetSite', locale)}
                  </button>
                </div>
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
