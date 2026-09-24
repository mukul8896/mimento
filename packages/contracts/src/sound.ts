import { z } from 'zod';

/**
 * Sound and celebration tokens. Like colours and fonts they are a closed set: the web app
 * synthesises every built-in track and effect itself (Web Audio), so nothing is fetched from a
 * third party and there is nothing to license. A creator's own track is an uploaded audio file
 * that belongs to the experience, exactly like a voice note.
 */

/** Built-in background tracks. The melodies used are traditional and in the public domain. */
export const MUSIC_TRACKS = [
  'LOVE_PIANO',
  'BIRTHDAY_BOX',
  'PARTY',
  'FESTIVE',
  'JINGLE',
  'AULD_LANG_SYNE',
  'DREAMY',
  'PLAYFUL',
] as const;
export const MusicTrackSchema = z.enum(MUSIC_TRACKS);
export type MusicTrack = z.infer<typeof MusicTrackSchema>;

export const MUSIC_LIBRARY: Record<MusicTrack, { name: string; emoji: string; mood: string }> = {
  LOVE_PIANO: { name: 'Soft piano', emoji: '💞', mood: 'Romantic · Canon in D' },
  BIRTHDAY_BOX: { name: 'Birthday music box', emoji: '🎂', mood: 'Sweet · Happy Birthday' },
  PARTY: { name: 'Party pop', emoji: '🥳', mood: 'Upbeat · celebrations' },
  FESTIVE: { name: 'Festive lights', emoji: '🪔', mood: 'Sitar and tabla · festivals' },
  JINGLE: { name: 'Jingle bells', emoji: '🔔', mood: 'Christmas · sleigh bells' },
  AULD_LANG_SYNE: { name: 'Auld Lang Syne', emoji: '🎆', mood: 'New Year · bells' },
  DREAMY: { name: 'Dreamy stars', emoji: '✨', mood: 'Calm · heartfelt' },
  PLAYFUL: { name: 'Playful plucks', emoji: '🎈', mood: 'Fun · cheeky' },
};

export const MusicSchema = z
  .discriminatedUnion('source', [
    z.strictObject({ source: z.literal('NONE') }),
    z.strictObject({ source: z.literal('LIBRARY'), track: MusicTrackSchema }),
    /** The creator's own track: an audio file uploaded to this experience. */
    z.strictObject({ source: z.literal('UPLOAD'), mediaId: z.uuid() }),
  ])
  .meta({ id: 'Music' });
export type Music = z.infer<typeof MusicSchema>;
export const NO_MUSIC: Music = { source: 'NONE' };

/** Short effects played when the recipient taps, answers or opens something. */
export const SOUND_EFFECTS = [
  'NONE',
  'POP',
  'YAY',
  'APPLAUSE',
  'FANFARE',
  'DING',
  'CHIME',
  'SPARKLE',
  'BOING',
  'WOMP',
  'BUZZ',
  'WHOOSH',
  'DRUMROLL',
  'HEARTBEAT',
] as const;
export const SoundEffectSchema = z.enum(SOUND_EFFECTS);
export type SoundEffect = z.infer<typeof SoundEffectSchema>;

export const SOUND_EFFECT_LABELS: Record<SoundEffect, string> = {
  NONE: 'No sound',
  POP: 'Pop',
  YAY: 'Yay!',
  APPLAUSE: 'Applause',
  FANFARE: 'Ta-da fanfare',
  DING: 'Ding',
  CHIME: 'Chimes',
  SPARKLE: 'Sparkle',
  BOING: 'Boing',
  WOMP: 'Sad trombone',
  BUZZ: 'Buzzer',
  WHOOSH: 'Whoosh',
  DRUMROLL: 'Drum roll',
  HEARTBEAT: 'Heartbeat',
};

/** The shower of emoji or confetti used for taps, happy answers and the final reveal. */
export const CELEBRATIONS = [
  'CONFETTI',
  'HEARTS',
  'SPARKLES',
  'BALLOONS',
  'FESTIVE',
  'FLOWERS',
  'SNOW',
  'NONE',
] as const;
export const CelebrationSchema = z.enum(CELEBRATIONS);
export type Celebration = z.infer<typeof CelebrationSchema>;

export const CELEBRATION_LIBRARY: Record<Celebration, { name: string; emoji: readonly string[] }> =
  {
    CONFETTI: { name: 'Confetti', emoji: ['🎉'] },
    HEARTS: { name: 'Hearts', emoji: ['💖', '💕', '❤️', '💗'] },
    SPARKLES: { name: 'Sparkles', emoji: ['✨', '⭐', '🌟', '💫'] },
    BALLOONS: { name: 'Balloons', emoji: ['🎈', '🎉', '🥳', '🎊'] },
    FESTIVE: { name: 'Festive', emoji: ['🪔', '✨', '🎇', '🌟'] },
    FLOWERS: { name: 'Flowers', emoji: ['🌸', '🌼', '🌷', '🌺'] },
    SNOW: { name: 'Snow', emoji: ['❄️', '⛄', '✨', '🎄'] },
    NONE: { name: 'None', emoji: [] },
  };

const EMOJI_PART =
  /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200d|\ufe0f|\u20e3/gu;

/** Keeps only emoji characters (and their joiners), so an emoji box never shows ordinary text. */
export function emojiOnly(value: string): string {
  return (value.match(EMOJI_PART) ?? []).join('').slice(0, 16);
}

/** What happens when the recipient picks an answer: an emoji burst and a sound. */
export const ReactionSchema = z.strictObject({
  emoji: z.string().trim().max(16),
  sound: SoundEffectSchema,
});
export type Reaction = z.infer<typeof ReactionSchema>;

export const DEFAULT_REACTIONS = {
  yes: { emoji: '😍', sound: 'YAY' },
  no: { emoji: '🥺', sound: 'WOMP' },
  maybe: { emoji: '🤔', sound: 'BOING' },
} as const satisfies Record<string, Reaction>;
