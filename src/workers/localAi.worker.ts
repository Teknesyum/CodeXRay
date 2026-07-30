import { CreateMLCEngine } from '@mlc-ai/web-llm';
import type { InitProgressReport, MLCEngine } from '@mlc-ai/web-llm';

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
  history: Array<{ role: string; content: string }>;
}

let engine: MLCEngine | undefined;

self.onmessage = async (event: MessageEvent<InitializeMessage | GenerateMessage>) => {
  const message = event.data;
  try {
    if (message.type === 'initialize') {
      engine = await CreateMLCEngine(message.model, {
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
          content: 'You are CodeXRay’s concise algorithm tutor. Use only the supplied execution context. Explain assumptions and never invent runtime state.',
        },
        ...message.history.slice(-8).map((item) => ({
          role: item.role === 'ai' ? 'assistant' as const : 'user' as const,
          content: item.content,
        })),
        { role: 'user', content: `${message.context}\n\nQuestion: ${message.question}` },
      ],
      temperature: 0.2,
      max_tokens: 350,
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
