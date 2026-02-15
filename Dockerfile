# =========================
# Build Stage
# =========================
FROM node:20-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ openssl

# Install pnpm
RUN npm install -g pnpm@latest

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (dev + prod for build)
# Set CI=true to skip prepare script (husky install)
RUN CI=true pnpm install --frozen-lockfile

# Copy source code and configuration
COPY tsconfig.json ./
COPY register-paths.js ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client
RUN pnpm db:generate

# Build TypeScript
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# =========================
# Runtime Stage
# =========================
FROM node:20-slim

WORKDIR /app

RUN apk add --no-cache dumb-init curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy production files from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/register-paths.js ./register-paths.js

USER nodejs

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512"

# Default to API server
# Override CMD in docker-compose for different services
CMD ["node", "-r", "./register-paths.js", "dist/services/api/src/server.js"]

EXPOSE 8010
