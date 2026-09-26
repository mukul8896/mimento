import { z } from 'zod';

/**
 * How a step is presented to the recipient: the "scene". Content (what a step says and asks)
 * stays in its config; this is only direction — layout, motion, music level and the moment of
 * feedback after an answer. Everything is optional with defaults, so experiences made before
 * scenes existed play exactly as before.
 */

/** A template's overall character; it sets easing, speed and how strongly moments land. */
export const MOTION_PROFILES = [
  'PLAYFUL',
  'ROMANTIC',
  'CINEMATIC',
  'FESTIVE',
  'ELEGANT',
  'WARM',
  'NOSTALGIC',
] as const;
export const MotionProfileSchema = z.enum(MOTION_PROFILES);
export type MotionProfile = z.infer<typeof MotionProfileSchema>;

/**
 * CARD: content on a card (the classic look). FLOAT: text floats over the background.
 * FOCUS: one line dominates a quiet screen — for the question that matters most.
 */
export const SCENE_LAYOUTS = ['CARD', 'FLOAT', 'FOCUS'] as const;
export const SceneLayoutSchema = z.enum(SCENE_LAYOUTS);
export type SceneLayout = z.infer<typeof SceneLayoutSchema>;

export const SCENE_ENTRANCES = [
  'FADE',
  'FADE_UP',
  'SOFT_SCALE',
  'BLUR_REVEAL',
  'WORD_REVEAL',
  'LIGHT_REVEAL',
] as const;
export const SceneEntranceSchema = z.enum(SCENE_ENTRANCES);
export type SceneEntrance = z.infer<typeof SceneEntranceSchema>;

export const SCENE_TRANSITIONS = [
  'CROSSFADE',
  'SOFT_SLIDE',
  'BLUR',
  'ZOOM_THROUGH',
  'FADE_THROUGH_DARK',
  'FADE_THROUGH_LIGHT',
] as const;
export const SceneTransitionSchema = z.enum(SCENE_TRANSITIONS);
export type SceneTransition = z.infer<typeof SceneTransitionSchema>;

/** The big moment a step can end with, reserved for the emotional peak of an experience. */
export const CLIMAXES = [
  'NONE',
  'ROMANTIC',
  'PROPOSAL',
  'BIRTHDAY',
  'FESTIVAL',
  'LIGHT_BURST',
] as const;
export const ClimaxSchema = z.enum(CLIMAXES);
export type Climax = z.infer<typeof ClimaxSchema>;

export const SceneSchema = z
  .strictObject({
    layout: SceneLayoutSchema.default('CARD'),
    /** Defaults to the motion profile's entrance. */
    entrance: SceneEntranceSchema.optional(),
    /** How this scene hands over to the next one; defaults to the motion profile's. */
    transition: SceneTransitionSchema.optional(),
    /** Shown for a moment after they answer, before moving on ("You remembered 🥹"). */
    reaction: z.string().trim().max(120).default(''),
    /** Background music level while this scene is on screen, 0–1 (1 = full). */
    music: z.number().min(0).max(1).optional(),
    /** Played when they give the positive answer here (Yes), or when the reveal opens. */
    climax: ClimaxSchema.default('NONE'),
  })
  .meta({ id: 'Scene' });
export type Scene = z.infer<typeof SceneSchema>;

export const DEFAULT_SCENE: Scene = { layout: 'CARD', reaction: '', climax: 'NONE' };
