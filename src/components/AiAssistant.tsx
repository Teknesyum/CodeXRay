import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Bot, Check, Copy, Crown, Loader, MapPin, Maximize2, Minimize2, Send, Trash2 } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestion, generateSimulationSteps } from '../services/aiService';
import { planLocalActions } from '../services/localAiService';
import type { AssistantMessage } from '../services/aiContext';
import {
  routeDeterministicCommand,
  validateActionPlan,
  resolveTimelineTarget,
  stripThinkBlock,
  type DeterministicWorkspaceCommand,
  type TimelineAction,
} from '../services/aiTimelineControl';
import { parseSimulationInput } from '../services/inputParsers';
import { resolveAlgorithmPresetById } from '../services/codeRegistry';
import { createInputPreset, getInputKindForAlgorithm } from '../services/inputPresets';
import { canonicalCustomTitle, routeGodModeRequest } from '../services/godModeRouting';
import {
  startGodModeRun,
  type GodModeRunHandle,
} from '../services/godModeOrchestrator';
import { dispatchGodModeUiAction } from '../services/godModeUiControl';
import { loadLatestGodModePlan, persistGodModePlan } from '../services/godModeRunStore';
import type { ManagerPlanV1, WorkspaceSnapshotV1 } from '../types/godMode';
import { t, translateRuntimeText } from '../i18n/translations';
import { GodModeProgress } from './GodModeProgress';
import { MarkdownPreview } from './MarkdownPreview';
import './AiAssistant.css';

const CHAT_STORAGE_KEY = 'codexray.ai-chat.v1';
const MAX_STORED_MESSAGES = 24;

const navigationExplanationPrompt = (
  originalQuestion: string,
  actions: DeterministicWorkspaceCommand[],
  targetIndex: number,
): string => {
  const actionTypes = actions.map(a => a.type).join(', ');
  return [
    `Original request: ${originalQuestion}`,
    `CodeXRay successfully applied these deterministic actions: [${actionTypes}].`,
    `The live simulation is at step ${targetIndex + 1}.`,
    'Explain the confirmed workspace state, current code line, changed variables, and visual state.',
    'Do not claim that any other workspace state changed.',
  ].join('\n');
};

const actionFailurePrompt = (originalQuestion: string, failure: string): string => [
  `Original request: ${originalQuestion}`,
  `CodeXRay could not apply the requested deterministic action: ${failure}`,
  'Explain the failure briefly without claiming that the workspace changed.',
].join('\n');

interface ActionExecutionResult {
  targetIndex: number;
  isPlaying: boolean;
  completedActions: DeterministicWorkspaceCommand[];
  failure: string | null;
}

const assertNever = (value: never): never => {
  throw new Error(`Unhandled deterministic action: ${JSON.stringify(value)}`);
};

const loadChatHistory = (): AssistantMessage[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((message): message is AssistantMessage =>
        Boolean(
          message
          && typeof message === 'object'
          && 'role' in message
          && (message.role === 'system' || message.role === 'user' || message.role === 'ai')
          && 'content' in message
          && typeof message.content === 'string',
        ))
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
};

interface AiAssistantProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const AiAssistant = ({ collapsed, onToggleCollapse }: AiAssistantProps) => {
  const {
    algorithmName,
    setAlgorithmName,
    code,
    steps,
    currentIndex,
    analysis,
    simulationInput,
    inputError,
    isPlaying,
    jumpTo,
    pause,
    play,
    setSpeed,
    pinnedVariables,
    selectedExampleQuestion,
    setSelectedExampleQuestion,
    aiStatus,
    aiContextWindow,
    isAiMaximized,
    setIsAiMaximized,
    locale,
    godModeEnabled,
    setGodModeEnabled,
    activeSimulationPackage,
    packageOutOfSync,
    applySimulationPackage,
    applyVisualPackageTransaction,
    applyInputTransaction,
    applyPresetTransaction,
    undoWorkspaceTransaction,
    redoWorkspaceTransaction,
    canUndoWorkspace,
    canRedoWorkspace,
    guidedMode,
    setGuidedMode,
    setTheme,
    requestRadioOpen,
  } = useTimeline();
  const currentStep = steps[currentIndex];
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<AssistantMessage[]>(loadChatHistory);
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState<string | null>(null);
  const [tourSteps, setTourSteps] = useState<number[]>([]);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);

  const [actionQueue, setActionQueue] = useState<DeterministicWorkspaceCommand[]>([]);
  const [isExecutingQueue, setIsExecutingQueue] = useState(false);
  const [isPlanningActions, setIsPlanningActions] = useState(false);
  const [currentActionText, setCurrentActionText] = useState<string>('');
  const [queueProgress, setQueueProgress] = useState(0);
  const [godModePlan, setGodModePlan] = useState<ManagerPlanV1 | null>(() => {
    const latest = loadLatestGodModePlan();
    return latest?.jobs.length && latest.jobs.every((job) => job.status === 'completed')
      ? null
      : latest;
  });
  const [lastGodModeRequest, setLastGodModeRequest] = useState<string | null>(null);

  const chatBodyRef = useRef<HTMLDivElement>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const godModeDismissTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const godModeRunRef = useRef<GodModeRunHandle | null>(null);
  const narratedCheckpointsRef = useRef(new Set<string>());
  const panelTitle = t('masterCoder', locale);

  const copyAiResponse = async (content: string, index: number) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        if (!copied) throw new Error('Clipboard copy was rejected.');
      }
      setCopiedMessageIndex(index);
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMessageIndex(null);
        copyResetTimerRef.current = null;
      }, 1800);
    } catch {
      // Clipboard access can be denied by browser permissions; keep the answer intact.
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      godModeRunRef.current?.cancel();
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
      if (godModeDismissTimerRef.current) window.clearTimeout(godModeDismissTimerRef.current);
    };
  }, []);

  const stateRef = useRef({
    code,
    simulationInput,
    algorithmName,
    steps,
    analysis,
    inputError,
    activeSimulationPackage,
    packageOutOfSync,
  });
  useEffect(() => {
    stateRef.current = {
      code,
      simulationInput,
      algorithmName,
      steps,
      analysis,
      inputError,
      activeSimulationPackage,
      packageOutOfSync,
    };
  }, [
    activeSimulationPackage,
    analysis,
    code,
    inputError,
    packageOutOfSync,
    simulationInput,
    algorithmName,
    steps,
  ]);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatHistory, analysis, currentStep, isTyping, actionQueue, currentActionText, typingMessage]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(chatHistory.slice(-MAX_STORED_MESSAGES)),
      );
    } catch {
      // Conversation memory remains available for this session when storage is unavailable.
    }
  }, [chatHistory]);

  const applyDeterministicActions = useCallback(async (
    actions: DeterministicWorkspaceCommand[],
  ): Promise<ActionExecutionResult> => {
    setActionQueue(actions);
    let targetIndex = currentIndex;
    let resultingIsPlaying = isPlaying;
    const completedActions: DeterministicWorkspaceCommand[] = [];
    let failure: string | null = null;

    try {
      for (let index = 0; index < actions.length; index += 1) {
        const action = actions[index];
        const actionLabel = action.type === 'load-preset'
          ? resolveAlgorithmPresetById(action.presetId)?.name
            ?? t('algorithmPreset', locale)
          : t(`aiAction_${action.type}`, locale);
        setCurrentActionText(t('aiActionExecuting', locale, { action: actionLabel }));
        setQueueProgress(Math.round((index / actions.length) * 100));
        await new Promise((resolve) => window.setTimeout(resolve, 180));

        switch (action.type) {
          case 'play':
            play();
            resultingIsPlaying = true;
            break;
          case 'pause':
            pause();
            resultingIsPlaying = false;
            break;
          case 'tour':
            setTourSteps(action.checkpoints);
            targetIndex = action.checkpoints[0] ?? targetIndex;
            jumpTo(targetIndex);
            break;
          case 'jump':
          case 'next':
          case 'previous':
          case 'next-important':
            targetIndex = resolveTimelineTarget(
              action,
              stateRef.current.steps,
              targetIndex,
            );
            jumpTo(targetIndex);
            break;
          case 'load-preset': {
            const preset = resolveAlgorithmPresetById(action.presetId);
            if (!preset) throw new Error(t('aiPresetNotFound', locale));

            const kind = getInputKindForAlgorithm(preset.name);
            const input = createInputPreset(kind, 1, preset.name);
            const validation = parseSimulationInput(
              kind,
              input.text,
              input.graph,
              input.parameters,
            );
            if (!validation.input) {
              throw new Error(validation.error ?? t('aiPresetLoadFailed', locale));
            }
            const newSteps = generateSimulationSteps(
              preset.name,
              preset.code,
              validation.input,
            );

            applyPresetTransaction({
              algorithmName: preset.name,
              code: preset.code,
              input,
              steps: newSteps,
              analysis: null,
            }, `preset-${preset.id}-${Date.now().toString(36)}`);
            stateRef.current = {
              algorithmName: preset.name,
              code: preset.code,
              simulationInput: input,
              steps: newSteps,
              analysis: null,
              inputError: null,
              activeSimulationPackage: null,
              packageOutOfSync: false,
            };
            targetIndex = 0;
            resultingIsPlaying = false;
            pause();
            break;
          }
          default:
            assertNever(action);
        }

        completedActions.push(action);
      }
      setQueueProgress(100);
      setCurrentActionText(t('aiActionCompleted', locale));
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    } catch (error) {
      failure = error instanceof Error ? error.message : t('aiActionFailed', locale);
      setCurrentActionText(t('aiActionFailed', locale));
      console.error('Failed to execute deterministic action:', error);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    } finally {
      if (mountedRef.current) {
        setActionQueue([]);
        setCurrentActionText('');
        setQueueProgress(0);
      }
    }

    return { targetIndex, isPlaying: resultingIsPlaying, completedActions, failure };
  }, [
    currentIndex, isPlaying, jumpTo, locale, pause, play,
    applyPresetTransaction,
  ]);

  const submitQuestion = useCallback(async (userMessage: string) => {
    if (isExecutingQueue) return;
    const history = [...chatHistory];
    setQuestion('');
    setChatHistory((previous) =>
      [...previous, { role: 'user' as const, content: userMessage }]
        .slice(-MAX_STORED_MESSAGES),
    );
    setIsTyping(true);

    try {
      const godModeIntent = godModeEnabled
        ? routeGodModeRequest(userMessage, stateRef.current.steps, currentIndex)
        : null;
      let actionsToExecute: DeterministicWorkspaceCommand[] | null =
        godModeIntent?.type === 'deterministic'
          ? godModeIntent.actions
          : routeDeterministicCommand(userMessage, stateRef.current.steps, currentIndex);
      let targetIndex = currentIndex;
      let workspaceIsPlaying = isPlaying;
      let modelQuestion = userMessage;

      if (godModeIntent?.type === 'ui-control') {
        const now = Date.now();
        const uiPlan: ManagerPlanV1 = {
          version: 1,
          runId: `gm-ui-${now.toString(36)}`,
          request: userMessage,
          intent: 'ui-control',
          createdAt: now,
          jobs: [
            {
              id: 'manager-route-ui-command',
              role: 'manager',
              label: 'Route UI command',
              dependsOn: [],
              weight: 35,
              status: 'completed',
              attempt: 1,
              maxAttempts: 1,
              startedAt: now,
              finishedAt: now,
            },
            {
              id: 'ui-director-apply-ui-command',
              role: 'ui-director',
              label: 'Apply typed UI command',
              dependsOn: ['manager-route-ui-command'],
              weight: 65,
              status: 'completed',
              attempt: 1,
              maxAttempts: 1,
              startedAt: now,
              finishedAt: now,
            },
          ],
        };
        setGodModePlan(uiPlan);
        persistGodModePlan(uiPlan);
        if (godModeIntent.command.startsWith('theme-')) {
          setTheme(godModeIntent.command.slice('theme-'.length) as 'neon' | 'dark' | 'light');
        } else if (godModeIntent.command === 'radio-open') {
          requestRadioOpen();
        } else if (godModeIntent.command === 'radio-play' || godModeIntent.command === 'radio-pause') {
          dispatchGodModeUiAction({
            type: 'set-radio-state',
            state: godModeIntent.command === 'radio-play' ? 'play' : 'pause',
          });
        } else {
          const layoutCommand = godModeIntent.command as
            | 'focus-code'
            | 'focus-simulation'
            | 'focus-assistant'
            | 'balanced';
          dispatchGodModeUiAction({
            type: 'set-workspace-layout',
            layout: layoutCommand,
          });
        }
        const content = locale === 'tr'
          ? 'Arayüz düzenini isteğine göre güncelledim.'
          : 'I updated the workspace layout as requested.';
        setChatHistory((previous) => [
          ...previous,
          { role: 'ai' as const, content },
        ].slice(-MAX_STORED_MESSAGES));
        return;
      }

      if (
        godModeIntent
        && godModeIntent.type !== 'deterministic'
      ) {
        if (godModeDismissTimerRef.current) {
          window.clearTimeout(godModeDismissTimerRef.current);
          godModeDismissTimerRef.current = null;
        }
        setLastGodModeRequest(userMessage);
        if (godModeIntent.type === 'discuss-current-step') pause();
        if (godModeIntent.type === 'create-algorithm') {
          const pendingTitle = canonicalCustomTitle(userMessage, locale);
          setAlgorithmName(pendingTitle);
          stateRef.current = { ...stateRef.current, algorithmName: pendingTitle };
        }
        const workspaceSnapshot: WorkspaceSnapshotV1 = {
          version: 1,
          algorithmName: stateRef.current.algorithmName,
          code: stateRef.current.code,
          simulationInput: stateRef.current.simulationInput,
          steps: stateRef.current.steps,
          currentIndex,
          analysis: stateRef.current.analysis,
          inputError: stateRef.current.inputError,
          activePackageId: stateRef.current.activeSimulationPackage?.id ?? null,
          packageOutOfSync: stateRef.current.packageOutOfSync,
        };
        const run = startGodModeRun({
          request: userMessage,
          intent: godModeIntent,
          locale,
          workspace: workspaceSnapshot,
          activePackage: stateRef.current.activeSimulationPackage,
          onPlan: (plan) => {
            persistGodModePlan(plan);
            if (!mountedRef.current) return;
            setGodModePlan(plan);
            const completed = plan.jobs.length > 0
              && plan.jobs.every((job) => job.status === 'completed');
            if (completed) {
              godModeDismissTimerRef.current = window.setTimeout(() => {
                setGodModePlan((current) => current?.runId === plan.runId ? null : current);
                godModeDismissTimerRef.current = null;
              }, 1_200);
            }
          },
          applyPackage: (value, runId) => {
            applySimulationPackage(value, runId);
            setTourSteps(value.checkpoints.map((checkpoint) => checkpoint.stepIndex));
            stateRef.current = {
              ...stateRef.current,
              algorithmName: value.title,
              code: value.source.code,
              simulationInput: value.input.value,
              steps: value.steps,
              analysis: value.analysis,
              inputError: null,
              activeSimulationPackage: value,
              packageOutOfSync: false,
            };
          },
          applyVisualPackage: (value, runId) => {
            applyVisualPackageTransaction(value, runId);
            stateRef.current = {
              ...stateRef.current,
              simulationInput: value.input.value,
              steps: value.steps,
              inputError: null,
              activeSimulationPackage: value,
              packageOutOfSync: false,
            };
          },
          applyInput: (input, generatedSteps, runId) => {
            applyInputTransaction(input, generatedSteps, runId);
            stateRef.current = {
              ...stateRef.current,
              simulationInput: input,
              steps: generatedSteps,
              inputError: null,
            };
          },
        });
        godModeRunRef.current = run;
        const result = await run.promise;
        godModeRunRef.current = null;
        if (!mountedRef.current) return;
        const content = result.tutorAnswer
          ? `${result.summary}\n\n${stripThinkBlock(result.tutorAnswer)}`
          : result.summary;
        setChatHistory((previous) => [
          ...previous,
          { role: 'ai' as const, content },
        ].slice(-MAX_STORED_MESSAGES));
        if (result.package?.teachingPlan.autoStart) {
          setSpeed(result.package.teachingPlan.suggestedSpeed);
          play();
        }
        return;
      }

      if (!actionsToExecute && aiStatus === 'ready') {
        setIsPlanningActions(true);
        try {
          const planJsonStr = await planLocalActions(userMessage, JSON.stringify({
            isPlaying,
            steps: stateRef.current.steps.length,
            currentIndex,
            locale,
          }));
          const parsed = JSON.parse(planJsonStr);
          const plannedActions: TimelineAction[] | null = validateActionPlan(
            parsed,
            stateRef.current.steps,
          );
          actionsToExecute = plannedActions;
        } catch (error) {
          console.error('Planner failed; continuing with conversation.', error);
        } finally {
          if (mountedRef.current) setIsPlanningActions(false);
        }
      }

      if (actionsToExecute && actionsToExecute.length > 0) {
        setIsExecutingQueue(true);
        const execution = await applyDeterministicActions(actionsToExecute);
        targetIndex = execution.targetIndex;
        workspaceIsPlaying = execution.isPlaying;
        modelQuestion = execution.failure
          ? actionFailurePrompt(userMessage, execution.failure)
          : navigationExplanationPrompt(
            userMessage,
            execution.completedActions,
            targetIndex,
          );
        if (aiStatus !== 'ready') {
          const content = execution.failure
            ? t('godModeActionFailed', locale, { error: execution.failure })
            : t('godModeActionApplied', locale);
          setChatHistory((previous) => [
            ...previous,
            { role: execution.failure ? 'system' as const : 'ai' as const, content },
          ].slice(-MAX_STORED_MESSAGES));
          return;
        }
      }

      if (!mountedRef.current) return;

      const workspace = {
        algorithmName: stateRef.current.algorithmName,
        code: stateRef.current.code,
        simulationInput: stateRef.current.simulationInput,
        steps: stateRef.current.steps,
        currentIndex: targetIndex,
        analysis: stateRef.current.analysis,
        inputError: stateRef.current.inputError,
        isPlaying: workspaceIsPlaying,
        pinnedVariables,
        contextWindow: aiContextWindow,
        locale,
      };

      setTypingMessage('');
      const answer = await askQuestion(modelQuestion, workspace, history);
      if (!mountedRef.current) return;

      const cleanedAnswer = stripThinkBlock(answer);

      let i = 0;
      while (i < cleanedAnswer.length) {
        if (!mountedRef.current) return;
        const chunkLength = Math.max(2, Math.floor(Math.random() * 8));
        const currentChunk = cleanedAnswer.slice(0, i + chunkLength);
        setTypingMessage(currentChunk);
        i += chunkLength;
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      setTypingMessage(null);
      setChatHistory((previous) =>
        [...previous, { role: 'ai' as const, content: cleanedAnswer }]
          .slice(-MAX_STORED_MESSAGES),
      );
    } catch (error) {
      if (!mountedRef.current) return;
      setChatHistory((previous) =>
        [...previous, {
          role: 'system' as const,
          content: translateRuntimeText(error instanceof Error ? error.message : 'The local model could not answer.', locale),
        }].slice(-MAX_STORED_MESSAGES),
      );
    } finally {
      if (mountedRef.current) {
        setIsPlanningActions(false);
        setIsTyping(false);
        setIsExecutingQueue(false);
      }
    }
  }, [
    chatHistory,
    currentIndex,
    isPlaying,
    pinnedVariables,
    aiStatus,
    aiContextWindow,
    locale,
    isExecutingQueue,
    applyDeterministicActions,
    applyInputTransaction,
    applySimulationPackage,
    applyVisualPackageTransaction,
    godModeEnabled,
    pause,
    play,
    requestRadioOpen,
    setTheme,
    setAlgorithmName,
    setSpeed,
  ]);

  useEffect(() => {
    if (!selectedExampleQuestion) return;
    if (aiStatus === 'ready' || godModeEnabled) void submitQuestion(selectedExampleQuestion);
    setSelectedExampleQuestion(null);
  }, [aiStatus, godModeEnabled, selectedExampleQuestion, setSelectedExampleQuestion, submitQuestion]);

  useEffect(() => {
    narratedCheckpointsRef.current.clear();
  }, [activeSimulationPackage?.id]);

  useEffect(() => {
    if (!guidedMode || isPlaying || !activeSimulationPackage) return;
    if (godModePlan?.jobs.some((job) => job.status === 'waiting' || job.status === 'running' || job.status === 'retrying')) return;
    const teachingCheckpoint = activeSimulationPackage.teachingPlan.checkpoints.find(
      ({ checkpoint }) => checkpoint.stepIndex === currentIndex,
    );
    if (!teachingCheckpoint) return;
    const key = `${activeSimulationPackage.id}:${currentIndex}`;
    if (narratedCheckpointsRef.current.has(key)) return;
    narratedCheckpointsRef.current.add(key);
    const { narration } = teachingCheckpoint;
    const labels = locale === 'tr'
      ? ['Kod', 'Veri', 'Görsel', 'Mantık', 'Zaman']
      : ['Code', 'Data', 'Visual', 'Reasoning', 'Time'];
    const content = [
      `${labels[0]}: ${narration.lenses.code}`,
      `${labels[1]}: ${narration.lenses.data}`,
      `${labels[2]}: ${narration.lenses.visual}`,
      `${labels[3]}: ${narration.lenses.reasoning}`,
      `${labels[4]}: ${narration.lenses.time}`,
      `${locale === 'tr' ? 'Değişmez koşul' : 'Invariant'}: ${narration.invariant}`,
      `${locale === 'tr' ? 'Sıradaki olası hareket' : 'Next possible move'}: ${narration.nextMove}`,
    ];
    if (currentIndex === activeSimulationPackage.steps.length - 1) {
      const result = activeSimulationPackage.teachingPlan.finalResult;
      content.push('', `${locale === 'tr' ? 'Final sonuç' : 'Final result'}: ${result.summary}`, result.correctness);
    }
    setChatHistory((previous) => [
      ...previous,
      { role: 'ai' as const, content: content.join('\n') },
    ].slice(-MAX_STORED_MESSAGES));
  }, [activeSimulationPackage, currentIndex, godModePlan, guidedMode, isPlaying, locale]);

  const systemMessage = translateRuntimeText(analysis
    ?? currentStep?.explanation
    ?? (aiStatus === 'ready'
      ? t('aiReadyPrompt', locale)
      : t('deterministicReady', locale)), locale);
  const conversationTurnCount = chatHistory.filter((message) => message.role !== 'system').length;
  const contextLabel = steps.length
    ? t('contextStep', locale, { current: currentIndex + 1, total: steps.length })
    : t('contextCodeOnly', locale);
  const isGodModeRunning = Boolean(godModePlan?.jobs.some((job) =>
    job.status === 'waiting' || job.status === 'running' || job.status === 'retrying'));

  if (collapsed) {
    return (
      <div className="ai-assistant">
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

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <Bot size={16} className="ai-icon" />
        <span>{panelTitle}</span>
        <span className="context-chip" title={t('contextHelp', locale)}>{contextLabel}</span>
        <button
          type="button"
          className={`god-mode-toggle ${godModeEnabled ? 'active' : ''}`}
          aria-pressed={godModeEnabled}
          aria-label={t(godModeEnabled ? 'godModeEnabled' : 'godModeDisabled', locale)}
          title={t(godModeEnabled ? 'godModeEnabled' : 'godModeDisabled', locale)}
          onClick={() => {
            if (godModeEnabled) godModeRunRef.current?.cancel();
            setGodModeEnabled(!godModeEnabled);
          }}
        >
          <Crown size={11} /> {t('godMode', locale)}
        </button>
        <button
          type="button"
          className={`god-mode-toggle ${guidedMode ? 'active' : ''}`}
          aria-pressed={guidedMode}
          aria-label={t(guidedMode ? 'guidedModeEnabled' : 'guidedModeDisabled', locale)}
          title={t(guidedMode ? 'guidedModeEnabled' : 'guidedModeDisabled', locale)}
          onClick={() => setGuidedMode(!guidedMode)}
        >
          <MapPin size={10} />
        </button>
        <span className={`local-status-dot ${aiStatus}`} title={`${t('localAi', locale)}: ${t(`status_${aiStatus}`, locale)}`} />
        <button
          type="button"
          className={`panel-action-btn maximize-btn neon-toggle ${isAiMaximized ? 'active' : ''}`}
          aria-label={isAiMaximized ? 'Minimize AI panel' : 'Maximize AI panel'}
          onClick={() => setIsAiMaximized(!isAiMaximized)}
          title={isAiMaximized ? 'Küçült' : 'Tam Ekran'}
        >
          {isAiMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button
          type="button"
          className="clear-chat-btn"
          aria-label={t('clearConversation', locale)}
          title={t('memoryCount', locale, { count: conversationTurnCount })}
          onClick={() => setChatHistory([])}
          disabled={conversationTurnCount === 0 || isTyping || actionQueue.length > 0}
        >
          <Trash2 size={13} />
        </button>
        <button
          type="button"
          className="panel-toggle"
          aria-label={t('collapsePanel', locale, { panel: panelTitle })}
          onClick={onToggleCollapse}
        >
          −
        </button>
      </div>

      {/* Progress for validated deterministic actions */}
      {actionQueue.length > 0 && (
        <div className="ai-action-queue">
          <div className="queue-status">
            <Activity size={14} className="pulse-icon" />
            <span>{currentActionText}</span>
          </div>
          <div className="queue-progress-bar">
            <div className="queue-progress-fill" style={{ width: `${queueProgress}%` }} />
          </div>
        </div>
      )}
      {godModePlan && (
        <GodModeProgress
          plan={godModePlan}
          locale={locale}
          onCancel={() => godModeRunRef.current?.cancel()}
          onUndo={undoWorkspaceTransaction}
          onRedo={redoWorkspaceTransaction}
          onRetry={() => {
            if (lastGodModeRequest && !isGodModeRunning) void submitQuestion(lastGodModeRequest);
          }}
          canUndo={canUndoWorkspace}
          canRedo={canRedoWorkspace}
        />
      )}

      <div className="ai-body" ref={chatBodyRef}>
        <div className="chat-message system-msg"><MarkdownPreview content={systemMessage} /></div>
        {chatHistory.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat-message ${message.role}-msg`}>
            {message.role === 'ai' && <Bot size={14} className="msg-icon" />}
            {message.role === 'user'
              ? <p>{message.content}</p>
              : <MarkdownPreview content={message.content} />}
            {message.role === 'ai' && (
              <button
                type="button"
                className={`copy-response-btn ${copiedMessageIndex === index ? 'copied' : ''}`}
                aria-label={t(copiedMessageIndex === index ? 'aiResponseCopied' : 'copyAiResponse', locale)}
                title={t(copiedMessageIndex === index ? 'aiResponseCopied' : 'copyAiResponse', locale)}
                onClick={() => void copyAiResponse(message.content, index)}
              >
                {copiedMessageIndex === index ? <Check size={13} /> : <Copy size={13} />}
              </button>
            )}
          </div>
        ))}
        {typingMessage !== null && (
          <div className="chat-message ai-msg">
            <Bot size={14} className="msg-icon" />
            <MarkdownPreview content={typingMessage} />
          </div>
        )}
        {isTyping && actionQueue.length === 0 && typingMessage === null && (
          <div className="chat-message ai-msg typing">
            <Loader size={14} className="spin-icon" />
            <p>{t(isPlanningActions ? 'aiPlanningActions' : 'thinkingLocally', locale)}</p>
          </div>
        )}
      </div>
      {tourSteps.length > 0 && (
        <nav className="ai-tour" aria-label={t('guidedTour', locale)}>
          <span><MapPin size={12} /> {t('keyMoments', locale)}</span>
          <div>
            {tourSteps.map((index) => (
              <button
                key={index}
                type="button"
                className={index === currentIndex ? 'active' : ''}
                aria-label={t('goToKeyMoment', locale, { step: index + 1 })}
                disabled={isTyping || (!godModeEnabled && aiStatus !== 'ready') || actionQueue.length > 0 || isGodModeRunning}
                onClick={() => void submitQuestion(
                  locale === 'tr'
                    ? `${index + 1}. adıma git ve bu önemli noktayı anlat`
                    : `Go to step ${index + 1} and explain this key moment`,
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </nav>
      )}
      <form
        className="ai-chat"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) void submitQuestion(question.trim());
        }}
      >
        <input
          type="text"
          maxLength={600}
          placeholder={aiStatus === 'ready' || godModeEnabled ? t('askPlaceholder', locale) : t('loadModelToChat', locale)}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={isTyping || (!godModeEnabled && aiStatus !== 'ready') || actionQueue.length > 0 || isGodModeRunning}
        />
        <button aria-label={t('sendQuestion', locale)} type="submit" className="send-btn" disabled={isTyping || (!godModeEnabled && aiStatus !== 'ready') || actionQueue.length > 0 || isGodModeRunning}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
