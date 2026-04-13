# syntax=docker/dockerfile:1.4
# ── Stage 1: Dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --network-concurrency 4

# ── Stage 2: Builder ──
# Build the Next.js app, then prune devDeps so node_modules only
# contains production packages before being copied to the runner.
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm prune --prod --no-optional

# ── Stage 3: Runner ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install bash (Alpine only has sh) and common tools needed by Claude Code's Bash tool
RUN apk add --no-cache bash coreutils curl git

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

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

HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
