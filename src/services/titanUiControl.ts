import type { UiActionV1 } from '../types/titan';
import { WORKSPACE_UI_EVENT } from './uiActionEvent';

export const TITAN_UI_EVENT = WORKSPACE_UI_EVENT;

export const dispatchTitanUiAction = (action: UiActionV1): void => {
  window.dispatchEvent(new CustomEvent<UiActionV1>(TITAN_UI_EVENT, { detail: action }));
};

export const isTitanUiEvent = (event: Event): event is CustomEvent<UiActionV1> =>
  event instanceof CustomEvent && Boolean(event.detail);
