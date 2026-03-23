# ── Stage 1: Dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Builder ──
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── Stage 3: Runner ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Non-root user
RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 --ingroup app app

# Copy standalone Next.js build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

# Overwrite stripped standalone node_modules with full deps for custom server
# (standalone ships minimal next runtime, but our server.js needs the full package)
COPY --from=deps /app/node_modules ./node_modules

# Data directories
RUN mkdir -p /home/app/.claude /app/workspace /app/data && \
    chown -R app:app /home/app/.claude /app/workspace /app/data

USER app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=600s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
