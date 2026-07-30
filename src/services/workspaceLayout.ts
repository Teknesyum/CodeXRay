export const RIGHT_PANEL_LIMITS = {
  visualizer: 200,
  assistant: 150,
  controls: 82,
  splitterTotal: 12,
} as const;

export interface RightPanelSizes {
  visualizerHeight: number;
  assistantHeight: number;
  controlHeight: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

const availableHeight = (viewportHeight: number): number =>
  Math.max(
    RIGHT_PANEL_LIMITS.visualizer
      + RIGHT_PANEL_LIMITS.assistant
      + RIGHT_PANEL_LIMITS.controls,
    viewportHeight - RIGHT_PANEL_LIMITS.splitterTotal,
  );

export const createDefaultRightPanelSizes = (
  viewportHeight: number,
): RightPanelSizes => {
  const available = availableHeight(viewportHeight);
  const controlHeight = 104;
  const assistantHeight = clamp(
    Math.round(viewportHeight * 0.28),
    180,
    340,
  );
  return {
    visualizerHeight: available - assistantHeight - controlHeight,
    assistantHeight,
    controlHeight,
  };
};

export const constrainRightPanelSizes = (
  viewportHeight: number,
  desiredVisualizerHeight: number,
  desiredAssistantHeight: number,
): RightPanelSizes => {
  const available = availableHeight(viewportHeight);
  const visualizerHeight = clamp(
    desiredVisualizerHeight,
    RIGHT_PANEL_LIMITS.visualizer,
    available - RIGHT_PANEL_LIMITS.assistant - RIGHT_PANEL_LIMITS.controls,
  );
  const assistantHeight = clamp(
    desiredAssistantHeight,
    RIGHT_PANEL_LIMITS.assistant,
    available - visualizerHeight - RIGHT_PANEL_LIMITS.controls,
  );
  return {
    visualizerHeight,
    assistantHeight,
    controlHeight: available - visualizerHeight - assistantHeight,
  };
};

