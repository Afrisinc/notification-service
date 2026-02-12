# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY . .

# Install dependencies
RUN npm ci

# Build all packages
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/worker-email ./apps/worker-email

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker-email/dist ./apps/worker-email/dist

# Install production dependencies only
RUN npm ci --production

# Set NODE_ENV
ENV NODE_ENV=production

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start worker
CMD ["node", "apps/worker-email/dist/index.js"]
