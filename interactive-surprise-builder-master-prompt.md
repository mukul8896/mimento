# Interactive Surprise Builder — Product Requirements, Architecture, and AI Build Prompt

**Prepared:** 22 September 2026  
**Working product name:** MomentPath (placeholder; verify domain and trademark before use)

## How to use this document

Copy the section titled **Master Prompt for Claude or GitHub Copilot** into a new coding-agent conversation. Give the agent access to an empty repository. Tell it to implement only the current phase and stop at the phase checkpoint. Do not ask it to generate all phases in one pass.

The product is a no-code website where a creator builds a private, interactive sequence of messages, photographs, questions, puzzles, choices, and a final surprise or externally purchased gift voucher. The creator publishes the experience and shares a private link. The recipient opens it without installing an app.

---

# Recommended architecture

## Architectural decision

Build a **modular monolith**, not microservices, for the first releases. Keep the web application, API, and worker separately deployable, but keep one repository and one PostgreSQL database. Organize backend code into strict domain modules. This is faster and cheaper initially, while individual modules can be extracted later if traffic or team size requires it.

Do not place all business logic inside Next.js route handlers. Public rendering belongs in the web app; reusable business rules, publishing, responses, gifts, payments, moderation, and authorization belong in the API.

## Open-source-first technology stack

| Area | Primary choice | Reason | Replaceable paid option |
|---|---|---|---|
| Language | TypeScript | One language across web, API, workers and tests | None required |
| Monorepo | pnpm workspaces + Turborepo | Fast, simple shared packages and builds | GitHub hosted runners if CI grows |
| Web | Next.js App Router | SSR, private shared pages, metadata/OG images and strong React ecosystem | Vercel hosting is optional, not required |
| API | NestJS REST API | Strong module boundaries, validation, OpenAPI and background-job integration | None required |
| UI | Tailwind CSS + shadcn/ui primitives | Accessible, customisable and avoids proprietary design systems | Paid design assets only if desired |
| Animation | Motion for React | Polished transitions without building an animation engine | Lottie assets from a licensed marketplace |
| Rich text | Tiptap core | Open-source, headless and extensible | Tiptap paid collaboration features later |
| Flow UI | Simple ordered-step editor in Phase 1; React Flow in Phase 2 | Do not overbuild the MVP; graph UI becomes useful with branching | React Flow Pro only if its paid support/features are needed |
| API contracts | OpenAPI + generated TypeScript client + Zod at boundaries | Prevents web/API drift | None required |
| Database | PostgreSQL | Durable relational model, JSONB for step configuration, excellent scaling path | Neon, Supabase, AWS RDS or Crunchy Bridge |
| ORM/migrations | Prisma ORM | Mature schema, migrations and AI-tool familiarity | Direct SQL for specialised queries |
| Cache/jobs | Redis-compatible server + BullMQ | Delayed reveals, email, media jobs and rate-limit coordination | Upstash/Redis Cloud; add only when needed |
| Authentication | Keycloak using OIDC/OAuth 2.0 | Open source, self-hostable, supports social login and MFA | Managed Keycloak, Auth0, Clerk or WorkOS |
| File storage | S3-compatible object storage | Portable API and presigned uploads | Cloudflare R2, AWS S3, Backblaze B2 |
| Local file storage | MinIO-compatible development service or filesystem adapter | Local development without a cloud account | Never rely on local disk in production |
| Payments | Provider adapter; Razorpay first for India | UPI/cards and webhook support | Stripe for international sales |
| Email | SMTP adapter | Avoid vendor lock-in | Amazon SES, Postmark or Resend |
| Analytics | Umami for simple product analytics | Lightweight and self-hostable | PostHog Cloud when funnels/features are needed |
| Error monitoring | OpenTelemetry + structured logs | Vendor-neutral instrumentation | Sentry; GlitchTip for open-source error tracking |
| Testing | Vitest, Supertest and Playwright | Unit, API integration and end-to-end coverage | Managed cross-browser service later |
| Containers | Docker + Docker Compose | Reproducible local and production builds | Managed container platform |
| Infrastructure | OpenTofu when infrastructure becomes repeatable | Open-source infrastructure as code | Terraform Cloud or cloud-native tools |
| CI/CD | GitHub Actions | Straightforward lint/test/build/deploy gates | Self-hosted runner later |

Use current stable releases at implementation time. Pin exact versions through the lockfile and automated dependency updates. Do not use release candidates, canary versions, or experimental framework features for core flows.

## Suggested repository layout

```text
moment-path/
  apps/
    web/                 # Next.js creator UI and recipient player
    api/                 # NestJS REST API
    worker/              # BullMQ workers; added when Phase 2 needs them
  packages/
    api-client/          # Generated client from OpenAPI
    contracts/           # Shared types and Zod schemas where appropriate
    design-system/       # Reusable accessible UI components and themes
    config/              # ESLint, TypeScript and test configuration
    test-utils/          # Factories and fixtures
  prisma/
    schema.prisma
    migrations/
    seed.ts
  infra/
    docker/
    opentofu/            # Introduce only when deployment is stable
  docs/
    architecture.md
    decisions/
    api.md
    privacy-security.md
    runbook.md
    phase-status.md
  docker-compose.yml
  pnpm-workspace.yaml
  turbo.json
```

## Scalability principles

1. Keep the API stateless; store sessions, data and media outside the process.
2. Publish an immutable `ExperienceVersion`. Editing a published experience creates a new draft/version instead of silently changing what a recipient is viewing.
3. Use an outbox table for reliable domain events before introducing a message broker.
4. Put email, media processing, scheduled unlocks and payment reconciliation in idempotent jobs.
5. Put CDN caching only in front of genuinely public static assets. Recipient experiences must not leak through shared caches.
6. Use adapters for storage, payments, email and analytics so vendors can be changed.
7. Start with one PostgreSQL primary. Add indexes, read replicas and partitioning only from measured need.
8. Preserve module boundaries so `gifts`, `payments`, `notifications` or `analytics` can later become services.

---

# Delivery phases

## Phase 0 — Validate before building heavily

**Goal:** confirm that people will create and share an experience.

Deliver:

- Responsive landing page explaining the product.
- Three clickable example experiences: date invitation, birthday surprise and anniversary.
- Waitlist or early-access form.
- Five interviews with potential creators and five with recipients.
- Record the percentage who finish the demo, attempt to create one, and would pay.

Do not build payments, AI writing, a graph editor, a template marketplace or native mobile apps in this phase.

Exit criterion: at least a small group of real users completes the demo and asks to create its own link. Treat the precise threshold as a founder decision, not an engineering metric.

## Phase 1 — Basic usable MVP

**Goal:** a creator can build, preview, publish and share a safe linear experience.

### Included features

- Creator registration, login, logout and account deletion.
- Dashboard listing drafts, published experiences and basic completion counts.
- Create from one of three templates or start blank.
- Linear ordered-step editor with add, edit, duplicate, reorder and delete.
- Supported step types:
  - Welcome/message
  - Image with caption
  - Multiple-choice question
  - Yes/No/Maybe choice
  - Configurable No-button behaviour
  - Scratch-to-reveal card
  - Final surprise/gift reveal
- Theme settings: colours, type scale and a small approved animation set.
- Mobile preview and desktop preview.
- Draft autosave with visible save status.
- Publish to a high-entropy, unguessable private URL.
- Recipient player that requires no account.
- Recipient progress and answers stored in a session.
- Creator can see aggregate completion and submitted response, subject to privacy settings.
- Disable, expire and permanently delete an experience.
- `noindex`/`nofollow` on recipient pages; do not include them in a sitemap.
- Basic admin page for disabling abusive experiences and reviewing reports.
- Report-abuse link available to recipients.

### Phase 1 gift limitations

- A gift is an externally obtained voucher code, URL, QR image, written instruction or physical-gift message.
- The platform does not issue money, maintain a wallet, sell stored value, transfer funds between users or promise voucher validity.
- Encrypt voucher secrets at rest and never send them to the browser until server-side eligibility is satisfied.
- Support an optional one-time reveal flag, while warning the creator that screenshots cannot be prevented.

### Phase 1 acceptance criteria

- A new creator can publish an experience in under five minutes using a template.
- A recipient can complete it on a 360px-wide phone without horizontal scrolling.
- The final gift cannot be retrieved by directly calling the API before required steps are complete.
- A recipient can always close the experience without submitting an answer; closing must not be recorded as Yes or No.
- For each applicable choice step, the creator can configure the No button as immediately clickable, clickable after a number of evasive attempts, clickable after a time delay, or permanently evasive.
- The creator can optionally show a Maybe option. No mode may remove or obstruct the always-visible close control.
- An unpublished, disabled, expired or deleted experience is unavailable publicly.
- User A cannot read or edit User B's drafts, responses, media or gift data.
- Uploaded files are type/size validated and delivered through time-limited URLs.
- All Phase 1 critical paths pass Playwright tests in CI.

## Phase 2 — Branching, monetisation and richer experiences

**Goal:** turn the MVP into a differentiated product.

Add:

- Conditional branching: route by answer, score, date or completed step.
- Visual graph editor using React Flow, backed by the same workflow schema.
- Draft validation for unreachable steps, cycles and missing endings.
- Scheduled publishing and scheduled reveal.
- Optional PIN/passcode and recipient email verification.
- Countdown, puzzle, photo gallery, audio/voice note, video and location/date reveal steps.
- Multilingual UI and creator-authored content; begin with English and selected Indian languages.
- Payments for one-time premium publishing through Razorpay.
- Payment webhook signature verification, idempotency and reconciliation.
- Premium entitlements independent of payment-provider objects.
- Email notifications that reveal only necessary information.
- Redis/BullMQ workers for scheduled jobs, notifications and media processing.
- Image metadata stripping, malware scanning and thumbnails.
- Creator analytics: opens, starts, completions and step-level drop-off, without invasive precise-location tracking.
- Version history and restore for drafts.
- Custom slug with collision protection; the private access token must remain separate.

Phase 2 exit criterion: paid publishing works reliably, branching flows can be validated before publishing, and support can resolve a user issue from audit logs without inspecting private message contents unnecessarily.

## Phase 3 — Marketplace and business expansion

Add only after product-market evidence:

- Template marketplace with creator profiles, review and revenue-sharing rules.
- Gift-card provider partnerships through authorised APIs.
- Wedding planner, gift shop and event-agency workspaces.
- Team collaboration and approval workflow.
- AI writing assistance with explicit consent and clear indication of what data is sent to a model provider.
- Custom domains, white labelling and branded QR codes.
- Public API and signed webhooks.
- Referral and affiliate tracking.
- Advanced moderation, copyright complaints and repeat-abuser controls.
- Data export and organisation-level retention policies.

## Phase 4 — Scale based on evidence

- Multi-region CDN for static media.
- Horizontally scaled web/API instances.
- Shared cache and distributed rate limits.
- Separate media and notification workers.
- Read replicas and database connection pooling.
- Dedicated search only if template discovery requires it.
- Extract a service only when load, ownership or deployment independence justifies it.

Do not adopt Kubernetes, Kafka, Elasticsearch or microservices merely in anticipation of traffic.

---

# Core domain model

The exact schema may evolve, but preserve these concepts:

- `User`: creator/admin identity reference and account state.
- `Experience`: ownership, title, state, active version, privacy and lifecycle.
- `ExperienceVersion`: immutable published snapshot or mutable draft.
- `Step`: typed configuration, order and stable identifier.
- `Transition`: default and conditional destination step.
- `Theme`: visual tokens, not arbitrary CSS or JavaScript.
- `MediaAsset`: owner, storage key, status, MIME type, size and scan state.
- `RecipientSession`: anonymous random identifier, progress, consent timestamps and expiry.
- `Response`: session, step, validated answer and submission time.
- `Gift`: encrypted secret/payload, reveal rules and redemption state.
- `Template`: curated/versioned starting structure.
- `Entitlement`: feature access resulting from plan, purchase or administration.
- `Payment`: provider-neutral payment state and provider reference.
- `WebhookEvent`: provider event ID, verified payload hash and processing status.
- `AbuseReport`: target, category, evidence reference and resolution.
- `AuditLog`: security-relevant actions without sensitive message contents.
- `OutboxEvent`: reliable asynchronous work.

Use PostgreSQL foreign keys and transactions. Use JSONB for per-step configuration, but validate it with a discriminated schema for each step type. Do not put ownership, payment state or access-control decisions only inside JSON.

## Experience lifecycle

```text
DRAFT -> PUBLISHED -> DISABLED
                  -> EXPIRED
                  -> DELETED
```

Publishing must validate the graph, clone a stable snapshot and atomically change the active version. Deletion should immediately deny public access and enqueue media/data cleanup according to the retention policy.

---

# Security, privacy and trust requirements

1. Use OIDC Authorization Code flow with PKCE. Validate issuer, audience, expiry and signature in the API.
2. Authorize every creator operation by resource ownership; never trust a client-supplied user ID.
3. Generate private share tokens with at least 128 bits of cryptographic randomness. Prefer storing a one-way hash of the access token.
4. Never place voucher codes, private responses or recipient tokens in logs, analytics, URLs beyond the required share token, or error reports.
5. Encrypt voucher payloads with authenticated encryption such as AES-256-GCM. Keep encryption keys in a secret manager/environment for development and design key rotation.
6. Validate and sanitize rich text. Never render creator HTML, CSS, scripts, iframes or event handlers directly.
7. Apply CSP, secure cookies, CSRF protection where relevant, strict CORS, rate limiting, upload limits and security headers.
8. Use presigned media upload/download URLs. Validate server-side MIME, extension, size and image dimensions. Strip EXIF metadata and scan uploads asynchronously before publication.
9. Do not claim that a link is fully private merely because it is unlisted. Explain that recipients can forward links or take screenshots.
10. Provide deletion, expiry and data-export mechanisms. Define retention periods for recipient sessions, IP/security logs and deleted media.
11. Collect the minimum recipient data. Do not expose precise IP address, exact location, device fingerprint or read timestamps to creators.
12. Provide recipient reporting and an administrative takedown workflow.
13. The recipient must always have a clear close control and may leave without submitting an answer. Closing records no Yes/No response. The creator may configure the No button behaviour, but that configuration must never hide or obstruct the close control.
14. Do not auto-play copyrighted music. Use user-owned/licensed uploads or external links, and respect browser autoplay rules.

Before commercial launch in India, obtain review of the privacy notice, terms, content/moderation process, payment flow and gift-voucher design from an Indian technology lawyer.

---

# Testing strategy

Use the user's QA background as an advantage: treat automated tests as a release requirement.

## Unit tests

- Step-schema validation.
- Flow validation and branching decisions.
- Experience lifecycle transitions.
- Gift eligibility and one-time reveal logic.
- Entitlement checks.
- Payment webhook state machine and idempotency.

## API integration tests

- Authentication and object-level authorization.
- Draft create/update/version/publish.
- Recipient session progression.
- Response validation.
- Gift cannot be fetched early.
- Expiry, disable and delete behaviour.
- Duplicate webhook delivery.
- Upload restrictions and signed URL permissions.

Use a real ephemeral PostgreSQL database in integration tests rather than mocking the persistence layer.

## Playwright end-to-end tests

- Creator signs in, creates a template-based experience, previews and publishes.
- Recipient completes it on mobile and desktop viewports.
- Yes, No and Maybe all work with mouse, keyboard and touch semantics.
- Each configured No-button mode behaves correctly: immediate, after-attempts, after-delay and permanently evasive. The close control remains usable in every mode.
- Scratch reveal has a non-pointer accessible alternative.
- Creator sees the permitted result.
- Cross-user access is denied.
- Direct-navigation attempts cannot reveal the gift.
- Disabled and expired links show the correct neutral page.
- Payment upgrade completes using provider test mode and a signed webhook fixture.

Run accessibility checks and test reduced-motion mode. Animations must not be required to understand or complete the experience.

## CI quality gates

- Formatting
- Linting
- Type checking
- Unit tests
- API integration tests
- Production builds
- Playwright smoke tests
- Dependency/security scan
- Migration validation

---

# Deployment recommendation

## Local development

Docker Compose should start PostgreSQL, Keycloak, an S3-compatible local store, optional Redis, a local email catcher, API and web app. Provide seed users and sample experiences without real secrets.

## Low-operations production starting point

- Web: Vercel **or** the same container platform as the API.
- API/worker: Render, Railway, Fly.io, AWS App Runner/ECS or an equivalent managed container service.
- Database: managed PostgreSQL with automated backups and point-in-time recovery.
- Media: Cloudflare R2 or AWS S3.
- Payments: Razorpay for India through a provider adapter.
- Email: Postmark, SES or Resend through SMTP/API adapter.
- DNS/CDN/WAF: Cloudflare.
- Errors: Sentry or hosted GlitchTip.

The recommended purchases are managed PostgreSQL, object storage, transactional email and a payment gateway. These services remove high-risk operational work. Keep application code and interfaces portable so a provider can be replaced.

Define separate development, staging and production environments. Never reuse production credentials or personal media in test environments.

---

# Master Prompt for Claude or GitHub Copilot

Copy everything inside the following block.

```text
You are the lead product engineer and software architect for a production-quality SaaS named "MomentPath" (working name). Build it incrementally in a monorepo. It is a no-code interactive surprise-page builder. A creator creates a sequence of messages, images, questions, choices, scratch reveals and a final surprise or external voucher, publishes it, and shares a private link with a recipient. The recipient needs no account.

IMPORTANT WORKING RULES
1. Work only on the requested phase. Do not silently implement future phases.
2. Before writing code, inspect the repository and report: assumptions, proposed file tree, data model, API endpoints, security risks and implementation order.
3. If the repository is empty, initialise it. If it contains code, preserve existing conventions and do not overwrite unrelated work.
4. Use stable, supported releases available now. Pin exact versions in the lockfile. Avoid canary, beta and experimental features for core functionality.
5. Use TypeScript with strict mode. Do not use `any` to bypass errors.
6. Build a modular monolith with separately deployable web and API applications. Business logic belongs in backend domain modules, not React components or Next.js route handlers.
7. Add tests with every feature. Do not declare a phase complete until formatting, lint, type-check, unit tests, integration tests, builds and Playwright smoke tests pass.
8. Never fabricate successful command output. Show failures, identify the cause and fix them.
9. Keep `docs/phase-status.md` updated with completed, deferred and blocked work.
10. Stop at the phase checkpoint and ask for approval before proceeding to another phase.

REQUIRED STACK
- pnpm workspaces and Turborepo
- apps/web: Next.js App Router, React, Tailwind CSS, accessible component primitives and Motion for optional animations
- apps/api: NestJS REST API with OpenAPI
- PostgreSQL with Prisma migrations
- Keycloak through OIDC/OAuth 2.0; API validates access tokens and object ownership
- S3-compatible storage behind a storage adapter and presigned URLs
- Vitest for units, Supertest for API integration and Playwright for E2E
- Docker and Docker Compose for local services
- Zod or equivalent discriminated runtime schemas for step configuration
- Provider interfaces for payments, email, storage and analytics
- Redis/BullMQ is deferred until Phase 2 unless a Phase 1 requirement demonstrably needs it

REPOSITORY STRUCTURE
Create apps/web, apps/api, packages/api-client, packages/contracts, packages/design-system, packages/config, packages/test-utils, prisma, infra and docs. Generate a typed web client from the API's OpenAPI document. Do not duplicate handwritten request/response types between web and API.

ARCHITECTURE
Use bounded NestJS modules: identity, experiences, workflow, publishing, recipient-sessions, responses, gifts, media, templates, entitlements, payments, moderation, notifications, audit and administration. Some remain empty/deferred until their phase, but do not create fake implementations.

Use an immutable ExperienceVersion for every published snapshot. A draft can change, but a published version cannot be modified in place. Step configuration may use JSONB, but it must be runtime-validated by a discriminated schema. Ownership, lifecycle and access-control data must use proper relational columns and foreign keys.

PHASE 1 TO IMPLEMENT NOW
Implement a basic usable MVP:
- Creator register/login/logout using Keycloak.
- Creator dashboard for drafts and published experiences.
- Create from three seeded templates: date invitation, birthday surprise and anniversary.
- Linear step editor supporting add/edit/duplicate/reorder/delete.
- Step types: welcome/message, image with caption, multiple-choice question, configurable Yes/No/Maybe choice, scratch reveal and final gift/surprise.
- Theme controls restricted to safe design tokens: palette, type scale and approved animation style. Do not accept arbitrary CSS or JavaScript.
- Mobile and desktop preview.
- Debounced autosave with an explicit saving/saved/error state and optimistic-concurrency version field.
- Publish only after server-side validation.
- Recipient page accessible through a cryptographically random private token and no recipient account.
- Anonymous recipient session with progress and validated responses.
- Final gift reveal only after server-side requirements are satisfied.
- Creator can see completion count and permitted submitted responses.
- Disable, expire and permanently delete an experience.
- Basic admin list, takedown action, audit trail and recipient report-abuse form.
- `noindex,nofollow`, no sitemap entry and no unsafe caching for recipient pages.

CONFIGURABLE NO-BUTTON RULE
For every Yes/No choice, allow the creator to choose one of these modes:
- `IMMEDIATE`: No is normally clickable from the start.
- `AFTER_ATTEMPTS`: No evades pointer/touch activation for a configured number of attempts, then becomes normally clickable.
- `AFTER_DELAY`: No remains evasive or disabled for a configured number of seconds, then becomes normally clickable.
- `EVASIVE`: No remains non-clickable for the whole experience.

Allow an optional Maybe button. Validate sensible bounds for attempt counts and delays. Respect reduced-motion preferences by replacing motion with a non-animated state change where possible. An always-visible Close control must remain usable with mouse, keyboard, touch and assistive technology in every mode. Closing the experience submits no answer and must never be converted into Yes or No. Never record Yes without an explicit Yes action.

GIFT RULES
In Phase 1 a gift is only an external voucher code/link/QR image, redemption instruction or physical-gift message supplied by the creator. Do not issue a wallet, stored value or platform currency. Encrypt voucher secrets using authenticated encryption. Never include a secret in list endpoints, logs, analytics, HTML source, Next.js server props or initial page payload. Create a dedicated reveal endpoint that verifies session progress. Support optional one-time reveal and explain that screenshots cannot be prevented.

MINIMUM DATA MODEL
Implement UserProfile (external identity subject), Experience, ExperienceVersion, Step, MediaAsset, RecipientSession, Response, Gift, Template, AbuseReport, AuditLog and OutboxEvent. Use UUID primary keys internally. The public experience URL must use at least 128 bits of cryptographic randomness; store a one-way hash of the raw access token if practical. Add created/updated timestamps, foreign keys, lifecycle state and indexes for real query paths.

SECURITY REQUIREMENTS
- Validate OIDC signature, issuer, audience and expiry in the API.
- Every creator query/mutation must enforce resource ownership server-side.
- Sanitise rich text and never render creator-provided HTML, script, iframe, CSS or event attributes.
- Set CSP and security headers; use secure, HttpOnly, SameSite cookies where cookies are used; implement strict CORS and rate limits.
- Validate upload type, size and image dimensions server-side. Use presigned storage operations. Phase 1 may mark malware scanning as a documented production blocker if local scanning is not implemented, but unscanned files must never be publicly published in production mode.
- Do not log access tokens, share tokens, voucher values, private message bodies or recipient responses.
- Collect minimal recipient data. Do not expose IP address, exact location, device fingerprint or detailed read tracking to the creator.
- Ensure disabled, expired and deleted experiences fail closed.
- Add neutral error pages that do not reveal whether a private token once existed.

API DESIGN
Use versioned REST endpoints under `/api/v1`. Define DTO validation and OpenAPI for every endpoint. Use problem-details-style errors with a request ID. Include health/readiness endpoints. Use cursor pagination for dashboard/admin lists. Implement idempotency for publish, destructive operations and future webhook handling where appropriate.

TEST REQUIREMENTS
Unit-test schemas, lifecycle, flow validation and gift eligibility. Integration-test the API against an ephemeral real PostgreSQL database, including cross-user authorization. Add Playwright tests for creator creation/publish, recipient mobile completion, every No-button mode, optional Maybe, closing without a response, early gift-access denial, disable/expire behaviour and cross-user isolation. Include accessibility checks for the main creator and recipient paths. Do not rely only on snapshots.

LOCAL DEVELOPER EXPERIENCE
Provide `.env.example`, Docker Compose, migrations, seeds and one command for development. Include a local email catcher only if email is implemented. Never commit secrets. Document setup, architecture, API generation, migrations, tests, backup expectations and deployment assumptions.

PHASE 1 COMPLETION OUTPUT
When implementation is complete, provide:
1. concise architecture summary;
2. exact setup and test commands;
3. migration and seed instructions;
4. security controls implemented;
5. known limitations and production blockers;
6. test results;
7. proposed Phase 2 backlog, without implementing it.

PHASE 2 — DO NOT IMPLEMENT UNTIL APPROVED
Conditional branching and React Flow editor; graph validation; scheduled publish/reveal; PIN/email verification; countdown, puzzle, galleries, audio/video and location reveal; multilingual UI; Razorpay one-time payments through a payment adapter; entitlements; verified/idempotent webhooks; Redis/BullMQ jobs; media processing and scanning; privacy-conscious funnel analytics; draft version history; and custom slugs separated from private access tokens.

PHASE 3 — DO NOT IMPLEMENT UNTIL APPROVED
Template marketplace; authorised gift-provider integrations; business workspaces; collaboration; consent-aware AI writing; custom domains; white labelling; API/webhooks; referrals; expanded moderation and data exports.

Start by returning the Phase 1 implementation plan, architecture decisions, schema proposal, endpoint list, threat checklist and proposed repository tree. Then wait for confirmation before generating code.
```

---

# Guidance for working with the coding agent

After the agent returns its plan, review these points before saying “proceed”:

- Does it keep the gift secret server-side?
- Does it create immutable published versions?
- Does it enforce ownership in the API rather than only hiding UI buttons?
- Does the private URL have a random token rather than a person's name?
- Does it avoid arbitrary creator HTML/JavaScript?
- Can the recipient close the experience without submitting an answer in every No-button mode?
- Are Phase 2 features genuinely deferred?
- Are Playwright tests included in the plan?
- Can all local dependencies be started reproducibly?

Give the agent one phase or one vertical slice at a time. Recommended first slices:

1. Repository, local infrastructure, authentication and CI.
2. Experience/draft data model and creator dashboard.
3. Linear editor and preview.
4. Publish/versioning and recipient player.
5. Responses and gift reveal.
6. Media, moderation, security hardening and E2E coverage.

---

# Official technical references

- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- NestJS documentation: https://docs.nestjs.com/
- PostgreSQL licence: https://www.postgresql.org/about/licence/
- Keycloak documentation: https://www.keycloak.org/documentation
- React Flow documentation: https://reactflow.dev/
- Tiptap editor: https://tiptap.dev/product/editor
- BullMQ queues: https://docs.bullmq.io/guide/queues/
- Cloudflare R2 S3 compatibility: https://developers.cloudflare.com/r2/get-started/s3/
- OpenTelemetry JavaScript: https://opentelemetry.io/docs/languages/js/
- Playwright best practices: https://playwright.dev/docs/best-practices
- Razorpay webhooks: https://razorpay.com/docs/webhooks/
