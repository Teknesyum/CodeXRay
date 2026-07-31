import {
  CreateMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
  prebuiltAppConfig,
} from '@mlc-ai/web-llm';
import type {
  ChatCompletionMessageParam,
  InitProgressReport,
  MLCEngine,
} from '@mlc-ai/web-llm';
import type { Locale } from '../i18n/translations';
import { buildPlannerInstructions, buildTutorInstructions } from '../services/aiContext';
import type { AssistantMessage } from '../services/aiContext';
import { buildPlannerCompletionOptions } from '../services/aiPlanner';
import { getLocalAiModelDefinition } from '../services/localAiModels';
import type { GodModeAgentRole } from '../types/godMode';

interface InitializeMessage {
  id: number;
  type: 'initialize';
  model: string;
  contextWindow: number;
}

interface PlanMessage {
  id: number;
  type: 'plan';
  question: string;
  context: string;
}

interface GenerateMessage {
  id: number;
  type: 'generate';
  question: string;
  context: string;
  history: Array<Pick<AssistantMessage, 'role' | 'content'>>;
  locale: Locale;
}

interface CacheStatusMessage {
  id: number;
  type: 'cache-status';
  model: string;
}

interface DeleteModelMessage {
  id: number;
  type: 'delete-model';
  model: string;
}

interface AgentRunMessage {
  id: number;
  type: 'agent-run';
  role: GodModeAgentRole;
  instructions: string;
  context: string;
  locale: Locale;
  responseSchema?: Record<string, unknown>;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

interface AgentCancelMessage {
  id: number;
  type: 'agent-cancel';
}

type WorkerRequest =
  | InitializeMessage
  | PlanMessage
  | GenerateMessage
  | CacheStatusMessage
  | DeleteModelMessage
  | AgentRunMessage
  | AgentCancelMessage;

let engine: MLCEngine | undefined;
let maxOutputTokens = 520;
let inferenceQueue: Promise<void> = Promise.resolve();
const cancelledRequests = new Set<number>();
const supportsOpfs = typeof navigator !== 'undefined'
  && Boolean(navigator.storage)
  && 'getDirectory' in navigator.storage;
const localAiAppConfig = {
  ...prebuiltAppConfig,
  cacheBackend: supportsOpfs ? 'opfs' as const : 'cache' as const,
};

const loadedEngine = (): MLCEngine => {
  if (!engine) throw new Error('The local model has not been loaded.');
  return engine;
};

const postError = (id: number, error: unknown) => {
  self.postMessage({
    id,
    type: 'error',
    text: error instanceof Error ? error.message : 'Local model failed.',
  });
};

const scheduleInference = (id: number, task: () => Promise<string>) => {
  self.postMessage({
    id,
    type: 'agent-event',
    status: 'queued',
    text: 'Queued on the local WebGPU engine.',
  });
  inferenceQueue = inferenceQueue
    .catch(() => undefined)
    .then(async () => {
      if (cancelledRequests.delete(id)) {
        postError(id, new Error('God Mode agent was cancelled.'));
        return;
      }
      self.postMessage({
        id,
        type: 'agent-event',
        status: 'running',
        text: 'Running inference on WebGPU.',
      });
      try {
        const text = await task();
        if (cancelledRequests.delete(id)) {
          postError(id, new Error('God Mode agent was cancelled.'));
          return;
        }
        self.postMessage({ id, type: 'answer', text });
      } catch (error) {
        postError(id, error);
      }
    });
};

const runPlanner = async (message: PlanMessage): Promise<string> => {
  const parsedContext = JSON.parse(message.context) as { steps?: unknown };
  const maximumStep = typeof parsedContext.steps === 'number'
    && Number.isSafeInteger(parsedContext.steps)
    && parsedContext.steps > 0
    ? parsedContext.steps
    : 1;
  const completion = await loadedEngine().chat.completions.create({
    messages: [
      { role: 'system', content: buildPlannerInstructions() },
      { role: 'user', content: `${message.context}\n\nQuestion: ${message.question}` },
    ],
    ...buildPlannerCompletionOptions(maximumStep),
  });
  return completion.choices[0]?.message.content ?? '{}';
};

const runAgent = async (message: AgentRunMessage): Promise<string> => {
  const expectsJson = Boolean(message.responseSchema || message.jsonMode);
  const completion = await loadedEngine().chat.completions.create({
    messages: [
      {
        role: 'system',
        content: [
          `You are the isolated CodeXRay ${message.role} specialist.`,
          message.instructions,
          'Use only supplied workspace state and artifacts. Never claim that application state changed.',
          expectsJson
            ? 'Return exactly one JSON object matching the required schema. Do not use markdown.'
            : `Respond concisely in ${message.locale === 'tr' ? 'Turkish' : 'English'}.`,
        ].join('\n'),
      },
      { role: 'user', content: message.context },
    ],
    temperature: message.temperature ?? (expectsJson ? 0 : 0.12),
    ...({ enable_thinking: false }),
    max_tokens: Math.min(message.maxTokens ?? maxOutputTokens, maxOutputTokens + 300),
    ...(expectsJson ? {
      response_format: {
        type: 'json_object' as const,
        ...(message.responseSchema ? { schema: JSON.stringify(message.responseSchema) } : {}),
      },
    } : {}),
  });
  return completion.choices[0]?.message.content ?? (expectsJson ? '{}' : '');
};

const runConversation = async (message: GenerateMessage): Promise<string> => {
  const promptMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildTutorInstructions(message.locale) },
    ...message.history
      .filter((item) => item.role === 'user' || item.role === 'ai')
      .map((item) => ({
        role: item.role === 'ai' ? 'assistant' as const : 'user' as const,
        content: item.content,
      })),
    { role: 'user', content: `${message.context}\n\nQuestion: ${message.question}` },
  ];
  const first = await loadedEngine().chat.completions.create({
    messages: promptMessages,
    temperature: 0.15,
    frequency_penalty: 0.35,
    presence_penalty: 0.05,
    repetition_penalty: 1.08,
    max_tokens: maxOutputTokens,
  });
  let answer = first.choices[0]?.message.content ?? 'The local model returned no answer.';
  let finishReason = first.choices[0]?.finish_reason;
  if (finishReason === 'length' && answer.trim()) {
    const continuation = await loadedEngine().chat.completions.create({
      messages: [
        ...promptMessages,
        { role: 'assistant', content: answer },
        {
          role: 'user',
          content: [
            'Your answer hit the local generation limit.',
            'Continue exactly where it stopped without repeating earlier sentences.',
            'Finish the current thought concisely within 220 tokens.',
          ].join(' '),
        },
      ],
      temperature: 0.1,
      frequency_penalty: 0.45,
      presence_penalty: 0,
      repetition_penalty: 1.1,
      max_tokens: maxOutputTokens >= 800 ? 320 : 240,
    });
    const continuedText = continuation.choices[0]?.message.content?.trim();
    if (continuedText) answer = `${answer.trimEnd()} ${continuedText}`;
    finishReason = continuation.choices[0]?.finish_reason;
  }
  if (finishReason === 'length') {
    answer = [
      answer.trimEnd(),
      message.locale === 'tr'
        ? '\n\n[Yanıt yerel üretim sınırına ulaştı. “Yanıtı sürdür” diyerek devam ettirebilirsiniz.]'
        : '\n\n[The response reached the local generation limit. Ask “continue the answer” to resume.]',
    ].join('');
  }
  return answer;
};

const handleAdministrativeRequest = async (
  message: InitializeMessage | CacheStatusMessage | DeleteModelMessage,
) => {
  if (message.type === 'cache-status') {
    const cached = await hasModelInCache(message.model, localAiAppConfig);
    self.postMessage({
      id: message.id,
      type: 'cache-status',
      text: cached ? 'cached' : 'not-cached',
    });
    return;
  }
  if (message.type === 'delete-model') {
    await deleteModelAllInfoInCache(message.model, localAiAppConfig);
    self.postMessage({ id: message.id, type: 'model-deleted', text: message.model });
    return;
  }
  const definition = getLocalAiModelDefinition(message.model);
  maxOutputTokens = (definition?.maxOutputTokens ?? 520)
    + (message.contextWindow >= 8192 ? 300 : 0);
  engine = await CreateMLCEngine(message.model, {
    appConfig: localAiAppConfig,
    initProgressCallback: (progress: InitProgressReport) => {
      self.postMessage({ id: message.id, type: 'progress', progress });
    },
  }, {
    context_window_size: message.contextWindow,
  });
  self.postMessage({ id: message.id, type: 'ready', text: message.model });
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === 'agent-cancel') {
    cancelledRequests.add(message.id);
    self.postMessage({
      id: message.id,
      type: 'agent-event',
      status: 'cancelled',
      text: 'Cancellation requested.',
    });
    return;
  }
  if (message.type === 'plan') {
    try {
      loadedEngine();
      scheduleInference(message.id, () => runPlanner(message));
    } catch (error) {
      postError(message.id, error);
    }
    return;
  }
  if (message.type === 'generate') {
    try {
      loadedEngine();
      scheduleInference(message.id, () => runConversation(message));
    } catch (error) {
      postError(message.id, error);
    }
    return;
  }
  if (message.type === 'agent-run') {
    try {
      loadedEngine();
      scheduleInference(message.id, () => runAgent(message));
    } catch (error) {
      postError(message.id, error);
    }
    return;
  }
  void handleAdministrativeRequest(message).catch((error) => postError(message.id, error));
};

export {};
