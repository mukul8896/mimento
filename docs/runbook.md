# Runbook

## Local development with Docker (recommended)

```bash
cp .env.example .env        # pnpm dev does this automatically if missing
pnpm install
pnpm dev
```

`pnpm dev` starts PostgreSQL and MinIO, applies migrations, seeds templates and runs the API
(http://localhost:4000) and web app (http://localhost:3000) with reload. There is no identity
provider and no sign-in: the first visit to a creator page mints an anonymous owner cookie
(see [ADR 0005](decisions/0005-no-accounts.md)). Moderation tools are at `/operator`, which asks
for `ADMIN_TOKEN`.

To use MinIO instead of the filesystem adapter, set in `.env`:

```bash
STORAGE_DRIVER=s3
MEDIA_ORIGIN=http://localhost:9000   # lets the web CSP load/upload images from MinIO
```

## Running without Docker

1. PostgreSQL: `pnpm local:postgres` (embedded PostgreSQL, data in `.local/postgres`). Point
   `DATABASE_URL` at it, then `pnpm db:deploy && pnpm db:seed`.
2. Keep `STORAGE_DRIVER=filesystem`.
3. `pnpm --filter @momentpath/contracts build && pnpm db:generate && pnpm dev:apps`.

## Tests

| Command                 | Needs                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `pnpm test`             | nothing                                                                                   |
| `pnpm test:integration` | nothing locally (starts an embedded PostgreSQL); in CI set `TEST_DATABASE_SERVER_URL`     |
| `pnpm test:e2e`         | PostgreSQL (migrated + seeded) running; builds are reused if the apps are already running |

E2E has no sign-in step: each browser profile picks up its own anonymous owner cookie, and the
`admin` profile posts `ADMIN_TOKEN` to `/operator/session`. It runs on a desktop viewport and a
360px touch phone. The API is started with `RATE_LIMIT_DISABLED=true` (refused in production).

Running E2E against the Compose stack instead reuses the running containers, so Playwright cannot
set that variable — add it to the `api` service for the run, otherwise all BFF traffic shares one
source IP and trips the 120 req/min limit.

## Migrations

- Create: edit `prisma/schema.prisma`, then `pnpm db:migrate --name <change>`.
- Hand-written SQL (constraints, triggers) goes in its own migration folder, like
  `20260922180100_integrity_rules`.
- Deploy: `pnpm db:deploy` as a release step **before** starting new API instances.
- CI checks that migrations apply cleanly and match the schema.

## Keys and secrets

- `APP_ENCRYPTION_KEYS` is a keyring `id:base64(32 bytes)`, comma separated. To rotate: add a new
  key, set `APP_ENCRYPTION_ACTIVE_KEY` to it and deploy; old ciphertexts keep decrypting. Never
  remove a key while data encrypted with it exists.
- `ADMIN_TOKEN` (≥ 32 chars) is the only privileged credential; rotating it invalidates open
  operator sessions. Production refuses to boot without it, so takedowns are always possible.
- Creator identity needs no server-side secret: owner and manage tokens are random per row, stored
  only as SHA-256 (plus AES-GCM ciphertext so manage links can be re-copied).

## Backups

Use managed PostgreSQL with automated backups and point-in-time recovery (at least 7 days).
Object storage should have versioning or replication enabled. Test a restore before launch.
Encryption keys must be backed up separately from database backups — without them gift secrets and
share links cannot be recovered.

## Deploying

The stack is four containers: Postgres, the API, the web app and Caddy for TLS. There is no
identity provider to run (ADR 0005) and no MinIO — production uses an S3-compatible service whose
endpoint the browser can reach, because presigned upload URLs are handed to the browser. A MinIO
container on the private network cannot serve those. Cloudflare R2 is the cheap default: free tier,
S3-compatible so the existing adapter is unchanged, and no egress fees.

### First deploy

1. **Host.** Anything that runs Docker with ~2GB RAM. Oracle Cloud's always-free tier fits with room
   to spare; a small VPS (Hetzner, RackNerd) costs a few euros a month; Railway takes the Dockerfiles
   directly if you would rather not run a server.
2. **DNS.** Point an A record for your domain at the host before starting Caddy — it obtains the
   certificate on first boot and needs the name to resolve.
3. **Storage.** Create an R2 (or S3) bucket and an access key scoped to it.
4. **Configure.** `cp .env.production.example .env.production` on the server and fill every blank.
   Generate each secret separately with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
5. **Migrate, then start.** Migrations are a release step, not something the API does at boot, so
   that a new container never half-migrates a database another container is still using.

   ```bash
   # Start only the database first.
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres

   # Apply migrations and seed the templates from the server itself. Postgres is published on
   # 127.0.0.1 only, so this works locally and is not reachable from the internet.
   export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5432/$POSTGRES_DB"
   pnpm install --frozen-lockfile
   pnpm --filter @momentpath/contracts build && pnpm db:generate
   pnpm db:deploy && pnpm db:seed

   # Then bring up the rest.
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
   ```

`--env-file` is not optional: compose interpolates `${VAR}` from that file (or the shell), while
`env_file:` only injects variables into containers. Both are needed, and leaving it off fails with
"required variable DOMAIN is missing a value".

### What production refuses to do

The API will not start if `STORAGE_DRIVER=filesystem`, if `ADMIN_TOKEN` is unset, or if
`RATE_LIMIT_DISABLED=true`. These are deliberate: filesystem storage loses data on redeploy, an
unset admin token would leave takedowns impossible, and rate limits are the only thing standing
between an unauthenticated public API and abuse.

Set `TRUST_PROXY_HOPS` to the number of proxies actually in front of the API — 2 for this stack
(Caddy, then the web BFF). Too low and rate limits count every request as coming from one IP.

### Updating

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Run `pnpm db:deploy` first whenever the release contains a migration, with `DATABASE_URL` pointing
at `127.0.0.1:5432` as above.

### Backups

Everything durable is in Postgres and the object store. A daily dump is enough:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backup-$(date +%F).sql.gz
```

Losing the database loses every creator's access permanently — there are no accounts to recover
from, so the encryption keyring in `.env.production` matters just as much: without
`APP_ENCRYPTION_KEYS` the gift secrets and manage tokens in a backup cannot be decrypted. Store it
somewhere other than the server.

## Deployment assumptions

- Web and API as containers (`infra/docker/*.Dockerfile`) behind TLS; set `TRUST_PROXY_HOPS` to
  the number of proxies in front of the API (the web BFF counts as one).
- `APP_ENV=production` requires `STORAGE_DRIVER=s3` and forbids disabling rate limits.
- Separate development, staging and production realms, databases, buckets and keys.
- In the `docker compose --profile app` setup, S3 presigned URLs are signed for the API's internal
  MinIO host; for browser uploads in that mode use the filesystem driver or run the apps on the host.
- There is no identity provider to deploy or reach. The only credential to configure per
  environment is `ADMIN_TOKEN`.

## Incident basics

- Take down abusive content: `/admin` → Take down (immediate, audited).
- Every error response carries `requestId`; search API logs by it. Logs contain no tokens,
  secrets, message bodies or answers.
