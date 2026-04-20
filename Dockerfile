# syntax=docker/dockerfile:1.4
# Use Debian slim (not Alpine) so argon2/better-sqlite3/node-pty can use
# pre-built binaries instead of compiling from C++ source (which takes ~1h on Alpine).

# ── Stage 1: Dependencies ──
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --network-concurrency 4

# ── Stage 2: Builder ──
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm prune --prod

# ── Stage 3: Runner ──
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install bash and common tools needed by Claude Code's Bash tool
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash curl git wget \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Non-root user — set home explicitly so HOME=/home/app (not / which is the
# default for --system accounts) and os.homedir() returns the right path.
RUN groupadd --system --gid 1001 app && \
    useradd --system --uid 1001 --gid app --home-dir /home/app app

ENV HOME=/home/app

# Copy standalone Next.js build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

# Copy pruned node_modules (production deps only, no devDeps)
COPY --from=builder /app/node_modules ./node_modules

# Data directories
RUN mkdir -p /home/app/.claude /app/workspace /app/data /app/projects && \
    chown -R app:app /home/app/.claude /app/workspace /app/data /app/projects

USER app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
