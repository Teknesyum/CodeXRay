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
    radioPlaylistId,
    setRadioPlaylistId,
    radioAutoplay,
    setRadioAutoplay,
    locale,
    theme,
    setTheme,
  } = useTimeline();
  const [showSettings, setShowSettings] = useState(false);
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
                <h2>{t('settings', locale)}</h2>
                <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
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
              <div className="settings-modal-content">
                {activeTab === 'ai' && (
                  <>
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
                )}
                {activeTab === 'radio' && (
                  <>
                    <div className="settings-section">
                      <div className="settings-title">{t('radioAutoplay', locale)}</div>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={radioAutoplay}
                          onChange={(e) => setRadioAutoplay(e.target.checked)}
                        />
                        <span>{t('radioAutoplay', locale)}</span>
                      </label>
                    </div>
                    <div className="settings-section">
                      <div className="settings-title">{t('radioCustomPlaylist', locale)}</div>
                      <input
                        type="text"
                        className="custom-playlist-input"
                        value={radioPlaylistId}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const listMatch = val.match(/[?&]list=([^&]+)/);
                          setRadioPlaylistId(listMatch ? listMatch[1] : val);
                        }}
                        placeholder="e.g. OLAK5uy_koji..."
                      />
                    </div>
                    <div className="settings-section">
                      <div className="settings-title">{t('radioPresets', locale)}</div>
                      <div className="playlist-presets">
                        <button 
                          className="action-btn"
                          onClick={() => setRadioPlaylistId('OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0')}
                        >
                          Up Cdk (Varsayılan)
                        </button>
                        <button 
                          className="action-btn"
                          onClick={() => setRadioPlaylistId('RDCLAK5uy_m5ENJ7vW7WpI0q3C3jT2g2L-0w_x4eC7s')}
                        >
                          Coding Focus
                        </button>
                        <button 
                          className="action-btn"
                          onClick={() => setRadioPlaylistId('RDCLAK5uy_kQh-E5X44l2b_H7R7sE3h_qP9T-bT9U9A')}
                        >
                          Synthwave
                        </button>
                        <button 
                          className="action-btn"
                          onClick={() => setRadioPlaylistId('RDCLAK5uy_n5XFdzqO0r_B3X5F0uO8S_r7g9O2n5L-8')}
                          >
                          Lofi Hip Hop
                        </button>
                        <button 
                          className="action-btn"
                          onClick={() => setRadioPlaylistId('RDCLAK5uy_k1zN6k3cT_F3t2p4M1J8L5K1h_w9x9y3k')}
                        >
                          Classical Focus
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                  CodeXRay v1.1.0
                </div>
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
