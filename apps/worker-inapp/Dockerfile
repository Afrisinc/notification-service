# -------------------------
# Builder Stage
# -------------------------
FROM node:20-alpine AS builder

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# Generate Prisma if needed
RUN pnpm --filter @afrisinc-notify/db exec prisma generate

# Build all workspaces
RUN pnpm -r run build

# Remove devDependencies safely
RUN pnpm prune --prod


# -------------------------
# Runtime Stage
# -------------------------
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages

CMD ["node", "apps/api/dist/index.js"]

