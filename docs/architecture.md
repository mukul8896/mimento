# Architecture

## Shape

A **modular monolith**: one repository, one PostgreSQL database, two separately deployable apps.

```text
Browser ──► Next.js web (apps/web) ──/bff/*──► NestJS API (apps/api) ──► PostgreSQL
   │             │  server components ───────────┘            │
   │             └─ anonymous owner cookie (no login)         └──► Object storage (S3 / MinIO / filesystem)
   └── signed media URLs ─────────────────────────────────────┘
```

- **Web** renders pages and holds the creator's secret token in an HttpOnly cookie. There are no
  accounts: the first visit to a creator route mints an anonymous owner (ADR 0005). Browser code
  never sees the token: every browser call goes to the same-origin **BFF** route
  (`/bff/api/v1/*`), which forwards to the API and attaches the credential. The BFF has no
  business logic.
- **API** owns every business rule, authorization decision and persistence operation.
- **Contracts** (`packages/contracts`) hold the Zod schemas for step configuration, themes, rich
  text, gifts and answers, plus pure rules (publish checks, answer checks, No-button behaviour).
  The API validates with them; the editor and player use the same schemas for rendering.
- **API client** is generated from the API's OpenAPI document (nestjs-zod → OpenAPI 3.1 →
  openapi-typescript), so request/response types are never hand-written twice.

## API modules (`apps/api/src/modules`)

| Module                                | Responsibility                                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| identity                              | Anonymous owner minting, owner/manage/operator token resolution, `/me`, data deletion endpoint                                         |
| experiences                           | Create (template/blank), list, detail, draft autosave with optimistic concurrency, lifecycle, permanent deletion, account data erasure |
| workflow                              | Server-side publish validation (content rules + media readiness/scan state)                                                            |
| publishing                            | Immutable version snapshots, share-link issue/rotation                                                                                 |
| recipient-sessions                    | Public recipient API: meta, sessions, answers, close, gift reveal, abuse report                                                        |
| responses                             | Creator results (aggregates + permitted individual answers)                                                                            |
| gifts                                 | Encrypted gift secrets, eligibility rule, one-time reveal                                                                              |
| media                                 | Signed uploads/downloads, byte-level validation, metadata stripping, storage adapters                                                  |
| templates                             | Curated templates (seeded)                                                                                                             |
| moderation / administration           | Reports, takedown/restore, content review, audit log                                                                                   |
| audit                                 | Security-relevant audit trail (no private content)                                                                                     |
| outbox                                | Transactional outbox + in-process worker (storage cleanup, identity deletion, retention)                                               |
| entitlements, payments, notifications | Reserved for Phase 2 (empty by design)                                                                                                 |

Provider ports live in `apps/api/src/providers` (storage implemented; payments, email, analytics
declared for Phase 2).

## Data model

See `prisma/schema.prisma`. Key rules:

- `Experience` holds ownership, lifecycle (`status`, `expiresAt`), moderation state and the
  **hash** of the share token (plus an AES-GCM ciphertext so the owner can copy the link again).
- `ExperienceVersion` number 0 is the single mutable draft; numbers ≥ 1 are published snapshots.
  A check constraint, a partial unique index and **database triggers** forbid changing a published
  version, its steps or its gift content.
- `Step.config` is JSONB but always validated by the discriminated schema in contracts on the way
  in and out.
- `Gift.payloadEnc` is AES-256-GCM with an HKDF-derived purpose key and AAD bound to
  `version:step`; publishing re-encrypts for the new version.
- `RecipientSession` stores only a token hash, the pinned version, progress timestamps and whether
  the recipient was told answers are shared — no IP, user agent or location.

## Lifecycle

```text
DRAFT ──publish──► PUBLISHED ──disable──► DISABLED ──enable──► PUBLISHED
                        │  └──expire / expiry date passes──► EXPIRED ──extend──► PUBLISHED
                        └──delete (any state)──► DELETED (content purged, tombstone kept)
Moderation takedown blocks publish/enable until an admin restores it.
```

Every public endpoint re-checks availability, so disabling, expiring, deleting or taking down an
experience fails closed immediately, including for sessions already in progress.

## Scaling notes

The API is stateless (sessions in cookies/DB, media in object storage). Rate limiting is
in-memory for Phase 1 (single instance); Phase 4 moves it to Redis. The outbox worker claims
rows with `FOR UPDATE SKIP LOCKED`, so several instances can run safely; Phase 2 moves it to a
BullMQ worker without changing producers.
