# ADR 0009 — Premium experience system (scenes, motion, audio)

**Status:** accepted 26 Sep 2026

## Context

Recipient experiences were a sequence of identical cards with one entrance animation per
experience and a burst on almost every tap. The owner's brief: a mobile-first, emotional
journey where motion and sound follow a story arc, the climax is the strongest moment, free
surprises invite the recipient to make one, and paid ones end without branding.

## Decision

- **Scenes are direction, not content.** Each step may carry an optional `scene` (layout CARD /
  FLOAT / FOCUS, entrance, transition, reaction line, music level, climax), stored in
  `Step.scene` (migration `20260926170000_step_scene`). The theme may carry a `motionProfile`
  (PLAYFUL, ROMANTIC, CINEMATIC, FESTIVE, ELEGANT, WARM, NOSTALGIC). Templates compose these;
  no template has its own animation code.
- **Old experiences are untouched.** No `motionProfile` ⇒ the player uses the original
  animation and feedback (`profileOf` returns null). Published versions keep playing as published.
- **Stack (owner decision):**
  - **Motion** for choreography: scene enter and exit, reactions, the climax, the letter.
  - **CSS** for cheap effects: per-element stagger, word reveal, glow.
  - **Lottie** for designed illustrations. It uses lottie-web's _light SVG_ player (46 KB gzipped, no WebAssembly, no
    `eval`) — Rive/dotLottie would need `wasm-unsafe-eval` in the CSP. The player and files load
    lazily. Files must be shapes only: text layers make lottie inject `<style>` (blocked by CSP);
    `assets.test.ts` enforces it. No GSAP.
- **Audio (owner decision: hybrid).**
  - Recorded, licensed instrumentals for premium templates (`RECORDED_TRACKS`, files in
    `public/audio`, sources and licences in `public/audio/LICENSES.md`), streamed from the first tap.
  - Synthesised Web Audio for interaction, heartbeat, swell and reveal cues.
  - Per-scene music level glides.
  - Mute is always available, and nothing depends on sound.
- **Branding (owner decisions):** `PublicExperience.branded` is decided by the server — no
  PLUS/PRO entitlement ⇒ branded (footer + ending B after the finale); paid ⇒ no Wish Revealer
  branding at all. Report always stays.
- **Assets:** starter illustrations are original (`scripts/build-lottie.mjs`); licensed designed
  files can replace them without code changes.

## Consequences

- One template (Proposal) is on the system; others migrate one at a time by adding scene
  direction and a profile to their template definition.
- Not built yet:
  - scratch-card and multiple-choice interaction upgrades;
  - more reveal types (ticket, photo memory);
  - experience analytics events (the only analytics today are server-side counts);
  - intent-based template variants.
- Real-device checks (iPhone Safari, Android Chrome, WhatsApp and Instagram in-app browsers) are
  still owner tests: E2E emulates a 360 px touch phone.
