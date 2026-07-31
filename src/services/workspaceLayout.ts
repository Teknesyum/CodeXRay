export const RIGHT_PANEL_LIMITS = {
  visualizer: 120,
  assistant: 150,
  controls: 58,
  splitterTotal: 12,
} as const;

export interface RightPanelSizes {
  visualizerHeight: number;
  assistantHeight: number;
  controlHeight: number;
}

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
  const controlHeight = RIGHT_PANEL_LIMITS.controls;
  const visualizerAssistantHeight = available - controlHeight;
  const assistantHeight = Math.min(
    Math.max(
      Math.round(visualizerAssistantHeight * 0.42),
      RIGHT_PANEL_LIMITS.assistant,
    ),
    visualizerAssistantHeight - RIGHT_PANEL_LIMITS.visualizer,
  );
  return {
    visualizerHeight: visualizerAssistantHeight - assistantHeight,
    assistantHeight,
    controlHeight,
  };
};

export const constrainRightPanelSizes = (
  viewportHeight: number,
  desiredVisualizerHeight: number,
  desiredAssistantHeight: number,
  desiredControlHeight: number,
): RightPanelSizes => {
  const available = availableHeight(viewportHeight);
  const minimumTotal = RIGHT_PANEL_LIMITS.visualizer
    + RIGHT_PANEL_LIMITS.assistant
    + RIGHT_PANEL_LIMITS.controls;
  const availableExtra = available - minimumTotal;
  const desiredExtras = [
    Math.max(0, desiredVisualizerHeight - RIGHT_PANEL_LIMITS.visualizer),
    Math.max(0, desiredAssistantHeight - RIGHT_PANEL_LIMITS.assistant),
    Math.max(0, desiredControlHeight - RIGHT_PANEL_LIMITS.controls),
  ];
  const desiredExtraTotal = desiredExtras.reduce((sum, value) => sum + value, 0);
  const scale = desiredExtraTotal > 0 ? availableExtra / desiredExtraTotal : 0;
  const visualizerHeight = RIGHT_PANEL_LIMITS.visualizer + desiredExtras[0] * scale;
  const assistantHeight = RIGHT_PANEL_LIMITS.assistant + desiredExtras[1] * scale;
  return {
    visualizerHeight,
    assistantHeight,
    controlHeight: available - visualizerHeight - assistantHeight,
  };
};
