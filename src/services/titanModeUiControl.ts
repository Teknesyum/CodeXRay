import type { UiActionV1 } from '../types/titan';
import { WORKSPACE_UI_EVENT } from './uiActionEvent';

export const TITAN_MODE_UI_EVENT = WORKSPACE_UI_EVENT;

export const dispatchTitanModeUiAction = (action: UiActionV1): void => {
  window.dispatchEvent(new CustomEvent<UiActionV1>(TITAN_MODE_UI_EVENT, { detail: action }));
};

export const isTitanModeUiEvent = (event: Event): event is CustomEvent<UiActionV1> =>
  event instanceof CustomEvent && Boolean(event.detail);
