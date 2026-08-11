import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FastForward,
  Pause,
  Play,
  Settings,
  StepBack,
  StepForward,
  Trash2,
  Check,
} from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { generateQuestions } from '../services/aiService';
import {
  deleteLocalModel,
  reconnectExternalAi,
  listExternalAiModels,
  getCachedLocalModels,
  getPersistentStorageStatus,
  initializeLocalAi,
  isLocalModelBusyError,
  isRecoverableLocalModelCacheError,
  LOCAL_AI_MODELS,
  repairLocalModel,
  requestPersistentLocalAiStorage,
  resetLocalAi,
  supportsLocalAi,
} from '../services/localAiService';
import { isDesktopRuntime } from '../services/desktopAiService';
import {
  EXTERNAL_AI_CONTEXT_WINDOWS,
  OPENAI_COMPATIBLE_ENDPOINT_PRESETS,
  getExternalAiMaxOutputTokens,
  getRecommendedExternalOutputTokens,
  invalidateExternalProfile,
  providerProfile,
} from '../services/aiProviderProfiles';
import type {
  AiConnectionProfileV1,
  AiProviderKind,
  ExternalAiContextWindow,
} from '../types/aiProvider';
import { t, translateRuntimeText } from '../i18n/translations';
import { selectCachedModelForAutoLoad } from '../services/localAiModels';
import { normalizeLocalAiProgress } from '../services/localAiProgress';
import {
  resetCodeXRayInterfaceState,
  resetCodeXRaySiteState,
} from '../services/siteReset';
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
    currentIndex,
    setSelectedExampleQuestion,
    aiModel,
    setAiModel,
    aiProvider,
    setAiProvider,
    aiProfiles,
    setAiProfiles,
    aiBearerToken,
    setAiBearerToken,
    aiContextWindow,
    setAiContextWindow,
    aiStatus,
    setAiStatus,
    aiProgress,
    setAiProgress,
    aiProgressPercent,
    setAiProgressPercent,
    showAiLoadWarning,
    setShowAiLoadWarning,
    showAiLoadProgress,
    setShowAiLoadProgress,
    autoLoadAiModel,
    setAutoLoadAiModel,
    radioPlaylistId,
    setRadioPlaylistId,
    requestRadioOpen,
    radioAutoplay,
    setRadioAutoplay,
    radioMinimizeSeconds,
    setRadioMinimizeSeconds,
    locale,
    setLocale,
    theme,
    setTheme,
  } = useTimeline();
  const [tempPlaylistUrl, setTempPlaylistUrl] = useState(radioPlaylistId);

  useEffect(() => {
    setTempPlaylistUrl(radioPlaylistId);
  }, [radioPlaylistId]);

  const handleApplyPlaylist = () => {
    setRadioPlaylistId(tempPlaylistUrl);
    requestRadioOpen();
  };
  const selectRadioPlaylist = (url: string) => {
    setRadioPlaylistId(url);
    setTempPlaylistUrl(url);
    requestRadioOpen();
  };
  const [showSettings, setShowSettings] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const settingsWasOpen = useRef(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'ui' | 'radio'>('ai');
  const [showQuestionsMenu, setShowQuestionsMenu] = useState(false);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
  const [cachedModels, setCachedModels] = useState<string[]>([]);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [repairableModel, setRepairableModel] = useState(false);
  const [externalModels, setExternalModels] = useState<string[]>([]);
  const [externalBusy, setExternalBusy] = useState(false);
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const startupCacheFallback = useRef(true);
  const autoLoadAttempts = useRef(new Set<string>());
  const providerOperationGenerationRef = useRef(0);
  const aiProgressHighWaterRef = useRef(0);
  const panelTitle = t('controls', locale);
  const selectedModel = LOCAL_AI_MODELS.find((model) => model.id === aiModel)
    ?? LOCAL_AI_MODELS[0];
  const modelCached = cacheChecked ? cachedModels.includes(aiModel) : null;
  const desktopRuntime = isDesktopRuntime();
  const externalProfile = aiProvider === 'webllm'
    ? null
    : providerProfile(aiProvider, aiProfiles);

  const resetAiUiState = () => {
    resetLocalAi();
    setRepairableModel(false);
    setAiStatus('idle');
    setAiProgress('');
    setAiProgressPercent(null);
  };

  const changeProvider = (provider: AiProviderKind) => {
    if (provider !== 'webllm' && !desktopRuntime) return;
    providerOperationGenerationRef.current += 1;
    resetAiUiState();
    setExternalBusy(false);
    setAiBearerToken('');
    setExternalModels([]);
    setAiProvider(provider);
    if (provider === 'webllm') {
      const model = LOCAL_AI_MODELS[0];
      setAiModel(model.id);
      setAiContextWindow(model.contextWindow);
      return;
    }
    const profile = providerProfile(provider, aiProfiles);
    setAiModel(profile.model);
    setAiContextWindow(profile.contextWindow);
  };

  const updateExternalProfile = (
    patch: Partial<Pick<AiConnectionProfileV1, 'baseUrl' | 'model' | 'contextWindow' | 'maxOutputTokens'>>,
  ) => {
    if (!externalProfile) return;
    const updated = invalidateExternalProfile(externalProfile, patch);
    setAiProfiles((profiles) => profiles.map((profile) => profile.id === updated.id ? updated : profile));
    setAiModel(updated.model);
    setAiContextWindow(updated.contextWindow);
    resetAiUiState();
  };

  const discoverExternalModels = async () => {
    if (!externalProfile) return;
    const operationGeneration = providerOperationGenerationRef.current;
    setExternalBusy(true);
    setAiProgress('');
    try {
      const models = await listExternalAiModels(externalProfile.baseUrl, aiBearerToken);
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      setExternalModels(models);
      setAiProgress(models.length
        ? t('externalModelsFound', locale, { count: models.length })
        : t('externalModelsEmpty', locale));
    } catch (error) {
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      setAiProgress(error instanceof Error ? error.message : t('externalDiscoveryFailed', locale));
    } finally {
      if (operationGeneration === providerOperationGenerationRef.current) setExternalBusy(false);
    }
  };

  const connectSelectedExternal = useCallback(async () => {
    if (!externalProfile || !externalProfile.model.trim()) {
      setAiStatus('error');
      setAiProgress(t('externalModelRequired', locale));
      return;
    }
    const operationGeneration = providerOperationGenerationRef.current;
    setExternalBusy(true);
    setAiStatus('loading');
    setAiProgress(t('testingExternalModel', locale));
    setAiProgressPercent(null);
    try {
      const connected = reconnectExternalAi(externalProfile, aiBearerToken);
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      setAiProfiles((profiles) => profiles.map((profile) => profile.id === connected.id ? connected : profile));
      setAiModel(connected.model);
      setAiContextWindow(connected.contextWindow);
      setAiStatus('ready');
      setAiProgress(connected.capabilities?.advancedWorkflows
        ? t('externalModelAdvancedReady', locale)
        : t('externalModelChatReady', locale));
    } catch (error) {
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      setAiStatus('error');
      setAiProgress(error instanceof Error ? error.message : t('externalConnectionFailed', locale));
    } finally {
      if (operationGeneration === providerOperationGenerationRef.current) setExternalBusy(false);
    }
  }, [aiBearerToken, externalProfile, locale, setAiContextWindow, setAiModel, setAiProfiles, setAiProgress, setAiProgressPercent, setAiStatus]);

  useEffect(() => {
    if (showSettings) settingsDialogRef.current?.focus();
    else if (settingsWasOpen.current) settingsTriggerRef.current?.focus();
    settingsWasOpen.current = showSettings;
  }, [showSettings]);

  const activateModel = useCallback(async (model: string, contextWindow: number) => {
    const operationGeneration = providerOperationGenerationRef.current;
    if (!await supportsLocalAi()) {
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      setAiStatus('unsupported');
      setAiProgressPercent(null);
      setAiProgress(translateRuntimeText('WebGPU is unavailable. Simulations still work without AI.', locale));
      return;
    }
    aiProgressHighWaterRef.current = 0;
    setRepairableModel(false);
    setAiStatus('loading');
    setAiProgressPercent(0);
    try {
      const persistent = await requestPersistentLocalAiStorage();
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      setStoragePersistent(persistent);
      await initializeLocalAi(model, contextWindow, (progress) => {
        if (operationGeneration !== providerOperationGenerationRef.current) return;
        const displayedPercentage = normalizeLocalAiProgress(
          progress,
          aiProgressHighWaterRef.current,
        );
        aiProgressHighWaterRef.current = displayedPercentage;
        setAiProgressPercent(displayedPercentage);
        setAiProgress(locale === 'tr' ? t('downloadingModel', locale) : progress.text);
      });
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      setCachedModels((current) => [...new Set([...current, model])]);
      setCacheChecked(true);
      setAiStatus('ready');
      aiProgressHighWaterRef.current = 100;
      setAiProgressPercent(100);
      setAiProgress(translateRuntimeText('Local model ready. No code or prompts leave this browser.', locale));
    } catch (error) {
      if (operationGeneration !== providerOperationGenerationRef.current) return;
      const busy = isLocalModelBusyError(error);
      const repairable = !busy && isRecoverableLocalModelCacheError(error);
      setRepairableModel(repairable);
      setAiStatus('error');
      setAiProgressPercent(null);
      setAiProgress(busy
        ? t('modelBusyAnotherTab', locale)
        : repairable
          ? t('modelCacheCorrupt', locale)
          : translateRuntimeText(error instanceof Error ? error.message : 'Local model failed to load.', locale));
    }
  }, [locale, setAiProgress, setAiProgressPercent, setAiStatus]);

  useEffect(() => {
    if (aiProvider !== 'webllm') return;
    if (aiContextWindow <= selectedModel.maxContextWindow) return;
    resetLocalAi();
    setAiContextWindow(selectedModel.contextWindow);
    setAiStatus('idle');
    setAiProgress('');
    setAiProgressPercent(null);
  }, [
    aiContextWindow,
    aiProvider,
    selectedModel.contextWindow,
    selectedModel.maxContextWindow,
    setAiContextWindow,
    setAiProgress,
    setAiProgressPercent,
    setAiStatus,
  ]);

  useEffect(() => {
    if (aiProvider !== 'webllm') return;
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
      
      if (!autoLoadAiModel) return;

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
    aiProvider,
    aiContextWindow,
    aiModel,
    selectedModel.maxContextWindow,
    setAiModel,
    autoLoadAiModel,
  ]);

  useEffect(() => {
    if (aiProvider === 'webllm' || !desktopRuntime || !autoLoadAiModel
      || !externalProfile?.capabilities || aiBearerToken || aiStatus !== 'idle') return;
    const loadKey = `external:${externalProfile.id}:${externalProfile.model}:${externalProfile.baseUrl}`;
    if (autoLoadAttempts.current.has(loadKey)) return;
    autoLoadAttempts.current.add(loadKey);
    setAiStatus('loading');
    setAiProgress(t('testingExternalModel', locale));
    const connected = reconnectExternalAi(externalProfile);
    setAiProfiles((profiles) => profiles.map((profile) => profile.id === connected.id ? connected : profile));
    setAiStatus('ready');
    setAiProgress(connected.capabilities?.advancedWorkflows
      ? t('externalModelAdvancedReady', locale)
      : t('externalModelChatReady', locale));
  }, [
    aiBearerToken,
    aiProvider,
    aiStatus,
    autoLoadAiModel,
    desktopRuntime,
    externalProfile,
    locale,
    setAiProfiles,
    setAiProgress,
    setAiStatus,
  ]);

  useEffect(() => {
    const handleLoadModel = () => {
      if (aiProvider === 'webllm') void activateModel(aiModel, aiContextWindow);
      else void connectSelectedExternal();
    };
    const handleOpenSettings = () => {
      setActiveTab('ai');
      setShowSettings(true);
    };
    window.addEventListener('codexray:loadModel', handleLoadModel);
    window.addEventListener('codexray:openAiSettings', handleOpenSettings);
    return () => {
      window.removeEventListener('codexray:loadModel', handleLoadModel);
      window.removeEventListener('codexray:openAiSettings', handleOpenSettings);
    };
  }, [activateModel, aiContextWindow, aiModel, aiProvider, connectSelectedExternal]);

  useEffect(() => {
    if (!showSettings || aiProvider !== 'webllm') return;
    let active = true;
    void getPersistentStorageStatus().then((persistent) => {
      if (active) setStoragePersistent(persistent);
    });
    return () => {
      active = false;
    };
  }, [aiProvider, showSettings]);

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
        setAiProgressPercent(null);
        setAiProgress(t('modelDeleted', locale));
        autoLoadAttempts.current.delete(model);
      }
    } catch (error) {
      setAiStatus('error');
      setAiProgressPercent(null);
      setAiProgress(error instanceof Error ? error.message : t('modelDeleteFailed', locale));
    } finally {
      setDeletingModel(null);
    }
  };

  const repairSelectedModel = async () => {
    if (!window.confirm(t('confirmRepairModel', locale, {
      name: translateRuntimeText(selectedModel.label, locale),
    }))) return;
    setDeletingModel(aiModel);
    setRepairableModel(false);
    try {
      await repairLocalModel(aiModel);
      setCachedModels((current) => current.filter((id) => id !== aiModel));
      autoLoadAttempts.current.delete(`${aiModel}:${aiContextWindow}`);
      setAiStatus('idle');
      setAiProgressPercent(null);
      setAiProgress(t('modelCacheRepaired', locale));
      await activateModel(aiModel, aiContextWindow);
    } catch (error) {
      setRepairableModel(true);
      setAiStatus('error');
      setAiProgressPercent(null);
      setAiProgress(isLocalModelBusyError(error)
        ? t('modelBusyAnotherTab', locale)
        : error instanceof Error ? error.message : t('modelRepairFailed', locale));
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

  const resetInterface = () => {
    resetCodeXRayInterfaceState();
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
        <button aria-label={t('previousStep', locale)} className="icon-btn primary-step" onClick={stepBackward} disabled={steps.length === 0 || currentIndex <= 0}>
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
        <button aria-label={t('nextStep', locale)} className="icon-btn primary-step" onClick={stepForward} disabled={steps.length === 0 || currentIndex >= steps.length - 1}>
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
          <button ref={settingsTriggerRef} aria-label={t('settings', locale)} className="icon-btn settings-btn" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={18} />
          </button>
          {showSettings && (
            <div
              ref={settingsDialogRef}
              className="settings-modal glass-panel"
              role="dialog"
              aria-label={t('settings', locale)}
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setShowSettings(false);
              }}
            >
              <div className="settings-modal-header">
                <h2>{t('settings', locale)}</h2>
                <button
                  className="close-btn"
                  aria-label={t('closeSettings', locale)}
                  onClick={() => setShowSettings(false)}
                >×</button>
              </div>
              <div className="settings-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ai')}
                >
                  {t('aiSettingsTab', locale)}
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'ui' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ui')}
                >
                  {t('uiSettingsTab', locale)}
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'radio' ? 'active' : ''}`}
                  onClick={() => setActiveTab('radio')}
                >
                  {t('radioSettingsTab', locale)}
                </button>
              </div>
              <div className={`settings-modal-content ${activeTab === 'ai'
                ? `ai-settings-layout ${aiProvider === 'webllm' ? '' : 'external-provider-layout'}`
                : ''}`}>
                {activeTab === 'ai' && (
                  <>
                <div className="settings-section ai-provider-settings">
                  <div className="settings-title">{t('aiProvider', locale)}</div>
                  <select
                    aria-label={t('aiProvider', locale)}
                    className="api-provider-select"
                    value={aiProvider}
                    onChange={(event) => changeProvider(event.target.value as AiProviderKind)}
                  >
                    <option value="webllm">WebLLM</option>
                    <option value="ollama" disabled={!desktopRuntime}>Ollama</option>
                    <option value="openai-compatible" disabled={!desktopRuntime}>
                      {locale === 'tr'
                        ? 'LM Studio ve benzerleri (OpenAI-compatible)'
                        : 'LM Studio & similar apps (OpenAI-compatible)'}
                    </option>
                  </select>
                  {!desktopRuntime && <p className="local-ai-note">{t('desktopProvidersOnly', locale)}</p>}
                  {desktopRuntime && aiProvider === 'openai-compatible' && (
                    <div className="provider-preset-actions">
                      {OPENAI_COMPATIBLE_ENDPOINT_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          className="provider-preset-chip"
                          title={preset.baseUrl}
                          aria-label={t('applyEndpointPreset', locale, {
                            name: preset.name,
                            url: preset.baseUrl,
                          })}
                          disabled={externalBusy}
                          onClick={() => updateExternalProfile({ baseUrl: preset.baseUrl })}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {aiProvider === 'webllm' ? (
                  <>
                <div className="settings-section ai-model-settings">
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
                      setRepairableModel(false);
                      setAiStatus('idle');
                      setAiProgressPercent(null);
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
                      setRepairableModel(false);
                      setAiStatus('idle');
                      setAiProgressPercent(null);
                      setAiProgress('');
                    }}
                  >
                    <option value={4096}>{t('context4k', locale)}</option>
                    {selectedModel.maxContextWindow >= 8192 && (
                      <option value={8192}>{t('context8kExperimental', locale)}</option>
                    )}
                    {selectedModel.maxContextWindow >= 16384 && (
                      <option value={16384}>{t('context16kExperimental', locale)}</option>
                    )}
                    {selectedModel.maxContextWindow >= 32768 && (
                      <option value={32768}>{t('context32kExperimental', locale)}</option>
                    )}
                  </select>
                  <p className="model-requirement">
                    {t('modelRequirement', locale, {
                      memory: (selectedModel.vramMb / 1000).toFixed(1),
                    })}
                  </p>
                  {selectedModel.reasoningModel && (
                    <p className="model-requirement">{t('reasoningModelRequirement', locale)}</p>
                  )}
                  <p className="model-requirement">
                    {t('modelTokenProfile', locale, {
                      context: aiContextWindow,
                      output: selectedModel.maxOutputTokens + (aiContextWindow >= 8192 ? 300 : 0),
                    })}
                  </p>
                </div>
                <p className="local-ai-note ai-privacy-note">
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
                <p className="local-ai-note ai-storage-note">{t('localAiStorageNote', locale)}</p>
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
                <div className="ai-load-actions">
                  <button
                    className="neon-button ai-load-button"
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
                  {repairableModel && (
                    <button
                      type="button"
                      className="neon-button ai-load-button danger"
                      disabled={deletingModel !== null || aiStatus === 'loading'}
                      onClick={() => void repairSelectedModel()}
                    >
                      {t('repairModelDownload', locale)}
                    </button>
                  )}
                </div>
                <div className="settings-section ai-load-preferences">
                  <div className="settings-title">{t('aiLoadPreferences', locale)}</div>
                  <label className="neon-checkbox-label" style={{ marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      className="neon-checkbox"
                      checked={autoLoadAiModel}
                      onChange={(e) => setAutoLoadAiModel(e.target.checked)}
                    />
                    <span className="checkbox-text">{t('autoLoadCachedModel', locale)}</span>
                  </label>
                  <label className="neon-checkbox-label" style={{ marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      className="neon-checkbox"
                      checked={showAiLoadWarning}
                      onChange={(e) => setShowAiLoadWarning(e.target.checked)}
                    />
                    <span className="checkbox-text">{t('showAiLoadWarning', locale)}</span>
                  </label>
                  <label className="neon-checkbox-label">
                    <input
                      type="checkbox"
                      className="neon-checkbox"
                      checked={showAiLoadProgress}
                      onChange={(e) => setShowAiLoadProgress(e.target.checked)}
                    />
                    <span className="checkbox-text">{t('showAiLoadProgress', locale)}</span>
                  </label>
                </div>
                {aiStatus === 'loading' && (
                  <div className="model-download-progress">
                    <div>
                      <span>{t('modelDownloadProgress', locale)}</span>
                      <output>{aiProgressPercent ?? 0}%</output>
                    </div>
                    <progress
                      aria-label={t('modelDownloadProgress', locale)}
                      max="100"
                      value={aiProgressPercent ?? 0}
                    />
                  </div>
                )}
                {aiProgress && <p className={`ai-status ${aiStatus}`}>{aiProgress}</p>}
                  </>
                ) : (
                  <>
                    <div className="settings-section ai-model-settings">
                      <div className="settings-title">
                        {aiProvider === 'ollama'
                          ? 'Ollama'
                          : (locale === 'tr'
                            ? 'LM Studio ve OpenAI-compatible uygulamalar'
                            : 'LM Studio & OpenAI-compatible apps')}
                      </div>
                      <label className="local-ai-field">
                        <span>{t('endpointUrl', locale)}</span>
                        <input
                          className="api-provider-select"
                          value={externalProfile?.baseUrl ?? ''}
                          disabled={externalBusy}
                          onChange={(event) => updateExternalProfile({ baseUrl: event.target.value })}
                          spellCheck={false}
                        />
                      </label>
                      <div className="ai-load-actions">
                        <button
                          type="button"
                          className="neon-button ai-load-button"
                          disabled={externalBusy}
                          onClick={() => void discoverExternalModels()}
                        >
                          {t('discoverModels', locale)}
                        </button>
                      </div>
                      <label className="local-ai-field">
                        <span>{t('externalModelId', locale)}</span>
                        <input
                          className="api-provider-select"
                          list="codexray-external-models"
                          value={externalProfile?.model ?? ''}
                          disabled={externalBusy}
                          onChange={(event) => updateExternalProfile({ model: event.target.value })}
                          spellCheck={false}
                        />
                        <datalist id="codexray-external-models">
                          {externalModels.map((model) => <option key={model} value={model} />)}
                        </datalist>
                      </label>
                      <label className="local-ai-field">
                        <span>{t('contextWindow', locale)}</span>
                        <select
                          className="api-provider-select"
                          value={externalProfile?.contextWindow ?? 4096}
                          disabled={externalBusy}
                          onChange={(event) => {
                            const contextWindow = Number(event.target.value) as ExternalAiContextWindow;
                            updateExternalProfile({
                              contextWindow,
                              maxOutputTokens: Math.min(
                                getExternalAiMaxOutputTokens(contextWindow),
                                Math.max(
                                  externalProfile?.maxOutputTokens ?? 1024,
                                  getRecommendedExternalOutputTokens(contextWindow),
                                ),
                              ),
                            });
                          }}
                        >
                          {EXTERNAL_AI_CONTEXT_WINDOWS.map((contextWindow) => (
                            <option key={contextWindow} value={contextWindow}>
                              {contextWindow >= 1024 ? `${contextWindow / 1024}K` : contextWindow}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="local-ai-field">
                        <span>{t('maxOutputTokens', locale)}</span>
                        <input
                          type="number"
                          className="api-provider-select"
                          min={256}
                          max={getExternalAiMaxOutputTokens(externalProfile?.contextWindow ?? 4096)}
                          step={128}
                          value={externalProfile?.maxOutputTokens ?? 1024}
                          disabled={externalBusy}
                          onChange={(event) => updateExternalProfile({
                            maxOutputTokens: Math.min(
                              getExternalAiMaxOutputTokens(externalProfile?.contextWindow ?? 4096),
                              Math.max(256, Number(event.target.value)),
                            ),
                          })}
                        />
                      </label>
                      <label className="local-ai-field">
                        <span>{t('sessionBearerToken', locale)}</span>
                        <input
                          type="password"
                          className="api-provider-select"
                          value={aiBearerToken}
                          disabled={externalBusy}
                          autoComplete="off"
                          onChange={(event) => setAiBearerToken(event.target.value)}
                        />
                      </label>
                    </div>
                    <p className="local-ai-note ai-privacy-note">{t('externalAiPrivacy', locale)}</p>
                    {externalProfile?.capabilities && (
                      <div className="local-storage-status">
                        <span className={externalProfile.capabilities.chat ? 'ready' : ''}>
                          {t('externalChatCompatible', locale)}
                        </span>
                        <span className={externalProfile.capabilities.advancedWorkflows ? 'ready' : ''}>
                          {externalProfile.capabilities.advancedWorkflows
                            ? t('externalAdvancedCompatible', locale)
                            : t('externalAdvancedUnavailable', locale)}
                        </span>
                      </div>
                    )}
                    <div className="ai-load-actions">
                      <button
                        type="button"
                        className="neon-button ai-load-button"
                        disabled={externalBusy || aiStatus === 'ready'}
                        onClick={() => void connectSelectedExternal()}
                      >
                        {externalBusy
                          ? t('testingExternalModel', locale)
                          : aiStatus === 'ready'
                            ? t('modelReady', locale)
                            : t('testAndConnect', locale)}
                      </button>
                    </div>
                    <div className="settings-section ai-load-preferences">
                      <label className="neon-checkbox-label">
                        <input
                          type="checkbox"
                          className="neon-checkbox"
                          checked={autoLoadAiModel}
                          onChange={(event) => setAutoLoadAiModel(event.target.checked)}
                        />
                        <span className="checkbox-text">{t('autoConnectExternalModel', locale)}</span>
                      </label>
                    </div>
                    {aiProgress && <p className={`ai-status ${aiStatus}`}>{aiProgress}</p>}
                  </>
                )}
                </>
                )}

                {activeTab === 'ui' && (
                  <>
                    <div className="settings-section">
                      <div className="settings-title">{t('theme', locale)}</div>
                      <div className="theme-selector">
                        <button 
                          className={`theme-btn neon-theme ${theme === 'neon' ? 'active' : ''}`}
                          onClick={() => setTheme('neon')}
                        >
                          {t('themeNeon', locale)}
                        </button>
                        <button 
                          className={`theme-btn dark-theme ${theme === 'dark' ? 'active' : ''}`}
                          onClick={() => setTheme('dark')}
                        >
                          {t('themeDark', locale)}
                        </button>
                        <button 
                          className={`theme-btn light-theme ${theme === 'light' ? 'active' : ''}`}
                          onClick={() => setTheme('light')}
                        >
                          {t('themeLight', locale)}
                        </button>
                      </div>
                    </div>
                    <div className="settings-section">
                      <div className="settings-title">{t('language', locale) || 'Dil (Language)'}</div>
                      <div className="theme-selector">
                        <button 
                          className={`theme-btn neon-theme ${locale === 'en' ? 'active' : ''}`}
                          onClick={() => setLocale('en')}
                        >
                          English (EN)
                        </button>
                        <button 
                          className={`theme-btn neon-theme ${locale === 'tr' ? 'active' : ''}`}
                          onClick={() => setLocale('tr')}
                        >
                          Türkçe (TR)
                        </button>
                      </div>
                    </div>

                    <div className="site-reset-section">
                      <div>
                        <div className="settings-title">{t('resetSiteTitle', locale)}</div>
                        <p className="local-ai-note">{t('resetSiteHelp', locale)}</p>
                      </div>
                      <div className="reset-actions">
                        <button
                          type="button"
                          className="reset-interface-button"
                          onClick={resetInterface}
                          disabled={aiStatus === 'loading' || deletingModel !== null}
                        >
                          {t('resetInterface', locale)}
                        </button>
                        <button
                          type="button"
                          className="reset-site-button"
                          onClick={resetSite}
                          disabled={aiStatus === 'loading' || deletingModel !== null}
                        >
                          {t('resetSite', locale)}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {activeTab === 'radio' && (
                  <>
                    <div className="settings-section">
                      <div className="settings-title">{t('radioAutoplay', locale)}</div>
                      <label className="neon-checkbox-label">
                        <input
                          type="checkbox"
                          className="neon-checkbox"
                          checked={radioAutoplay}
                          onChange={(e) => setRadioAutoplay(e.target.checked)}
                        />
                        <span className="checkbox-text">{t('radioAutoplay', locale)}</span>
                      </label>
                    </div>
                    <div className="settings-section">
                      <div className="settings-title">{t('radioMinimizeDelay', locale)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="range"
                          className="progress-slider"
                          min="1"
                          max="16"
                          step="1"
                          value={radioMinimizeSeconds}
                          onChange={(e) => setRadioMinimizeSeconds(Number(e.target.value))}
                          style={{ flex: 1 }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--neon-cyan)', width: '30px', textAlign: 'right' }}>
                          {radioMinimizeSeconds > 15 ? t('never', locale) : `${radioMinimizeSeconds}s`}
                        </span>
                      </div>
                    </div>
                    <div className="settings-section">
                      <div className="settings-title">{t('radioPlaylist', locale)}</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="custom-playlist-input"
                          value={tempPlaylistUrl}
                          onChange={(e) => setTempPlaylistUrl(e.target.value)}
                          placeholder="https://youtube.com/playlist?list=..."
                        />
                        <button 
                          type="button"
                          className="action-btn"
                          style={{ padding: '6px' }}
                          onClick={handleApplyPlaylist}
                          title={t('apply', locale)}
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="settings-section">
                      <div className="settings-title">{t('radioPresets', locale)}</div>
                      <div className="playlist-presets">
                        <button 
                          className={`theme-btn neon-theme ${radioPlaylistId === 'https://youtube.com/playlist?list=OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0' ? 'active' : ''}`}
                          onClick={() => selectRadioPlaylist('https://youtube.com/playlist?list=OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0')}
                        >
                          SirensCeol ({t('defaultLabel', locale)})
                        </button>
                        <button 
                          className={`theme-btn neon-theme ${radioPlaylistId === 'https://youtube.com/playlist?list=PLjigMzkDwo3CLT0g1XhPoovK9TUMkwR63' ? 'active' : ''}`}
                          onClick={() => selectRadioPlaylist('https://youtube.com/playlist?list=PLjigMzkDwo3CLT0g1XhPoovK9TUMkwR63')}
                        >
                          Kodlama & Odak (Lofi)
                        </button>
                        <button 
                          className={`theme-btn neon-theme ${radioPlaylistId === 'https://youtube.com/playlist?list=PLOtNYlNIGer0jmWpFtTWqMkfP56iuZg1w' ? 'active' : ''}`}
                          onClick={() => selectRadioPlaylist('https://youtube.com/playlist?list=PLOtNYlNIGer0jmWpFtTWqMkfP56iuZg1w')}
                        >
                          Synthwave & Retrowave
                        </button>
                        <button 
                          className={`theme-btn neon-theme ${radioPlaylistId === 'https://youtube.com/playlist?list=PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo' ? 'active' : ''}`}
                          onClick={() => selectRadioPlaylist('https://youtube.com/playlist?list=PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo')}
                          >
                          Lofi Hip Hop Mix
                        </button>
                        <button 
                          className={`theme-btn neon-theme ${radioPlaylistId === 'https://youtube.com/playlist?list=PL2140A0411C65DD13' ? 'active' : ''}`}
                          onClick={() => selectRadioPlaylist('https://youtube.com/playlist?list=PL2140A0411C65DD13')}
                        >
                          {t('classicalMusic', locale)}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <footer className="settings-version-footer" aria-label="CodeXRay version">
                <span>CodeXRay</span>
                <strong>v{__CODEXRAY_VERSION__}</strong>
              </footer>
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
