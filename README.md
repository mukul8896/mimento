# MomentPath (working name)

A no-code builder for private, interactive surprise pages. Creators build a linear sequence of
messages, photos, questions, a playful Yes/No, scratch cards and a final surprise, publish it to an
unguessable private link, and the recipient plays it on any phone without an account.

> Product and phase plan: [`interactive-surprise-builder-master-prompt.md`](interactive-surprise-builder-master-prompt.md) ·
> Current status: [`docs/phase-status.md`](docs/phase-status.md)

## Quick start (with Docker)

```bash
pnpm install
pnpm dev            # starts Postgres and MinIO; migrates; seeds; runs API :4000 and web :3000
```

Open http://localhost:3000 and start building. **There is no sign-up and no login** — the first
visit to a creator page mints an anonymous owner token into an HttpOnly cookie, and each surprise
also gets its own manage link for getting back to it from another device (see
[ADR 0005](docs/decisions/0005-no-accounts.md)).

Moderation tools live at `/operator`, which asks for the `ADMIN_TOKEN` from your `.env`.

No Docker yet? See [docs/runbook.md → Running without Docker](docs/runbook.md#running-without-docker).

## Commands

| Command                                                             | What it does                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`                                                          | Full local stack (Docker dependencies + apps with reload)              |
| `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm format:check` | Quality gates                                                          |
| `pnpm test`                                                         | Unit tests (contracts, API, web)                                       |
| `pnpm test:integration`                                             | API integration tests on a real, throwaway PostgreSQL                  |
| `pnpm test:e2e`                                                     | Playwright on desktop and a 360px touch phone (needs Postgres running) |
| `pnpm db:migrate` / `pnpm db:deploy` / `pnpm db:seed`               | Create migration (dev) / apply migrations / seed templates             |
| `pnpm openapi:generate`                                             | Regenerate `packages/api-client` after changing API DTOs               |

## Repository layout

```text
apps/api            NestJS REST API (/api/v1), domain modules, OpenAPI
apps/web            Next.js creator UI, recipient player (/e/[token]) and BFF proxy (/bff)
packages/contracts  Zod schemas + pure domain rules shared by API and web
packages/api-client Typed client generated from the OpenAPI document
packages/design-system  Accessible UI primitives
packages/config     Shared TypeScript / ESLint config
packages/test-utils Ephemeral PostgreSQL, token issuer, image fixtures
prisma/             Schema, migrations, template seed
infra/              Dockerfiles
docs/               Architecture, decisions, API, security, runbook, phase status
```
