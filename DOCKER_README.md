# ScreenCraft Docker Setup

Production-ready Docker configuration for ScreenCraft screenshot service.

## Quick Start

### Development (Local)

```bash
# Start all services
make dev

# Or manually
docker-compose up -d

# Initialize database
make db-migrate

# View logs
make logs
```

Access:
- Frontend: http://localhost:4321
- API: http://localhost:3000/docs
- MinIO Console: http://localhost:9001 (minioadmin / minioadmin123)

### Production (Hetzner)

```bash
# Setup environment
cp .env.example .env
nano .env  # Configure production values

# Start production
make prod

# Or manually
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Initialize database
make db-migrate
```

See [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md) for complete production guide.

---

## Architecture

### Services

1. **PostgreSQL** (postgres:16-alpine)
   - User authentication
   - Screenshot metadata
   - Job tracking

2. **Redis** (redis:7-alpine)
   - BullMQ job queue
   - Rate limiting cache
   - Session storage

3. **MinIO** (minio:latest)
   - S3-compatible object storage
   - Screenshot storage
   - Public/private buckets

4. **API** (Node.js 20 Alpine + Playwright)
   - Fastify REST API
   - Authentication (JWT)
   - Screenshot job creation

5. **Worker** (Node.js 20 Alpine + Playwright)
   - BullMQ worker
   - Playwright browser pool
   - Screenshot generation

6. **Frontend** (Astro + Node/Nginx)
   - Landing page
   - User dashboard
   - Static site generation

7. **Traefik** (traefik:v2.10)
   - Reverse proxy
   - SSL/TLS termination
   - Let's Encrypt automation

### Network

All services run on a dedicated `screencraft` bridge network with service discovery via DNS.

### Volumes

- `postgres_data`: Database persistence
- `redis_data`: Redis persistence
- `minio_data`: Object storage
- `traefik_certs`: SSL certificates

---

## Configuration

### Environment Files

**Root `.env`** (Production settings):
```env
POSTGRES_PASSWORD=your_strong_password
REDIS_PASSWORD=your_strong_password
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your_strong_password
JWT_SECRET=your_jwt_secret_min_32_chars
CORS_ORIGIN=https://yourdomain.com
ACME_EMAIL=admin@yourdomain.com
```

**`api/.env`** (API settings):
```env
DATABASE_URL=postgresql://screencraft:password@postgres:5432/screencraft
REDIS_HOST=redis
MINIO_ENDPOINT=minio
```

### Multi-Stage Builds

Both API and Frontend use multi-stage Dockerfiles:

1. **deps**: Production dependencies only
2. **development**: Full dev environment with hot reload
3. **builder**: Build TypeScript/Astro
4. **production**: Minimal runtime image

---

## Resource Allocation

### Development (Laptop)

Total: ~8GB RAM, 4 CPUs

```
PostgreSQL: 1GB RAM
Redis: 512MB RAM
MinIO: 512MB RAM
API: 2GB RAM
Worker: 2GB RAM (3 concurrent browsers)
Frontend: 512MB RAM
```

### Production (Hetzner 64GB)

Total: ~61GB RAM, 25 CPUs

```
PostgreSQL: 8GB RAM, 4 CPUs
Redis: 4GB RAM, 2 CPUs
MinIO: 4GB RAM, 2 CPUs
API (×2): 8GB RAM, 4 CPUs
Worker (×3): 36GB RAM, 12 CPUs (10 concurrent browsers)
Frontend: 512MB RAM, 0.5 CPUs
Traefik: 512MB RAM, 1 CPU
```

Adjust in `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
```

---

## Common Commands

### Service Management

```bash
# Start/stop
make dev          # Start development
make dev-down     # Stop development
make prod         # Start production
make prod-down    # Stop production

# Logs
make logs                    # All services
make dev-logs                # Development logs
docker compose logs api -f   # Specific service

# Restart
make restart              # All services
make restart-api          # Specific service
docker compose restart worker
```

### Database

```bash
# Migrations
make db-migrate   # Run migrations
make db-generate  # Generate Prisma Client
make db-reset     # Reset database (dev only!)

# Backup/Restore
make db-backup    # Create backup
make db-restore   # Restore from backup

# Direct access
make shell-db     # PostgreSQL shell
docker compose exec postgres psql -U screencraft screencraft
```

### Debugging

```bash
# Shell access
make shell-api      # API container
make shell-worker   # Worker container
make shell-db       # PostgreSQL

# Monitor
make health         # Health status
make status         # Container status
docker stats        # Resource usage

# Queue monitoring
make queue-length   # Pending jobs
make browser-pool   # Active browsers
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs <service>

# Inspect container
docker inspect <container-id>

# Force recreate
docker compose up -d --force-recreate <service>
```

### Database Connection Failed

```bash
# Check PostgreSQL
docker compose logs postgres

# Test connection
docker compose exec postgres pg_isready -U screencraft

# Verify DATABASE_URL
docker compose exec api printenv | grep DATABASE
```

### Worker Not Processing

```bash
# Check worker logs
docker compose logs worker -f

# Check Redis
docker compose exec redis redis-cli ping

# Check queue
docker compose exec redis redis-cli llen bull:screenshots:wait
```

### Out of Memory

```bash
# Check usage
docker stats

# Reduce browser pool
# Edit .env: MAX_CONCURRENT_BROWSERS=5
docker compose restart worker

# Scale down workers
docker compose up -d --scale worker=2
```

### Permission Errors

```bash
# Fix permissions
make fix-permissions

# Or manually
docker compose exec api chown -R node:node /app
```

---

## Security Best Practices

### Production Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secret (32+ characters)
- [ ] Configure firewall (ports 80, 443, 22 only)
- [ ] Enable SSL with Let's Encrypt
- [ ] Set Traefik dashboard authentication
- [ ] Disable unnecessary ports (no direct DB access)
- [ ] Use `.env` for secrets (never commit!)
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Monitor resource usage

### Generating Secrets

```bash
# Strong password
openssl rand -base64 32

# JWT secret
openssl rand -base64 48

# Traefik auth
htpasswd -nb admin your_password
```

---

## Performance Tuning

### Browser Pool

Adjust `MAX_CONCURRENT_BROWSERS` based on RAM:

```
16GB RAM: 3-5 browsers
32GB RAM: 5-8 browsers
64GB RAM: 10-15 browsers
```

Each browser uses ~1.5-2GB RAM.

### Worker Scaling

```bash
# Scale workers dynamically
docker compose up -d --scale worker=5

# Or in docker-compose.prod.yml
deploy:
  replicas: 5
```

### Database Tuning

PostgreSQL settings in `docker-compose.prod.yml`:

```yaml
command:
  - "postgres"
  - "-c"
  - "shared_buffers=2GB"
  - "-c"
  - "effective_cache_size=6GB"
```

---

## Monitoring

### Health Endpoints

- API: `http://localhost:3000/health`
- Frontend: `http://localhost:3000/health`
- MinIO: `http://localhost:9000/minio/health/live`

### Metrics

```bash
# Container stats
docker stats --no-stream

# Queue metrics
docker compose exec redis redis-cli INFO stats

# Browser pool size
docker compose exec redis redis-cli get browser:pool:size

# Database connections
docker compose exec postgres psql -U screencraft -c "SELECT count(*) FROM pg_stat_activity;"
```

### Logs

```bash
# Aggregated logs
docker compose logs -f --tail=100

# Specific service
docker compose logs api -f

# With timestamps
docker compose logs -t -f
```

---

## Backup Strategy

### Automated Backups

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * /home/deploy/screencraft/scripts/backup.sh

# Weekly full backup
0 3 * * 0 /home/deploy/screencraft/scripts/backup-full.sh
```

### Manual Backup

```bash
# Database
make db-backup

# Volumes
docker run --rm -v screencraft_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz -C /data .

# Complete backup
docker compose down
tar czf screencraft-backup-$(date +%Y%m%d).tar.gz \
  /var/lib/docker/volumes/screencraft_*
```

---

## Updating

### Pull Updates

```bash
# Development
git pull
docker-compose down
docker-compose build
docker-compose up -d
make db-migrate

# Production
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
make db-migrate
```

### Rollback

```bash
git log --oneline  # Find previous version
git checkout <commit-hash>
make prod-build
make prod
```

---

## Development Tips

### Hot Reload

Development containers mount source code as volumes:

```yaml
volumes:
  - ./api/src:/app/src  # Changes auto-reload
```

### Debug Mode

```bash
# Enable debug logs
docker compose exec api sh -c "LOG_LEVEL=debug npm run dev"

# Node.js inspector
docker compose exec api node --inspect=0.0.0.0:9229 dist/server.js
```

### Local Development Without Docker

```bash
# Start only infrastructure
docker-compose up -d postgres redis minio

# Run API locally
cd api
npm run dev

# Run frontend locally
cd web
npm run dev
```

---

## Support & Documentation

- **Full Deployment Guide**: [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)
- **API Documentation**: [api/README.md](./api/README.md)
- **Architecture**: [api/ARCHITECTURE.md](./api/ARCHITECTURE.md)
- **Authentication**: [api/AUTH_SYSTEM_README.md](./api/AUTH_SYSTEM_README.md)

---

## License

MIT
