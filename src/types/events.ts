import type { GodModeIntent } from './titan';

export type GodModeUserMessagePayload =
  | { text: string }
  | GodModeIntent;

declare global {
  interface WindowEventMap {
    'god-mode-user-message': CustomEvent<GodModeUserMessagePayload>;
  }
}
