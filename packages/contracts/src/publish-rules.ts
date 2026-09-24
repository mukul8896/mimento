import { END, successors, type FlowStep } from './flow';
import { richTextIsEmpty } from './rich-text';
import { MAX_STEPS, type DraftStep } from './steps';
import { themeContrastIssues, type Theme } from './theme';

export interface PublishIssue {
  /** Step key the issue belongs to, or null for experience-level issues. */
  stepKey: string | null;
  field: string | null;
  message: string;
}

export interface PublishCheckInput {
  title: string;
  theme: Theme;
  steps: DraftStep[];
  /** Step keys of gift steps that have a stored secret. Supplied by the server. */
  giftStepKeysWithSecret: ReadonlySet<string>;
}

/**
 * Content rules that must hold before a draft can be published. The API runs this and
 * additionally verifies media ownership, upload state and scan status. The editor runs the
 * same function to show problems early, but the server result is authoritative.
 */
export function publishIssues(input: PublishCheckInput): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const add = (stepKey: string | null, field: string | null, message: string) =>
    issues.push({ stepKey, field, message });

  if (input.title.trim().length === 0) add(null, 'title', 'Give your experience a title.');
  if (input.steps.length === 0) add(null, 'steps', 'Add at least one step.');
  if (input.steps.length > MAX_STEPS) add(null, 'steps', `Use at most ${MAX_STEPS} steps.`);
  for (const message of themeContrastIssues(input.theme.palette)) add(null, 'theme', message);

  const keys = new Set<string>();
  input.steps.forEach((step, index) => {
    if (keys.has(step.key)) add(step.key, 'key', 'Duplicate step identifier.');
    keys.add(step.key);

    switch (step.type) {
      case 'MESSAGE':
        if (step.config.heading.trim() === '' && richTextIsEmpty(step.config.body)) {
          add(step.key, 'body', 'Write a heading or a message.');
        }
        break;
      case 'IMAGE':
        if (!step.config.mediaId) add(step.key, 'mediaId', 'Upload an image.');
        if (step.config.alt.trim() === '') {
          add(step.key, 'alt', 'Describe the image for people using screen readers.');
        }
        break;
      case 'MULTIPLE_CHOICE':
        if (step.config.question.trim() === '') add(step.key, 'question', 'Write the question.');
        if (step.config.options.some((o) => o.label.trim() === '')) {
          add(step.key, 'options', 'Every option needs a label.');
        }
        if (step.config.requireCorrect && step.config.correctOptionId === null) {
          add(step.key, 'correctOptionId', 'Choose the correct answer, or stop requiring one.');
        }
        break;
      case 'YES_NO_CHOICE':
        if (step.config.question.trim() === '') add(step.key, 'question', 'Write the question.');
        break;
      case 'SCRATCH_REVEAL':
        if (step.config.hiddenText.trim() === '' && !step.config.hiddenMediaId) {
          add(step.key, 'hiddenText', 'Add text or an image to reveal.');
        }
        if (step.config.hiddenMediaId && step.config.hiddenMediaAlt.trim() === '') {
          add(step.key, 'hiddenMediaAlt', 'Describe the hidden image for screen readers.');
        }
        break;
      case 'GIFT_REVEAL':
        if (index !== input.steps.length - 1) {
          add(step.key, 'position', 'The final surprise must be the last step.');
        }
        if (!input.giftStepKeysWithSecret.has(step.key)) {
          add(step.key, 'secret', 'Add the surprise details the recipient will receive.');
        }
        break;
    }
  });

  const giftSteps = input.steps.filter((s) => s.type === 'GIFT_REVEAL');
  if (giftSteps.length > 1) add(null, 'steps', 'Use only one final surprise step.');

  for (const issue of flowIssues(input.steps)) issues.push(issue);
  return issues;
}

/** Steps as the path walker sees them: routing plus the quiz answer used for scoring. */
export function flowSteps(steps: readonly DraftStep[]): FlowStep[] {
  return steps.map((s) => ({
    key: s.key,
    type: s.type,
    next: s.next,
    correctOptionId: s.type === 'MULTIPLE_CHOICE' ? s.config.correctOptionId : null,
  }));
}

/** Values an ANSWER condition may compare against for a step, or null if it has no answer. */
export function answerChoices(step: DraftStep): { value: string; label: string }[] | null {
  if (step.type === 'MULTIPLE_CHOICE') {
    return step.config.options.map((o) => ({ value: o.id, label: o.label || o.id }));
  }
  if (step.type === 'YES_NO_CHOICE') {
    return [
      { value: 'YES', label: step.config.yesLabel },
      ...(step.config.noButton.mode === 'EVASIVE'
        ? []
        : [{ value: 'NO', label: step.config.noLabel }]),
      ...(step.config.maybeEnabled ? [{ value: 'MAYBE', label: step.config.maybeLabel }] : []),
    ];
  }
  return null;
}

/**
 * Branching rules that must hold before publishing: every route points at a real, different
 * step; answer conditions match what the step can actually be answered with; the flow has no
 * loops; every step can be reached; and a final surprise, if there is one, can be reached.
 */
export function flowIssues(steps: readonly DraftStep[]): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const keys = new Set(steps.map((s) => s.key));
  const flow = flowSteps(steps);

  steps.forEach((step) => {
    const routing = step.next;
    if (!routing) return;
    if (step.type === 'GIFT_REVEAL' && (routing.rules.length > 0 || routing.otherwise !== null)) {
      issues.push({
        stepKey: step.key,
        field: 'next',
        message: 'The final surprise always ends the experience.',
      });
      return;
    }
    const choices = answerChoices(step);
    const targets = [...routing.rules.map((r) => r.goto), routing.otherwise];
    for (const target of targets) {
      if (target === null || target === END) continue;
      if (target === step.key) {
        issues.push({
          stepKey: step.key,
          field: 'next',
          message: 'A step cannot lead back to itself.',
        });
      } else if (!keys.has(target)) {
        issues.push({
          stepKey: step.key,
          field: 'next',
          message: 'A route leads to a step that no longer exists.',
        });
      }
    }
    for (const rule of routing.rules) {
      const when = rule.when;
      if (when.kind === 'ANSWER') {
        if (!choices) {
          issues.push({
            stepKey: step.key,
            field: 'next',
            message: 'Only question steps can branch on the answer.',
          });
        } else if (!choices.some((c) => c.value === when.equals)) {
          issues.push({
            stepKey: step.key,
            field: 'next',
            message: 'A route depends on an answer this step no longer offers.',
          });
        }
      }
      if (when.kind === 'COMPLETED' && !keys.has(when.stepKey)) {
        issues.push({
          stepKey: step.key,
          field: 'next',
          message: 'A route depends on a step that no longer exists.',
        });
      }
    }
  });

  // Loops: depth-first search over every possible route.
  const state = new Array<0 | 1 | 2>(steps.length).fill(0);
  let loopAt: number | null = null;
  const visit = (i: number) => {
    if (loopAt !== null) return;
    state[i] = 1;
    for (const n of successors(flow, i)) {
      if (n === 'END') continue;
      if (state[n] === 1) loopAt = i;
      else if (state[n] === 0) visit(n);
      if (loopAt !== null) return;
    }
    state[i] = 2;
  };
  if (steps.length > 0) visit(0);
  if (loopAt !== null) {
    issues.push({
      stepKey: steps[loopAt]!.key,
      field: 'next',
      message: 'This route goes back to an earlier step, so the experience could never end.',
    });
    return issues;
  }

  // Reachability from the first step.
  const reached = new Set<number>();
  const queue = steps.length > 0 ? [0] : [];
  while (queue.length > 0) {
    const i = queue.shift()!;
    if (reached.has(i)) continue;
    reached.add(i);
    for (const n of successors(flow, i)) if (n !== 'END' && !reached.has(n)) queue.push(n);
  }
  steps.forEach((step, i) => {
    if (reached.has(i)) return;
    issues.push({
      stepKey: step.key,
      field: 'next',
      message:
        step.type === 'GIFT_REVEAL'
          ? 'No path leads to the final surprise, so nobody could open it.'
          : 'No path leads to this step. Connect it or remove it.',
    });
  });
  return issues;
}
