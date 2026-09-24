# CLAUDE.md — Wish Revealer (wishrevealer.com)

Context for AI coding sessions. **Read `INSTRUCTION.md` first** for the current state (done, next,
blocked) and update it before you finish. `docs/phase-status.md` is the formal checklist.

## Product in one paragraph

A no-code builder for private, interactive surprise pages. A creator builds a linear sequence of
steps (message, image, multiple choice, Yes/No/Maybe, scratch reveal, final gift), publishes it to an
unguessable private link, and a recipient plays it without an account. The full spec is
`interactive-surprise-builder-master-prompt.md` — treat it as the source of truth.

## Working rules (from the spec — non-negotiable)

1. Work only on the approved phase. Phase 1 is implemented; **Phase 2 needs explicit owner approval**.
2. TypeScript strict; no `any` (ESLint enforces `no-explicit-any`).
3. Business logic lives in NestJS modules (`apps/api/src/modules/*`), never in React components or
   Next.js route handlers. `apps/web/src/app/bff/[...path]/route.ts` only forwards.
4. Every feature ships with tests. Never claim a command passed without running it.
5. Published `ExperienceVersion`s are immutable (enforced by DB triggers too).
6. Gift secrets: AES-256-GCM at rest; returned only by `POST /public/experiences/{token}/session/gift`
   after server-side eligibility; never in list/draft payloads, logs, HTML or server props.
7. The recipient Close control must work in every No-button mode; closing never records an answer.
8. Never log access tokens, share/session tokens, voucher values, message bodies or answers.
9. Mobile-first everywhere (creator UI and player). E2E runs on a 360px touch viewport.
10. Do not commit — the owner reviews and commits.

## Layout

- `apps/api` NestJS 11 (`/api/v1`), OpenAPI at `/api/v1/docs-json`. Tests: `src/**/*.test.ts` (unit),
  `test/*.int.test.ts` (integration on real Postgres via `@momentpath/test-utils`).
- `apps/web` Next.js 16 App Router. `src/proxy.ts` (CSP nonce, headers, auth refresh), `src/app/(creator)`,
  `src/app/e/[token]` (player), `src/components/{editor,player,creator}`, `e2e/` (Playwright).
  **Next 16 differs from older versions** — read `apps/web/node_modules/next/dist/docs/` before using an API.
- `packages/contracts` Zod schemas + pure rules (built to CJS; run its build after edits).
- `packages/api-client` generated — run `pnpm openapi:generate` after DTO/schema changes.
- `packages/design-system`, `packages/config`, `packages/test-utils`; `prisma/`; `infra/`; `docs/`.

## Commands

pnpm is pinned to 10.x. If missing: `npm i -g --prefix ~/.local/pnpm-10 pnpm@10.34.5` and add
`~/.local/pnpm-10/bin` to PATH.

- `pnpm dev` (Docker) or the no-Docker steps in `docs/runbook.md`
- `pnpm build | lint | typecheck | test | test:integration | test:e2e | format:check`
- `pnpm db:migrate | db:deploy | db:seed | db:generate`, `pnpm openapi:generate`

## Gotchas learned the hard way

- Versions are pinned on purpose (TS 5.9, Nest 11, Prisma 7.10, pnpm 10, ESLint 9) — see `docs/decisions/0002`.
- Node tsconfig: `module: node20`, `moduleResolution: node16` (editors on TS 6 reject node10).
- `@ZodResponse` needs an explicit `status`, and never use bare `z.string().nullable()` in API response
  schemas (becomes `string[]` in OpenAPI) — add a constraint like `.max(2000)`.
- Strict production CSP: libraries must not inject `<style>` tags without the nonce (Tiptap uses
  `injectCSS: false`; Radix gets the nonce via `get-nonce` in `components/csp-nonce.tsx`).
  `e2e/csp.spec.ts` catches regressions — run E2E against `next build && next start` before claiming done.
- Prisma blocks `migrate reset` for AI agents; never bypass it — create a new local database instead.
