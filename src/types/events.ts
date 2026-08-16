import type { TitanModeIntent } from './titan';

export type TitanModeUserMessagePayload =
  | { text: string }
  | TitanModeIntent;

declare global {
  interface WindowEventMap {
    'titan-mode-user-message': CustomEvent<TitanModeUserMessagePayload>;
  }
}
