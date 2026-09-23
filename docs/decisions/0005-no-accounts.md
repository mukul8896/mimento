# ADR 0005 — No accounts: anonymous owner and manage tokens

**Status:** accepted (supersedes the Keycloak/OIDC parts of ADR 0001)

## Context

Every comparable product (Gifft.me, GiftFeels, YoursToOpen, openme.gift) lets someone build and send
a surprise without registering. Requiring sign-up costs conversion at exactly the wrong moment, and
Keycloak was also the most expensive component to host — a JVM service with its own database, for a
product whose creators visit once or twice.

## Decision

Registration and OIDC are removed. Identity is a secret token, following the pattern already used
for share tokens (ADR 0004):

- **Owner token** — 256-bit, minted by `POST /owners` the first time someone reaches a creator
  route, stored as SHA-256 in `UserProfile.ownerTokenHash` and held in an HttpOnly cookie
  (`mp_owner`). Sent upstream as `x-owner-token`. This is the whole creator identity.
- **Manage token** — 256-bit, minted per experience at creation, stored as SHA-256 in
  `Experience.manageTokenHash` plus AES-GCM ciphertext so the creator can copy the link again.
  Sent as `x-manage-token`; grants access to **that experience only** (`Principal.scopeExperienceId`),
  so sharing a recovery link cannot reach the owner's other experiences.
- **Operator token** — `ADMIN_TOKEN`, compared in constant time, for the moderation endpoints. It
  provisions a single `operator` profile so audit entries keep a valid actor reference. Unset leaves
  `/admin` closed rather than open, and production refuses to boot without it.

`UserProfile` rows are kept: only the authentication mechanism changed, so ownership, results,
audit logging and cascade deletion work exactly as before. `subject` holds `anon:<uuid>` instead of
an OIDC subject.

## Consequences

- Keycloak, `openid-client`, the OIDC environment variables and the four web auth routes are gone,
  along with the split-horizon discovery workaround the containerised setup needed.
- **Losing the cookie loses access** unless the creator saved a manage link. This is the central
  trade-off of the model; an optional email capture at publish time is the mitigation and is not
  yet built.
- Abuse accountability is weaker: rate limits can only key on IP, and there is no identity to ban,
  only content to take down. This makes upload scanning (already a production blocker) and the
  report flow more important, not less.
