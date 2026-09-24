import {
  DEFAULT_THEME,
  DraftStepSchema,
  PALETTE_PRESETS,
  richTextFromParagraphs,
  type PublicExperience,
} from '@momentpath/contracts';

const k = (n: number) => `00000000-0000-4000-8200-${String(n).padStart(12, '0')}`;

/** The landing page's playable surprise. It runs locally; nothing is sent anywhere. */
export const DEMO_EXPERIENCE: PublicExperience = {
  title: 'A tiny surprise for you',
  theme: {
    ...DEFAULT_THEME,
    palette: { ...PALETTE_PRESETS.blush },
    font: 'ROUNDED',
    animation: 'POP',
  },
  versionNumber: 0,
  responsesVisibleToCreator: false,
  media: [],
  steps: [
    {
      key: k(1),
      type: 'MESSAGE',
      config: {
        heading: 'Hey you 👋',
        body: richTextFromParagraphs('This is exactly what your loved one sees on their phone.'),
        buttonLabel: 'Show me',
      },
    },
    {
      key: k(2),
      type: 'YES_NO_CHOICE',
      config: {
        question: 'Do you like surprises?',
        yesLabel: 'Yes! 😍',
        noLabel: 'No',
        maybeEnabled: false,
        noButton: { mode: 'EVASIVE' },
        evasiveMessage: 'Nice try! The No button runs away 😄',
      },
    },
    {
      key: k(3),
      type: 'MULTIPLE_CHOICE',
      config: {
        question: 'Who would you surprise first?',
        options: [
          { id: 'partner', label: 'My partner 💕' },
          { id: 'family', label: 'Family 🏡' },
          { id: 'friend', label: 'My best friend 🤝' },
          { id: 'me', label: 'Myself, obviously 😎' },
        ],
      },
    },
    {
      key: k(4),
      type: 'SCRATCH_REVEAL',
      config: {
        instructions: 'Scratch to see what you can make',
        hiddenText: 'Birthdays, Diwali, proposals, apologies — anything worth a smile.',
      },
    },
    {
      key: k(5),
      type: 'GIFT_REVEAL',
      config: {
        title: 'Your turn!',
        message: richTextFromParagraphs('Ready to make someone’s day?'),
        revealButtonLabel: 'Reveal my surprise',
      },
    },
  ].map((s) => DraftStepSchema.parse(s)),
};

export const DEMO_GIFT = 'Make one for someone you love — it takes about two minutes. 🎁';
