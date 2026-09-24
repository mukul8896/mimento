# INSTRUCTION.md — current application state

_Last updated: 2026-09-25 (Phase 2 live; 1-year retention; passkeys and email sign-in planned)._ Update this file at the end of every session.

## Status snapshot

**Phase 1 is implemented and verified locally. Accounts have since been removed (stage 1 below);
stages 2 and 3 are not started.**

| Area                                                                                    | State                                                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Contracts, Prisma schema/migrations/seed                                                | Done                                                                                               |
| API (all Phase 1 modules)                                                               | Done — 52 unit + 45 integration tests passing on real PostgreSQL                                   |
| Web (auth, dashboard, editor, preview, publish, manage/results, account, admin, player) | Done — builds, lint/type-check clean, 5 unit tests                                                 |
| Playwright E2E (desktop + 360px touch phone, axe, CSP)                                  | 36 passed / 1 skipped (touch-only test on desktop) against `next start`                            |
| Security audit (`pnpm audit --prod`)                                                    | Clean (transitive overrides in pnpm-workspace.yaml)                                                |
| Docker Compose, Dockerfiles                                                             | **Verified 2026-09-23** — services healthy, both images build, API + web serve                     |
| GitHub Actions CI                                                                       | Written, **not yet run** (no git remote)                                                           |
| Docs                                                                                    | README, docs/architecture.md, decisions/, api.md, privacy-security.md, runbook.md, phase-status.md |

## Retention: activity tracking and 1-year cleanup (2026-09-25)

Owner decision: **one year**. Without accounts nobody tells us they have left, so activity decides.

- **Schema** (migration `20260925090000_activity_and_retention`): `UserProfile.lastSeenAt`,
  `Experience.lastActivityAt`, `Experience.retentionWarnedAt` (for the email reminder, slice 3).
  Backfilled from `updatedAt` and the last recipient open.
- **What counts as use** (recorded at most every 12 h): any request with the owner cookie
  (`IdentityService.resolveOwner` → `RetentionService.touchOwner`, which also refreshes _all_ that
  owner's surprises); a manage link (that surprise); a recipient opening the link
  (`countOpen`). Activity clears `retentionWarnedAt`.
- **Sweep** (`apps/api/src/modules/experiences/retention.service.ts`, worker only, hourly —
  `RETENTION_SWEEP_MS`): surprises unused for `RETENTION_DAYS` (default 365, 0 = off) are purged
  through the normal `purge` (audit actor `SYSTEM`, media removed by the outbox); then owners with
  nothing left and no visit for as long become `DELETED` with their token hash cleared
  (`account.expired`). The operator profile is never touched.
- **Web**: summaries carry `keptUntil`; the manage page shows "Kept until"; the dashboard warns in
  the last 30 days. A creator whose key stopped working is sent to `/start-over`, which clears the
  cookies only after the API confirms a 401 (so it cannot sign anyone out), then a fresh owner is
  minted. Privacy policy updated.
- **Tests**: `retention.int.test.ts` (activity bumps, sweep of surprises then owners, 364-day
  surprise kept); E2E `recovery.spec.ts` (dead key replaced, kept-until shown).
- **Next slices**: passkeys (SimpleWebAuthn), then optional email magic link plus the "about to be
  deleted" reminder 14 days before `keptUntil` (needs SMTP credentials).

## Music, sound effects and celebrations (2026-09-24)

The player now reacts to every tap. All built-in audio is **synthesised in the browser with Web
Audio** — no audio files, no third-party hosts, nothing to license.

- **Contracts** (`packages/contracts/src/sound.ts`): `MUSIC_TRACKS` (8 built-in tracks),
  `SOUND_EFFECTS` (14), `CELEBRATIONS` (8), `ReactionSchema` (emoji + sound). `ThemeSchema` gained
  `music` (`NONE` | `LIBRARY` track | `UPLOAD` mediaId), `sounds` (bool) and `celebration`, plus
  `FLIP` and `RISE` animations — all with defaults, so stored themes and published versions parse
  unchanged. Yes/No steps gained `yesReaction`/`noReaction`/`maybeReaction`; quiz options gained an
  optional `emoji`. `themeMediaIds(theme)` returns the uploaded track id.
- **API**: an uploaded track goes through the same checks as other media — draft save requires the
  file to belong to the experience (`INVALID_MEDIA`), publish-check requires it to be ready audio
  (issue `field: 'music'`), and the recipient/moderation payloads include it in `media`. `getDraft`
  now parses the theme so defaults are filled in.
- **Web** (`apps/web/src/components/player/fx/`): `synth.ts` (instruments: music box, e-piano, pad,
  sitar, tabla, marimba, sleigh bells…), `songs.ts` (the tracks as note data; Happy Birthday,
  Jingle Bells, Auld Lang Syne and Pachelbel's Canon are public domain, the rest are original),
  `effects.ts`, `engine.ts` (lookahead scheduler, reverb, compressor, mute, ducking; uploads play
  through an `<audio>` element), `particles.ts` (canvas emoji/confetti bursts, full-screen shower,
  faint floating emoji), `fx.tsx` (`useFx()` context and the sound toggle).
- **Player behaviour**: sound starts on the first tap (browser rule); a sound toggle sits next to
  Close (preference saved in `localStorage` as `wr-sound`); Continue = pop + small burst; Yes/No/Maybe
  = the step's reaction (Yes also showers the screen); quiz right = ding + burst, wrong = buzzer +
  card shake; evasive No = boing + 😜; scratch reveal = sparkle; place reveal = whoosh; gift reveal
  = fanfare + shower; music ducks on video steps and while a voice note plays. Card entrances
  stagger; the main button glows (shadow only, so it never moves under a tap). Reduced motion turns
  off particles and CSS animations; sound is unaffected. Sound failures never break the player.
- **Editor**: Style → "Music & sounds" (listen to each track, pick one or upload your own song —
  the upload says to use only music you have the rights to — toggle tap sounds, pick a
  celebration). Yes/No form → "Reactions" (emoji + sound per answer, with a play button). Quiz
  answers have an emoji box.
- **Templates**: every template has a matching track, celebration and livelier animation; Yes/No
  steps have themed reactions; quiz labels ending in an emoji burst that emoji.
- **Tests**: contracts (defaults, music union), web unit (`fx/songs.test.ts`: note parsing, every
  track loops inside its length), integration (`new-steps.int.test.ts` → background music: library
  track reaches the recipient; uploads must be owned, audio, and are served), E2E `sound.spec.ts`
  (toggle persists, reactions don't block, editor picks save). Every track and effect was also
  rendered offline in Chromium: no NaN, peaks ≤ 0.35.
- **Local E2E note**: the local `.env` has `BILLING_ENABLED=true`, which makes template publishing
  in E2E fail on tier checks. Run E2E with billing off without editing `.env`:
  stop the Docker `api`/`web` containers, `pnpm build`, then from `apps/web`:
  `BILLING_ENABLED=false CI=1 node --env-file=../../.env node_modules/@playwright/test/cli.js test`.
- **Follow-up fixes (same day)**: quiz answer rows (the emoji box had taken the whole row and
  hidden the answer text and ✕); the editor preview now opens on the selected step and restarts
  there after each edit (`PreviewBackend` `startAt`; "Play from the start" plays it all); the
  preview phone frame no longer overflows narrow screens; long scratch-layer labels shrink/wrap.
- **Not done / ideas**: GIF stickers (Giphy/Tenor need API keys and CSP changes — creators can
  already upload a GIF in an image step); real recorded tracks (could add CC0 files later);
  gating uploads or premium tracks behind a paid tier (currently all free).

## Ready-made templates and a new landing page (2026-09-24)

- 26 templates: the 3 classics plus 23 occasion templates in `prisma/occasion-templates.ts`
  (birthday, midnight birthday, Diwali, New Year countdown, Holi, Raksha Bandhan, Eid, Christmas,
  Valentine, proposal, congratulations, graduation, wedding, new baby, good luck, get well,
  thank you, sorry, farewell, friendship, Mother's/Father's Day, meet me). Six new palettes.
- Templates declare a few `fields` ("Their name", "From", dates). Text uses `{{key}}`; creating
  fills them once (`fillTemplate`/`materializeTemplate` in contracts), then validates the result
  as ordinary draft steps. A string that is exactly a date placeholder becomes the ISO date
  (countdown targets, gift unlock times). `GET /templates/:key/preview` is public and fills in
  the examples so visitors can play a template before signing anything.
- **Free or paid is the operator's call**: every new template seeds as FREE; `/admin` → "Templates:
  free or paid" switches tier and visibility (`PUT /admin/templates/:key`, audited). The seed
  never overwrites tier or visibility on existing rows.
- Landing (`app/page.tsx`, `components/site/landing/*`): tap-to-open gift hero with confetti
  (motion, already a dependency), floating emoji background (CSS only), an in-page playable demo
  (preview backend, nothing stored), occasion-filtered gallery with a play-demo dialog, and
  "use this template" deep links to `/new?template=key`. `/new` got the same cards plus a short
  personalise sheet. WhatsApp share button on the share card and publish dialog. No paid assets
  or services: emoji, CSS and the existing motion library only.
- Tests: `templates.int.test.ts` (every template publishes as-is), `template-fields.test.ts`,
  `landing.mobile.spec.ts`. Full run: 75+23+80 unit, 104 integration, 57 E2E passed.
- Seen once in a full integration run and not reproducible in isolation or two reruns:
  `new-steps.int.test.ts` "locked countdown" returned non-400. Watch for it.

## Fix: new surprises "not found" with a manage-link cookie (2026-09-24)

- Reported from the owner's phone: creating a surprise succeeded but the editor said it did not
  exist. The browser held both its owner cookie and a manage-link cookie; the BFF sent only the
  manage token, whose scope is one experience.
- Now the BFF sends both, and `AuthGuard.resolve` picks: same owner → owner token; different
  owners → manage token only for its own experience, owner token otherwise (lists include the
  managed one via `Principal.alsoManagedExperienceId`). Browsers with only a manage link are
  minted an owner cookie on creator routes, so they can create too. A manage-only API caller
  gets `MANAGE_LINK_ONLY` instead of an orphaned surprise.
- Tests: `auth.int.test.ts` (both same-owner and other-owner cases), `recovery.spec.ts` E2E.

## Rebrand to Wish Revealer (2026-09-24)

- Every user-visible "MomentPath" is now **Wish Revealer** (header, titles, footer, policies,
  report dialog, results, API docs title, problem `type` URLs → `https://wishrevealer.com/problems/…`).
- **Deliberately unchanged:** the HKDF label `momentpath:<purpose>` in `common/crypto.ts` (changing
  it would make every stored gift code and share/manage link undecryptable — there is a comment),
  `@momentpath/*` package names, DB/bucket/compose names, and internal keys (`mp:` prefixes).
- Open item: `access.int.test.ts > scheduled gift reveal` failed once in a full run right after
  the unit tests and passed in 16 later runs; cause not found. Watch for it in CI.

## Phase 2d-2 — scheduling, PIN, short links, analytics (2026-09-24)

- Migration `20260924210000_access_and_analytics`: `Experience.opensAt`, `pinHash`, `pinFailures`,
  `pinLockedUntil`, `slug` (unique) and table `ExperienceDailyOpen` (experienceId, UTC day, opens).
- `PUT /experiences/:id/access` (opening time, PIN, short link; audit `access.updated` records
  which setting changed, never the PIN). A short link requires a PIN; removing the PIN while a
  link exists is refused (`SHORT_LINK_NEEDS_PIN`). Reserved names in `RESERVED_SLUGS`.
- Recipient: `meta` counts the open, hides the title while a PIN is set, returns `opensAt` and
  `pinRequired`. `POST …/sessions` takes an optional `{ pin }` (parsed in the controller because
  the body is optional). Errors: `NOT_YET_OPEN` (detail = ISO time), `PIN_REQUIRED`,
  `PIN_INCORRECT`, `PIN_LOCKED` (detail = unlock time). 10 wrong PINs lock for 15 minutes.
- `POST /public/links/:slug/sessions {pin}` → session + share token; the web `/p/[slug]` page
  stores the session and redirects to `/e/<token>`, so the PIN is asked once. Wrong name and wrong
  PIN give the same 403.
- Scheduled gift: `GIFT_REVEAL.config.revealAt`; eligibility reason `NOT_YET` → `GIFT_NOT_YET`.
- Results gained `opens`, `opensByDay` (30 days) and `reach` (sessions per step).
- Known trade-off (docs/privacy-security.md): the shared lockout lets someone with the link lock
  a surprise for 15 minutes.

## Phase 2d-1 — new step types (2026-09-24)

- Six step types (contracts `steps.ts`, DB enum migration `20260924190000_more_step_types`):
  `COUNTDOWN` (server refuses to continue before `targetAt` when `waitForIt`), `PUZZLE` (typed
  answer, answer kind `TEXT`, normalised compare on the server, answer stripped by `publicStep`),
  `PHOTO_GALLERY` (≤ 12 images, alt required), `VOICE_NOTE` (audio upload ≤ 10 MB: MP3/M4A/AAC/
  OGG/WebM, byte-checked, ClamAV-scanned, not re-encoded), `VIDEO` (YouTube/Vimeo link only,
  embedded via youtube-nocookie / player.vimeo.com with `referrerpolicy=strict-origin`),
  `PLACE_REVEAL` (tap to reveal place/time, Google Maps search link).
- CSP gained `media-src` (storage origin) and `frame-src` for the two video players only.
- Publish validator checks media kind per step (voice note = audio, others = image).
- **Fixed a Phase 1 bug:** `browserApi()` read `window` during server rendering, so the manage
  page (and operator console) threw on the server and fell back to client rendering with a 500.
- E2E: `new-steps.mobile.spec.ts` runs on desktop and the 360px touch profile.

## Phase 2c — branching and version history (2026-09-24)

- **Model** (`packages/contracts/src/flow.ts`): steps stay an ordered list; each may carry
  `next: { rules: [{ when, goto }], otherwise }`. Conditions: `ANSWER` (this step's option id or
  YES/NO/MAYBE), `SCORE_AT_LEAST` (correct quiz answers on the path), `DATE_ON_OR_AFTER` (UTC date
  when reached), `COMPLETED` (another step on the path). `goto` is a step key or `END`;
  `otherwise: null` = next in the list. Stored in the new `Step.routing` JSONB column
  (migration `20260924170000_step_routing`).
- **One path walker** (`walkPath`) is used by the API (which step may be answered next; the gift
  unlocks only when it is on the recipient's own path) and by the editor preview. Routing is
  stripped from recipient payloads (`publicStep`) because answer routes could reveal which answer
  leads to the surprise; the player's progress bar now counts completed steps.
- **Publish checks** (`flowIssues`): dangling/self routes, answer values a step cannot produce,
  loops, unreachable steps, unreachable final surprise. The final surprise must stay last and
  always ends the experience.
- **Tier:** any routing makes a draft a custom build (PRO), like changing a template's structure.
- **Editor:** "What happens next" under every step form (per-answer targets, extra conditions,
  fallback); "Flow" view with `@xyflow/react` 12.12.0 (mobile tab, desktop toggle; tap to edit,
  drag to set the fallback). React Flow injects no `<style>`; its CSS is imported statically.
  Deleting a step drops routes to it.
- **History:** `GET /experiences/:id/versions`, `POST …/versions/:number/restore` (audit
  `draft.restored`), editor "History" dialog. Restore re-encrypts gift secrets for the draft.
- Test hygiene: integration files share one database and run in parallel, so tests must not
  drain global queues (`outbox.processDue`, `MediaPipeline.processPending` — the latter takes an
  `experienceId` scope for this reason).

## Phase 2b — media worker and malware scanning (2026-09-24)

Owner decisions for the rest of Phase 2 (2026-09-24): **no email** (notifications and recipient
email verification become a paid feature later), **no translations** until the app is stable,
**voice notes uploaded / video as YouTube-Vimeo links** (video upload may become paid), and
**commit + push + deploy after each slice** (commits use the GitHub no-reply email, no tool
attribution).

- **No Redis** ([ADR 0007](docs/decisions/0007-background-jobs-without-redis.md)): jobs stay on the
  Postgres outbox/`SKIP LOCKED`. `PROCESS_ROLE` = `api` | `worker` | `all`; `src/worker.ts` boots the
  same modules without HTTP. Prod compose runs `api`, `worker` and `clamav` (`clamav/clamav-debian:1.4`,
  multi-arch; the Alpine image has no arm64 build). ~1 GB RAM for clamd.
- **MediaPipeline** (`modules/media/media-pipeline.ts`): READY + `processedAt IS NULL` is the job
  (backfills old uploads). Scan → CLEAN/INFECTED (infected: deleted, `status=REJECTED`, audit
  `media.infected`); clean → `-display` (≤1600 px) and `-thumb` (≤400 px) WebP via sharp 0.35.4.
  clamd errors → retried, never marked clean. Served URLs prefer the display copy.
- WebP/GIF metadata stripped at upload too (`image-inspection.ts`).
- Migration `20260924150000_media_pipeline` (displayKey, thumbKey, processedAt).
- Tests: fake clamd speaking real INSTREAM (`test/fake-clamd.ts`) + 5 pipeline integration tests;
  the real clamd was checked locally with a clean PNG, EICAR (flagged) and a 4 MB file.

## Phase 2 — approved 2026-09-24, slice 2a (payments) built

Owner approved Phase 2, delivered in slices: **2a payments** → 2b media/workers (ClamAV) → 2c
branching → 2d richer experiences. See `docs/phase-status.md`.

**2a is built and tested against fake providers; not yet run against the real sandboxes.**

- API `modules/payments`: Razorpay Payment Links and Dodo checkout sessions (hosted pages only),
  `GET/POST /experiences/:id/checkout`, `POST …/checkout/:orderId/confirm` (asks the provider),
  `POST /payments/webhooks/{razorpay,dodo}` (raw body, signature-verified, deduplicated), public
  `GET /pricing`, and an in-process reconciler. New tables `PaymentOrder`, `PaymentWebhookEvent`
  (migration `20260923182058_payments`).
- Web: unlock panel on the manage page (guesses India from timezone/locale, "Paying from outside
  India?" switch), `/experiences/:id/checkout` return page, `/webhooks/:provider` pass-through,
  `/pricing`, `/terms`, `/privacy`, `/refunds`, `/contact` + site footer. New web env
  `SUPPORT_EMAIL`, `OPERATOR_NAME`.
- Placeholder prices ₹99/₹199 and $2.99/$4.99 (`PRICE_*`), one-time per surprise.
- Tests: 69 unit, 68 integration (15 new payment tests), E2E 46 passed / 1 skipped against
  `next build && next start`.

**Deployed 2026-09-24** (commit `a81ceb3`) to wishrevealer.com: payments migration applied via the
`migrate` container, stack rebuilt, new pages live. `.env.production` has the payment settings as
blanks with `BILLING_ENABLED=false`, so nothing is charged and no provider is offered yet. Commits in
this repo use the GitHub no-reply email and carry no tool attribution (owner's request).

**Sandbox verified 2026-09-24** on wishrevealer.com with the owner's test keys:

- Razorpay: ₹99 UPI test payment → signed `payment_link.paid` webhook → PAID, Plus unlocked,
  published. A second attempt on the same link was refused by Razorpay (links are single-use).
- Dodo: an Indian billing address made Dodo charge INR (₹234.28 incl. tax) and the 4242 test card
  was declined; with a US address $1.99 succeeded → signed `payment.succeeded` webhook → PAID,
  Plus unlocked, published. Dodo **does** copy checkout `metadata.order_id` onto the payment.
- Found and fixed (local, not yet deployed): after a declined attempt the return page said "will
  unlock by itself"; the confirm response now has `attemptFailed` from the provider and the page
  shows "did not go through — try again".
- `DODO_PRODUCT_PLUS_TO_PRO` was a copy of the Plus product; blanked on the server until a $1.00
  upgrade product exists.

**Next for 2a (superseded list below kept for history):** owner provides Razorpay + Dodo test keys (put straight into `.env` /
`.env.production`, never in chat) → run a real sandbox purchase with each → fix any field-name
differences → deploy to the server with `BILLING_ENABLED=true` and register webhooks. Policy pages
are drafts and need legal review before live keys. Not covered by E2E: the unlock → provider →
return flow in a browser (needs a provider; covered at API level).

## First production deploy (2026-09-23)

- Contabo VPS `85.208.51.49` (Ubuntu 24.04, 4 vCPU / 8 GB, 2 GB swap, ufw allows 22/80/443 only).
  Docker 29, Node 24, pnpm 10.34.5. Repo cloned at `/root/mimento`, `.env.production` there (mode 600).
- Domain **wishrevealer.com** (bought on Cloudflare; A records for `@` and `www` → server, DNS only /
  grey cloud) since 2026-09-24. `www` redirects to the apex (Caddyfile). The old sslip.io host is no
  longer served; `.env.production.bak-sslip` on the server is the previous config.
- Migrations + seed applied; all four containers up; `/bff/api/v1/health` → ok.
- Migrations now run in a one-off `migrate` compose service (Dockerfile `migrate` stage, profile
  `release`), so hosts need only Docker. Verified on the server. Node/pnpm are still installed
  there from the first deploy but are no longer needed.
- R2 configured by the owner (bucket `momentpath-media`, CORS for the sslip.io origin); uploads work.
  As expected, publishing **with images** is blocked in production ("An image is waiting for its
  safety scan") because no scanner exists. Owner chose to leave it that way for now; text-only
  experiences publish. The ClamAV scanner (Phase 2) needs owner approval.
- Still open: password SSH login still enabled, no automated backups yet. Upload scanning is
  done (Phase 2b).

## Product change: no accounts (decided 2026-09-23, owner-approved)

Every comparable product (Gifft.me, GiftFeels, YoursToOpen, openme.gift) lets people build and send
without registering, and Keycloak was the most expensive thing to host. Registration and OIDC are
therefore removed. This supersedes the account model in the master prompt — **update that document
before the next session rebuilds what was taken out.**

Planned in three stages:

1. **Anonymous owner tokens + Keycloak removal — DONE.** See
   [ADR 0005](docs/decisions/0005-no-accounts.md) for the design and trade-offs.
2. Template tiers and entitlement checks (free / advanced / custom builder) — not started.
   `Experience.templateKey` and the Template model already exist, so this is mostly gating what is
   built rather than new features.
3. ~~Stripe Checkout~~ → **Razorpay (India) + Dodo Payments (elsewhere)**, anonymous, entitlement on
   the experience — built in Phase 2a, see below and [ADR 0006](docs/decisions/0006-payments-razorpay-and-dodo.md).

### What stage 1 changed

- **Identity is a secret token**, following the share-token pattern: a 256-bit owner token
  (`mp_owner` HttpOnly cookie, `x-owner-token`) minted by `POST /owners` on first visit to a creator
  route, plus a per-experience manage token (`x-manage-token`) that is scoped to that one experience
  so a shared recovery link cannot reach the owner's others.
- **`UserProfile` rows were kept** — only authentication changed, so ownership, results, audit and
  cascade deletion behave exactly as before. `subject` is now `anon:<uuid>`.
- **`ADMIN_TOKEN` replaces the realm role.** The operator gets a real profile row so audit entries
  keep a valid actor. Production refuses to boot without it. Web entry point: `/operator`.
- Removed: Keycloak (service, realm, `infra/keycloak`), `openid-client`, `iron-session`, the OIDC
  test issuer, the four web auth routes, and the split-horizon OIDC workaround added earlier today.
- Added: `/m/[token]` (manage link → cookie, keeping the token out of URLs and Referer headers),
  `/forget` (clear this device), `/operator` + `/operator/session`.

### Recovery after clearing browser data (added 2026-09-23)

Two links, both now surfaced in the UI and covered by `e2e/recovery.spec.ts`:

- **Manage link** (`/m/<token>`) — one experience, shown on that experience's manage page. Restores
  editing and its replies on any device.
- **Recovery link** (`/r/<token>`) — the owner token itself, shown on `/account` behind a reveal
  with a warning that it is a master key. Restores every experience the creator made.

The recovery link needs no new storage: the owner token is in the request's HttpOnly cookie, so the
server renders the link directly. It is never returned by the API, and the raw token is still only
ever stored as SHA-256.

Note that losing access does **not** break the surprise for its recipient — the share link is keyed
on `accessTokenHash`, independent of the creator's cookie, so it keeps playing and still records
answers.

### Known gaps from this change

- Recovery still depends on the creator **choosing to save a link**. Optional email capture at
  publish time, purely to send those links, is **not built** — it is the mitigation for people who
  save nothing. It would add PII, so `docs/privacy-security.md` needs updating with it.
- Abuse accountability is weaker: rate limits key on IP only and there is no identity to ban. This
  makes the upload-scanning production blocker more pressing, not less.

## Decisions taken with the owner

- Build Phase 1 directly without the plan-approval gate.
- Git repository initialised; **do not commit** — the owner reviews and commits.
- Docker is now installed and the Compose stack is verified (2026-09-23). The no-Docker path still
  works as a fallback: `pnpm local:postgres` (embedded PostgreSQL, data in `.local/postgres`, DB
  `momentpath_local`), a native Keycloak 26 distribution (`kc.sh start-dev --import-realm` with
  `infra/keycloak/momentpath-realm.json`), and the filesystem storage adapter. `.env` now points at
  the Compose database (`momentpath`); the pre-Docker copy is kept as `.env.bak-nodocker`.
- The app must be mobile friendly everywhere (creator UI too, not only the recipient player).

## Technical decisions worth knowing

- Versions pinned: TypeScript 5.9, NestJS 11, Prisma 7.10, pnpm 10, ESLint 9 (see CLAUDE.md for reasons).
- Node tsconfig uses `module: node20` / `moduleResolution: node16` (TS 6 in editors deprecates node10; node20
  allows CommonJS to require ESM-only packages such as `jose`).
- OpenAPI is generated as 3.1. Avoid bare `z.string().nullable()` in API response schemas — nestjs-zod +
  @nestjs/swagger turn it into `string[]`. Always add a constraint (e.g. `.max(2000)`).
- `@ZodResponse` must always pass `status`, otherwise only a `default` response is documented and the typed
  client returns `never`.
- Share tokens: 256-bit, stored as SHA-256 hash + AES-GCM ciphertext (owner can re-copy). The publish response
  never contains the token (it would be persisted in idempotency records); the web fetches `share-link` after.
- Recipient session token travels in the `x-recipient-session` header, stored in localStorage; never in URLs.

## Docker verification (2026-09-23) — five fixes it took

1. **MinIO images were unpullable.** `minio/minio` and `minio/mc` no longer exist on Docker Hub (the
   repositories 404). The same release tags are published on quay.io, so `docker-compose.yml` now uses
   `quay.io/minio/minio` and `quay.io/minio/mc`.
2. **API image build failed at `prisma generate`.** `prisma.config.ts` resolves `env('DATABASE_URL')`
   even for `generate`, and `.env` is excluded by `.dockerignore` (correctly). The build stage of
   `infra/docker/api.Dockerfile` now sets a placeholder `DATABASE_URL`; the runtime stage is a separate
   `FROM`, so nothing leaks into the final image.
3. **API container crashed on boot.** `apps/api/src/common/logging.ts` asked pino for the `pino-pretty`
   transport whenever `APP_ENV=development`, but pino-pretty is a devDependency absent from the
   production install — pino throws "unable to determine transport target". It now falls back to JSON
   logs when the package cannot be resolved (`prettyTransportAvailable()`, covered by unit tests).

4. **Sign in / Create experience were dead in the container.** `/login` returned 500 and `/register`
   sent the browser to `http://0.0.0.0:3000`. Two separate causes:
   - The web server ran OIDC discovery against `OIDC_ISSUER` (`http://localhost:8080/...`), which
     inside the container is the container itself → `ECONNREFUSED`. Fixed by split-horizon OIDC:
     Keycloak pins its frontend URL (`KC_HOSTNAME=http://localhost:8080`) and answers back-channel
     callers dynamically (`KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`), so one `iss` serves both sides;
     the web container discovers over the new optional `OIDC_INTERNAL_ISSUER`
     (`http://keycloak:8080/realms/momentpath`). `client.discovery` cannot be used for this (it
     requires discovery URL == issuer), so `lib/auth/oidc.ts` fetches the document and builds the
     `Configuration` itself — after asserting the advertised issuer equals `OIDC_ISSUER`. Unset
     outside containers, behaviour is unchanged.
   - `/register` and the proxy's login redirect derived their target from the request origin, which a
     standalone Next server bound to `0.0.0.0` reports as `http://0.0.0.0:3000`. Both now use
     `WEB_ORIGIN`, as `auth/callback` and `logout` already did.
5. **`web` did not wait for Keycloak.** `depends_on` now requires `keycloak: service_healthy`.

Verified after the fixes: postgres/keycloak/minio healthy, bucket created, `prisma migrate deploy` +
`db seed` against the Compose database, both images build, `GET /api/v1/health` → `{"status":"ok"}`,
`/api/v1/docs-json` → 200, web `/` → 200 with the CSP nonce, and `/bff/api/v1/health` → 200 (web →
API over the Compose network). A full Authorization Code + PKCE sign-in as `alice@example.test`
completes: `/login` → Keycloak → `/auth/callback` → `mp_session` cookie → `/dashboard` 200, and
authenticated `/bff/api/v1/experiences` calls (GET, POST, DELETE) succeed, which also confirms the API
accepts the `iss` that Keycloak now pins. The stack runs on the standard ports 3000/4000.

The Playwright suite also passes against the containers, run headed: **36 passed, 1 skipped** in 43s
(the skip is the touch-only evasive-No test, which the desktop project does not run). Note that
`playwright.config.ts` disables API rate limits only when it starts the API itself; with
`reuseExistingServer` it reuses the container, where all BFF traffic shares one source IP, so set
`RATE_LIMIT_DISABLED=true` on the `api` service for a container run (a compose override file is
enough — it was reverted afterwards).

Not covered: the CI workflow still has no remote to run on.

## Next steps

1. Owner: run `pnpm dev` (or `docker compose --profile app up`) and try the app; push to GitHub so CI runs.
2. Owner decisions pending (see the Phase 1 completion report): malware scanning approach,
   retention periods, product name/domain, legal review, Phase 2 approval and priorities.
3. After approval only: Phase 2 (branching + React Flow, payments, workers, scanning, etc.).
