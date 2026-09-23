# Phase status

_Updated 22 Sep 2026._ Phase 1 implemented; awaiting owner review before Phase 2.

## Phase 1 — Basic usable MVP

### Completed

- Creator identity without registration: anonymous owner token, per-experience manage link,
  data deletion (see [ADR 0005](decisions/0005-no-accounts.md)).
- Dashboard with drafts/live/inactive filters, cursor pagination and open/completed counts.
- Create from three seeded templates (date invitation, birthday surprise, anniversary) or blank.
- Linear editor: add, edit, duplicate, reorder (accessible up/down), delete; one final surprise kept last.
- Step types: message (restricted rich text), photo with caption + alt text, multiple choice
  (optional quiz), Yes/No/Maybe with four No modes, scratch card with accessible reveal, final surprise.
- Theme tokens: palette presets + colour pickers with WCAG contrast checks, font, type scale, animation.
- Mobile and desktop preview (local, records nothing).
- Debounced autosave with saved / unsaved / saving / error / conflict states and optimistic concurrency.
- Server-side publish validation; immutable published versions (DB triggers); sessions pinned to a version.
- Private 256-bit link, hash stored, copy/rotate; recipient player with no account.
- Anonymous sessions with validated, ordered answers; resume after refresh.
- Gift reveal only after server-side eligibility; optional one-time reveal with screenshot warning.
- Results: aggregates plus individual answers when the creator chose (and told recipients) so.
- Disable, re-enable, expire now, scheduled expiry, permanent delete, link rotation.
- Admin: report queue, content review (no secrets), takedown/restore, audit log; recipient report form.
- noindex/nofollow, robots disallow, no sitemap, no-store caching, no-referrer on recipient pages.
- Mobile-first creator UI and player; verified at 360px with touch.

### Acceptance criteria

| Criterion                                                    | Evidence                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Publish from a template in < 5 minutes                       | E2E `creator.spec.ts` (asserts < 5 min; runs in seconds)                                                         |
| Recipient completes on 360px phone without horizontal scroll | E2E `recipient.spec.ts` on the `mobile` project                                                                  |
| Gift not retrievable before required steps                   | Integration `recipient.int.test.ts`, E2E direct-fetch test                                                       |
| Close without answering; never recorded as Yes/No            | Integration + E2E `closing records no answer at all`                                                             |
| Four No modes configurable                                   | Unit (`noButtonState`, bounds), integration (EVASIVE rejected), E2E (each mode, keyboard, touch, reduced motion) |
| Optional Maybe; Close never obstructed                       | E2E Maybe + EVASIVE close tests                                                                                  |
| Unpublished/disabled/expired/deleted unavailable             | Integration `lifecycle.int.test.ts`, E2E neutral page                                                            |
| User A cannot access User B's data                           | Integration (15 endpoints), E2E isolation                                                                        |
| Uploads validated and served via time-limited URLs           | Integration `media.int.test.ts`, unit signature tests                                                            |
| Critical paths pass Playwright in CI                         | `.github/workflows/ci.yml` e2e job (local run: 36 passed)                                                        |

### Deferred / blocked

- **Production blocker:** malware scanning of uploads (images cannot be published in production
  until scanned; see `docs/privacy-security.md`).
- WebP/GIF metadata stripping (JPEG/PNG done).
- ~~Docker Compose and Dockerfiles not yet run~~ — verified 2026-09-23: infra services healthy, both
  images build, API and web serve (see INSTRUCTION.md for the three fixes that took).
- CI workflow written but not yet run on GitHub (no remote configured).
- Legal review of privacy notice, terms, moderation and gift wording (founder task).

## Phase 2 — not started (awaiting approval)

See the proposed backlog in the Phase 1 completion report and the master prompt.
