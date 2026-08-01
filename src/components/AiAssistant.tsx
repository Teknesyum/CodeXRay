import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Bot, Check, Copy, Crown, ExternalLink, Globe2, Loader, MapPin, Maximize2, Minimize2, Send, Square, Trash2, X } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestion, generateSimulationSteps } from '../services/aiService';
import { cancelLocalResponse, planLocalActions } from '../services/localAiService';
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
import { routeGodModeRequest, routeWebSourceRequest } from '../services/godModeRouting';
import {
  startGodModeRun,
  type GodModeRunHandle,
} from '../services/godModeOrchestrator';
import { dispatchGodModeUiAction } from '../services/godModeUiControl';
import { loadLatestGodModePlan, persistGodModePlan } from '../services/godModeRunStore';
import type { ManagerPlanV1, WorkspaceSnapshotV1 } from '../types/godMode';
import type { BoundWebSourceSessionV1, ManagerPlanV2, SolutionArtifactV1, WebProblemSpecV1 } from '../types/webSource';
import {
  clearBoundWebSource,
  extractFirstPublicHttpsUrl,
  loadBoundWebSource,
  normalizeWebProblem,
  readWebSource,
  saveBoundWebSource,
  buildWebProblemPrompt,
  WebSourceError,
} from '../services/webSource';
import type { JavaFallbackRun } from '../services/webProblemOrchestrator';
import { t, translateRuntimeText } from '../i18n/translations';
import { GodModeProgress } from './GodModeProgress';
import { MarkdownPreview } from './MarkdownPreview';
import './AiAssistant.css';

const CHAT_STORAGE_KEY = 'codexray.ai-chat.v1';
const MAX_STORED_MESSAGES = 24;

const webSourceErrorKey = (error: WebSourceError): string => {
  if (error.code === 'cancelled') return 'webReaderCancelled';
  if (error.code === 'timeout' || error.code === 'rate_limited' || error.retryable) return 'webReaderRetry';
  if (error.code === 'too_large' || error.code === 'unsupported_content_type' || error.code === 'dynamic_content_unsupported') return 'webReaderPaste';
  return 'webReaderFailed';
};

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
    code,
    setCode,
    setAlgorithmName,
    steps,
    setSteps,
    currentIndex,
    setCurrentIndex,
    analysis,
    setAnalysis,
    simulationInput,
    inputError,
    setInputError,
    isPlaying,
    jumpTo,
    pause,
    play,
    setSpeed,
    pinnedVariables,
    selectedExampleQuestion,
    setSelectedExampleQuestion,
    aiStatus,
    aiModel,
    aiContextWindow,
    isAiMaximized,
    setIsAiMaximized,
    locale,
    godModeEnabled,
    setGodModeEnabled,
    setIsGodModeTypingSource,
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
    if (!latest?.jobs.length) return null;
    return latest.jobs.some((job) => job.status === 'failed') ? latest : null;
  });
  const [lastGodModeRequest, setLastGodModeRequest] = useState<string | null>(null);
  const [webSourceSession, setWebSourceSession] = useState<BoundWebSourceSessionV1 | null>(loadBoundWebSource);
  const [webPlan, setWebPlan] = useState<ManagerPlanV2 | null>(null);

  const chatBodyRef = useRef<HTMLDivElement>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const godModeDismissTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const godModeRunRef = useRef<GodModeRunHandle | null>(null);
  const webRunRef = useRef<JavaFallbackRun | null>(null);
  const webFetchRef = useRef<AbortController | null>(null);
  const dismissedGodModeRunsRef = useRef(new Set<string>());
  const sourcePreviewRunRef = useRef<string | null>(null);
  const narratedCheckpointsRef = useRef(new Set<string>());
  const responseEpochRef = useRef(0);
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
      sourcePreviewRunRef.current = null;
      godModeRunRef.current?.cancel();
      webRunRef.current?.cancel();
      webFetchRef.current?.abort();
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
          case 'previous-important':
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
    const responseEpoch = ++responseEpochRef.current;
    const history = [...chatHistory];
    setQuestion('');
    setChatHistory((previous) =>
      [...previous, { role: 'user' as const, content: userMessage }]
        .slice(-MAX_STORED_MESSAGES),
    );
    setIsTyping(true);

    try {
      const webIntent = routeWebSourceRequest(userMessage, Boolean(webSourceSession));
      let activeWebSession = webSourceSession;
      let webProblemForSimulation: WebProblemSpecV1 | null = null;
      let modelQuestion = userMessage;

      if (webIntent?.type === 'read-web-source' || (webIntent?.type === 'solve-web-problem' && webIntent.url)) {
        if (!webIntent.url) throw new Error('The web source URL is missing.');
        const controller = new AbortController();
        webFetchRef.current = controller;
        const document = await readWebSource(webIntent.url, { signal: controller.signal });
        webFetchRef.current = null;
        const problem = normalizeWebProblem(document);
        activeWebSession = { version: 1, document, problem, solution: null };
        saveBoundWebSource(activeWebSession);
        setWebSourceSession(activeWebSession);
        if (webIntent.type === 'read-web-source') {
          setChatHistory((previous) => [
            ...previous,
            { role: 'ai' as const, content: `${t('webSourceReady', locale)}\n\n**${problem.title}**` },
          ].slice(-MAX_STORED_MESSAGES));
          return;
        }
      }

      if (webIntent?.type === 'solve-web-problem') {
        if (!activeWebSession) throw new Error('No bound web problem is available.');
        const { isWebProblemSolveCapable, startJavaFallbackRun } = await import('../services/webProblemOrchestrator');
        if (aiStatus !== 'ready' || !isWebProblemSolveCapable(aiModel)) {
          setChatHistory((previous) => [
            ...previous,
            { role: 'system' as const, content: t('webSolveModelRequired', locale) },
          ].slice(-MAX_STORED_MESSAGES));
          return;
        }
        if (!activeWebSession.problem.simulationCompatibility.compatible) {
          const run = startJavaFallbackRun({
            request: userMessage,
            problem: activeWebSession.problem,
            locale,
            modelId: aiModel,
            onPlan: (plan) => {
              if (mountedRef.current) setWebPlan(plan);
            },
          });
          webRunRef.current = run;
          setWebPlan(run.plan);
          const solution = await run.promise;
          webRunRef.current = null;
          if (!mountedRef.current || responseEpoch !== responseEpochRef.current) return;
          const nextSession = { ...activeWebSession, solution };
          saveBoundWebSource(nextSession);
          setWebSourceSession(nextSession);
          if (solution.kind !== 'unexecuted-java17') throw new Error('Unexpected web solution branch.');
          setChatHistory((previous) => [
            ...previous,
            {
              role: 'ai' as const,
              content: [
                `**${t('webJavaUnexecuted', locale)}**`,
                '',
                `### ${solution.title}`,
                '```java',
                solution.code,
                '```',
                solution.explanation,
                '',
                `Time: ${solution.complexity.time} · Space: ${solution.complexity.space}`,
              ].join('\n'),
            },
          ].slice(-MAX_STORED_MESSAGES));
          return;
        }
        webProblemForSimulation = activeWebSession.problem;
        modelQuestion = buildWebProblemPrompt(
          activeWebSession.problem,
          'Create, validate, compile, test, and visualize this algorithm in CodeXRay. Apply it only after every verification gate and critic pass.',
        );
      } else if (webIntent?.type === 'explain-bound-solution') {
        if (!activeWebSession?.solution) {
          setChatHistory((previous) => [
            ...previous,
            { role: 'system' as const, content: t('webSourceReady', locale) },
          ].slice(-MAX_STORED_MESSAGES));
          return;
        }
        if (aiStatus !== 'ready') {
          setChatHistory((previous) => [
            ...previous,
            { role: 'system' as const, content: t('webSolveModelRequired', locale) },
          ].slice(-MAX_STORED_MESSAGES));
          return;
        }
        modelQuestion = buildWebProblemPrompt(
          activeWebSession.problem,
          `Explain only the solution bound to source hash ${activeWebSession.solution.sourceHash} and problem hash ${activeWebSession.solution.problemHash}: ${JSON.stringify(activeWebSession.solution).slice(0, 10_000)}`,
        );
      }

      const godModeIntent = webProblemForSimulation
        ? routeGodModeRequest(
          modelQuestion,
          stateRef.current.steps,
          currentIndex,
          stateRef.current.algorithmName,
        )
        : godModeEnabled
        ? routeGodModeRequest(
          userMessage,
          stateRef.current.steps,
          currentIndex,
          stateRef.current.algorithmName,
        )
        : null;
      let actionsToExecute: DeterministicWorkspaceCommand[] | null =
        godModeIntent?.type === 'deterministic'
          ? godModeIntent.actions
          : routeDeterministicCommand(userMessage, stateRef.current.steps, currentIndex);
      let targetIndex = currentIndex;
      let workspaceIsPlaying = isPlaying;

      if (godModeIntent?.type === 'clarify-algorithm') {
        setChatHistory((previous) => [
          ...previous,
          { role: 'ai' as const, content: t('godModeClarifyAlgorithm', locale) },
        ].slice(-MAX_STORED_MESSAGES));
        return;
      }

      if (
        godModeIntent?.type === 'create-algorithm'
        && godModeIntent.template === 'bidirectional-bfs'
        && /(?:benim|bu|mevcut|current|my)\s+(?:graph|graf)/i.test(userMessage)
        && stateRef.current.simulationInput.graph
        && !stateRef.current.simulationInput.graph.targetId
      ) {
        setChatHistory((previous) => [
          ...previous,
          { role: 'ai' as const, content: t('godModeMissingGraphEndpoints', locale) },
        ].slice(-MAX_STORED_MESSAGES));
        return;
      }

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
            if (!mountedRef.current || dismissedGodModeRunsRef.current.has(plan.runId)) return;
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
          previewSource: async (draftCode, title, runId) => {
            if (webProblemForSimulation) return;
            if (!mountedRef.current || sourcePreviewRunRef.current !== runId) return;
            dispatchGodModeUiAction({ type: 'set-workspace-layout', layout: 'focus-code' });
            pause();
            setAlgorithmName(title);
            setSteps([]);
            setCurrentIndex(0);
            setAnalysis(null);
            setInputError(null);
            setCode('');
            const chunkSize = Math.max(2, Math.ceil(draftCode.length / 180));
            setIsGodModeTypingSource(true);
            try {
              for (let end = chunkSize; end < draftCode.length + chunkSize; end += chunkSize) {
                if (!mountedRef.current || sourcePreviewRunRef.current !== runId) return;
                setCode(draftCode.slice(0, Math.min(end, draftCode.length)));
                await new Promise((resolve) => window.setTimeout(resolve, 12));
              }
            } finally {
              if (mountedRef.current && sourcePreviewRunRef.current === runId) {
                setIsGodModeTypingSource(false);
              }
            }
          },
          applyPackage: (value, runId) => {
            applySimulationPackage(value, runId);
            dispatchGodModeUiAction({ type: 'set-workspace-layout', layout: 'balanced' });
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
        sourcePreviewRunRef.current = run.runId;
        const result = await run.promise;
        godModeRunRef.current = null;
        sourcePreviewRunRef.current = null;
        setIsGodModeTypingSource(false);
        if (!mountedRef.current) return;
        const content = result.tutorAnswer
          ? `${result.summary}\n\n${stripThinkBlock(result.tutorAnswer)}`
          : result.summary;
        if (webProblemForSimulation && result.package && activeWebSession) {
          const solution: SolutionArtifactV1 = {
            version: 1,
            kind: 'validated-simulation',
            sourceHash: webProblemForSimulation.sourceHash,
            problemHash: webProblemForSimulation.id,
            packageId: result.package.id,
            review: { passed: true, summary: result.summary, findings: [] },
          };
          const nextSession = { ...activeWebSession, solution };
          saveBoundWebSource(nextSession);
          setWebSourceSession(nextSession);
        }
        setChatHistory((previous) => [
          ...previous,
          {
            role: 'ai' as const,
            content: webProblemForSimulation
              ? `**${t('webValidatedSimulation', locale)}**\n\n${content}`
              : content,
          },
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
      if (!mountedRef.current || responseEpoch !== responseEpochRef.current) return;

      const cleanedAnswer = stripThinkBlock(answer);

      let i = 0;
      while (i < cleanedAnswer.length) {
        if (!mountedRef.current || responseEpoch !== responseEpochRef.current) return;
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
      sourcePreviewRunRef.current = null;
      godModeRunRef.current = null;
      webFetchRef.current = null;
      webRunRef.current = null;
      if (!mountedRef.current || responseEpoch !== responseEpochRef.current) return;
      setChatHistory((previous) =>
        [...previous, {
          role: 'system' as const,
          content: error instanceof WebSourceError
            ? t(webSourceErrorKey(error), locale)
            : translateRuntimeText(error instanceof Error ? error.message : 'The local model could not answer.', locale),
        }].slice(-MAX_STORED_MESSAGES),
      );
    } finally {
      if (mountedRef.current && responseEpoch === responseEpochRef.current) {
        setIsGodModeTypingSource(false);
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
    aiModel,
    aiContextWindow,
    locale,
    isExecutingQueue,
    applyDeterministicActions,
    applyInputTransaction,
    applySimulationPackage,
    applyVisualPackageTransaction,
    godModeEnabled,
    webSourceSession,
    pause,
    play,
    requestRadioOpen,
    setTheme,
    setSpeed,
    setCode,
    setAlgorithmName,
    setSteps,
    setCurrentIndex,
    setAnalysis,
    setInputError,
    setIsGodModeTypingSource,
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
  const isWebRunning = Boolean(webPlan?.jobs.some((job) =>
    job.status === 'waiting' || job.status === 'running' || job.status === 'retrying'));
  const canSubmitWithoutModel = Boolean(extractFirstPublicHttpsUrl(question) || webSourceSession);

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
            if (godModeEnabled) {
              sourcePreviewRunRef.current = null;
              godModeRunRef.current?.cancel();
            }
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
        <button
          type="button"
          className={`panel-action-btn maximize-btn neon-toggle ${isAiMaximized ? 'active' : ''}`}
          aria-label={t(isAiMaximized ? 'minimizeAiPanel' : 'maximizeAiPanel', locale)}
          onClick={() => setIsAiMaximized(!isAiMaximized)}
          title={t(isAiMaximized ? 'minimizeAiPanel' : 'maximizeAiPanel', locale)}
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

      {webSourceSession && (
        <section className="web-source-card" aria-label={t('webSourceTitle', locale)}>
          <Globe2 size={14} aria-hidden="true" />
          <div className="web-source-content">
            <strong>{webSourceSession.problem.title}</strong>
            <span>{new URL(webSourceSession.document.finalUrl).hostname} · {webSourceSession.document.provider}</span>
            <p>{webSourceSession.problem.description.slice(0, 260)}</p>
            {webSourceSession.document.truncated && <em>{t('webSourceTruncated', locale)}</em>}
            {webSourceSession.solution && (
              <b className={`web-solution-badge ${webSourceSession.solution.kind}`}>
                {t(webSourceSession.solution.kind === 'validated-simulation'
                  ? 'webValidatedSimulation'
                  : 'webJavaUnexecuted', locale)}
              </b>
            )}
          </div>
          <a
            href={webSourceSession.document.finalUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t('webSourceOriginal', locale)}
            title={t('webSourceOriginal', locale)}
          >
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            onClick={() => {
              clearBoundWebSource();
              setWebSourceSession(null);
              setWebPlan(null);
            }}
            aria-label={t('webSourceClear', locale)}
            title={t('webSourceClear', locale)}
          >
            <X size={13} />
          </button>
        </section>
      )}

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
          onCancel={() => {
            const dismissedPlan = godModePlan;
            if (dismissedPlan) dismissedGodModeRunsRef.current.add(dismissedPlan.runId);
            sourcePreviewRunRef.current = null;
            godModeRunRef.current?.cancel();
            godModeRunRef.current = null;
            if (dismissedPlan) {
              persistGodModePlan({
                ...dismissedPlan,
                jobs: dismissedPlan.jobs.map((job) =>
                  job.status === 'waiting' || job.status === 'running' || job.status === 'retrying'
                    ? { ...job, status: 'cancelled', error: undefined, finishedAt: Date.now() }
                    : job),
              });
            }
            setGodModePlan(null);
            setIsGodModeTypingSource(false);
            setIsPlanningActions(false);
            setIsExecutingQueue(false);
            setIsTyping(false);
          }}
          onUndo={undoWorkspaceTransaction}
          onRedo={redoWorkspaceTransaction}
          onRetry={() => {
            if (lastGodModeRequest && !isGodModeRunning) void submitQuestion(lastGodModeRequest);
          }}
          canUndo={canUndoWorkspace}
          canRedo={canRedoWorkspace}
        />
      )}
      {webPlan && (
        <GodModeProgress
          plan={webPlan}
          locale={locale}
          onCancel={() => {
            webRunRef.current?.cancel();
            webFetchRef.current?.abort();
            setWebPlan(null);
            setIsTyping(false);
          }}
          onUndo={undoWorkspaceTransaction}
          onRedo={redoWorkspaceTransaction}
          onRetry={() => {
            if (!isWebRunning) void submitQuestion(lastGodModeRequest ?? (locale === 'tr' ? 'Bu problemi çöz' : 'Solve this problem'));
          }}
          canUndo={false}
          canRedo={false}
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
                disabled={isTyping || (!godModeEnabled && aiStatus !== 'ready' && !canSubmitWithoutModel) || actionQueue.length > 0 || isGodModeRunning || isWebRunning}
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
          maxLength={2048}
          placeholder={aiStatus === 'ready' || godModeEnabled ? t('askPlaceholder', locale) : t('loadModelToChat', locale)}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={isTyping || (!godModeEnabled && aiStatus !== 'ready' && !canSubmitWithoutModel) || actionQueue.length > 0 || isGodModeRunning || isWebRunning}
        />
        {isTyping ? (
          <button
            aria-label={t('stopAiResponse', locale)}
            type="button"
            className="send-btn stop-response-btn"
            onClick={() => {
              responseEpochRef.current += 1;
              cancelLocalResponse();
              webFetchRef.current?.abort();
              webRunRef.current?.cancel();
              sourcePreviewRunRef.current = null;
              godModeRunRef.current?.cancel();
              setTypingMessage(null);
              setIsPlanningActions(false);
              setIsExecutingQueue(false);
              setIsTyping(false);
            }}
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button aria-label={t('sendQuestion', locale)} type="submit" className="send-btn" disabled={(!godModeEnabled && aiStatus !== 'ready' && !canSubmitWithoutModel) || actionQueue.length > 0 || isGodModeRunning || isWebRunning}>
            <Send size={14} />
          </button>
        )}
      </form>
    </div>
  );
};
