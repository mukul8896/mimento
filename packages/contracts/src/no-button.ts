import type { NoButtonConfig } from './steps';

export interface NoButtonInputs {
  /** Number of times the recipient has tried to activate or reach the No button. */
  attempts: number;
  /** Milliseconds since the choice step was shown. */
  elapsedMs: number;
}

export interface NoButtonState {
  /** When true, activating No submits a NO answer like any normal button. */
  clickable: boolean;
  /** Attempts still needed in AFTER_ATTEMPTS mode, otherwise null. */
  remainingAttempts: number | null;
  /** Whole seconds still to wait in AFTER_DELAY mode, otherwise null. */
  remainingSeconds: number | null;
}

/**
 * Pure description of how the No button behaves. The player renders movement (or, with
 * reduced motion, a static state change) from this; it never affects the Close control.
 */
export function noButtonState(config: NoButtonConfig, inputs: NoButtonInputs): NoButtonState {
  switch (config.mode) {
    case 'IMMEDIATE':
      return { clickable: true, remainingAttempts: null, remainingSeconds: null };
    case 'AFTER_ATTEMPTS': {
      const remaining = Math.max(0, config.attempts - Math.max(0, inputs.attempts));
      return { clickable: remaining === 0, remainingAttempts: remaining, remainingSeconds: null };
    }
    case 'AFTER_DELAY': {
      const remainingMs = Math.max(0, config.delaySeconds * 1000 - Math.max(0, inputs.elapsedMs));
      return {
        clickable: remainingMs === 0,
        remainingAttempts: null,
        remainingSeconds: Math.ceil(remainingMs / 1000),
      };
    }
    case 'EVASIVE':
      return { clickable: false, remainingAttempts: null, remainingSeconds: null };
  }
}
