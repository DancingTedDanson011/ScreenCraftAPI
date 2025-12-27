# Docker Quick Reference Cheat Sheet

## Essential Commands

### Start/Stop Services

```bash
# Development
make dev                    # Start all services
make dev-down               # Stop all services
make dev-logs               # View logs

# Production
make prod                   # Start production
make prod-down              # Stop production
make prod-logs              # View logs
make prod-build             # Rebuild images

# Manual (without Makefile)
docker-compose up -d                                                    # Dev
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # Prod
```

### Database Operations

```bash
make db-migrate             # Run migrations
make db-generate            # Generate Prisma Client
make db-backup              # Backup database
make db-restore             # Restore database
make shell-db               # PostgreSQL shell

# Manual
docker compose exec api npx prisma migrate deploy
docker compose exec postgres pg_dump -U screencraft screencraft > backup.sql
```

### Monitoring

```bash
make status                 # Container status
make health                 # Health checks
make logs                   # All logs
docker stats                # Resource usage

# Queue monitoring
make queue-length           # Pending jobs
make browser-pool           # Active browsers

# Specific service logs
docker compose logs api -f
docker compose logs worker -f
docker compose logs postgres -f
```

### Shell Access

```bash
make shell-api              # API container
make shell-worker           # Worker container
make shell-db               # PostgreSQL
make shell-redis            # Redis CLI
make shell-web              # Frontend

# Manual
docker compose exec api sh
docker compose exec postgres psql -U screencraft
docker compose exec redis redis-cli
```

### Service Management

```bash
make restart                # Restart all
make restart-api            # Restart API
make restart-worker         # Restart worker

docker compose restart <service>
docker compose stop <service>
docker compose start <service>
```

---

## Environment Setup

### Initial Setup

```bash
# Automated
./setup.sh

# Manual
cp .env.example .env
cp api/.env.example api/.env
nano .env
```

### Generate Secure Passwords

```bash
# PostgreSQL/Redis/MinIO password
openssl rand -base64 32

# JWT secret
openssl rand -base64 48

# Traefik basic auth
htpasswd -nb admin your_password
```

---

## Development Workflow

### Start Development Environment

```bash
# Full setup
make dev
make db-migrate
make db-generate

# Access services
# Frontend: http://localhost:4321
# API: http://localhost:3000/docs
# MinIO: http://localhost:9001
```

### Hot Reload

Files are automatically reloaded:
- API: `./api/src` → Container watches changes
- Frontend: `./web/src` → Astro dev server

### Debugging

```bash
# Enable debug logs
docker compose exec api sh -c "LOG_LEVEL=debug npm run dev"

# View specific logs
docker compose logs api -f --tail=100

# Check environment variables
docker compose exec api printenv
```

---

## Production Deployment

### First Deployment

```bash
# 1. Configure
cp .env.example .env
nano .env  # Set all values

# 2. Deploy
make prod
make db-migrate

# 3. Verify
make health
make prod-logs
```

### Update Deployment

```bash
# Pull changes
git pull

# Rebuild and restart
make prod-build
make prod

# Run migrations
make db-migrate
```

### Rollback

```bash
git checkout <commit-hash>
make prod-build
make prod
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs <service> --tail=50

# Check status
docker compose ps

# Force recreate
docker compose up -d --force-recreate <service>
```

### Database Issues

```bash
# Check connection
docker compose exec postgres pg_isready -U screencraft

# Check DATABASE_URL
docker compose exec api printenv DATABASE_URL

# View connections
docker compose exec postgres psql -U screencraft -c "SELECT count(*) FROM pg_stat_activity;"
```

### Worker Issues

```bash
# Check worker logs
docker compose logs worker -f

# Check Redis
docker compose exec redis redis-cli ping

# Check queue
docker compose exec redis redis-cli llen bull:screenshots:wait

# Check active jobs
docker compose exec redis redis-cli llen bull:screenshots:active
```

### Memory Issues

```bash
# Check usage
docker stats --no-stream

# Reduce browser pool
# Edit .env: MAX_CONCURRENT_BROWSERS=5
docker compose restart worker

# Scale down
docker compose up -d --scale worker=2
```

### Permission Errors

```bash
make fix-permissions

# Or manually
docker compose exec api chown -R node:node /app
```

---

## Useful Docker Commands

### Container Management

```bash
docker compose ps                           # List containers
docker compose ps -a                        # List all (including stopped)
docker compose top                          # Show processes
docker compose exec <service> <command>     # Run command in container
docker compose run <service> <command>      # Run one-off command
```

### Logs

```bash
docker compose logs                         # All logs
docker compose logs -f                      # Follow logs
docker compose logs -f --tail=100           # Follow last 100 lines
docker compose logs <service>               # Specific service
docker compose logs -t <service>            # With timestamps
```

### Cleanup

```bash
docker compose down                         # Stop containers
docker compose down -v                      # Stop + remove volumes
docker compose down --remove-orphans        # Stop + remove orphans
make clean                                  # Interactive cleanup

# Remove unused resources
docker system prune                         # Remove unused data
docker system prune -a                      # Remove all unused images
docker volume prune                         # Remove unused volumes
```

### Images

```bash
docker compose build                        # Build all images
docker compose build --no-cache             # Force rebuild
docker compose pull                         # Pull latest images
docker images                               # List images
docker rmi <image-id>                       # Remove image
```

---

## Health Checks

### Manual Health Checks

```bash
# API
curl http://localhost:3000/health

# Frontend
curl http://localhost:4321/

# MinIO
curl http://localhost:9000/minio/health/live

# PostgreSQL
docker compose exec postgres pg_isready

# Redis
docker compose exec redis redis-cli ping
```

### Docker Health Status

```bash
docker compose ps
docker inspect <container-id> | grep -A 10 Health
```

---

## Backup & Restore

### Database Backup

```bash
# Quick backup
make db-backup

# Manual backup
docker compose exec -T postgres pg_dump -U screencraft screencraft | \
  gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Automated backup (crontab)
0 2 * * * /path/to/backup.sh
```

### Database Restore

```bash
# Interactive restore
make db-restore

# Manual restore
gunzip -c backup.sql.gz | \
  docker compose exec -T postgres psql -U screencraft screencraft
```

### Volume Backup

```bash
# Backup volume
docker run --rm \
  -v screencraft_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz -C /data .

# Restore volume
docker run --rm \
  -v screencraft_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres_data.tar.gz -C /data
```

---

## Scaling

### Scale Workers

```bash
# Via Makefile (edit docker-compose.prod.yml)
deploy:
  replicas: 5

# Or dynamically
docker compose up -d --scale worker=5
```

### Monitor Scaling

```bash
docker compose ps
docker stats
make queue-length
make browser-pool
```

---

## Network Debugging

### Container Networking

```bash
# Inspect network
docker network inspect screencraft

# Test connectivity
docker compose exec api ping postgres
docker compose exec api ping redis
docker compose exec api nc -zv minio 9000
```

### DNS Resolution

```bash
# From inside container
docker compose exec api nslookup postgres
docker compose exec api nslookup redis
```

---

## Performance Monitoring

### Resource Usage

```bash
# Real-time stats
docker stats

# Specific service
docker stats screencraft-worker

# With formatting
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Queue Metrics

```bash
# Pending jobs
docker compose exec redis redis-cli llen bull:screenshots:wait

# Active jobs
docker compose exec redis redis-cli llen bull:screenshots:active

# Completed jobs
docker compose exec redis redis-cli llen bull:screenshots:completed

# Failed jobs
docker compose exec redis redis-cli llen bull:screenshots:failed
```

---

## Quick Fixes

### Clear Everything and Start Fresh

```bash
docker compose down -v --remove-orphans
docker system prune -a -f
make dev
make db-migrate
```

### Fix Permission Issues

```bash
docker compose exec api chown -R node:node /app
docker compose exec worker chown -R node:node /app
```

### Restart Hanging Service

```bash
docker compose restart <service>
docker compose up -d --force-recreate <service>
```

### Clear Redis Cache

```bash
docker compose exec redis redis-cli FLUSHALL
```

---

## Production URLs

Replace `screencraft.example.com` with your domain:

```
Frontend:   https://screencraft.example.com
API:        https://api.screencraft.example.com
Traefik:    https://traefik.screencraft.example.com
```

---

## Environment Variables Quick Reference

### Critical Production Variables

```env
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
MINIO_ROOT_USER=<admin>
MINIO_ROOT_PASSWORD=<strong-password>
JWT_SECRET=<min-32-chars>
CORS_ORIGIN=https://yourdomain.com
ACME_EMAIL=admin@yourdomain.com
MAX_CONCURRENT_BROWSERS=10
```

---

## Emergency Commands

### Stop Everything

```bash
docker compose down
# or
make dev-down
make prod-down
```

### View All Logs

```bash
docker compose logs -f --tail=1000
```

### Check Disk Space

```bash
df -h
docker system df
```

### Emergency Cleanup

```bash
docker system prune -a -f --volumes
```

---

## Links to Documentation

- **Full Guide**: `DOCKER_DEPLOYMENT.md`
- **Architecture**: `api/ARCHITECTURE.md`
- **API Docs**: `http://localhost:3000/docs`
- **Setup Summary**: `DOCKER_SETUP_COMPLETE.md`
