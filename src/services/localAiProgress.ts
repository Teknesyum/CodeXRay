interface LocalAiProgressLike {
  progress: number;
  text: string;
}

export const normalizeLocalAiProgress = (
  report: LocalAiProgressLike,
  previous: number,
) => {
  const raw = Math.max(0, Math.min(1, report.progress));
  const status = report.text.toLowerCase();
  let lifecycleProgress: number;

  if (status.includes('fetch param') || status.includes('fetching param')) {
    lifecycleProgress = Math.round(raw * 70);
  } else if (status.includes('loading model from cache')) {
    lifecycleProgress = 70 + Math.round(raw * 29);
  } else {
    lifecycleProgress = Math.min(99, Math.round(raw * 100));
  }

  return Math.max(previous, Math.min(99, lifecycleProgress));
};
