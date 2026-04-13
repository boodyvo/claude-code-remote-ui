# ── Stage 1: All dependencies (needed for build) ──
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --network-concurrency 4

# ── Stage 2: Production-only dependencies (for runtime) ──
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod --network-concurrency 4

# ── Stage 3: Builder ──
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── Stage 4: Runner ──
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

# Copy only production node_modules (not devDeps) for native packages
# (standalone ships minimal next runtime; serverExternalPackages need prod deps)
COPY --from=prod-deps /app/node_modules ./node_modules

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
