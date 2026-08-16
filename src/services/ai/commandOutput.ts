import type { AiProviderCapabilities } from '../../types/aiProvider';
import { extractTolerantJson } from './tolerantJson';

export interface CommandResolution<T> {
  value: T;
  source: 'deterministic' | 'model';
  notice: string | null;
}

export const resolveCommandOutput = <T>(
  deterministic: T,
  capabilities: AiProviderCapabilities | null,
  modelOutput: string | null,
  validate: (value: unknown) => value is T,
): CommandResolution<T> => {
  if (!capabilities || capabilities.structuredOutput === 'none' || modelOutput === null) {
    return {
      value: deterministic,
      source: 'deterministic',
      notice: 'Command model unavailable; the deterministic result was used.',
    };
  }
  const extracted = extractTolerantJson(modelOutput, validate);
  if (!extracted.ok) {
    return {
      value: deterministic,
      source: 'deterministic',
      notice: `The command model output was unusable (${extracted.reason}); the deterministic result was used.`,
    };
  }
  return {
    value: extracted.value,
    source: 'model',
    notice: capabilities.structuredOutput === 'prompt-only'
      ? 'The command model does not enforce schemas; validated tolerant extraction was used.'
      : null,
  };
};

export const capabilityBudgetWarning = (
  capabilities: AiProviderCapabilities | null,
): string | null => capabilities && capabilities.usableOutputTokens < 250
  ? `This model uses about ${capabilities.reasoningOverhead} reasoning tokens per response. Increase maximum output tokens to 2048 or select a non-reasoning command model.`
  : null;
