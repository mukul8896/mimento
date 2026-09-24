import { NO_MUSIC, type Music, type SoundEffect } from '@momentpath/contracts';
import { AudioEngine } from './engine';

/**
 * One shared engine for the editor's "listen" buttons. Each call comes from a click, so it can
 * unlock sound straight away.
 */
let engine: AudioEngine | null = null;
let stopTimer: number | null = null;

function shared(): AudioEngine {
  engine ??= new AudioEngine();
  engine.unlock();
  return engine;
}

export function previewEffect(effect: SoundEffect): void {
  shared().effect(effect);
}

/** Plays a track for a short while; returns a function that stops it early. */
export function previewMusic(music: Music, url: string | null, seconds = 20): () => void {
  const e = shared();
  e.setMusic(music, url);
  if (stopTimer !== null) window.clearTimeout(stopTimer);
  const stop = () => {
    if (stopTimer !== null) window.clearTimeout(stopTimer);
    stopTimer = null;
    e.setMusic(NO_MUSIC);
  };
  stopTimer = window.setTimeout(stop, seconds * 1000);
  return stop;
}

export function stopPreview(): void {
  if (stopTimer !== null) window.clearTimeout(stopTimer);
  stopTimer = null;
  engine?.setMusic(NO_MUSIC);
}
