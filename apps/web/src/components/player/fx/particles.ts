/**
 * Emoji and confetti particles on a canvas that never takes pointer events. One layer shows
 * bursts (answers, reveals); another floats a few faint emoji behind the card.
 */

export interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  age: number;
  life: number;
  glyph: string | null;
  color: string;
  gravity: number;
  sway: number;
  alpha: number;
}

const CONFETTI_COLOURS = ['#ff5a7a', '#ffc53d', '#3ec7ff', '#7c5cff', '#39d98a', '#ff8a3d'];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const sprites = new Map<string, HTMLCanvasElement>();

/** Emoji are drawn once to an offscreen canvas and then blitted, which is much faster. */
function sprite(glyph: string): HTMLCanvasElement {
  let c = sprites.get(glyph);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    if (g) {
      g.font = `72px ${EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(glyph, 48, 54);
    }
    sprites.set(glyph, c);
  }
  return c;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

export class ParticleLayer {
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;
  private ctx: CanvasRenderingContext2D | null;
  private resize = new ResizeObserver(() => this.fit());
  private ambient: { glyphs: readonly string[]; count: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.resize.observe(canvas);
    this.fit();
  }

  private fit() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(rect.width * ratio));
    this.canvas.height = Math.max(1, Math.round(rect.height * ratio));
    this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private local(p: Point): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: p.x - rect.left, y: p.y - rect.top };
  }

  private size() {
    const rect = this.canvas.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  /** A burst from a point: emoji (or confetti when `glyphs` is empty). */
  burst(at: Point, glyphs: readonly string[], count: number, power = 1) {
    const { x, y } = this.local(at);
    for (let i = 0; i < count; i++) {
      const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const speed = rand(260, 620) * power;
      this.add({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: rand(-0.6, 0.6),
        vr: rand(-6, 6),
        size: glyphs.length ? rand(20, 38) * Math.min(power, 1.4) : rand(7, 12),
        age: 0,
        life: rand(1.1, 1.8),
        glyph: glyphs.length ? pick(glyphs) : null,
        color: pick(CONFETTI_COLOURS),
        gravity: 900,
        sway: 0,
        alpha: 1,
      });
    }
    this.start();
  }

  /** A full-screen shower from the top and two fountains from the bottom corners. */
  shower(glyphs: readonly string[]) {
    const { w, h } = this.size();
    const rect = this.canvas.getBoundingClientRect();
    for (let i = 0; i < 46; i++) {
      this.add({
        x: rand(0, w),
        y: rand(-h * 0.6, -20),
        vx: rand(-60, 60),
        vy: rand(80, 260),
        rot: rand(-1, 1),
        vr: rand(-4, 4),
        size: glyphs.length ? rand(22, 40) : rand(8, 13),
        age: 0,
        life: rand(2.6, 3.6),
        glyph: glyphs.length ? pick(glyphs) : null,
        color: pick(CONFETTI_COLOURS),
        gravity: 260,
        sway: rand(20, 60),
        alpha: 1,
      });
    }
    for (const side of [0, 1]) {
      const at = { x: rect.left + (side ? w - 10 : 10), y: rect.top + h - 10 };
      const { x, y } = this.local(at);
      for (let i = 0; i < 22; i++) {
        const angle = side
          ? rand(-Math.PI * 0.8, -Math.PI * 0.6)
          : rand(-Math.PI * 0.4, -Math.PI * 0.2);
        const speed = rand(500, 900);
        this.add({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: 0,
          vr: rand(-6, 6),
          size: glyphs.length ? rand(20, 34) : rand(7, 12),
          age: 0,
          life: rand(1.6, 2.4),
          glyph: glyphs.length ? pick(glyphs) : null,
          color: pick(CONFETTI_COLOURS),
          gravity: 800,
          sway: 0,
          alpha: 1,
        });
      }
    }
    this.start();
  }

  /** Keeps a few faint emoji drifting upwards; an empty list stops them. */
  setAmbient(glyphs: readonly string[], count = 9) {
    this.ambient = glyphs.length ? { glyphs, count } : null;
    this.particles = this.particles.filter((p) => p.gravity !== -1);
    if (this.ambient) this.start();
  }

  private spawnAmbient(initial: boolean) {
    if (!this.ambient) return;
    const { w, h } = this.size();
    this.add({
      x: rand(0, w),
      y: initial ? rand(0, h) : h + 30,
      vx: 0,
      vy: rand(-28, -14),
      rot: rand(-0.3, 0.3),
      vr: rand(-0.3, 0.3),
      size: rand(16, 30),
      age: 0,
      life: 60,
      glyph: pick(this.ambient.glyphs),
      color: pick(CONFETTI_COLOURS),
      gravity: -1, // marks an ambient particle
      sway: rand(8, 24),
      alpha: rand(0.18, 0.32),
    });
  }

  private add(p: Particle) {
    if (this.particles.length < 400) this.particles.push(p);
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.raf = this.particles.length || this.ambient ? requestAnimationFrame(frame) : 0;
    };
    this.raf = requestAnimationFrame(frame);
  }

  private step(dt: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const { w, h } = this.size();
    if (this.ambient) {
      const ambientCount = this.particles.filter((p) => p.gravity === -1).length;
      for (let i = ambientCount; i < this.ambient.count; i++) this.spawnAmbient(ambientCount === 0);
    }
    ctx.clearRect(0, 0, w, h);
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      const ambient = p.gravity === -1;
      if (ambient) {
        p.y += p.vy * dt;
        p.x += Math.sin(p.age * 0.8 + p.size) * p.sway * dt;
        if (p.y < -40 || !this.ambient) continue;
      } else {
        if (p.age >= p.life) continue;
        p.vy += p.gravity * dt;
        p.vx *= 1 - 1.2 * dt;
        p.vy *= 1 - 0.6 * dt;
        p.x += (p.vx + Math.sin(p.age * 3) * p.sway) * dt;
        p.y += p.vy * dt;
        if (p.y > h + 60) continue;
      }
      p.rot += p.vr * dt;
      const fade = ambient ? 1 : Math.min(1, (p.life - p.age) / (p.life * 0.35));
      ctx.globalAlpha = p.alpha * fade;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.glyph) {
        ctx.drawImage(sprite(p.glyph), -p.size / 2, -p.size / 2, p.size, p.size);
      } else {
        ctx.fillStyle = p.color;
        // Confetti flutters by squashing as it turns.
        ctx.fillRect(
          -p.size / 2,
          (-p.size / 4) * Math.abs(Math.cos(p.age * 8)),
          p.size,
          p.size / 2,
        );
      }
      ctx.restore();
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    this.particles = alive;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resize.disconnect();
    this.particles = [];
    this.ambient = null;
  }
}
