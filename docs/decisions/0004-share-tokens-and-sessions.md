# ADR 0004 — Share tokens and recipient sessions

**Status:** accepted

- Share token: 32 bytes of CSPRNG output (256 bits), base64url. Stored as SHA-256 for lookup and as
  AES-GCM ciphertext (purpose-bound key) so the owner can copy the link again. The publish response
  never includes the token (it would otherwise be persisted in idempotency records); the owner
  fetches it from `GET /experiences/{id}/share-link` (no-store).
- Recipient session: another 256-bit token returned once, kept in the recipient's localStorage and
  sent in the `x-recipient-session` header — never in a URL — so progress resumes after a refresh.
  Header-based sessions are not vulnerable to CSRF.
- Recipient pages send `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex` and
  `Cache-Control: no-store`, and are excluded in robots.txt. There is no sitemap.
