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

  return issues;
}
