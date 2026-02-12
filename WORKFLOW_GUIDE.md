# GitHub Actions Workflow Guide

This document explains how the CI/CD workflow builds, pushes, and deploys all four notification services.

## Workflow Overview

The `.github/workflows/deploy.yml` implements a **two-stage pipeline**:

```
[Code Push] → [Build & Push Phase] → [Deploy Phase]
                    (Parallel)         (Sequential)
```

## Stage 1: Build & Push (Parallel)

### How It Works

The workflow uses a **matrix strategy** to build all 4 services in parallel:

```yaml
strategy:
  matrix:
    service:
      - api
      - worker-email
      - worker-sms
      - worker-inapp
```

This creates **4 parallel jobs**, each running simultaneously on separate GitHub runners.

### What Each Job Does

For each service, the job:

1. **Checks out code** (fetch-depth: 0 gets full history)
2. **Sets up Docker build infrastructure**
   - QEMU (for multi-architecture builds)
   - Docker Buildx (multi-platform builder)
3. **Authenticates with GitHub Container Registry (GHCR)**
   - Uses `secrets.GITHUB_TOKEN` for authentication
   - Only on pushes to main/develop/master (not on PRs)
4. **Extracts metadata** for the Docker image
   - Service name: `notification-{service}`
   - Tags: branch name, commit SHA, "latest" (for default branch)
5. **Builds and pushes Docker image**
   - Builds from `./apps/{service}/Dockerfile`
   - Targets both `linux/amd64` and `linux/arm64` architectures
   - Pushes to: `ghcr.io/{owner}/notification-{service}:tag`
   - Caches layers in registry for faster rebuilds

### Parallel Execution Timeline

```
Time    Job 1 (API)          Job 2 (Email)        Job 3 (SMS)          Job 4 (InApp)
-----|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
      Checkout, Build, Push    Checkout, Build, Push   Checkout, Build, Push   Checkout, Build, Push
      ← All 4 run in parallel, typically 5-10 minutes total →
```

### Image Registry Output

After successful builds, images are pushed to GHCR:

```
ghcr.io/username/notification-api:develop
ghcr.io/username/notification-api:develop-abc1234
ghcr.io/username/notification-api:latest (on develop branch)

ghcr.io/username/notification-worker-email:develop
ghcr.io/username/notification-worker-email:develop-abc1234
ghcr.io/username/notification-worker-email:latest

ghcr.io/username/notification-worker-sms:develop
ghcr.io/username/notification-worker-sms:develop-abc1234
ghcr.io/username/notification-worker-sms:latest

ghcr.io/username/notification-worker-inapp:develop
ghcr.io/username/notification-worker-inapp:develop-abc1234
ghcr.io/username/notification-worker-inapp:latest
```

## Stage 2: Deploy (Sequential)

### Trigger Conditions

The deploy job only runs when ALL build jobs succeed:

```yaml
needs: build-and-push
if: github.event_name == 'push' &&
    (github.ref == 'refs/heads/main' ||
     github.ref == 'refs/heads/develop' ||
     github.ref == 'refs/heads/master')
```

Meaning: **Push-only, not on pull requests**, and **only to protected branches**.

### Deployment Steps

1. **SSH to VPS**
   - Uses `appleboy/ssh-action@v0.1.10`
   - Credentials from secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT`
   - 30-second timeout for connection, 15 minutes for scripts

2. **Authenticate with GHCR**
   ```bash
   docker login ghcr.io -u {owner} --password-stdin
   ```

3. **Pull Latest Images**
   ```bash
   docker compose pull
   ```
   - Fetches the latest image tags from GHCR
   - Only pulls what's in `docker-compose.yml`

4. **Deploy Services**
   ```bash
   docker compose up -d --remove-orphans
   ```
   - Starts all services in detached mode
   - Removes any orphaned containers from old deployments

5. **Wait & Verify**
   - Waits 5 seconds for services to stabilize
   - Checks `docker compose ps` - shows all service statuses
   - Calls `/health/live` endpoint on API
   - Prunes images older than 24 hours to save disk space

## Service Dependencies

The services are deployed together via `docker-compose.yml`:

```
API (port 8010)
├─ RabbitMQ (5672, 15672)
├─ PostgreSQL (5432)
└─ Redis (6379)

Worker Services (all depend on above)
├─ worker-email
├─ worker-sms
└─ worker-inapp
```

Health checks ensure all services are ready before dependent services start.

## Environment Flow

```
GitHub Secrets
    ↓
├─ Build secrets: (GHCR auto-provided via GITHUB_TOKEN)
│
└─ Deploy secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_PORT
       ↓
    SSH to VPS
       ↓
    Read .env from VPS
       ↓
    docker-compose.yml uses env vars:
       DATABASE_URL
       RABBITMQ_URL
       REDIS_URL
       SMTP_* (email worker)
       TWILIO_* (SMS worker)
       etc.
```

## Multi-Architecture Support

The workflow builds for **both** architectures:

```yaml
platforms: linux/amd64,linux/arm64
```

This means:
- **amd64**: Standard x86-64 servers (most cloud VPS)
- **arm64**: AWS Graviton, newer Macs, ARM servers

Docker automatically selects the right image when pulling.

## Caching Strategy

```yaml
cache-from: type=registry,ref=ghcr.io/.../notification-{service}:buildcache
cache-to: type=registry,ref=ghcr.io/.../notification-{service}:buildcache
```

- First build: Full build from scratch
- Subsequent builds: Reuse layers from previous builds
- Saves build time from 10+ minutes to 2-5 minutes on no-change rebuilds

## Troubleshooting

### Build Fails
1. Check GitHub Actions logs under "Actions" tab
2. Common issues:
   - `pnpm install` fails → missing dependencies or lock file outdated
   - `tsc` fails → TypeScript compilation errors
   - Docker login fails → `GITHUB_TOKEN` permissions issue

### Deploy Fails
1. SSH timeout → VPS unreachable or slow network
2. `docker-compose pull` fails → GHCR authentication on VPS failed
3. Services won't start → Check VPS `.env` file has all required variables
4. Health check fails → Give services more time or check port availability

### Secrets Configuration

Required GitHub Secrets:
- `VPS_HOST` - IP or hostname
- `VPS_USER` - SSH username
- `VPS_SSH_KEY` - Private SSH key
- `VPS_PORT` - SSH port (optional, defaults to 22)
- `VPS_APP_PATH` - Application directory on VPS (optional, defaults to `/opt/apps/afrisinc/notification-service`)
- `GHCR_TOKEN` - Token for docker login (if using different auth)
- `GHCR_OWNER` - GitHub username/org (if different from repo owner)

## Example: What Happens on Push to develop

```
1. Developer pushes code to develop branch
2. GitHub detects push → triggers workflow

BUILD PHASE (5-10 minutes):
  Job 1: Builds apps/api/ → pushes to ghcr.io/.../notification-api:develop
  Job 2: Builds apps/worker-email/ → pushes to ghcr.io/.../notification-worker-email:develop
  Job 3: Builds apps/worker-sms/ → pushes to ghcr.io/.../notification-worker-sms:develop
  Job 4: Builds apps/worker-inapp/ → pushes to ghcr.io/.../notification-worker-inapp:develop

DEPLOY PHASE (2-5 minutes) [only if all builds succeed]:
  Connects to VPS via SSH
  Runs: docker-compose pull
    → Pulls latest api, worker-email, worker-sms, worker-inapp images
  Runs: docker-compose up -d --remove-orphans
    → Starts new containers with latest images
  Runs: Health checks
    → Verifies all services are healthy
  Output: Lists all running services

Total time: ~8-15 minutes
Result: VPS now running latest code from develop
```

## Monitoring Deployments

### Check Workflow Status
- GitHub → Actions → Select workflow run
- See real-time logs for each job
- Green checkmark = success, Red X = failure

### Check VPS Services
```bash
# SSH to VPS
docker compose ps

# View logs
docker compose logs -f api
docker compose logs -f worker-email
docker compose logs -f worker-sms
docker compose logs -f worker-inapp

# Check API health
curl http://localhost:8010/health/live
```

### Registry Images
```bash
# List all notification service images
docker images | grep notification

# View image history
docker history ghcr.io/username/notification-api:latest
```
