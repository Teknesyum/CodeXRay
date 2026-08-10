import { Channel, invoke } from '@tauri-apps/api/core';
import type {
  AiConnectionProfileV1,
  DesktopAiEvent,
  DesktopCompletionRequest,
  DesktopCompletionResult,
  DesktopProbeResult,
} from '../types/aiProvider';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export const isDesktopRuntime = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const normalizeLoopbackBaseUrl = (value: string): string => {
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Local AI endpoint must use HTTP or HTTPS.');
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error('Local AI endpoint must use localhost, 127.0.0.1, or [::1].');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Local AI endpoint cannot contain credentials, a query, or a fragment.');
  }
  if (parsed.port) {
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('Local AI endpoint has an invalid port.');
    }
  }
  parsed.hostname = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname;
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/v1';
  return parsed.toString().replace(/\/$/, '');
};

const assertDesktop = (): void => {
  if (!isDesktopRuntime()) throw new Error('External local AI providers are available in the desktop app.');
};

export const listDesktopModels = async (
  baseUrl: string,
  bearerToken = '',
): Promise<string[]> => {
  assertDesktop();
  return invoke<string[]>('list_models', {
    baseUrl: normalizeLoopbackBaseUrl(baseUrl),
    bearerToken,
  });
};

export const probeDesktopModel = async (
  profile: AiConnectionProfileV1,
  bearerToken = '',
): Promise<DesktopProbeResult> => {
  assertDesktop();
  return invoke<DesktopProbeResult>('probe_model', {
    request: {
      baseUrl: normalizeLoopbackBaseUrl(profile.baseUrl),
      model: profile.model,
      bearerToken,
      contextWindow: profile.contextWindow,
      maxOutputTokens: profile.maxOutputTokens,
    },
  });
};

export const runDesktopCompletion = async (
  request: DesktopCompletionRequest,
  onEvent?: (event: DesktopAiEvent) => void,
): Promise<DesktopCompletionResult> => {
  assertDesktop();
  const channel = new Channel<DesktopAiEvent>();
  channel.onmessage = (event) => onEvent?.(event);
  return invoke<DesktopCompletionResult>('run_completion', {
    request: {
      ...request,
      baseUrl: normalizeLoopbackBaseUrl(request.baseUrl),
    },
    onEvent: channel,
  });
};

export const cancelDesktopCompletion = async (requestId: number): Promise<void> => {
  if (!isDesktopRuntime()) return;
  await invoke('cancel_completion', { requestId });
};

export const readWebSourceFromDesktop = async (
  url: string,
  signal?: AbortSignal,
): Promise<Response> => {
  assertDesktop();
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const cancellation = () => undefined;
  signal?.addEventListener('abort', cancellation, { once: true });
  try {
    const result = await invoke<{ status: number; body: string }>('read_web_source', { url });
    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
    return new Response(result.body, {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    signal?.removeEventListener('abort', cancellation);
  }
};
