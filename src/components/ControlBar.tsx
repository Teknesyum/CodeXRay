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
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const startupCacheFallback = useRef(true);
  const autoLoadAttempts = useRef(new Set<string>());
  const panelTitle = t('controls', locale);
  const selectedModel = LOCAL_AI_MODELS.find((model) => model.id === aiModel)
    ?? LOCAL_AI_MODELS[0];
  const modelCached = cacheChecked ? cachedModels.includes(aiModel) : null;

  useEffect(() => {
    if (showSettings) settingsDialogRef.current?.focus();
    else if (settingsWasOpen.current) settingsTriggerRef.current?.focus();
    settingsWasOpen.current = showSettings;
  }, [showSettings]);

  const activateModel = useCallback(async (model: string, contextWindow: number) => {
    if (!await supportsLocalAi()) {
      setAiStatus('unsupported');
      setAiProgressPercent(null);
      setAiProgress(translateRuntimeText('WebGPU is unavailable. Simulations still work without AI.', locale));
      return;
    }
    setAiStatus('loading');
    setAiProgressPercent(0);
    try {
      setStoragePersistent(await requestPersistentLocalAiStorage());
      await initializeLocalAi(model, contextWindow, (progress) => {
        const percentage = Math.round(Math.max(0, Math.min(1, progress.progress)) * 100);
        setAiProgressPercent(percentage);
        setAiProgress(locale === 'tr' ? t('downloadingModel', locale) : progress.text);
      });
      setCachedModels((current) => [...new Set([...current, model])]);
      setCacheChecked(true);
      setAiStatus('ready');
      setAiProgressPercent(100);
      setAiProgress(translateRuntimeText('Local model ready. No code or prompts leave this browser.', locale));
    } catch (error) {
      setAiStatus('error');
      setAiProgressPercent(null);
      setAiProgress(translateRuntimeText(error instanceof Error ? error.message : 'Local model failed to load.', locale));
    }
  }, [locale, setAiProgress, setAiProgressPercent, setAiStatus]);

  useEffect(() => {
    if (aiContextWindow <= selectedModel.maxContextWindow) return;
    resetLocalAi();
    setAiContextWindow(selectedModel.contextWindow);
    setAiStatus('idle');
    setAiProgress('');
    setAiProgressPercent(null);
  }, [
    aiContextWindow,
    selectedModel.contextWindow,
    selectedModel.maxContextWindow,
    setAiContextWindow,
    setAiProgress,
    setAiProgressPercent,
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
    aiContextWindow,
    aiModel,
    selectedModel.maxContextWindow,
    setAiModel,
    autoLoadAiModel,
  ]);

  useEffect(() => {
    const handleLoadModel = () => {
      void activateModel(aiModel, aiContextWindow);
    };
    window.addEventListener('codexray:loadModel', handleLoadModel);
    return () => window.removeEventListener('codexray:loadModel', handleLoadModel);
  }, [activateModel, aiModel, aiContextWindow]);

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
              <div className={`settings-modal-content ${activeTab === 'ai' ? 'ai-settings-layout' : ''}`}>
                {activeTab === 'ai' && (
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
                      setAiStatus('idle');
                      setAiProgressPercent(null);
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
                <strong>v2.0.0</strong>
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
