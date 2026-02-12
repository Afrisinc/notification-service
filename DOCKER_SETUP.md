# Docker Setup Guide - Notification Service

## 🏗️ Architecture

This notification service uses a **distributed architecture** with separate containerized services:

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Services                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  📧 API      │  │  📨 Email    │  │  📱 SMS      │  │
│  │  :8010       │  │  Worker      │  │  Worker      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  🔔 In-App   │  │  🐰 RabbitMQ │  │  🐘 Postgres │  │
│  │  Worker      │  │  Queue       │  │  Database    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ⚡ Redis Cache                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 10GB+ disk space

## 🚀 Quick Start

### 1. Clone & Setup

```bash
git clone <repository>
cd notification-service
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your configuration:

```bash
# Update required values
SMTP_HOST=smtp.gmail.com
SENDGRID_API_KEY=your-key
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
```

### 3. Start All Services

```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## 🏭 Building Individual Services

### Build Specific Images

```bash
# Build API image
docker build -f apps/api/Dockerfile -t notification-api:latest .

# Build Email Worker
docker build -f apps/worker-email/Dockerfile -t notification-worker-email:latest .

# Build SMS Worker
docker build -f apps/worker-sms/Dockerfile -t notification-worker-sms:latest .

# Build In-App Worker
docker build -f apps/worker-inapp/Dockerfile -t notification-worker-inapp:latest .
```

### Push to Registry

```bash
# Tag images
docker tag notification-api:latest ghcr.io/your-org/notification-api:latest
docker tag notification-worker-email:latest ghcr.io/your-org/notification-worker-email:latest
docker tag notification-worker-sms:latest ghcr.io/your-org/notification-worker-sms:latest
docker tag notification-worker-inapp:latest ghcr.io/your-org/notification-worker-inapp:latest

# Push to registry
docker push ghcr.io/your-org/notification-api:latest
docker push ghcr.io/your-org/notification-worker-email:latest
docker push ghcr.io/your-org/notification-worker-sms:latest
docker push ghcr.io/your-org/notification-worker-inapp:latest
```

## 📡 Service Details

### API Service (Port 8010)

```bash
# Health check
curl http://localhost:8010/health/live

# Swagger API Docs
http://localhost:8010/docs
```

### RabbitMQ Management (Port 15672)

```
Username: guest
Password: guest
URL: http://localhost:15672
```

### PostgreSQL (Port 5432)

```
Host: localhost
Port: 5432
Database: notification_db
User: postgres
Password: postgres
```

### Redis (Port 6379)

```
Host: localhost
Port: 6379
```

## 🔍 Monitoring & Debugging

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f worker-email

# Last 100 lines
docker-compose logs --tail=100 api
```

### Check Service Status

```bash
# List all running containers
docker-compose ps

# Inspect a service
docker-compose exec api sh
docker-compose exec postgres psql -U postgres
```

### Database Migrations

```bash
# Run migrations
docker-compose exec api npm run db:migrate

# Push schema changes
docker-compose exec api npm run db:push

# Reset database
docker-compose exec api npm run db:reset
```

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Rebuild images
docker-compose build --no-cache

# Remove all containers and start fresh
docker-compose down -v
docker-compose up -d
```

### Port Already in Use

```bash
# Change port in docker-compose.yml
# For example, API port 8011 instead of 8010:
ports:
  - "8011:8010"
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U postgres -c "SELECT 1"
```

### RabbitMQ Issues

```bash
# Check RabbitMQ status
docker-compose logs rabbitmq

# Access management console
http://localhost:15672
```

## 🚢 Production Deployment

### Using Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml notification-service

# View services
docker service ls
```

### Using Kubernetes

Convert docker-compose.yml to Kubernetes manifests:

```bash
# Use Kompose tool
kompose convert -f docker-compose.yml -o k8s/

# Deploy to Kubernetes
kubectl apply -f k8s/
```

## 📊 Performance Tuning

### Memory Limits

Edit `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

### Database Connection Pool

Update `.env`:

```bash
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

### Redis Configuration

```bash
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## 🧹 Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (warning: deletes data!)
docker-compose down -v

# Remove all stopped containers
docker container prune

# Remove dangling images
docker image prune
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [RabbitMQ Docker Guide](https://hub.docker.com/_/rabbitmq)
- [PostgreSQL Docker Guide](https://hub.docker.com/_/postgres)

---

For issues or questions, open an issue on GitHub.
