import {
  CreateMLCEngine,
  hasModelInCache,
  prebuiltAppConfig,
} from '@mlc-ai/web-llm';
import type { InitProgressReport, MLCEngine } from '@mlc-ai/web-llm';
import type { Locale } from '../i18n/translations';
import { buildTutorInstructions } from '../services/aiContext';
import type { AssistantMessage } from '../services/aiContext';

interface InitializeMessage {
  id: number;
  type: 'initialize';
  model: string;
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

let engine: MLCEngine | undefined;
const supportsOpfs = typeof navigator !== 'undefined'
  && Boolean(navigator.storage)
  && 'getDirectory' in navigator.storage;
const localAiAppConfig = {
  ...prebuiltAppConfig,
  cacheBackend: supportsOpfs ? 'opfs' as const : 'cache' as const,
};

self.onmessage = async (
  event: MessageEvent<InitializeMessage | GenerateMessage | CacheStatusMessage>,
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
    if (message.type === 'initialize') {
      engine = await CreateMLCEngine(message.model, {
        appConfig: localAiAppConfig,
        initProgressCallback: (progress: InitProgressReport) => {
          self.postMessage({ id: message.id, type: 'progress', progress });
        },
      });
      self.postMessage({ id: message.id, type: 'ready', text: message.model });
      return;
    }
    if (!engine) throw new Error('The local model has not been loaded.');
    const completion = await engine.chat.completions.create({
      messages: [
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
      ],
      temperature: 0.15,
      frequency_penalty: 0.35,
      presence_penalty: 0.05,
      repetition_penalty: 1.08,
      max_tokens: 320,
    });
    self.postMessage({
      id: message.id,
      type: 'answer',
      text: completion.choices[0]?.message.content ?? 'The local model returned no answer.',
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
