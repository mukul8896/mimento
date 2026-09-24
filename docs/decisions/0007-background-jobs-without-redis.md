# 0007 — Background jobs run on PostgreSQL in a worker process; no Redis yet

_Status: accepted (24 Sep 2026)._ The master prompt lists "Redis/BullMQ workers" for Phase 2 but also
says to add Redis "only when needed". This records why it is not needed yet.

## Context

Phase 2b needs work that must not run inside an HTTP request: malware scanning, re-encoding images,
and later scheduled reveals. The app already has a transactional outbox in PostgreSQL, claimed
with `FOR UPDATE SKIP LOCKED`, which gives delayed execution (`availableAt`), retries with backoff
and safe concurrency across processes.

## Decision

- **A separate worker process**, not a separate codebase: `apps/api/src/worker.ts` boots the same
  Nest modules without an HTTP listener. `PROCESS_ROLE` decides what a process does: `api` (HTTP
  only), `worker` (jobs only) or `all` (development and tests). Production runs one of each from the
  same image (`docker-compose.prod.yml`).
- **Jobs stay on PostgreSQL.** The outbox, payment reconciler and the new media pipeline poll it
  and claim rows with `SKIP LOCKED`. The media pipeline needs no queue at all: an upload that is
  `READY` with `processedAt IS NULL` _is_ the job, which also backfills files uploaded before the
  pipeline existed.
- **ClamAV (clamd) as its own container**, spoken to over TCP with `INSTREAM`. A scan that cannot
  complete (clamd down or still loading signatures) leaves the file unscanned and retries; a file
  is never marked clean by default. Production refuses to start a job-running process without
  `CLAMAV_HOST`.

## Consequences

- One service fewer to run, patch, back up and pay for; the server only needs Docker.
- Polling adds up to a few seconds of latency (`MEDIA_PIPELINE_MS`, default 3 s), acceptable for a
  scan the creator waits on only when publishing.
- Rate limits stay in memory per API instance. Redis becomes worth it when there is more than one
  API instance (shared rate limits, Phase 4) or job volume makes polling expensive; producers and
  handlers are already idempotent, so moving to BullMQ then changes only the transport.
