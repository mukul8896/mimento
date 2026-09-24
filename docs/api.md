# API

- Base path: `/api/v1`. Interactive docs (non-production): `http://localhost:4000/api/v1/docs`,
  JSON at `/api/v1/docs-json`. The committed document is `packages/api-client/openapi.json`.
- Errors: `application/problem+json` with `type`, `title`, `status`, stable `code`, `requestId`
  and optional `issues[]` (validation / publish problems).
- Auth: `Authorization: Bearer <access token>` for creator/admin routes; recipient routes are
  public and use the share token in the path plus `x-recipient-session`.
- Pagination: cursor-based (`?cursor=&limit=`) on dashboard and admin lists.
- Idempotency: `Idempotency-Key` header (8–100 chars) on publish, disable, enable, expire and
  delete. A retried key replays the stored response; reusing a key for a different request is 422.
- Health: `GET /api/v1/health` (liveness), `GET /api/v1/ready` (database reachable).

## Endpoints

| Method & path                                                                                        | Purpose                                                                            |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /me` · `DELETE /me`                                                                             | Current creator · delete account and all data                                      |
| `GET /templates`                                                                                     | Seeded templates                                                                   |
| `GET /experiences` · `POST /experiences`                                                             | List (filter `DRAFT`/`PUBLISHED`/`INACTIVE`) · create from template or blank       |
| `GET /experiences/{id}`                                                                              | Detail with lifecycle and stats                                                    |
| `GET /experiences/{id}/draft` · `PUT …/draft`                                                        | Draft document · autosave (`revision` for optimistic concurrency, 409 on conflict) |
| `GET/PUT /experiences/{id}/draft/gifts/{stepKey}`                                                    | Owner-only gift secret (encrypted at rest)                                         |
| `POST /experiences/{id}/media/uploads` · `POST …/media/{mediaId}/complete`                           | Signed upload URL · validate uploaded bytes                                        |
| `POST /experiences/{id}/publish-check` · `POST …/publish`                                            | Validate · publish immutable version                                               |
| `GET /experiences/{id}/share-link` · `POST …/share-link/rotate`                                      | Copy link · replace link                                                           |
| `POST /experiences/{id}/disable` · `enable` · `expire` · `PUT …/expiry` · `DELETE /experiences/{id}` | Lifecycle                                                                          |
| `GET /experiences/{id}/results`                                                                      | Aggregates and permitted responses                                                 |
| `GET /pricing`                                                                                       | Public price list (per configured provider)                                        |
| `GET /experiences/{id}/checkout` · `POST …/checkout`                                                 | Tier needed vs held and priced offers · open hosted checkout (Razorpay / Dodo)     |
| `POST /experiences/{id}/checkout/{orderId}/confirm`                                                  | Ask the provider about the payment; unlock if paid                                 |
| `POST /payments/webhooks/{razorpay,dodo}`                                                            | Signed provider webhooks (raw body; not in the generated client)                   |
| `GET /public/experiences/{token}/meta`                                                               | Availability, title and theme (server render)                                      |
| `POST /public/experiences/{token}/sessions` · `GET …/session`                                        | Start · resume                                                                     |
| `POST …/session/answers` · `POST …/session/close` · `POST …/session/gift`                            | Answer · close (records nothing) · reveal gift                                     |
| `POST /public/experiences/{token}/reports`                                                           | Abuse report (always 202)                                                          |
| `GET /admin/reports` · `POST /admin/reports/{id}/resolve`                                            | Moderation queue                                                                   |
| `GET /admin/experiences` · `GET …/{id}/content` · `POST …/{id}/takedown` · `POST …/{id}/restore`     | Takedown workflow                                                                  |
| `POST /admin/experiences/{id}/entitlement`                                                           | Operator grant of a tier (support, refunds)                                        |
| `GET /admin/audit-logs`                                                                              | Audit trail                                                                        |

## Regenerating the client

After changing a DTO or a schema in `packages/contracts/src/api.ts`:

```bash
pnpm openapi:generate   # builds the API, exports openapi.json, regenerates packages/api-client/src/schema.ts
```

CI fails if the committed client is out of date. Always give `@ZodResponse` an explicit `status`,
and avoid bare `z.string().nullable()` in response schemas (add a constraint such as `.max(n)`),
otherwise the generated types are wrong.
