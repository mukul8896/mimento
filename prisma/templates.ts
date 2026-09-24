import {
  DEFAULT_THEME,
  PALETTE_PRESETS,
  richTextFromParagraphs,
  type TemplateContentInput,
  type Tier,
} from '@momentpath/contracts';
import { OCCASION_TEMPLATES } from './occasion-templates';

/**
 * Curated templates. Step keys are placeholders replaced per experience; `{{field}}` text is
 * filled from the template's fields when an experience is created (contracts/template-fields).
 * `tier` only applies when a template is first seeded: after that the operator decides.
 */
export interface TemplateDefinition {
  key: string;
  name: string;
  description: string;
  /** What a creator must hold to publish this template unchanged. */
  tier: Tier;
  position: number;
  version: number;
  content: TemplateContentInput;
}

const k = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const CLASSIC_TEMPLATES: TemplateDefinition[] = [
  {
    key: 'date-invitation',
    name: 'Date invitation',
    description: 'Ask someone out with a playful Yes/No, pick the vibe and reveal the plan.',
    tier: 'FREE',
    position: 1,
    version: 1,
    content: {
      title: 'A little question for you',
      occasion: 'Love',
      emoji: '💌',
      theme: { ...DEFAULT_THEME, palette: { ...PALETTE_PRESETS.blush }, animation: 'POP' },
      steps: [
        {
          key: k(1),
          type: 'MESSAGE',
          config: {
            heading: 'Hey you 👋',
            body: richTextFromParagraphs(
              'I made this just for you. Tap continue when you are ready.',
            ),
            buttonLabel: 'Continue',
          },
        },
        {
          key: k(2),
          type: 'YES_NO_CHOICE',
          config: {
            question: 'Will you go on a date with me?',
            yesLabel: 'Yes!',
            noLabel: 'No',
            maybeEnabled: true,
            maybeLabel: 'Maybe',
            noButton: { mode: 'AFTER_ATTEMPTS', attempts: 3 },
            evasiveMessage: 'Are you sure? 🥺',
          },
        },
        {
          key: k(3),
          type: 'MULTIPLE_CHOICE',
          config: {
            question: 'Pick the vibe',
            options: [
              { id: 'dinner', label: 'Candle-lit dinner' },
              { id: 'movie', label: 'Movie night' },
              { id: 'picnic', label: 'Sunset picnic' },
            ],
            correctOptionId: null,
            requireCorrect: false,
            wrongAnswerMessage: 'Not quite — try again!',
          },
        },
        {
          key: k(4),
          type: 'SCRATCH_REVEAL',
          config: {
            instructions: 'Scratch to see when',
            coverLabel: 'Scratch here',
            hiddenText: 'Saturday at 7pm',
            hiddenMediaId: null,
            hiddenMediaAlt: '',
            buttonLabel: 'Continue',
          },
        },
        {
          key: k(5),
          type: 'GIFT_REVEAL',
          config: {
            title: 'The plan',
            message: richTextFromParagraphs('One last thing…'),
            kind: 'PHYSICAL_MESSAGE',
            revealButtonLabel: 'Show me the plan',
            oneTimeReveal: false,
          },
        },
      ],
      giftDefaults: {
        [k(5)]: {
          kind: 'PHYSICAL_MESSAGE',
          message: 'I will pick you up at 7. Wear something comfy!',
        },
      },
    },
  },
  {
    key: 'birthday-surprise',
    name: 'Birthday surprise',
    description: 'A warm birthday message, a memory quiz, a scratch card and a hidden present.',
    tier: 'PLUS',
    position: 2,
    version: 1,
    content: {
      title: 'Happy birthday!',
      occasion: 'Birthday',
      emoji: '🎂',
      theme: { ...DEFAULT_THEME, palette: { ...PALETTE_PRESETS.sunrise }, animation: 'SLIDE' },
      steps: [
        {
          key: k(1),
          type: 'MESSAGE',
          config: {
            heading: 'Happy birthday! 🎂',
            body: richTextFromParagraphs(
              'Another trip around the sun. I have a few surprises lined up for you.',
            ),
            buttonLabel: 'Let’s go',
          },
        },
        {
          key: k(2),
          type: 'MULTIPLE_CHOICE',
          config: {
            question: 'Which memory made me laugh the most this year?',
            options: [
              { id: 'trip', label: 'The road trip' },
              { id: 'cake', label: 'The cake disaster' },
              { id: 'karaoke', label: 'Karaoke night' },
            ],
            correctOptionId: null,
            requireCorrect: false,
            wrongAnswerMessage: 'Not quite — try again!',
          },
        },
        {
          key: k(3),
          type: 'SCRATCH_REVEAL',
          config: {
            instructions: 'Scratch for a birthday wish',
            coverLabel: 'Scratch here',
            hiddenText: 'May this year be your best one yet.',
            hiddenMediaId: null,
            hiddenMediaAlt: '',
            buttonLabel: 'Continue',
          },
        },
        {
          key: k(4),
          type: 'YES_NO_CHOICE',
          config: {
            question: 'Ready for your present?',
            yesLabel: 'Yes, please!',
            noLabel: 'Not yet',
            maybeEnabled: false,
            maybeLabel: 'Maybe',
            noButton: { mode: 'IMMEDIATE' },
            evasiveMessage: 'Nice try!',
          },
        },
        {
          key: k(5),
          type: 'GIFT_REVEAL',
          config: {
            title: 'Your present',
            message: richTextFromParagraphs('Here it is…'),
            kind: 'INSTRUCTION',
            revealButtonLabel: 'Reveal my present',
            oneTimeReveal: false,
          },
        },
      ],
      giftDefaults: {
        [k(5)]: { kind: 'INSTRUCTION', instructions: 'Look inside the blue box on your desk.' },
      },
    },
  },
  {
    key: 'anniversary',
    name: 'Anniversary',
    description:
      'Celebrate your time together with a quiz about the day you met and a final surprise.',
    tier: 'PLUS',
    position: 3,
    version: 1,
    content: {
      title: 'Happy anniversary',
      occasion: 'Love',
      emoji: '💞',
      theme: {
        ...DEFAULT_THEME,
        palette: { ...PALETTE_PRESETS.midnight },
        font: 'SERIF',
        animation: 'FADE',
      },
      steps: [
        {
          key: k(1),
          type: 'MESSAGE',
          config: {
            heading: 'Happy anniversary ❤️',
            body: richTextFromParagraphs('Every year with you is my favourite year.'),
            buttonLabel: 'Continue',
          },
        },
        {
          key: k(2),
          type: 'MULTIPLE_CHOICE',
          config: {
            question: 'Where did we first meet?',
            options: [
              { id: 'cafe', label: 'At a café' },
              { id: 'party', label: 'At a friend’s party' },
              { id: 'work', label: 'At work' },
            ],
            correctOptionId: null,
            requireCorrect: false,
            wrongAnswerMessage: 'Not quite — try again!',
          },
        },
        {
          key: k(3),
          type: 'YES_NO_CHOICE',
          config: {
            question: 'Shall we do another year together?',
            yesLabel: 'Always',
            noLabel: 'No',
            maybeEnabled: false,
            maybeLabel: 'Maybe',
            noButton: { mode: 'EVASIVE' },
            evasiveMessage: 'That button seems to be shy 😄',
          },
        },
        {
          key: k(4),
          type: 'GIFT_REVEAL',
          config: {
            title: 'A surprise for you',
            message: richTextFromParagraphs('Close your eyes… now open them.'),
            kind: 'PHYSICAL_MESSAGE',
            revealButtonLabel: 'Open my surprise',
            oneTimeReveal: false,
          },
        },
      ],
      giftDefaults: {
        [k(4)]: {
          kind: 'PHYSICAL_MESSAGE',
          message: 'Dinner is booked for Friday at our favourite place.',
        },
      },
    },
  },
];

export const TEMPLATES: TemplateDefinition[] = [...CLASSIC_TEMPLATES, ...OCCASION_TEMPLATES];
