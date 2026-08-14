import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Bot, BrainCircuit, Check, ChevronDown, Copy, Crown, ExternalLink, Globe2, Loader, MapPin, Maximize2, Minimize2, Send, Square, Trash2, X } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestionDetailed, generateSimulationSteps } from '../services/aiService';
import { cancelLocalResponse, isDisposedLocalModelError, planLocalActions } from '../services/localAiService';
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
import { extractDpDimensions, requestsUniqueDpInput, routeGodModeRequest, routeWebSourceRequest } from '../services/godModeRouting';
import type { GodModeRunHandle } from '../services/godModeOrchestrator';
import { dispatchGodModeUiAction } from '../services/godModeUiControl';
import {
  clearGodModePlans,
  loadLatestGodModePlan,
  persistGodModePlan,
  removeGodModePlan,
} from '../services/godModeRunStore';
import type { ManagerPlanV1, WorkspaceSnapshotV1 } from '../types/titan';
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

const QuestionTaxonomyTree = lazy(() => import('./QuestionTaxonomyTree'));

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
      .slice(-MAX_STORED_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: message.content,
        ...(typeof message.reasoning === 'string' && message.reasoning.trim()
          ? { reasoning: message.reasoning.slice(0, 200_000) }
          : {}),
        ...(typeof message.reasoningTokens === 'number'
          ? { reasoningTokens: message.reasoningTokens }
          : {}),
        ...(typeof message.inferenceMs === 'number' ? { inferenceMs: message.inferenceMs } : {}),
      }));
  } catch {
    return [];
  }
};

interface AiAssistantProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface PendingDpSelection {
  request: string;
  rows: number;
  columns: number;
  uniqueInput: boolean;
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
    setAiStatus,
    setAiProgress,
    setAiProgressPercent,
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
  const [streamingResponse, setStreamingResponse] = useState<{
    reasoning: string;
    content: string;
  } | null>(null);
  const streamingResponseRef = useRef<{ reasoning: string; content: string } | null>(null);
  const streamFlushTimerRef = useRef<number | null>(null);
  const [tourSteps, setTourSteps] = useState<number[]>([]);
  const [copyStatus, setCopyStatus] = useState<{
    index: number;
    state: 'copied' | 'error';
  } | null>(null);

  const [actionQueue, setActionQueue] = useState<DeterministicWorkspaceCommand[]>([]);
  const [isExecutingQueue, setIsExecutingQueue] = useState(false);
  const [isPlanningActions, setIsPlanningActions] = useState(false);
  const [currentActionText, setCurrentActionText] = useState<string>('');
  const [queueProgress, setQueueProgress] = useState(0);
  const [godModePlan, setGodModePlan] = useState<ManagerPlanV1 | null>(() => {
    const latest = loadLatestGodModePlan();
    if (!latest?.jobs.length) return null;
    if (latest.jobs.some((job) => job.status === 'waiting' || job.status === 'running' || job.status === 'retrying')) {
      removeGodModePlan(latest.runId);
      return null;
    }
    return latest.jobs.some((job) => job.status === 'failed') ? latest : null;
  });
  const [lastGodModeRequest, setLastGodModeRequest] = useState<string | null>(null);
  const [webSourceSession, setWebSourceSession] = useState<BoundWebSourceSessionV1 | null>(loadBoundWebSource);
  const [webPlan, setWebPlan] = useState<ManagerPlanV2 | null>(null);
  const [pendingDpSelection, setPendingDpSelection] = useState<PendingDpSelection | null>(null);
  const [taxonomyView, setTaxonomyView] = useState<Awaited<ReturnType<typeof import('../services/questionTaxonomy').default>>>(null);

  const chatBodyRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const copyResetTimerRef = useRef<number | null>(null);
  const godModeDismissTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const godModeRunRef = useRef<GodModeRunHandle | null>(null);
  const webRunRef = useRef<JavaFallbackRun | null>(null);
  const webFetchRef = useRef<AbortController | null>(null);
  const dismissedGodModeRunsRef = useRef(new Set<string>());
  const sourcePreviewRunRef = useRef<string | null>(null);
  const sourcePreviewSnapshotRef = useRef<WorkspaceSnapshotV1 | null>(null);
  const selectedCatalogProblemRef = useRef<{ id: string; source: string; title: string } | null>(null);
  const narratedCheckpointsRef = useRef(new Set<string>());
  const responseEpochRef = useRef(0);
  const panelTitle = t('masterCoder', locale);

  const copyAiResponse = async (content: string, index: number) => {
    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(content);
          copied = true;
        } catch {
          // Some embedded browsers expose Clipboard API but deny its permission.
        }
      }
      if (!copied) {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        copied = document.execCommand?.('copy') ?? false;
        textarea.remove();
        if (!copied) throw new Error('Clipboard copy was rejected.');
      }
      setCopyStatus({ index, state: 'copied' });
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopyStatus(null);
        copyResetTimerRef.current = null;
      }, 1800);
    } catch {
      setCopyStatus({ index, state: 'error' });
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopyStatus(null);
        copyResetTimerRef.current = null;
      }, 2400);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelLocalResponse();
      sourcePreviewRunRef.current = null;
      godModeRunRef.current?.cancel();
      webRunRef.current?.cancel();
      webFetchRef.current?.abort();
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current);
      if (godModeDismissTimerRef.current) window.clearTimeout(godModeDismissTimerRef.current);
      if (streamFlushTimerRef.current) window.clearTimeout(streamFlushTimerRef.current);
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

  const restoreSourcePreview = useCallback(() => {
    const snapshot = sourcePreviewSnapshotRef.current;
    sourcePreviewSnapshotRef.current = null;
    if (!snapshot) return;
    pause();
    setAlgorithmName(snapshot.algorithmName);
    setCode(snapshot.code);
    setSteps(snapshot.steps);
    setCurrentIndex(snapshot.currentIndex);
    setAnalysis(snapshot.analysis);
    setInputError(snapshot.inputError);
    setIsGodModeTypingSource(false);
  }, [pause, setAlgorithmName, setAnalysis, setCode, setCurrentIndex, setInputError, setIsGodModeTypingSource, setSteps]);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (chatBody && shouldAutoScrollRef.current) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  }, [chatHistory, analysis, currentStep, isTyping, actionQueue, currentActionText, streamingResponse]);

  const handleChatScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const chatBody = event.currentTarget;
    const distanceFromBottom = chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom <= 32;
  }, []);

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
            const newSteps = await generateSimulationSteps(
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

  const submitQuestion = useCallback(async (userMessage: string | any) => {
    if (isExecutingQueue) return;
    const responseEpoch = ++responseEpochRef.current;
    const history = [...chatHistory];
    const selectedCatalogProblem = selectedCatalogProblemRef.current;
    selectedCatalogProblemRef.current = null;
    const selectedTitle = selectedCatalogProblem?.title ?? '';
    const includesSelectedTitle = userMessage.toLocaleLowerCase().includes(selectedTitle.toLocaleLowerCase());
    const catalogSimulationRequest = selectedCatalogProblem
      && includesSelectedTitle
      && (userMessage.trim().localeCompare(selectedTitle, undefined, { sensitivity: 'base' }) === 0
        || /sim(?:ü|u)le|simulation|simulate|çöz|coz|çalıştır|calistir|run/i.test(userMessage))
      ? `Create catalog problem: ${selectedCatalogProblem.source}/${selectedCatalogProblem.id}`
      : userMessage;
    const selectedCatalogIntent = catalogSimulationRequest !== userMessage
      ? routeGodModeRequest(catalogSimulationRequest, stateRef.current.steps, currentIndex, stateRef.current.algorithmName)
      : null;
    setQuestion('');
    setChatHistory((previous) =>
      [...previous, { role: 'user' as const, content: userMessage }]
        .slice(-MAX_STORED_MESSAGES),
    );
    setIsTyping(true);
    setStreamingResponse(null);
    streamingResponseRef.current = null;

    try {
      const taxonomyAnswer = await (await import('../services/questionTaxonomy')).default(userMessage, locale);
      if (taxonomyAnswer) {
        setTaxonomyView(taxonomyAnswer);
        setChatHistory((previous) => [
          ...previous,
          { role: 'ai' as const, content: taxonomyAnswer.content },
        ].slice(-MAX_STORED_MESSAGES));
        return;
      }
      const webIntent = routeWebSourceRequest(userMessage, Boolean(webSourceSession));
      let activeWebSession = webSourceSession;
      let webProblemForSimulation: WebProblemSpecV1 | null = null;
      let modelQuestion = userMessage;
      let historyForModel = history;

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
                `**${t('webCriticReview', locale)}:** ${solution.review.summary}`,
                '',
                `Time: \`${solution.complexity.time}\` · Space: \`${solution.complexity.space}\``,
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
        const boundSolutionSummary = activeWebSession.solution.kind === 'unexecuted-java17'
          ? [
              `Source title: ${activeWebSession.problem.title}`,
              'Validated Java 17 candidate:',
              activeWebSession.solution.code.slice(0, 8_000),
              `Complexity: time ${activeWebSession.solution.complexity.time}; space ${activeWebSession.solution.complexity.space}`,
              `Correctness review: ${activeWebSession.solution.review.summary}`,
            ]
          : [
              `Validated simulation package: ${activeWebSession.solution.packageId}`,
              `Correctness review: ${activeWebSession.solution.review.summary}`,
            ];
        modelQuestion = [
          locale === 'tr'
            ? 'Bağlı çözümü Türkçe anlat: en fazla 4 kısa adım, “Doğruluk:” ve “Karmaşıklık:”. Metni tekrarlama veya bilgi uydurma.'
            : 'Explain the bound solution in at most 4 short steps, then “Correctness:” and “Complexity:”. Do not repeat or invent.',
          `User follow-up: ${userMessage.slice(0, 1_500)}`,
          ...boundSolutionSummary,
        ].join('\n');
        historyForModel = [];
      }

      let godModeIntent = webProblemForSimulation
        ? routeGodModeRequest(
          modelQuestion,
          stateRef.current.steps,
          currentIndex,
          stateRef.current.algorithmName,
        )
        : selectedCatalogIntent ?? (godModeEnabled
        ? routeGodModeRequest(
          catalogSimulationRequest,
          stateRef.current.steps,
          currentIndex,
          stateRef.current.algorithmName,
        )
        : null);
      let godModeRequest = userMessage;

      if (godModeIntent?.type === 'create-catalog-problem' && selectedCatalogProblem) {
        const { preflightCatalogProblem } = await import('../services/godModeEntry');
        const support = await preflightCatalogProblem(
          selectedCatalogProblem.source,
          selectedCatalogProblem.id,
          selectedCatalogProblem.title,
          locale,
        );
        if (!support.exact) {
          godModeIntent = { type: 'create-algorithm', template: 'model-authored' };
          godModeRequest = support.request;
        }
      }
      let actionsToExecute: DeterministicWorkspaceCommand[] | null =
        godModeIntent?.type === 'deterministic'
          ? godModeIntent.actions
          : routeDeterministicCommand(userMessage, stateRef.current.steps, currentIndex);
      let targetIndex = currentIndex;
      let workspaceIsPlaying = isPlaying;

      if (godModeIntent?.type === 'clarify-algorithm') {
        const dimensions = extractDpDimensions(userMessage) ?? { rows: 6, columns: 11 };
        setPendingDpSelection({
          request: userMessage,
          ...dimensions,
          uniqueInput: requestsUniqueDpInput(userMessage),
        });
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
        setLastGodModeRequest(godModeRequest);
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
        const { startGodModeRun } = await import('../services/godModeEntry');
        sourcePreviewSnapshotRef.current = workspaceSnapshot;
        const run = startGodModeRun({
          request: godModeRequest,
          intent: godModeIntent,
          locale,
          workspace: workspaceSnapshot,
          activePackage: stateRef.current.activeSimulationPackage,
          contextWindow: aiContextWindow,
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
            sourcePreviewSnapshotRef.current = null;
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
            sourcePreviewSnapshotRef.current = null;
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
            sourcePreviewSnapshotRef.current = null;
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
        const content = (result as any).tutorAnswer
          ? `${(result as any).summary}\n\n${stripThinkBlock((result as any).tutorAnswer)}`
          : (result as any).summary;
        if (webProblemForSimulation && (result as any).package && activeWebSession) {
          const solution: SolutionArtifactV1 = {
            version: 1,
            kind: 'validated-simulation',
            sourceHash: webProblemForSimulation.sourceHash,
            problemHash: webProblemForSimulation.id,
            packageId: (result as any).package.id,
            review: { passed: true, summary: (result as any).summary, findings: [] },
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
        if ((result as any).package?.teachingPlan.autoStart) {
          setSpeed((result as any).package.teachingPlan.suggestedSpeed);
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

      const answer = await askQuestionDetailed(modelQuestion, workspace, historyForModel, (update) => {
        if (!mountedRef.current || responseEpoch !== responseEpochRef.current || !update.delta) return;
        const current = streamingResponseRef.current ?? { reasoning: '', content: '' };
        streamingResponseRef.current = update.type === 'reasoning'
          ? { ...current, reasoning: `${current.reasoning}${update.delta}`.slice(0, 200_000) }
          : { ...current, content: `${current.content}${update.delta}`.slice(0, 200_000) };
        if (streamFlushTimerRef.current === null) {
          streamFlushTimerRef.current = window.setTimeout(() => {
            streamFlushTimerRef.current = null;
            if (mountedRef.current && responseEpoch === responseEpochRef.current) {
              setStreamingResponse(streamingResponseRef.current);
            }
          }, 32);
        }
      });
      if (!mountedRef.current || responseEpoch !== responseEpochRef.current) return;

      const cleanedAnswer = stripThinkBlock(answer.content);
      const guidedTaxonomy = await (await import('../services/questionTaxonomy')).default(`${userMessage}\n${cleanedAnswer}`, locale);
      if (guidedTaxonomy?.selectedNodeId) setTaxonomyView(guidedTaxonomy);

      setChatHistory((previous) =>
        [...previous, {
          role: 'ai' as const,
          content: cleanedAnswer,
          reasoning: answer.reasoning,
          reasoningTokens: answer.reasoningTokens,
          inferenceMs: answer.inferenceMs,
        }]
          .slice(-MAX_STORED_MESSAGES),
      );
    } catch (error) {
      restoreSourcePreview();
      sourcePreviewRunRef.current = null;
      godModeRunRef.current = null;
      webFetchRef.current = null;
      webRunRef.current = null;
      if (!mountedRef.current || responseEpoch !== responseEpochRef.current) return;
      const disposedModel = isDisposedLocalModelError(error);
      if (disposedModel) {
        setAiStatus('idle');
        setAiProgressPercent(null);
        setAiProgress(t('modelSessionExpired', locale));
      }
      setChatHistory((previous) =>
        [...previous, {
          role: 'system' as const,
          content: disposedModel
            ? t('modelSessionExpired', locale)
            : error instanceof WebSourceError
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
        if (streamFlushTimerRef.current) window.clearTimeout(streamFlushTimerRef.current);
        streamFlushTimerRef.current = null;
        streamingResponseRef.current = null;
        setStreamingResponse(null);
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
    setAiProgress,
    setAiProgressPercent,
    setAiStatus,
    setSpeed,
    setCode,
    setAlgorithmName,
    setSteps,
    setCurrentIndex,
    setAnalysis,
    setInputError,
    setIsGodModeTypingSource,
    restoreSourcePreview,
  ]);

  const chooseDpPath = useCallback((choice: 'lcs' | 'edit' | 'knapsack' | 'random' | 'unique' | 'own') => {
    const pending = pendingDpSelection;
    if (!pending) return;
    if (choice === 'own') {
      setPendingDpSelection(null);
      setQuestion(locale === 'tr'
        ? '2D DP problemimin amacı, inputu ve beklenen çıktısı: '
        : 'Goal, input, and expected output of my 2D DP problem: ');
      return;
    }
    const selected = choice === 'random'
      ? (['lcs', 'edit', 'knapsack'] as const)[Math.floor(Math.random() * 3)]
      : choice;
    const salt = pending.uniqueInput
      ? Math.floor(Date.now() + Math.random() * 1_000_000)
      : 0;
    const makeText = (length: number, offset: number) => Array.from({ length }, (_, index) =>
      String.fromCharCode(97 + ((index * 11 + offset + salt) % 26))).join('');
    const first = makeText(pending.rows, 3);
    const second = makeText(pending.columns, 7);
    const weights = Array.from({ length: pending.rows }, (_, index) =>
      1 + ((index * 5 + salt) % Math.max(2, Math.min(9, pending.columns))));
    const values = weights.map((weight, index) => weight + 1 + ((index * 7 + salt) % 13));
    const inputOrigin = pending.uniqueInput ? 'Kullanıcının istediği benzersiz inputu yerel olarak üret;' : '';
    const commands = {
      lcs: `LCS 2D DP hazır şablonunu kullan. ${inputOrigin} Input metinleri "${first}" ve "${second}" olsun; uzunluklar ${pending.rows}x${pending.columns}. Deterministik simülasyonu oluştur.`,
      edit: `Edit Distance 2D DP hazır şablonunu kullan. ${inputOrigin} Input metinleri "${first}" ve "${second}" olsun; uzunluklar ${pending.rows}x${pending.columns}. Deterministik simülasyonu oluştur.`,
      knapsack: `0/1 Knapsack 2D DP hazır şablonunu kullan. ${inputOrigin} ${pending.rows} öğe için ağırlıklar ${JSON.stringify(weights)}, değerler ${JSON.stringify(values)}, kapasite ${pending.columns} olsun. Deterministik simülasyonu oluştur.`,
      unique: `Özgün model-authored 2D DP sorusu yaz, çöz ve simüle et. Kullanıcının ${pending.rows}x${pending.columns} boyut isteğini kesin sözleşme kabul et. Hazır veya varsayılan input önerme; bu boyutlarda yeni ve doğrulanabilir input üret.`,
    } as const;
    setPendingDpSelection(null);
    void submitQuestion(commands[selected]);
  }, [locale, pendingDpSelection, submitQuestion]);

  useEffect(() => {
    const handleGodModeUserMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      if (customEvent.detail?.text) {
        submitQuestion(customEvent.detail.text);
      }
    };
    window.addEventListener('god-mode-user-message', handleGodModeUserMessage);
    return () => window.removeEventListener('god-mode-user-message', handleGodModeUserMessage);
  }, [submitQuestion]);


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
      content.push('', `${locale === 'tr' ? 'Final sonuç' : 'Final result'}: ${(result as any).summary}`, result.correctness);
    }
    setChatHistory((previous) => [
      ...previous,
      { role: 'ai' as const, content: content.join('\n') },
    ].slice(-MAX_STORED_MESSAGES));
  }, [activeSimulationPackage, currentIndex, godModePlan, guidedMode, isPlaying, locale]);

  const systemMessage = translateRuntimeText(currentStep?.explanation
    ?? (aiStatus === 'ready'
      ? t('aiReadyPrompt', locale)
      : t('deterministicReady', locale)), locale);
  const analysisEntries = (analysis ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      return separator > 0
        ? { label: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() }
        : { label: '', value: line };
    });
  const conversationTurnCount = chatHistory.filter((message) => message.role !== 'system').length;
  const contextLabel = steps.length
    ? t('contextStep', locale, { current: currentIndex + 1, total: steps.length })
    : t('contextCodeOnly', locale);
  const isGodModeRunning = Boolean(godModePlan?.jobs.some((job) =>
    job.status === 'waiting' || job.status === 'running' || job.status === 'retrying'));
  const isWebRunning = Boolean(webPlan?.jobs.some((job) =>
    job.status === 'waiting' || job.status === 'running' || job.status === 'retrying'));
  const canSubmitWithoutModel = Boolean(extractFirstPublicHttpsUrl(question) || webSourceSession);
  const dismissGodModePlan = () => {
    if (godModeDismissTimerRef.current) {
      window.clearTimeout(godModeDismissTimerRef.current);
      godModeDismissTimerRef.current = null;
    }
    if (godModePlan) {
      dismissedGodModeRunsRef.current.add(godModePlan.runId);
      removeGodModePlan(godModePlan.runId);
    }
    setGodModePlan(null);
  };
  const clearConversationAndRuns = () => {
    setChatHistory([]);
    setQuestion('');
    setTaxonomyView(null);
    setPendingDpSelection(null);
    setAnalysis(null);
    setTourSteps([]);
    setLastGodModeRequest(null);
    dismissGodModePlan();
    clearGodModePlans();
    setWebPlan(null);
  };

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
              restoreSourcePreview();
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
          title={analysis && conversationTurnCount === 0
            ? t('clearAnalysis', locale)
            : t('memoryCount', locale, { count: conversationTurnCount })}
          onClick={clearConversationAndRuns}
          disabled={(conversationTurnCount === 0 && !godModePlan && !webPlan && !analysis && !taxonomyView && !pendingDpSelection)
            || isTyping || actionQueue.length > 0 || isGodModeRunning || isWebRunning}
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
            restoreSourcePreview();
            godModeRunRef.current = null;
            if (dismissedPlan) {
              persistGodModePlan({
                ...dismissedPlan,
                jobs: dismissedPlan.jobs.map((job) =>
                  job.status === 'waiting' || job.status === 'running' || job.status === 'retrying'
                    ? { ...job, status: 'cancelled', error: undefined, finishedAt: Date.now() }
                    : job),
              });
              removeGodModePlan(dismissedPlan.runId);
            }
            setGodModePlan(null);
            setIsGodModeTypingSource(false);
            setIsPlanningActions(false);
            setIsExecutingQueue(false);
            setIsTyping(false);
          }}
          onDismiss={dismissGodModePlan}
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
          onDismiss={() => setWebPlan(null)}
          onUndo={undoWorkspaceTransaction}
          onRedo={redoWorkspaceTransaction}
          onRetry={() => {
            if (!isWebRunning) void submitQuestion(lastGodModeRequest ?? (locale === 'tr' ? 'Bu problemi çöz' : 'Solve this problem'));
          }}
          canUndo={false}
          canRedo={false}
        />
      )}

      <div className="ai-body" ref={chatBodyRef} onScroll={handleChatScroll}>
        {analysis && (
          <section className="analysis-outline" aria-label={t('algorithmAnalysis', locale)}>
            <header>
              <Activity size={13} aria-hidden="true" />
              <strong>{t('algorithmAnalysis', locale)}</strong>
              <button
                type="button"
                onClick={() => setAnalysis(null)}
                aria-label={t('clearAnalysis', locale)}
                title={t('clearAnalysis', locale)}
              >
                <X size={12} />
              </button>
            </header>
            <div className="analysis-outline-body">
              {analysisEntries.map((entry, index) => (
                <div className="analysis-outline-row" key={`${entry.label}-${index}`}>
                  {entry.label && <span>{translateRuntimeText(entry.label, locale)}</span>}
                  <p>{translateRuntimeText(entry.value, locale)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="chat-message system-msg"><MarkdownPreview content={systemMessage} /></div>
        {chatHistory.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat-message ${message.role}-msg`}>
            {message.role === 'ai' && <Bot size={14} className="msg-icon" />}
            {message.role === 'user'
              ? <p>{message.content}</p>
              : (
                <div className="ai-message-content">
                  {message.role === 'ai' && message.reasoning && (
                    <details className="reasoning-disclosure">
                      <summary>
                        <span className="reasoning-title">
                          <BrainCircuit size={14} aria-hidden="true" />
                          {t('modelReasoning', locale)}
                        </span>
                        <span className="reasoning-meta">
                          {message.reasoningTokens
                            ? t('reasoningTokenCount', locale, { count: message.reasoningTokens })
                            : message.inferenceMs
                              ? t('reasoningDuration', locale, { seconds: (message.inferenceMs / 1000).toFixed(1) })
                              : ''}
                          <ChevronDown size={14} aria-hidden="true" />
                        </span>
                      </summary>
                      <div className="reasoning-body">
                        <MarkdownPreview content={message.reasoning} />
                      </div>
                    </details>
                  )}
                  <MarkdownPreview content={message.content} />
                </div>
              )}
            {message.role === 'ai' && (
              <button
                type="button"
                className={`copy-response-btn ${copyStatus?.index === index ? copyStatus.state : ''}`}
                aria-label={t(copyStatus?.index === index
                  ? copyStatus.state === 'copied' ? 'aiResponseCopied' : 'aiResponseCopyFailed'
                  : 'copyAiResponse', locale)}
                title={t(copyStatus?.index === index
                  ? copyStatus.state === 'copied' ? 'aiResponseCopied' : 'aiResponseCopyFailed'
                  : 'copyAiResponse', locale)}
                onClick={() => void copyAiResponse(message.content, index)}
              >
                {copyStatus?.index === index && copyStatus.state === 'copied'
                  ? <Check size={13} />
                  : <Copy size={13} />}
              </button>
            )}
            {message.role === 'ai' && copyStatus?.index === index && (
              <span className={`copy-response-feedback ${copyStatus.state}`} role="status">
                {t(copyStatus.state === 'copied' ? 'aiResponseCopied' : 'aiResponseCopyFailed', locale)}
              </span>
            )}
          </div>
        ))}
        {pendingDpSelection && (
          <section className="dp-choice-panel" aria-label={t('dpChoiceTitle', locale)}>
            <strong>{t('dpChoiceTitle', locale)}</strong>
            <span>{t('dpChoiceDimensions', locale, {
              rows: pendingDpSelection.rows,
              columns: pendingDpSelection.columns,
            })}</span>
            <div className="dp-choice-actions">
              <button type="button" onClick={() => chooseDpPath('lcs')}>{t('dpChoiceLcs', locale)}</button>
              <button type="button" onClick={() => chooseDpPath('edit')}>{t('dpChoiceEditDistance', locale)}</button>
              <button type="button" onClick={() => chooseDpPath('knapsack')}>{t('dpChoiceKnapsack', locale)}</button>
              <button type="button" onClick={() => chooseDpPath('random')}>{t('dpChoiceRandom', locale)}</button>
              <button type="button" onClick={() => chooseDpPath('unique')}>{t('dpChoiceUnique', locale)}</button>
              <button type="button" onClick={() => chooseDpPath('own')}>{t('dpChoiceOwn', locale)}</button>
            </div>
          </section>
        )}
        {taxonomyView && (
          <Suspense fallback={<p><Loader size={14} className="spin-icon" /></p>}>
            <QuestionTaxonomyTree
              key={taxonomyView.selectedNodeId ?? 'root'}
              groups={taxonomyView.groups}
              initialNodeId={taxonomyView.selectedNodeId}
              locale={locale}
              onProblemSelect={(problem) => {
                selectedCatalogProblemRef.current = problem;
                setQuestion(problem.title);
              }}
            />
          </Suspense>
        )}
        {isTyping && actionQueue.length === 0 && (
          <div className={`chat-message ai-msg typing ${streamingResponse ? 'live-stream' : ''}`}>
            <Bot size={14} className="msg-icon" />
            {streamingResponse ? (
              <div className="ai-message-content">
                {streamingResponse.reasoning && (
                  <details className="reasoning-disclosure live" open>
                    <summary>
                      <span className="reasoning-title">
                        <BrainCircuit size={14} aria-hidden="true" />
                        {t('modelReasoning', locale)}
                        <span className="live-thinking-dot" aria-label={t('reasoningStreaming', locale)} />
                      </span>
                      <span className="reasoning-meta">
                        {t('live', locale)}
                        <ChevronDown size={14} aria-hidden="true" />
                      </span>
                    </summary>
                    <div className="reasoning-body live-body">
                      <MarkdownPreview content={streamingResponse.reasoning} />
                      <span className="stream-caret" aria-hidden="true" />
                    </div>
                  </details>
                )}
                {streamingResponse.content
                  ? (
                    <div className="streaming-answer" aria-label={t('answerStreaming', locale)}>
                      <MarkdownPreview content={streamingResponse.content} />
                      <span className="stream-caret" aria-hidden="true" />
                    </div>
                  )
                  : !streamingResponse.reasoning && (
                    <p><Loader size={14} className="spin-icon" /> {t('thinkingLocally', locale)}</p>
                  )}
              </div>
            ) : (
              <p><Loader size={14} className="spin-icon" /> {t(isPlanningActions ? 'aiPlanningActions' : 'thinkingLocally', locale)}</p>
            )}
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
          onChange={(event) => {
            const next = event.target.value;
            if (selectedCatalogProblemRef.current && !next.startsWith(selectedCatalogProblemRef.current.title)) {
              selectedCatalogProblemRef.current = null;
            }
            setQuestion(next);
          }}
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
              restoreSourcePreview();
              setIsPlanningActions(false);
              setIsExecutingQueue(false);
              setIsTyping(false);
              if (streamFlushTimerRef.current) window.clearTimeout(streamFlushTimerRef.current);
              streamFlushTimerRef.current = null;
              streamingResponseRef.current = null;
              setStreamingResponse(null);
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
