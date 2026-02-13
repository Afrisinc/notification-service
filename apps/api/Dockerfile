# =========================
# ============ Build Stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# System deps
RUN apk add --no-cache python3 make g++ openssl

# Install pnpm
RUN npm install -g pnpm@latest

# Copy monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy shared packages (common, config only - NOT db)
COPY packages/common ./packages/common
COPY packages/config ./packages/config

# Copy this service
COPY apps/api ./apps/api

# Install ALL dependencies (including dev for build)
RUN CI=true pnpm install --frozen-lockfile

# CRITICAL: Copy Prisma schema from packages/db to service
COPY packages/db/prisma/schema.prisma ./apps/api/prisma/schema.prisma

# Generate Prisma client for this service
RUN cd apps/api && npx prisma generate --schema=./prisma/schema.prisma

# Build shared packages
RUN pnpm --filter @afrisinc-notify/common run build
RUN pnpm --filter @afrisinc-notify/config run build

# Build this service
RUN pnpm --filter @afrisinc-notify/api run build

# Create production bundle (includes generated Prisma client)
RUN pnpm --filter @afrisinc-notify/api --prod deploy /prod

# =========================
# ============ Runtime Stage
# =========================
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy production bundle from builder
COPY --from=builder --chown=nodejs:nodejs /prod ./

USER nodejs

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8010/health/live || exit 1

EXPOSE 8010

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/server.js"]
