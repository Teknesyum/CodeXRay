export type LocalAiRole = 'route' | 'navigate' | 'edit-input' | 'explain' | 'translate';

export const LOCAL_AI_USABLE_OUTPUT_TOKENS: Readonly<Record<LocalAiRole, number>> = {
  route: 120,
  navigate: 120,
  'edit-input': 160,
  explain: 600,
  translate: 900,
};

export const roleMaxTokens = (
  role: LocalAiRole,
  reasoningOverhead: number,
  profileMaximum: number,
): number => Math.min(
  profileMaximum,
  LOCAL_AI_USABLE_OUTPUT_TOKENS[role] + Math.max(0, Math.round(reasoningOverhead)),
);
