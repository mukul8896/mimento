# ADR 0001 — Modular monolith with a BFF

**Status:** accepted (Phase 1)

A single repository and database with separately deployable web and API apps. The web app talks to
the API only through a thin same-origin BFF route so that creator tokens stay in HttpOnly cookies
and CSRF is handled with SameSite cookies plus an Origin check. Business logic lives only in the
API's domain modules. Modules can be extracted later if load or team ownership demands it.
