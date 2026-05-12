# =========================
# Build Stage
# =========================
FROM node:20-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies (dev + prod for build)
# Set CI=true to skip prepare script (husky install)
RUN CI=true pnpm install --frozen-lockfile

# Copy source code and configuration
COPY tsconfig.json ./
COPY tsconfig.runtime.json ./
COPY register-paths.js ./
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

RUN apt-get update && apt-get install -y \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nodejs

# Copy production files from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/register-paths.js ./register-paths.js
COPY --from=builder --chown=nodejs:nodejs /app/src ./src

# Copy schema to default prisma location (required for runtime db:seed/db:push)
RUN mkdir -p /app/prisma && \
    cp /app/src/shared/database/models/schema.prisma /app/prisma/schema.prisma && \
    chown -R nodejs:nodejs /app/prisma

USER nodejs

ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512"

# Default to API server
# Override CMD in docker-compose for different services
CMD ["node", "-r", "./register-paths.js", "dist/services/api/src/server.js"]

EXPOSE 8010
