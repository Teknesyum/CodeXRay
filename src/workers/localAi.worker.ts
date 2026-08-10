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
import { getLocalAiModelDefinition, resolveLocalAgentOutputTokens } from '../services/localAiModels';
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
export const selectLocalAiCacheBackend = (
  hostname: string,
  opfsAvailable: boolean,
): 'opfs' | 'cache' => {
  const normalizedHost = hostname.toLowerCase();
  const isLocalDevelopment = normalizedHost === 'localhost'
    || normalizedHost === '127.0.0.1'
    || normalizedHost === '::1'
    || normalizedHost === '[::1]';
  return opfsAvailable && !isLocalDevelopment ? 'opfs' : 'cache';
};
const workerHostname = typeof self !== 'undefined' ? self.location?.hostname ?? '' : '';
const localAiAppConfig = {
  ...prebuiltAppConfig,
  cacheBackend: selectLocalAiCacheBackend(workerHostname, supportsOpfs),
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

const postAgentEvent = (
  id: number,
  status: 'queued' | 'running' | 'first-token' | 'streaming' | 'validating' | 'completed' | 'cancelled',
  text: string,
  metrics: Partial<Pick<LocalAgentResultV2, 'queueMs' | 'firstTokenMs' | 'inferenceMs' | 'completionTokens' | 'finishReason'>> = {},
) => {
  self.postMessage({ id, type: 'agent-event', status, text, ...metrics });
};

const scheduleInference = (id: number, task: () => Promise<string | LocalAgentResultV2>) => {
  const queuedAt = performance.now();
  postAgentEvent(id, 'queued', 'Queued on the local WebGPU engine.');
  const execution = inferenceQueue
    .catch(() => undefined)
    .then(async () => {
      if (cancelledRequests.delete(id)) {
        throw new Error('God Mode agent was cancelled.');
      }
      postAgentEvent(id, 'running', 'Waiting for the first token from WebGPU.');
      try {
        activeInferenceId = id;
        const inferenceStartedAt = performance.now();
        const output = await task();
        if (cancelledRequests.delete(id)) {
          throw new Error('God Mode agent was cancelled.');
        }
        if (typeof output === 'string') {
          return { output };
        }
        const result = {
          ...output,
          queueMs: Math.max(0, Math.round(inferenceStartedAt - queuedAt)),
          inferenceMs: Math.max(0, Math.round(performance.now() - inferenceStartedAt)),
        };
        return { output: result.text, result };
      } finally {
        cancelledRequests.delete(id);
        if (activeInferenceId === id) activeInferenceId = null;
      }
    });

  // Release the serialized queue before publishing the answer. The main thread
  // can enqueue a repair agent immediately after receiving an answer; publishing
  // while this promise is still unresolved can strand that repair behind the
  // just-finished request on real WebGPU engines.
  inferenceQueue = execution.then(() => undefined, () => undefined);
  void execution.then(({ output, result }) => {
    if (result) {
      postAgentEvent(id, 'completed', 'Local inference completed.', {
        queueMs: result.queueMs,
        firstTokenMs: result.firstTokenMs,
        inferenceMs: result.inferenceMs,
        completionTokens: result.completionTokens,
        finishReason: result.finishReason,
      });
      self.postMessage({ id, type: 'answer', text: output, result });
      return;
    }
    self.postMessage({ id, type: 'answer', text: output });
  }).catch((error) => postError(id, error));
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

const runAgent = async (message: AgentRunMessage): Promise<LocalAgentResultV2> => {
  const expectsJson = Boolean(message.responseSchema || message.jsonMode);
  const outputTokens = resolveLocalAgentOutputTokens(
    getLocalAiModelDefinition(activeModel),
    message.maxTokens,
    expectsJson,
    activeContextWindow,
  );
  const systemContent = [
    `You are the isolated CodeXRay ${message.role} specialist.`,
    message.instructions,
    'Use only supplied workspace state and artifacts. Never claim that application state changed.',
    expectsJson
      ? `Return exactly one JSON object matching the required schema. Do not use markdown. Write every human-readable string field in ${message.locale === 'tr' ? 'Turkish' : 'English'}; keep source code and complexity notation unchanged.`
      : `Match answer depth to the task and respond completely in ${message.locale === 'tr' ? 'Turkish' : 'English'}.`,
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
  const inferenceStartedAt = performance.now();
  const completion = await loadedEngine().chat.completions.create({
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: boundedPromptText(message.context, promptCharacterBudget) },
    ],
    temperature: message.temperature ?? (expectsJson ? 0 : 0.12),
    ...({ enable_thinking: false }),
    max_tokens: outputTokens,
    stream: true,
    stream_options: { include_usage: true },
    ...(expectsJson ? {
      response_format: {
        type: 'json_object' as const,
        ...(includeSchema ? { schema: schemaText } : {}),
      },
    } : {}),
  });
  let text = '';
  let finishReason = 'unknown';
  let promptTokens: number | null = null;
  let completionTokens: number | null = null;
  let firstTokenMs: number | null = null;
  let lastHeartbeatAt = 0;
  for await (const chunk of completion) {
    const content = chunk.choices[0]?.delta.content ?? '';
    if (content) {
      text += content;
      const now = performance.now();
      if (firstTokenMs === null) {
        firstTokenMs = Math.max(0, Math.round(now - inferenceStartedAt));
        lastHeartbeatAt = now;
        postAgentEvent(message.id, 'first-token', 'The local model produced its first token.', { firstTokenMs });
      } else if (now - lastHeartbeatAt >= 250) {
        lastHeartbeatAt = now;
        postAgentEvent(message.id, 'streaming', 'The local model is still producing output.', { firstTokenMs });
      }
    }
    const chunkFinishReason = chunk.choices[0]?.finish_reason;
    if (chunkFinishReason) finishReason = chunkFinishReason;
    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens;
      completionTokens = chunk.usage.completion_tokens;
    }
  }
  postAgentEvent(message.id, 'validating', 'Validating the completed local-model response.', { firstTokenMs });
  return {
    version: 2,
    text: text || (expectsJson ? '{}' : ''),
    finishReason,
    model: activeModel,
    contextWindow: activeContextWindow,
    promptTokens,
    completionTokens,
    queueMs: 0,
    firstTokenMs,
    inferenceMs: 0,
    schemaMode: message.responseSchema ? 'json-schema' : message.jsonMode ? 'json-object' : 'none',
  };
};

export const mergeContinuationText = (answer: string, continuation: string): string => {
  const left = answer.trimEnd();
  const right = continuation.trimStart();
  const maximumOverlap = Math.min(left.length, right.length, 2_000);
  for (let overlap = maximumOverlap; overlap >= 16; overlap -= 1) {
    if (left.slice(-overlap) === right.slice(0, overlap)) {
      return `${left}${right.slice(overlap)}`;
    }
  }
  return `${left}\n\n${right}`;
};

const runConversation = async (message: GenerateMessage): Promise<string> => {
  const reasoningModel = Boolean(getLocalAiModelDefinition(activeModel)?.reasoningModel);
  const promptMessages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: [
        buildTutorInstructions(message.locale),
        reasoningModel
          ? 'Answer directly with the final response. Do not emit private reasoning, analysis, or <think> blocks.'
          : '',
      ].filter(Boolean).join('\n'),
    },
    ...message.history
      .filter((item) => item.role === 'user' || item.role === 'ai')
      .map((item) => ({
        role: item.role === 'ai' ? 'assistant' as const : 'user' as const,
        content: item.content,
      })),
    { role: 'user', content: `${message.context}\n\nQuestion: ${message.question}` },
  ];
  const streamCompletion = async (
    options: Parameters<MLCEngine['chat']['completions']['create']>[0],
  ): Promise<{ text: string; finishReason: string | null | undefined }> => {
    const completion = await loadedEngine().chat.completions.create({
      ...options,
      stream: true,
    } as Parameters<MLCEngine['chat']['completions']['create']>[0]);
    if (completion && typeof completion === 'object' && Symbol.asyncIterator in completion) {
      let text = '';
      let finishReason: string | null | undefined;
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          text += delta;
          self.postMessage({ id: message.id, type: 'stream-delta', phase: 'answer', text: delta });
        }
        finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
      }
      return { text, finishReason };
    }
    const fallback = completion as unknown as {
      choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
    };
    const text = fallback.choices?.[0]?.message?.content ?? 'The local model returned no answer.';
    if (text) self.postMessage({ id: message.id, type: 'stream-delta', phase: 'answer', text });
    return { text, finishReason: fallback.choices?.[0]?.finish_reason };
  };

  const first = await streamCompletion({
    messages: promptMessages,
    temperature: 0.15,
    frequency_penalty: 0.35,
    presence_penalty: 0.05,
    repetition_penalty: 1.08,
    ...({ enable_thinking: false }),
    max_tokens: maxOutputTokens,
  });
  let answer = first.text;
  let finishReason = first.finishReason;
  if (finishReason === 'length' && answer.trim()) {
    const continuation = await streamCompletion({
      messages: [
        ...promptMessages,
        { role: 'assistant', content: answer },
        {
          role: 'user',
          content: [
            'Your answer hit the local generation limit.',
            'Continue exactly where it stopped without repeating earlier sentences.',
            'Finish the current thought completely, without padding or an arbitrary fixed-length target.',
          ].join(' '),
        },
      ],
      temperature: 0.1,
      frequency_penalty: 0.45,
      presence_penalty: 0,
      repetition_penalty: 1.1,
      ...({ enable_thinking: false }),
      max_tokens: Math.max(240, Math.floor(maxOutputTokens / 2)),
    });
    const continuedText = continuation.text.trim();
    if (continuedText) answer = mergeContinuationText(answer, continuedText);
    finishReason = continuation.finishReason;
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
