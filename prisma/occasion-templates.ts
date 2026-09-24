import {
  DEFAULT_THEME,
  PALETTE_PRESETS,
  richTextFromParagraphs,
  type PalettePresetName,
  type Theme,
  type TemplateField,
} from '@momentpath/contracts';
import type { TemplateDefinition } from './templates';

/**
 * Ready-made occasion templates. Each asks for a few personal details ({{name}}, {{from}} …)
 * and is publishable as soon as those are filled in. Everything seeds as FREE; the operator
 * decides which become paid (operator console → Templates).
 *
 * Small builders keep each template readable as a script of steps.
 */

const k = (n: number) => `00000000-0000-4000-8100-${String(n).padStart(12, '0')}`;

type FieldInput = Partial<TemplateField> & Pick<TemplateField, 'key' | 'label' | 'placeholder'>;

const name = (label = 'Their name', placeholder = 'Priya'): FieldInput => ({
  key: 'name',
  label,
  placeholder,
  fallback: 'you',
  required: true,
  maxLength: 40,
});
const from = (placeholder = 'Rahul'): FieldInput => ({
  key: 'from',
  label: 'Your name',
  placeholder,
  fallback: 'me',
  maxLength: 40,
});

const theme = (palette: PalettePresetName, extra: Partial<Omit<Theme, 'palette'>> = {}): Theme => ({
  ...DEFAULT_THEME,
  palette: { ...PALETTE_PRESETS[palette] },
  ...extra,
});

const message = (n: number, heading: string, ...paragraphs: string[]) => ({
  key: k(n),
  type: 'MESSAGE' as const,
  config: {
    heading,
    body: richTextFromParagraphs(...paragraphs),
    buttonLabel: 'Continue',
  },
});

const yesNo = (
  n: number,
  question: string,
  opts: { yes?: string; no?: string; evasive?: boolean; tries?: number; maybe?: boolean } = {},
) => ({
  key: k(n),
  type: 'YES_NO_CHOICE' as const,
  config: {
    question,
    yesLabel: opts.yes ?? 'Yes!',
    noLabel: opts.no ?? 'No',
    maybeEnabled: opts.maybe ?? false,
    maybeLabel: 'Maybe',
    noButton: opts.evasive
      ? { mode: 'EVASIVE' as const }
      : opts.tries
        ? { mode: 'AFTER_ATTEMPTS' as const, attempts: opts.tries }
        : { mode: 'IMMEDIATE' as const },
    evasiveMessage: 'Nice try! 😄',
  },
});

const choice = (n: number, question: string, options: string[]) => ({
  key: k(n),
  type: 'MULTIPLE_CHOICE' as const,
  config: {
    question,
    options: options.map((label, i) => ({ id: `option-${i + 1}`, label })),
    correctOptionId: null,
    requireCorrect: false,
    wrongAnswerMessage: 'Not quite — try again!',
  },
});

const scratch = (n: number, instructions: string, hiddenText: string) => ({
  key: k(n),
  type: 'SCRATCH_REVEAL' as const,
  config: {
    instructions,
    coverLabel: 'Scratch here',
    hiddenText,
    hiddenMediaId: null,
    hiddenMediaAlt: '',
    buttonLabel: 'Continue',
  },
});

const countdown = (
  n: number,
  title: string,
  targetAt: string,
  waitForIt: boolean,
  text: string,
) => ({
  key: k(n),
  type: 'COUNTDOWN' as const,
  config: {
    title,
    targetAt,
    message: richTextFromParagraphs(text),
    waitForIt,
    buttonLabel: 'Continue',
  },
});

const puzzle = (n: number, prompt: string, answer: string, hint: string) => ({
  key: k(n),
  type: 'PUZZLE' as const,
  config: {
    prompt,
    answer,
    hint,
    wrongMessage: 'Not quite — think back… 💭',
    buttonLabel: 'Check',
  },
});

const place = (n: number, title: string, placeName: string, when: string | null) => ({
  key: k(n),
  type: 'PLACE_REVEAL' as const,
  config: {
    title,
    revealLabel: 'Reveal',
    placeName,
    address: '',
    when,
    note: '',
    buttonLabel: 'Continue',
  },
});

const gift = (
  n: number,
  title: string,
  text: string,
  button: string,
  revealAt: string | null = null,
) => ({
  key: k(n),
  type: 'GIFT_REVEAL' as const,
  config: {
    title,
    message: richTextFromParagraphs(text),
    kind: 'PHYSICAL_MESSAGE' as const,
    revealButtonLabel: button,
    oneTimeReveal: false,
    revealAt,
  },
});

interface Recipe {
  key: string;
  name: string;
  description: string;
  occasion: string;
  emoji: string;
  title: string;
  theme: Theme;
  fields: FieldInput[];
  steps: { key: string; type: string; config: object }[];
  /** The message shown when the final surprise is opened; the creator can change it. */
  giftMessage: string;
}

function template(recipe: Recipe, position: number): TemplateDefinition {
  const giftStep = recipe.steps.at(-1)!;
  return {
    key: recipe.key,
    name: recipe.name,
    description: recipe.description,
    tier: 'FREE',
    position,
    version: 1,
    content: {
      title: recipe.title,
      theme: recipe.theme,
      occasion: recipe.occasion,
      emoji: recipe.emoji,
      fields: recipe.fields,
      steps: recipe.steps,
      giftDefaults: { [giftStep.key]: { kind: 'PHYSICAL_MESSAGE', message: recipe.giftMessage } },
    },
  };
}

const RECIPES: Recipe[] = [
  // ——— Birthday ———
  {
    key: 'birthday-wish',
    name: 'Birthday wish',
    description: 'A bright birthday greeting with a playful question and a scratch-card wish.',
    occasion: 'Birthday',
    emoji: '🎉',
    title: 'Happy birthday, {{name}}!',
    theme: theme('sunrise', { font: 'ROUNDED', animation: 'POP' }),
    fields: [name(), from()],
    steps: [
      message(
        1,
        'Happy birthday, {{name}}! 🎂',
        'Today is all about you.',
        'I made you something — tap continue.',
      ),
      yesNo(2, 'Ready for your birthday surprise?', {
        yes: 'Yes, show me!',
        no: 'Not yet',
        tries: 3,
      }),
      scratch(
        3,
        'Scratch to see my wish for you',
        'May this year bring you endless laughter, big adventures and every little thing you have been hoping for.',
      ),
      gift(4, 'A birthday present from {{from}}', 'One last thing…', 'Open my present'),
    ],
    giftMessage: 'Your present is waiting — ask {{from}} where to find it! 🎁',
  },
  {
    key: 'birthday-midnight',
    name: 'Midnight birthday countdown',
    description: 'Counts down to their birthday; the present unlocks at exactly the right moment.',
    occasion: 'Birthday',
    emoji: '⏰',
    title: 'Counting down to your birthday, {{name}}',
    theme: theme('midnight', { font: 'ROUNDED', animation: 'FADE' }),
    fields: [
      name(),
      from(),
      {
        key: 'birthday',
        label: 'Birthday (date and time)',
        placeholder: '',
        kind: 'datetime',
        required: true,
        suggest: 'IN_7_DAYS',
      },
    ],
    steps: [
      message(1, 'Psst, {{name}} 🤫', 'Something is on its way to you.'),
      countdown(
        2,
        'Your birthday is almost here',
        '{{birthday}}',
        false,
        'The present unlocks the moment your birthday begins.',
      ),
      choice(3, 'How should we celebrate?', [
        'Cake, obviously 🍰',
        'A big party 🎈',
        'A quiet dinner 🍝',
        'A surprise trip ✈️',
      ]),
      gift(
        4,
        'Happy birthday!',
        'It is time. Happy birthday from {{from}} 💛',
        'Open it now',
        '{{birthday}}',
      ),
    ],
    giftMessage: 'Happy birthday, {{name}}! Your present is ready — love, {{from}}.',
  },

  // ——— Festivals ———
  {
    key: 'diwali-wishes',
    name: 'Diwali wishes',
    description:
      'Light up their Diwali with warm wishes, a festive question and a blessing to reveal.',
    occasion: 'Festivals',
    emoji: '🪔',
    title: 'Happy Diwali, {{name}}!',
    theme: theme('festive', { font: 'SERIF', animation: 'FADE' }),
    fields: [name('Their name', 'Anjali'), from()],
    steps: [
      message(
        1,
        'Happy Diwali, {{name}}! 🪔',
        'May the festival of lights fill your home with joy, warmth and sweetness.',
      ),
      choice(2, 'What is your favourite part of Diwali?', [
        'The diyas ✨',
        'The sweets 🍬',
        'Rangoli 🌸',
        'Time with family 👨‍👩‍👧',
      ]),
      scratch(
        3,
        'Scratch to reveal your Diwali blessing',
        'May this Diwali bring you good health, new beginnings and prosperity all year long.',
      ),
      gift(4, 'A Diwali surprise from {{from}}', 'Shubh Deepavali!', 'Open my surprise'),
    ],
    giftMessage: 'Wishing you and your family a very happy and safe Diwali. — {{from}}',
  },
  {
    key: 'new-year-countdown',
    name: 'New Year countdown',
    description: 'A live countdown to midnight; their New Year message unlocks as the year turns.',
    occasion: 'Festivals',
    emoji: '🎆',
    title: 'Happy New Year, {{name}}!',
    theme: theme('midnight', { font: 'SANS', animation: 'POP' }),
    fields: [
      name(),
      from(),
      {
        key: 'midnight',
        label: 'New Year moment',
        placeholder: '',
        kind: 'datetime',
        required: true,
        suggest: 'NEXT_NEW_YEAR',
      },
    ],
    steps: [
      message(
        1,
        'Hey {{name}} 🥂',
        'A whole new year is about to begin. I saved something for the first minute.',
      ),
      countdown(
        2,
        'Counting down to the New Year',
        '{{midnight}}',
        false,
        'Come back at midnight — or keep this open and watch it happen.',
      ),
      choice(3, 'Your big wish for the new year?', [
        'Adventure 🌍',
        'Love 💕',
        'Success 🚀',
        'Peace and rest 🌿',
      ]),
      gift(
        4,
        'Happy New Year!',
        'Here is to the best year yet.',
        'Open my message',
        '{{midnight}}',
      ),
    ],
    giftMessage: 'Happy New Year, {{name}}! May every day of it be kind to you. — {{from}}',
  },
  {
    key: 'holi-wishes',
    name: 'Holi wishes',
    description: 'A burst of colour: a playful Holi greeting with a scratch-card wish.',
    occasion: 'Festivals',
    emoji: '🎨',
    title: 'Happy Holi, {{name}}!',
    theme: theme('holi', { font: 'ROUNDED', animation: 'POP' }),
    fields: [name(), from()],
    steps: [
      message(
        1,
        'Happy Holi, {{name}}! 🎨',
        'Wishing you a day full of colour, laughter and gujiya.',
      ),
      choice(2, 'Pick your Holi colour', ['Pink 💗', 'Yellow 💛', 'Green 💚', 'Blue 💙']),
      scratch(
        3,
        'Scratch the colours away',
        'May your life always be as bright and colourful as today!',
      ),
      gift(4, 'A Holi surprise', 'Bura na mano, Holi hai! 😄', 'Open it'),
    ],
    giftMessage: 'Happy Holi! Save me some gujiya. — {{from}}',
  },
  {
    key: 'raksha-bandhan',
    name: 'Raksha Bandhan',
    description: 'For a brother or sister: memories, a promise and a Rakhi surprise.',
    occasion: 'Festivals',
    emoji: '🧵',
    title: 'Happy Raksha Bandhan, {{name}}',
    theme: theme('sunrise', { font: 'SERIF', animation: 'FADE' }),
    fields: [name('Their name', 'Aarav'), from('Meera')],
    steps: [
      message(
        1,
        'Happy Raksha Bandhan, {{name}}! 🧵',
        'Through every fight and every laugh, you are still my favourite person.',
      ),
      choice(2, 'Who was the naughtier one growing up?', [
        'Definitely you 😏',
        'Okay… me 🙈',
        'Both of us 😂',
      ]),
      scratch(3, 'Scratch to read my promise', 'I will always be there for you — no matter what.'),
      gift(4, 'Your Rakhi gift from {{from}}', 'Because you deserve it.', 'Open my gift'),
    ],
    giftMessage: 'Happy Raksha Bandhan! Your gift is on its way. — {{from}}',
  },
  {
    key: 'eid-mubarak',
    name: 'Eid Mubarak',
    description: 'Warm Eid wishes, a moonlit blessing and a surprise to open.',
    occasion: 'Festivals',
    emoji: '🌙',
    title: 'Eid Mubarak, {{name}}!',
    theme: theme('crescent', { font: 'SERIF', animation: 'FADE' }),
    fields: [name('Their name', 'Ayaan'), from()],
    steps: [
      message(
        1,
        'Eid Mubarak, {{name}}! 🌙',
        'May this Eid bring peace to your heart and happiness to your home.',
      ),
      scratch(
        2,
        'Scratch to reveal your Eid blessing',
        'May all your prayers be answered and your days be filled with light.',
      ),
      gift(3, 'Your Eidi from {{from}}', 'A little something to make you smile.', 'Open my Eidi'),
    ],
    giftMessage: 'Eid Mubarak! Your Eidi is waiting. — {{from}}',
  },
  {
    key: 'christmas-wishes',
    name: 'Christmas wishes',
    description: 'A cosy Christmas message, a festive question and a present under the tree.',
    occasion: 'Festivals',
    emoji: '🎄',
    title: 'Merry Christmas, {{name}}!',
    theme: theme('evergreen', { font: 'SERIF', animation: 'FADE' }),
    fields: [name(), from()],
    steps: [
      message(
        1,
        'Merry Christmas, {{name}}! 🎄',
        'Wishing you warm lights, good food and the best company.',
      ),
      yesNo(2, 'Have you been good this year?', { yes: 'Of course! 😇', no: 'Umm…', tries: 2 }),
      choice(3, 'What is Christmas without…', ['Presents 🎁', 'Cake 🍰', 'Music 🎶', 'Family 🏡']),
      gift(4, 'A present under the tree', 'From {{from}}, with love.', 'Unwrap it'),
    ],
    giftMessage: 'Merry Christmas! Look under the tree 🎁 — {{from}}',
  },

  // ——— Love ———
  {
    key: 'valentine',
    name: 'Be my Valentine',
    description: 'Ask the big question — the No button runs away, so there is only one answer.',
    occasion: 'Love',
    emoji: '💘',
    title: 'A question for you, {{name}}',
    theme: theme('blush', { font: 'ROUNDED', animation: 'POP' }),
    fields: [name(), from()],
    steps: [
      message(1, 'Hi {{name}} 💌', 'I have been wanting to ask you something…'),
      yesNo(2, 'Will you be my Valentine?', { yes: 'Yes! 💖', no: 'No', evasive: true }),
      choice(3, 'Pick our Valentine plan', [
        'Dinner date 🍷',
        'Movie night 🎬',
        'A long walk 🌅',
        'Surprise me 🎁',
      ]),
      gift(4, 'Happy Valentine’s Day', 'You just made my day.', 'Open your surprise'),
    ],
    giftMessage: 'I will plan the perfect day. Can not wait! — {{from}}',
  },
  {
    key: 'proposal',
    name: 'Proposal',
    description: 'Walk them through your story with a memory puzzle before the big question.',
    occasion: 'Love',
    emoji: '💍',
    title: 'For you, {{name}}',
    theme: theme('lavender', { font: 'SERIF', animation: 'FADE' }),
    fields: [
      name(),
      from(),
      {
        key: 'firstPlace',
        label: 'Where you first met (they must guess it)',
        placeholder: 'Goa',
        required: true,
        maxLength: 60,
        fallback: '',
      },
    ],
    steps: [
      message(
        1,
        '{{name}}, this is our story 💜',
        'Every moment with you has been my favourite moment.',
      ),
      puzzle(2, 'Where did we first meet?', '{{firstPlace}}', 'Think back to the very beginning…'),
      message(3, 'You remembered 🥹', 'Then you already know how much you mean to me.'),
      yesNo(4, 'Will you marry me?', { yes: 'YES! 💍', no: 'No', evasive: true }),
      gift(5, 'Forever starts now', 'I love you.', 'Open my heart'),
    ],
    giftMessage: 'You have made me the happiest person alive. — {{from}}',
  },

  // ——— Celebrate ———
  {
    key: 'congratulations',
    name: 'Congratulations',
    description: 'Celebrate a win — a new job, a promotion or any big moment.',
    occasion: 'Celebrate',
    emoji: '🏆',
    title: 'Congratulations, {{name}}!',
    theme: theme('sunrise', { font: 'SANS', animation: 'POP' }),
    fields: [
      name(),
      from(),
      {
        key: 'achievement',
        label: 'What are you celebrating?',
        placeholder: 'the new job',
        fallback: 'this big moment',
        maxLength: 60,
      },
    ],
    steps: [
      message(1, 'Congratulations, {{name}}! 🏆', 'I am so proud of you for {{achievement}}.'),
      choice(2, 'How are you celebrating?', [
        'Party time 🎉',
        'Nice dinner 🍽️',
        'Sleep for a week 😴',
        'Straight to the next goal 🚀',
      ]),
      scratch(
        3,
        'Scratch for a little note',
        'You worked so hard for this — you earned every bit of it.',
      ),
      gift(4, 'A treat from {{from}}', 'Because winners deserve surprises.', 'Open my treat'),
    ],
    giftMessage: 'Drinks are on me! 🥂 — {{from}}',
  },
  {
    key: 'graduation',
    name: 'Graduation',
    description: 'A proud send-off for a graduate, with a wish for what comes next.',
    occasion: 'Celebrate',
    emoji: '🎓',
    title: 'Happy graduation, {{name}}!',
    theme: theme('ocean', { font: 'SANS', animation: 'SLIDE' }),
    fields: [name(), from()],
    steps: [
      message(1, 'You did it, {{name}}! 🎓', 'All those late nights paid off.'),
      choice(2, 'What is next?', [
        'A dream job 💼',
        'More studying 📚',
        'Travel the world 🌍',
        'A long nap 😴',
      ]),
      scratch(
        3,
        'Scratch to reveal my wish',
        'The world is lucky to have you. Go and make it yours.',
      ),
      gift(4, 'A graduation gift', 'Congratulations from {{from}}.', 'Open my gift'),
    ],
    giftMessage: 'So proud of you! Your gift is waiting. — {{from}}',
  },
  {
    key: 'wedding-wishes',
    name: 'Wedding wishes',
    description: 'Blessings for the happy couple, with a sweet question and a gift.',
    occasion: 'Celebrate',
    emoji: '💐',
    title: 'Congratulations, {{name}}!',
    theme: theme('lavender', { font: 'SERIF', animation: 'FADE' }),
    fields: [name('The couple', 'Riya & Karan'), from()],
    steps: [
      message(
        1,
        'Congratulations, {{name}}! 💐',
        'Wishing you a lifetime of love, laughter and adventures together.',
      ),
      choice(2, 'Honeymoon pick?', [
        'Beach 🏝️',
        'Mountains 🏔️',
        'A city break 🏙️',
        'Staying home 🏡',
      ]),
      scratch(3, 'Scratch for our wish', 'May your love grow stronger with every passing year.'),
      gift(4, 'A wedding gift from {{from}}', 'With all our love.', 'Open the gift'),
    ],
    giftMessage: 'Wishing you both a beautiful journey together. — {{from}}',
  },
  {
    key: 'new-baby',
    name: 'New baby',
    description: 'Welcome a new little one with warm wishes for the family.',
    occasion: 'Celebrate',
    emoji: '👶',
    title: 'Welcome, little one!',
    theme: theme('ocean', { font: 'ROUNDED', animation: 'FADE' }),
    fields: [name('Parents’ names', 'Neha & Arjun'), from()],
    steps: [
      message(1, 'Congratulations, {{name}}! 👶', 'Your family just got a whole lot sweeter.'),
      choice(2, 'Who will the baby take after?', [
        'Mum 💕',
        'Dad 💙',
        'Both 🥰',
        'The grandparents 😄',
      ]),
      gift(3, 'A gift for the little one', 'With love from {{from}}.', 'Open it'),
    ],
    giftMessage: 'Welcome to the world, little one! — {{from}}',
  },
  {
    key: 'good-luck',
    name: 'Good luck',
    description: 'A boost before an exam, interview or big day.',
    occasion: 'Celebrate',
    emoji: '🍀',
    title: 'Good luck, {{name}}!',
    theme: theme('meadow', { font: 'SANS', animation: 'SLIDE' }),
    fields: [
      name(),
      from(),
      {
        key: 'event',
        label: 'What is it for?',
        placeholder: 'your exam',
        fallback: 'the big day',
        maxLength: 60,
      },
    ],
    steps: [
      message(
        1,
        'Good luck with {{event}}, {{name}}! 🍀',
        'You have prepared for this. You have got this.',
      ),
      yesNo(2, 'Are you going to smash it?', {
        yes: 'Absolutely! 💪',
        no: 'I am nervous',
        tries: 3,
      }),
      scratch(3, 'Scratch for a reminder', 'Breathe. Believe. You are more ready than you think.'),
      gift(4, 'For afterwards', 'A treat is waiting when it is over.', 'Peek at my treat'),
    ],
    giftMessage: 'Whatever happens, I am proud of you. Treat is on me! — {{from}}',
  },

  // ——— Care ———
  {
    key: 'get-well-soon',
    name: 'Get well soon',
    description: 'Cheer someone up while they recover.',
    occasion: 'Care',
    emoji: '🌻',
    title: 'Get well soon, {{name}}',
    theme: theme('meadow', { font: 'ROUNDED', animation: 'FADE' }),
    fields: [name(), from()],
    steps: [
      message(1, 'Get well soon, {{name}} 🌻', 'Sending you a big warm hug and lots of rest.'),
      choice(2, 'What would cheer you up?', [
        'Soup 🍲',
        'A funny movie 😂',
        'A long nap 😴',
        'A visit 🤗',
      ]),
      gift(3, 'A little get-well surprise', 'Feel better soon.', 'Open it'),
    ],
    giftMessage: 'Rest up — I will bring your favourite snacks. — {{from}}',
  },
  {
    key: 'thank-you',
    name: 'Thank you',
    description: 'Say thanks in a way they will remember.',
    occasion: 'Care',
    emoji: '🙏',
    title: 'Thank you, {{name}}',
    theme: theme('meadow', { font: 'SERIF', animation: 'FADE' }),
    fields: [
      name(),
      from(),
      {
        key: 'reason',
        label: 'What are you thankful for?',
        placeholder: 'always being there',
        fallback: 'everything',
        maxLength: 80,
      },
    ],
    steps: [
      message(
        1,
        'Thank you, {{name}} 🙏',
        'Thank you for {{reason}}. It means more than you know.',
      ),
      scratch(2, 'Scratch for a little note', 'The world is better with people like you in it.'),
      gift(3, 'A thank-you from {{from}}', 'Just because.', 'Open it'),
    ],
    giftMessage: 'Thank you — truly. — {{from}}',
  },
  {
    key: 'sorry',
    name: 'I am sorry',
    description: 'Apologise sweetly — the No button is hard to catch.',
    occasion: 'Care',
    emoji: '🥺',
    title: 'I am sorry, {{name}}',
    theme: theme('blush', { font: 'ROUNDED', animation: 'FADE' }),
    fields: [name(), from()],
    steps: [
      message(1, 'I am sorry, {{name}} 🥺', 'I messed up, and I want to make it right.'),
      yesNo(2, 'Will you forgive me?', { yes: 'Okay, fine 💞', no: 'No', tries: 4 }),
      gift(
        3,
        'A peace offering',
        'Thank you for giving me another chance.',
        'Accept my peace offering',
      ),
    ],
    giftMessage: 'Your favourite dessert is on its way. Friends again? — {{from}}',
  },
  {
    key: 'farewell',
    name: 'Farewell',
    description: 'Say goodbye to a colleague or friend who is moving on.',
    occasion: 'Care',
    emoji: '👋',
    title: 'We will miss you, {{name}}',
    theme: theme('sunrise', { font: 'SANS', animation: 'SLIDE' }),
    fields: [name(), from('The team')],
    steps: [
      message(
        1,
        'We will miss you, {{name}} 👋',
        'Thank you for everything. It will not be the same without you.',
      ),
      choice(2, 'What will you miss most?', [
        'The coffee chats ☕',
        'The lunches 🍱',
        'The jokes 😂',
        'Us, obviously 🥹',
      ]),
      scratch(3, 'Scratch for our wish', 'Go and do amazing things. We are cheering for you.'),
      gift(4, 'A farewell gift from {{from}}', 'Stay in touch!', 'Open the gift'),
    ],
    giftMessage: 'Good luck on your next adventure! — {{from}}',
  },

  // ——— Family & friends ———
  {
    key: 'friendship',
    name: 'Friendship',
    description: 'Celebrate your best friend with a memory question and a surprise.',
    occasion: 'Family & friends',
    emoji: '🤝',
    title: 'For my best friend, {{name}}',
    theme: theme('sunrise', { font: 'ROUNDED', animation: 'POP' }),
    fields: [name(), from()],
    steps: [
      message(1, 'Hey {{name}} 🤝', 'Just a reminder that you are stuck with me forever.'),
      choice(2, 'How long have we been friends?', [
        'Since forever 🕰️',
        'Since school 🎒',
        'Since college 🎓',
        'Feels like forever 😄',
      ]),
      scratch(3, 'Scratch to see what I think of you', 'Best. Friend. Ever.'),
      gift(4, 'A friendship surprise', 'Love you, buddy.', 'Open it'),
    ],
    giftMessage: 'Our next plan is on me! — {{from}}',
  },
  {
    key: 'mothers-day',
    name: 'Mother’s Day',
    description: 'Thank your mum with memories, love and a surprise.',
    occasion: 'Family & friends',
    emoji: '🌷',
    title: 'Happy Mother’s Day, {{name}}',
    theme: theme('blush', { font: 'SERIF', animation: 'FADE' }),
    fields: [name('What you call her', 'Maa'), from()],
    steps: [
      message(
        1,
        'Happy Mother’s Day, {{name}} 🌷',
        'Thank you for every hug, every meal and every time you believed in me.',
      ),
      choice(2, 'Your best superpower?', [
        'Knowing everything 🔮',
        'The best food 🍛',
        'Endless patience 🧘',
        'Fixing anything 🛠️',
      ]),
      gift(3, 'For the best mum', 'With all my love.', 'Open my gift'),
    ],
    giftMessage: 'You deserve a day off — today I have planned everything. — {{from}}',
  },
  {
    key: 'fathers-day',
    name: 'Father’s Day',
    description: 'Celebrate your dad with a smile and a surprise.',
    occasion: 'Family & friends',
    emoji: '👔',
    title: 'Happy Father’s Day, {{name}}',
    theme: theme('ocean', { font: 'SANS', animation: 'FADE' }),
    fields: [name('What you call him', 'Papa'), from()],
    steps: [
      message(1, 'Happy Father’s Day, {{name}} 👔', 'Thank you for always being my hero.'),
      yesNo(2, 'Do you still have the best dad jokes?', {
        yes: 'Obviously 😎',
        no: 'Never!',
        tries: 2,
      }),
      gift(3, 'For the best dad', 'With love.', 'Open my gift'),
    ],
    giftMessage: 'Lunch is on me this weekend! — {{from}}',
  },
  {
    key: 'meet-me',
    name: 'Meet me here',
    description: 'Invite someone to a secret place and time, revealed step by step.',
    occasion: 'Love',
    emoji: '📍',
    title: 'A secret plan for {{name}}',
    theme: theme('lavender', { font: 'ROUNDED', animation: 'SLIDE' }),
    fields: [
      name(),
      from(),
      {
        key: 'where',
        label: 'Where to meet',
        placeholder: 'Marine Drive',
        required: true,
        maxLength: 60,
        fallback: '',
      },
      { key: 'when', label: 'When', placeholder: '', kind: 'datetime', suggest: 'IN_7_DAYS' },
    ],
    steps: [
      message(1, 'Hey {{name}} 🤫', 'I have a plan. Are you ready?'),
      yesNo(2, 'Are you free for a surprise?', { yes: 'Always! 😍', no: 'Busy…', tries: 3 }),
      place(3, 'Guess where we are going', '{{where}}', '{{when}}'),
      gift(4, 'See you there!', 'Dress comfy — the rest is a surprise.', 'One more thing'),
    ],
    giftMessage: 'I will be waiting. Do not be late! — {{from}}',
  },
];

export const OCCASION_TEMPLATES: TemplateDefinition[] = RECIPES.map((r, i) => template(r, 10 + i));
