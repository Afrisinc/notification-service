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
COPY packages ./packages
COPY apps ./apps

# Install ALL dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Generate Prisma
RUN pnpm --filter @afrisinc-notify/db exec prisma generate

# Build ALL packages
RUN pnpm -r run build

# Remove dev dependencies from node_modules
RUN pnpm install --prod --frozen-lockfile



# =========================
# ============ Runtime Stage
# =========================
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy everything built: node_modules (prod only), packages (with dist), and worker dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker-email/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/worker-email/package.json ./package.json

USER nodejs

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=256"

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]
