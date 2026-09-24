# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# `prisma generate` resolves datasource.url even though it never connects, and .env is not in the
# image (.dockerignore). A placeholder satisfies it; the runtime stage injects the real DATABASE_URL.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
# prebuild runs `prisma generate`; the generated client is compiled into dist/generated.
RUN pnpm --filter @momentpath/contracts build && pnpm --filter @momentpath/api build
RUN pnpm deploy --filter @momentpath/api --prod --legacy /out && cp -r apps/api/dist /out/dist

# Release step: apply pending migrations, then the idempotent seed. Reuses the build stage because it
# already has the Prisma CLI, tsx and the generated client, none of which the runtime image carries.
# Compose supplies the real DATABASE_URL (`docker compose run --rm migrate`).
FROM build AS migrate
CMD ["sh", "-c", "pnpm db:deploy && pnpm db:seed"]

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out /app
USER app
EXPOSE 4000
# Migrations are a separate release step: the `migrate` stage above (`docker compose run --rm migrate`).
CMD ["node", "dist/main.js"]
