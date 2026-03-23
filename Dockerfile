# ── Stage 1: Dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Builder ──
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build (standalone output) + bundle custom server.ts → .next/standalone/server.js
RUN pnpm build

# ── Stage 3: Runner ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Claude Code CLI (provides claude binary + SDK)
RUN npm install -g @anthropic-ai/claude-code

# Non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

# Copy standalone Next.js build (includes node_modules subset)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

# Data directories (mounted as volumes in production)
RUN mkdir -p /home/app/.claude /app/workspace /app/data && \
    chown -R app:app /home/app/.claude /app/workspace /app/data

USER app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
