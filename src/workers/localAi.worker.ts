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
import { buildTutorInstructions } from '../services/aiContext';
import type { AssistantMessage } from '../services/aiContext';
import { getLocalAiModelDefinition } from '../services/localAiModels';

interface InitializeMessage {
  id: number;
  type: 'initialize';
  model: string;
  contextWindow: number;
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

let engine: MLCEngine | undefined;
let maxOutputTokens = 520;
const supportsOpfs = typeof navigator !== 'undefined'
  && Boolean(navigator.storage)
  && 'getDirectory' in navigator.storage;
const localAiAppConfig = {
  ...prebuiltAppConfig,
  cacheBackend: supportsOpfs ? 'opfs' as const : 'cache' as const,
};

self.onmessage = async (
  event: MessageEvent<
    InitializeMessage | GenerateMessage | CacheStatusMessage | DeleteModelMessage
  >,
) => {
  const message = event.data;
  try {
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
      self.postMessage({
        id: message.id,
        type: 'model-deleted',
        text: message.model,
      });
      return;
    }
    if (message.type === 'initialize') {
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
      return;
    }
    if (!engine) throw new Error('The local model has not been loaded.');
    const promptMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: buildTutorInstructions(message.locale),
      },
      ...message.history
        .filter((item) => item.role === 'user' || item.role === 'ai')
        .map((item) => ({
          role: item.role === 'ai' ? 'assistant' as const : 'user' as const,
          content: item.content,
        })),
      { role: 'user', content: `${message.context}\n\nQuestion: ${message.question}` },
    ];
    const completion = await engine.chat.completions.create({
      messages: promptMessages,
      temperature: 0.15,
      frequency_penalty: 0.35,
      presence_penalty: 0.05,
      repetition_penalty: 1.08,
      max_tokens: maxOutputTokens,
    });
    let answer = completion.choices[0]?.message.content
      ?? 'The local model returned no answer.';
    let finishReason = completion.choices[0]?.finish_reason;
    if (finishReason === 'length' && answer.trim()) {
      const continuation = await engine.chat.completions.create({
        messages: [
          ...promptMessages,
          { role: 'assistant', content: answer },
          {
            role: 'user',
            content: [
              'Your answer hit the local generation limit.',
              'Continue exactly where it stopped, without repeating earlier sentences.',
              'Finish the current thought concisely within 220 tokens.',
              'Preserve any required CODEXRAY_ACTION directive at the very end.',
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
    self.postMessage({
      id: message.id,
      type: 'answer',
      text: answer,
    });
  } catch (error) {
    self.postMessage({
      id: message.id,
      type: 'error',
      text: error instanceof Error ? error.message : 'Local model failed.',
    });
  }
};

export {};
