import {
  DEFAULT_THEME,
  PALETTE_PRESETS,
  richTextFromParagraphs,
  type Cover,
  type MotionProfile,
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

type CoverKind = Cover['kind'];

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
      theme: {
        ...DEFAULT_THEME,
        palette: { ...PALETTE_PRESETS.blush },
        animation: 'POP',
        music: { source: 'LIBRARY', track: 'LOVE_PIANO' },
        celebration: 'HEARTS',
      },
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
            yesReaction: { emoji: '😍💖🥰', sound: 'APPLAUSE' },
            noReaction: { emoji: '💔', sound: 'WOMP' },
            maybeReaction: { emoji: '🤔😏', sound: 'BOING' },
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
      theme: {
        ...DEFAULT_THEME,
        palette: { ...PALETTE_PRESETS.sunrise },
        animation: 'RISE',
        music: { source: 'LIBRARY', track: 'BIRTHDAY_BOX' },
        celebration: 'BALLOONS',
      },
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
            yesReaction: { emoji: '🎁🥳', sound: 'YAY' },
            noReaction: { emoji: '⏳', sound: 'BOING' },
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
        animation: 'FLIP',
        music: { source: 'LIBRARY', track: 'LOVE_PIANO' },
        celebration: 'HEARTS',
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
            yesReaction: { emoji: '💞♾️💍', sound: 'APPLAUSE' },
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

/**
 * Each experience moves at its own pace (docs/decisions/0009): celebrations are brisk and
 * bouncy, festivals and family moments warm, and the tender ones take their time. A template
 * that sets its own motionProfile (the Proposal) keeps it.
 */
export const PACE: Record<string, MotionProfile> = {
  // Brisk
  'date-invitation': 'PLAYFUL',
  'birthday-surprise': 'PLAYFUL',
  'birthday-wish': 'PLAYFUL',
  'birthday-midnight': 'PLAYFUL',
  'holi-wishes': 'PLAYFUL',
  'new-year-countdown': 'PLAYFUL',
  friendship: 'PLAYFUL',
  congratulations: 'PLAYFUL',
  graduation: 'PLAYFUL',
  'good-luck': 'PLAYFUL',
  'meet-me': 'PLAYFUL',
  // Warm
  'diwali-wishes': 'FESTIVE',
  'eid-mubarak': 'FESTIVE',
  'christmas-wishes': 'FESTIVE',
  'raksha-bandhan': 'FESTIVE',
  'thank-you': 'WARM',
  'mothers-day': 'WARM',
  'fathers-day': 'WARM',
  'new-baby': 'WARM',
  'wedding-wishes': 'WARM',
  // Tender
  anniversary: 'ROMANTIC',
  valentine: 'ROMANTIC',
  proposal: 'CINEMATIC',
  sorry: 'NOSTALGIC',
  'get-well-soon': 'NOSTALGIC',
  farewell: 'NOSTALGIC',
};

/**
 * How each surprise is opened: a sealed envelope for letters and love, a wrapped gift for
 * celebrations, a glowing light for festivals. The template's own emoji goes on the seal,
 * the box or in the light.
 */
/**
 * The line on each cover: a teaser that invites the tap without giving away the first scene.
 */
export const COVER_LINES: Record<string, string> = {
  'date-invitation': 'Psst… someone has a little question for you',
  'birthday-surprise': 'Something is wrapped up for your birthday',
  anniversary: 'A letter about us, sealed with love',
  'birthday-wish': '{{name}}, someone wrapped up your birthday',
  'birthday-midnight': '{{name}}, something is counting down to your day',
  'diwali-wishes': '{{name}}, a little light for your Diwali',
  'new-year-countdown': '{{name}}, your new year starts here',
  'holi-wishes': '{{name}}, a splash of colour is waiting',
  'raksha-bandhan': '{{name}}, a thread of love, just for you',
  'eid-mubarak': '{{name}}, a little moonlight for your Eid',
  'christmas-wishes': '{{name}}, something is waiting under the tree',
  valentine: '{{name}}, this letter has been waiting for you',
  proposal: '{{name}}, open this when your heart is ready',
  congratulations: '{{name}}, you earned this one',
  graduation: '{{name}}, a little something for the graduate',
  'wedding-wishes': '{{name}}, a gift for your happily ever after',
  'new-baby': 'A tiny gift for the newest little one',
  'good-luck': '{{name}}, a little luck, wrapped for you',
  'get-well-soon': '{{name}}, a warm letter to make you smile',
  'thank-you': '{{name}}, a few words I have been meaning to say',
  sorry: '{{name}}, I wrote this for you',
  farewell: '{{name}}, before you go…',
  friendship: '{{name}}, for the best friend in the world',
  'mothers-day': 'A letter full of love, just for you',
  'fathers-day': 'A letter for the best dad, just for you',
  'meet-me': '{{name}}, you are invited to something secret',
};

export const COVERS: Record<string, CoverKind> = {
  'date-invitation': 'ENVELOPE',
  anniversary: 'ENVELOPE',
  valentine: 'ENVELOPE',
  proposal: 'ENVELOPE',
  sorry: 'ENVELOPE',
  'meet-me': 'ENVELOPE',
  'thank-you': 'ENVELOPE',
  'mothers-day': 'ENVELOPE',
  'fathers-day': 'ENVELOPE',
  farewell: 'ENVELOPE',
  'get-well-soon': 'ENVELOPE',
  'birthday-surprise': 'GIFT',
  'birthday-wish': 'GIFT',
  'birthday-midnight': 'GIFT',
  congratulations: 'GIFT',
  graduation: 'GIFT',
  'new-baby': 'GIFT',
  friendship: 'GIFT',
  'good-luck': 'GIFT',
  'wedding-wishes': 'GIFT',
  'diwali-wishes': 'GLOW',
  'eid-mubarak': 'GLOW',
  'christmas-wishes': 'GLOW',
  'raksha-bandhan': 'GLOW',
  'holi-wishes': 'GLOW',
  'new-year-countdown': 'GLOW',
};

const paced = (t: TemplateDefinition): TemplateDefinition => {
  const theme = t.content.theme;
  const motionProfile = theme.motionProfile ?? PACE[t.key];
  const kind = COVERS[t.key];
  const line = COVER_LINES[t.key];
  const cover =
    theme.cover ??
    (kind ? { kind, emoji: t.content.emoji ?? '🎁', ...(line ? { line } : {}) } : undefined);
  return {
    ...t,
    content: {
      ...t.content,
      theme: {
        ...theme,
        ...(motionProfile ? { motionProfile } : {}),
        ...(cover ? { cover } : {}),
      },
    },
  };
};

export const TEMPLATES: TemplateDefinition[] = [...CLASSIC_TEMPLATES, ...OCCASION_TEMPLATES].map(
  paced,
);
