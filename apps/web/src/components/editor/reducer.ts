import {
  defaultStepConfig,
  MAX_STEPS,
  type DraftStep,
  type ExperienceSettings,
  type StepRouting,
  type StepType,
  type Theme,
} from '@momentpath/contracts';

export interface EditorState {
  title: string;
  theme: Theme;
  settings: ExperienceSettings;
  steps: DraftStep[];
  selectedKey: string | null;
}

export type EditorAction =
  | { type: 'setTitle'; title: string }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'setSettings'; settings: ExperienceSettings }
  | { type: 'select'; key: string | null }
  | { type: 'add'; stepType: StepType; key: string }
  | { type: 'update'; key: string; config: DraftStep['config'] }
  | { type: 'route'; key: string; next: StepRouting | undefined }
  | { type: 'duplicate'; key: string; newKey: string }
  | { type: 'move'; key: string; direction: -1 | 1 }
  | { type: 'remove'; key: string };

export function canAdd(state: EditorState, stepType: StepType): boolean {
  if (state.steps.length >= MAX_STEPS) return false;
  if (stepType === 'GIFT_REVEAL') return !state.steps.some((s) => s.type === 'GIFT_REVEAL');
  return true;
}

export function canDuplicate(step: DraftStep): boolean {
  return step.type !== 'GIFT_REVEAL';
}

/**
 * Pure editor state transitions. New steps are inserted before the final surprise so that the
 * gift stays last; duplicated steps get a new stable key.
 */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'setTitle':
      return { ...state, title: action.title };
    case 'setTheme':
      return { ...state, theme: action.theme };
    case 'setSettings':
      return { ...state, settings: action.settings };
    case 'select':
      return { ...state, selectedKey: action.key };
    case 'add': {
      if (!canAdd(state, action.stepType)) return state;
      const step = {
        key: action.key,
        type: action.stepType,
        config: defaultStepConfig(action.stepType),
      } as DraftStep;
      const giftIndex = state.steps.findIndex((s) => s.type === 'GIFT_REVEAL');
      const steps = [...state.steps];
      if (action.stepType !== 'GIFT_REVEAL' && giftIndex >= 0) steps.splice(giftIndex, 0, step);
      else steps.push(step);
      return { ...state, steps, selectedKey: step.key };
    }
    case 'update':
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.key === action.key ? ({ ...s, config: action.config } as DraftStep) : s,
        ),
      };
    case 'route':
      return {
        ...state,
        steps: state.steps.map((s) => {
          if (s.key !== action.key) return s;
          const { next: _old, ...rest } = s;
          return (isEmptyRouting(action.next) ? rest : { ...rest, next: action.next }) as DraftStep;
        }),
      };
    case 'duplicate': {
      const index = state.steps.findIndex((s) => s.key === action.key);
      const original = state.steps[index];
      if (!original || !canDuplicate(original) || state.steps.length >= MAX_STEPS) return state;
      const copy = {
        ...original,
        key: action.newKey,
        config: structuredClone(original.config),
      } as DraftStep;
      const steps = [...state.steps];
      steps.splice(index + 1, 0, copy);
      return { ...state, steps, selectedKey: copy.key };
    }
    case 'move': {
      const index = state.steps.findIndex((s) => s.key === action.key);
      const target = index + action.direction;
      if (index < 0 || target < 0 || target >= state.steps.length) return state;
      const steps = [...state.steps];
      [steps[index], steps[target]] = [steps[target]!, steps[index]!];
      return { ...state, steps };
    }
    case 'remove': {
      const index = state.steps.findIndex((s) => s.key === action.key);
      if (index < 0) return state;
      const steps = state.steps
        .filter((s) => s.key !== action.key)
        .map((s) => withoutRoutesTo(s, action.key));
      const selectedKey =
        state.selectedKey === action.key
          ? (steps[Math.min(index, steps.length - 1)]?.key ?? null)
          : state.selectedKey;
      return { ...state, steps, selectedKey };
    }
  }
}

function isEmptyRouting(next: StepRouting | undefined): boolean {
  return !next || (next.rules.length === 0 && next.otherwise === null);
}

/** After a step is deleted, routes to it fall back to "next step" instead of dangling. */
function withoutRoutesTo(step: DraftStep, removed: string): DraftStep {
  if (!step.next) return step;
  const rules = step.next.rules.filter(
    (r) => r.goto !== removed && !(r.when.kind === 'COMPLETED' && r.when.stepKey === removed),
  );
  const otherwise = step.next.otherwise === removed ? null : step.next.otherwise;
  const { next: _old, ...rest } = step;
  const next = { rules, otherwise };
  return (isEmptyRouting(next) ? rest : { ...rest, next }) as DraftStep;
}

export const STEP_TYPE_LABEL: Record<StepType, string> = {
  MESSAGE: 'Message',
  IMAGE: 'Photo',
  MULTIPLE_CHOICE: 'Question',
  YES_NO_CHOICE: 'Yes / No',
  SCRATCH_REVEAL: 'Scratch card',
  GIFT_REVEAL: 'Final surprise',
};

export const STEP_TYPE_HINT: Record<StepType, string> = {
  MESSAGE: 'A heading and a short message',
  IMAGE: 'A photo with a caption',
  MULTIPLE_CHOICE: 'Pick one answer, optionally a quiz',
  YES_NO_CHOICE: 'Yes, No and Maybe with a playful No button',
  SCRATCH_REVEAL: 'Scratch to reveal a hidden message',
  GIFT_REVEAL: 'The gift or plan revealed at the end',
};

export function stepSummary(step: DraftStep): string {
  switch (step.type) {
    case 'MESSAGE':
      return step.config.heading || 'Message';
    case 'IMAGE':
      return step.config.caption || step.config.alt || 'Photo';
    case 'MULTIPLE_CHOICE':
    case 'YES_NO_CHOICE':
      return step.config.question || 'Untitled question';
    case 'SCRATCH_REVEAL':
      return step.config.instructions || 'Scratch card';
    case 'GIFT_REVEAL':
      return step.config.title || 'Final surprise';
  }
}
