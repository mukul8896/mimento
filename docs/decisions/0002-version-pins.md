# ADR 0002 — Version pins that deviate from "latest"

**Status:** accepted (22 Sep 2026)

| Package           | Pinned         | Latest at the time | Reason                                                                                      |
| ----------------- | -------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| TypeScript        | 5.9.3          | 7.0.2              | typescript-eslint supports `<6.1`; TS 7 (native) is not yet supported by the lint toolchain |
| NestJS            | 11.2.5         | 12.0.4             | nestjs-zod 5.5 supports Nest ≤ 11; Nest 11 is still maintained                              |
| Prisma            | 7.10.0         | 8.0.0-rc           | npm `latest` pointed to a release candidate; the rule forbids RCs for core flows            |
| pnpm              | 10.34.5        | 12.5.1             | Proven workspace/Turborepo behaviour; upgrade deliberately                                  |
| ESLint            | 9.39.5         | 10.x               | eslint-config-next plugins (react, jsx-a11y, import) do not support ESLint 10 yet           |
| embedded-postgres | 18.4.0-beta.17 | same               | Test/dev-only fallback when Docker is unavailable; production never uses it                 |

Transitive security overrides (`pnpm-workspace.yaml → overrides`): multer ≥ 2.3.0,
mysql2 ≥ 3.23.1, deepmerge-ts ≥ 8.0.0. Revisit these pins when upstream releases catch up.
