import type { Music, SoundEffect } from '@momentpath/contracts';
import { playEffect } from './effects';
import { song, type Song } from './songs';
import { makeImpulse, makeNoise, playNote, type Out } from './synth';

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const MUSIC_LEVEL = 0.55;
const DUCKED_LEVEL = 0.06;
const LOOKAHEAD = 0.35;

interface Playing {
  key: string;
  stop: () => void;
}

/**
 * Background music and sound effects for one player. Browsers only allow sound after the
 * visitor interacts, so nothing plays until `unlock()` is called from a tap or key press;
 * until then requests are remembered, not queued. Every call is safe to make at any time and
 * never throws — sound is decoration, never a reason for the player to fail.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicOut: Out | null = null;
  private sfxOut: Out | null = null;
  private wanted: { music: Music; url: string | null } = { music: { source: 'NONE' }, url: null };
  private playing: Playing | null = null;
  private muted = false;
  private ducked = false;
  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) void this.ctx.suspend().catch(() => {});
    else if (!this.muted) void this.ctx.resume().catch(() => {});
  };

  static supported(): boolean {
    return audioContextCtor() !== null;
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture. Starts any music that was asked for. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = audioContextCtor();
        if (!Ctor) return;
        const ctx = new Ctor();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 4;
        compressor.connect(ctx.destination);
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : 0.9;
        master.connect(compressor);
        const impulse = makeImpulse(ctx);
        const noise = makeNoise(ctx);
        // Music and effects each have their own reverb so ducking the music ducks its tail too.
        const bus = (level: number) => {
          const dry = ctx.createGain();
          dry.gain.value = level;
          dry.connect(master);
          const reverb = ctx.createConvolver();
          reverb.buffer = impulse;
          const wetLevel = ctx.createGain();
          wetLevel.gain.value = 0.5;
          reverb.connect(wetLevel).connect(dry);
          return { dry, reverb };
        };
        const music = bus(this.ducked ? DUCKED_LEVEL : MUSIC_LEVEL);
        const sfx = bus(0.9);
        this.ctx = ctx;
        this.master = master;
        this.musicBus = music.dry;
        this.musicOut = { ctx, dry: music.dry, wet: music.reverb, noise };
        this.sfxOut = { ctx, dry: sfx.dry, wet: sfx.reverb, noise };
        document.addEventListener('visibilitychange', this.onVisibility);
      }
      if (this.ctx.state !== 'running' && !this.muted) void this.ctx.resume().catch(() => {});
      this.sync();
    } catch {
      // No sound on this device; the experience works the same without it.
    }
  }

  /** What should play once sound is allowed (and not muted). */
  setMusic(music: Music, url: string | null = null): void {
    this.wanted = { music, url };
    this.sync();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      if (this.master && this.ctx)
        this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
      if (!muted && this.ctx?.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch {
      /* ignore */
    }
    this.sync();
  }

  /** Quietens the music while a voice note or video plays. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    try {
      if (this.musicBus && this.ctx)
        this.musicBus.gain.setTargetAtTime(
          ducked ? DUCKED_LEVEL : MUSIC_LEVEL,
          this.ctx.currentTime,
          0.3,
        );
    } catch {
      /* ignore */
    }
    this.sync();
  }

  effect(effect: SoundEffect): void {
    if (effect === 'NONE' || this.muted || !this.ctx || !this.sfxOut) return;
    try {
      playEffect(this.sfxOut, effect, this.ctx.currentTime + 0.01);
    } catch {
      /* ignore */
    }
  }

  dispose(): void {
    this.playing?.stop();
    this.playing = null;
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', this.onVisibility);
    const ctx = this.ctx;
    this.ctx = null;
    this.master = this.musicBus = null;
    this.musicOut = this.sfxOut = null;
    void ctx?.close().catch(() => {});
  }

  /** Starts, switches or stops the music to match what is wanted. */
  private sync(): void {
    const { music, url } = this.wanted;
    const key =
      music.source === 'LIBRARY'
        ? `lib:${music.track}`
        : music.source === 'UPLOAD' && url
          ? `url:${url}`
          : '';
    const active = key && this.ctx && !this.muted ? key : '';
    if ((this.playing?.key ?? '') === active) {
      if (this.playing && this.ctx?.state === 'suspended' && !document.hidden)
        void this.ctx.resume().catch(() => {});
      return;
    }
    this.playing?.stop();
    this.playing = null;
    if (!active) return;
    try {
      this.playing =
        music.source === 'LIBRARY'
          ? { key: active, stop: this.startSong(song(music.track)) }
          : { key: active, stop: this.startElement(url!) };
    } catch {
      this.playing = null;
    }
  }

  private startSong(s: Song): () => void {
    const ctx = this.ctx!;
    const base = this.musicOut!;
    // Each song gets its own fader so switching tracks crossfades instead of cutting.
    const fader = ctx.createGain();
    fader.gain.setValueAtTime(0, ctx.currentTime);
    fader.gain.linearRampToValueAtTime(s.gain ?? 1, ctx.currentTime + 2.5);
    fader.connect(base.dry);
    const wet = ctx.createGain();
    wet.gain.value = s.gain ?? 1;
    wet.connect(base.wet);
    const out: Out = { ...base, dry: fader, wet };
    const spb = 60 / s.bpm;
    const t0 = ctx.currentTime + 0.12;
    let index = 0;
    let loop = 0;
    const tick = () => {
      if (s.events.length === 0) return;
      const horizon = ctx.currentTime + LOOKAHEAD;
      for (let guard = 0; guard < 512; guard++) {
        const ev = s.events[index]!;
        const at = t0 + (loop * s.beats + ev.beat) * spb;
        if (at > horizon) break;
        // Notes that were missed (the tab was in the background) are skipped, not bunched up.
        if (at >= ctx.currentTime - 0.02)
          playNote(out, ev.voice, at, ev.midi, ev.dur * spb, ev.vel);
        index++;
        if (index >= s.events.length) {
          index = 0;
          loop++;
        }
      }
    };
    tick();
    const timer = window.setInterval(tick, 80);
    return () => {
      window.clearInterval(timer);
      try {
        const now = ctx.currentTime;
        fader.gain.cancelScheduledValues(now);
        fader.gain.setValueAtTime(fader.gain.value, now);
        fader.gain.linearRampToValueAtTime(0, now + 0.6);
        wet.gain.setTargetAtTime(0, now, 0.2);
        window.setTimeout(() => {
          fader.disconnect();
          wet.disconnect();
        }, 3000);
      } catch {
        /* context already closed */
      }
    };
  }

  /** The creator's own track, streamed by an <audio> element (not decoded into memory). */
  private startElement(url: string): () => void {
    const el = new Audio();
    el.src = url;
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = null;
    const level = () => (this.ducked ? 0.08 : 0.7);
    el.volume = 0;
    void el.play().catch(() => {});
    let raf = 0;
    const started = performance.now();
    const fadeIn = () => {
      const k = Math.min(1, (performance.now() - started) / 2000);
      el.volume = level() * k;
      if (k < 1) raf = requestAnimationFrame(fadeIn);
    };
    raf = requestAnimationFrame(fadeIn);
    const follow = window.setInterval(() => {
      if (performance.now() - started > 2000) el.volume = level();
    }, 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(follow);
      el.pause();
      el.removeAttribute('src');
      el.load();
    };
  }
}
