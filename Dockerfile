# =============================================================================
# Mentoya Client — Nuxt 4 Production Dockerfile
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

# Install essential build tools for native dependencies (sharp, esbuild, etc.)
RUN apt-get update && apt-get install -y \
        python3 \
        make \
        g++ \
        build-essential \
        libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm package manager globally.
# Pin to 11.x to match the lockfile generator and the `allowBuilds` list in
# pnpm-workspace.yaml (pnpm 10 does not understand that key and would skip
# the native postinstall scripts).
RUN npm install -g pnpm@11

WORKDIR /app

# Configure environment variables for package installation
ENV npm_config_unsafe_perm=true
ENV PNPM_IGNORE_SCRIPTS=false

# Copy only dependency manifest files first to leverage Docker layer caching.
# pnpm-workspace.yaml carries the pnpm 10 `allowBuilds` list — without it the
# native postinstall scripts (sharp, esbuild, better-sqlite3) are skipped.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install project dependencies (this layer is cached unless package files change)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Set production environment flags for building.
# The package.json script asks V8 for 4 GB; on a 4 GB VPS that turns a build
# into a host-wide OOM kill. 2048 MB matches the project's own measurement.
# Stop the running stack before building (see scripts/build.sh) so the build
# and the containers are not competing for the same RAM.
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048

# BUILD-TIME defaults. nuxt.config.ts reads NUXT_API_BASE/NUXT_PUBLIC_BASE
# from process.env, so without these the image would ship with
# `apiUrl: undefined` — the exact condition that caused the recursive
# $fetch → SSR → $fetch loop and the "heap out of memory" crash.
# They can still be overridden at runtime with NUXT_API_URL/NUXT_PUBLIC_BASE.
ARG NUXT_API_BASE=http://server:3001/.api
ARG NUXT_PUBLIC_BASE=https://api.mentoya.ir
ENV NUXT_API_BASE=${NUXT_API_BASE}
ENV NUXT_PUBLIC_BASE=${NUXT_PUBLIC_BASE}

# Build the Nuxt application for production. Call `nuxt build` directly so
# the 4096 MB NODE_OPTIONS from package.json does not override the cap above.
RUN pnpm exec nuxt build

# -----------------------------------------------------------------------------
# Stage 2: Runtime Stage
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim

WORKDIR /app

# Set runtime environment variables.
# 640 MB heap for ~100–360 MB RSS of normal SSR; the container limit is 896 MB
# (see docker-compose.yaml). Keep the heap below the container limit.
ENV NODE_ENV=production
ENV PORT=3000
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0
ENV NODE_OPTIONS=--max-old-space-size=640

# Copy only the compiled production output and package manifest from the builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

# Expose the application port to the internal Docker network
EXPOSE 3000

# TCP probe: the API has no bare `/` route to rely on.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e "require('net').connect(3000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),3000)"

# Start the Nuxt / Nitro production server
CMD ["node", ".output/server/index.mjs"]