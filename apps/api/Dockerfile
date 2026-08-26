# syntax=docker/dockerfile:1
#
# Build context is the repository root, not `apps/api` — a pnpm workspace
# cannot be installed from one package's directory:
#
#   docker build -f apps/api/Dockerfile -t vendor-marketplace-api .
#
# The ignore list is `Dockerfile.dockerignore` beside this file; see the note
# at the top of it.
#
# Debian slim rather than Alpine: `sharp` ships glibc prebuilds that need no
# toolchain, and the musl path is the one that surprises people at build time.

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
# corepack pins pnpm to the `packageManager` field, so the image and the
# developer's machine resolve the lockfile identically.
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Manifests before sources: editing a route must not invalidate the install
# layer. Every workspace manifest has to be present or `--frozen-lockfile`
# rejects the lockfile as out of date, even behind a filter.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/preflight/package.json packages/preflight/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @vendor-marketplace/api...

COPY . .
# `build` declares `dependsOn: ["^build"]`, so @vendor-marketplace/shared and
# @vendor-marketplace/db are compiled first. The pruned tree resolves both from their
# `dist/`, so skipping this produces an image that builds and then crashes on
# a missing module at start.
RUN pnpm turbo run build --filter=@vendor-marketplace/api

# `--legacy` because this workspace does not set `inject-workspace-packages`.
# `--prod` drops devDependencies; `files: ["dist"]` in the manifest keeps the
# sources, configs, and test setup out of the image.
RUN pnpm deploy --legacy --prod --filter=@vendor-marketplace/api /app

FROM base AS runtime
ENV NODE_ENV=production
# Binding loopback inside a container is unreachable from outside it while
# every log line still reads as healthy. 0.0.0.0 is not optional here.
ENV HOST=0.0.0.0
ENV PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT??4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form, so node is PID 1 and receives SIGTERM directly — `src/index.ts`
# closes Fastify on it, which drains in-flight requests instead of dropping
# them. Wrapping this in a shell would swallow the signal.
CMD ["node", "dist/index.js"]
