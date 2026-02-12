# =========================
# ============ Build Stage
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# System deps required for prisma + native builds
RUN apk add --no-cache python3 make g++ openssl

# Install pnpm
RUN npm install -g pnpm

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy monorepo source
COPY packages ./packages
COPY apps ./apps

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @afrisinc-notify/db exec prisma generate

# Build all packages
RUN pnpm -r run build

# Create production bundle (including workspace packages)
RUN pnpm deploy --filter @afrisinc-notify/api --legacy /prod



# =========================
# ============ Runtime Stage
# =========================
FROM node:20-alpine

WORKDIR /app

# Install runtime utilities
RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy production-ready bundle
COPY --from=builder --chown=nodejs:nodejs /prod ./

# Switch to non-root
USER nodejs

# Environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8010/health/live || exit 1

EXPOSE 8010

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/server.js"]
