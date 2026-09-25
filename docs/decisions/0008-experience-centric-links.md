# ADR 0008 — One experience, two links (no account model in the product)

**Status:** accepted 25 Sep 2026 (refines ADR 0005)

## Context

ADR 0005 removed sign-in but the product still looked like an account: a dashboard of drafts and
published surprises, an Account page, a creator-wide recovery link (`/r/<token>`) and passkeys.
Every "Use Template" added another draft to the list. The owner wants WishRevealer to feel like
buying individual experiences, not keeping an account.

## Decision

- Customer-facing, a surprise is **Create → Personalize → Preview → Publish → Pay → two links**:
  the **recipient link** (`/e/<token>`, to share) and the **private management link**
  (`/m/<token>`, to keep). `/m` opens _Manage Surprise_ for that one experience directly
  (`GET /me` now returns `managedExperienceId` for a manage-token request).
- **Removed** (owner decision; existing data is test data): the Dashboard, Account and Sign-in
  pages, the recovery link UI, `/forget`, and the web passkey pages/route. `/r/<token>` opens the
  home page and grants nothing. Navigation is Templates · Create · How it works.
- **Kept, invisible:** the owner token cookie (it ties unfinished work, autosave and uploads to
  this browser and authorises the published page to show the private link), manage tokens
  (hash + ciphertext, scoped to one experience by `AuthGuard`), `UserProfile`/`Principal`,
  ownership checks, audit, recipient tokens/sessions/PIN, rate limits, `ADMIN_TOKEN`.
- **Passkeys:** API module and tables kept dormant ("hide, keep working"); with no sign-in page
  nothing calls them. Re-adding the page from git history brings them back.
- **Unfinished surprises are temporary:** `DRAFT_RETENTION_DAYS` (default 30) — deleted after 30
  days without being opened or saved. Visiting the site no longer keeps drafts alive
  (`touchOwner` skips them). On Create Experience, unfinished work is offered back
  ("Continue your unfinished surprise?" → Continue / Start Over, which deletes it), so drafts do
  not pile up.
- **Standard warning**, everywhere: "Keep this link safe. WishRevealer does not require an
  account, so this private link is how you access and manage your surprise. We may not be able to
  restore access if you lose it."

## Consequences

- Losing the private link means losing management access; recipients are unaffected.
- A creator's unfinished surprise lives only in the browser that started it.
- Security is unchanged: same token entropy, hashing, scoping, non-enumerable 404s and limits.
