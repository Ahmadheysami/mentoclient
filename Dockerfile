# ---------- Build stage ----------
FROM node:20-bookworm-slim AS builder

# Build tools for native deps (better-sqlite3, sharp, esbuild)
RUN apt-get update && apt-get install -y \
        python3 \
        make \
        g++ \
        build-essential \
        libc6-dev \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10

WORKDIR /app

ENV npm_config_unsafe_perm=true
ENV PNPM_IGNORE_SCRIPTS=false

# Copy manifest files first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --no-frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN pnpm build:prod

# ---------- Runtime stage ----------
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_PORT=3000

# Nuxt 4 production output is self-contained under .output/ (node server)
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
