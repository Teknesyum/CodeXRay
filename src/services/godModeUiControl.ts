import type { UiActionV1 } from '../types/titan';

export const GOD_MODE_UI_EVENT = 'codexray:god-mode-ui-action';

export const dispatchGodModeUiAction = (action: UiActionV1): void => {
  window.dispatchEvent(new CustomEvent<UiActionV1>(GOD_MODE_UI_EVENT, { detail: action }));
};

export const isGodModeUiEvent = (event: Event): event is CustomEvent<UiActionV1> =>
  event instanceof CustomEvent && Boolean(event.detail);
