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
import type { LocalAgentResultV2 } from '../types/webSource';

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
  detailed?: boolean;
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
let activeContextWindow = 4096;
let activeModel = '';
let inferenceQueue: Promise<void> = Promise.resolve();
const cancelledRequests = new Set<number>();
let activeInferenceId: number | null = null;
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

const boundedPromptText = (value: string, maximumCharacters: number): string => {
  if (value.length <= maximumCharacters) return value;
  const marker = '\n[Lower-priority agent context shortened to fit the selected local-model window.]\n';
  const available = Math.max(0, maximumCharacters - marker.length);
  const headLength = Math.ceil(available * 0.72);
  return `${value.slice(0, headLength)}${marker}${value.slice(value.length - (available - headLength))}`;
};

const postError = (id: number, error: unknown) => {
  self.postMessage({
    id,
    type: 'error',
    text: error instanceof Error ? error.message : 'Local model failed.',
  });
};

const scheduleInference = (id: number, task: () => Promise<string | LocalAgentResultV2>) => {
  const queuedAt = performance.now();
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
        activeInferenceId = id;
        const inferenceStartedAt = performance.now();
        const output = await task();
        if (cancelledRequests.delete(id)) {
          postError(id, new Error('God Mode agent was cancelled.'));
          return;
        }
        if (typeof output === 'string') {
          self.postMessage({ id, type: 'answer', text: output });
        } else {
          self.postMessage({
            id,
            type: 'answer',
            text: output.text,
            result: {
              ...output,
              queueMs: Math.max(0, Math.round(inferenceStartedAt - queuedAt)),
              inferenceMs: Math.max(0, Math.round(performance.now() - inferenceStartedAt)),
            },
          });
        }
      } catch (error) {
        postError(id, error);
      } finally {
        if (activeInferenceId === id) activeInferenceId = null;
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

const runAgent = async (message: AgentRunMessage): Promise<string | LocalAgentResultV2> => {
  const expectsJson = Boolean(message.responseSchema || message.jsonMode);
  const outputTokens = Math.min(message.maxTokens ?? maxOutputTokens, maxOutputTokens + 300);
  const systemContent = [
    `You are the isolated CodeXRay ${message.role} specialist.`,
    message.instructions,
    'Use only supplied workspace state and artifacts. Never claim that application state changed.',
    expectsJson
      ? 'Return exactly one JSON object matching the required schema. Do not use markdown.'
      : `Respond concisely in ${message.locale === 'tr' ? 'Turkish' : 'English'}.`,
  ].join('\n');
  const schemaText = message.responseSchema ? JSON.stringify(message.responseSchema) : '';
  const includeSchema = Boolean(message.responseSchema)
    && schemaText.length <= activeContextWindow;
  const promptCharacterBudget = Math.max(
    900,
    (activeContextWindow - outputTokens - 420) * 2
      - systemContent.length
      - (includeSchema ? schemaText.length : 0),
  );
  const completion = await loadedEngine().chat.completions.create({
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: boundedPromptText(message.context, promptCharacterBudget) },
    ],
    temperature: message.temperature ?? (expectsJson ? 0 : 0.12),
    ...({ enable_thinking: false }),
    max_tokens: outputTokens,
    ...(expectsJson ? {
      response_format: {
        type: 'json_object' as const,
        ...(includeSchema ? { schema: schemaText } : {}),
      },
    } : {}),
  });
  const text = completion.choices[0]?.message.content ?? (expectsJson ? '{}' : '');
  if (!message.detailed) return text;
  return {
    version: 2,
    text,
    finishReason: completion.choices[0]?.finish_reason ?? 'unknown',
    model: activeModel,
    contextWindow: activeContextWindow,
    promptTokens: completion.usage?.prompt_tokens ?? null,
    completionTokens: completion.usage?.completion_tokens ?? null,
    queueMs: 0,
    inferenceMs: 0,
    schemaMode: message.responseSchema ? 'json-schema' : message.jsonMode ? 'json-object' : 'none',
  };
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
  activeModel = message.model;
  activeContextWindow = message.contextWindow;
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
    if (activeInferenceId === message.id) void engine?.interruptGenerate();
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
