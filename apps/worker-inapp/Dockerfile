# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/worker-inapp ./apps/worker-inapp

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build worker-inapp
RUN pnpm --filter @afrisinc-notify/worker-inapp build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy from builder
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker-inapp/dist ./dist
COPY --from=builder /app/apps/worker-inapp/package.json ./apps/worker-inapp/

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('fs').accessSync('/tmp/worker-ready')" || exit 1

EXPOSE 3001

CMD ["node", "dist/worker.js"]
