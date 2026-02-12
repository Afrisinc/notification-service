# ============ Build Stage ============
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy workspace packages
COPY packages ./packages
COPY apps ./apps

# Install pnpm globally
RUN npm install -g pnpm

# Install all dependencies (skip scripts initially to avoid prepare hook issues)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Now run the prepare script after all dependencies are installed and hoisted
# RUN pnpm run prepare
RUN pnpm --filter @***-notify/db exec prisma generate

# Build all packages
RUN pnpm --filter @afrisinc-notify/api run build

# ============ Runtime Stage ============
FROM node:20-alpine

# Install dumb-init for proper signal handling and curl for health checks
RUN apk add --no-cache dumb-init curl

WORKDIR /app

# Create app user for security (non-root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy from builder - monorepo structure
COPY --from=builder --chown=nodejs:nodejs /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8010/health/live || exit 1

# Environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"

# Expose port
EXPOSE 8010

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "apps/api/dist/server.js"]
