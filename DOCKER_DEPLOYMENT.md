# Docker Deployment Guide

Complete Docker production deployment guide for ScreenCraft.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Hetzner Server Setup](#hetzner-server-setup)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Development
- Docker 24+ and Docker Compose 2.20+
- Node.js 20+ (for local development)
- Git

### Production Server (Hetzner)
- Ubuntu 22.04 LTS
- 64GB RAM (recommended)
- 8+ CPU cores
- 200GB+ SSD storage
- Docker and Docker Compose installed

---

## Development Setup

### 1. Clone and Configure

```bash
# Clone repository
git clone <repository-url>
cd Agents_Project

# Copy environment files
cp .env.example .env
cp api/.env.example api/.env

# Review and adjust values in .env files
nano .env
nano api/.env
```

### 2. Start Development Environment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 3. Initialize Database

```bash
# Generate Prisma Client
docker-compose exec api npx prisma generate

# Run migrations
docker-compose exec api npx prisma migrate deploy

# Seed database (optional)
docker-compose exec api npm run prisma:seed
```

### 4. Access Services

- **Frontend**: http://localhost:4321
- **API**: http://localhost:3000
- **API Docs**: http://localhost:3000/docs
- **MinIO Console**: http://localhost:9001
- **Traefik Dashboard**: http://localhost:8080

---

## Production Deployment

### 1. Server Preparation

```bash
# SSH into your Hetzner server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version

# Create deployment user
adduser deploy
usermod -aG docker deploy
su - deploy
```

### 2. Clone Repository

```bash
# As deploy user
git clone <repository-url> /home/deploy/screencraft
cd /home/deploy/screencraft
```

### 3. Configure Production Environment

```bash
# Copy and edit production environment
cp .env.example .env
nano .env
```

**Critical values to set:**

```env
# Strong passwords!
POSTGRES_PASSWORD=<generate-strong-password>
REDIS_PASSWORD=<generate-strong-password>
MINIO_ROOT_USER=<admin-username>
MINIO_ROOT_PASSWORD=<generate-strong-password>

# JWT secret (min 32 chars)
JWT_SECRET=<generate-random-string-min-32-chars>

# Your domain
CORS_ORIGIN=https://screencraft.example.com
PUBLIC_API_URL=https://api.screencraft.example.com

# Let's Encrypt email
ACME_EMAIL=admin@example.com

# Traefik dashboard auth (generate with htpasswd)
TRAEFIK_BASIC_AUTH=admin:$apr1$abc123$xyz

# Browser pool (adjust for your server)
MAX_CONCURRENT_BROWSERS=10
```

### 4. Generate Secure Passwords

```bash
# PostgreSQL password
openssl rand -base64 32

# Redis password
openssl rand -base64 32

# MinIO password
openssl rand -base64 32

# JWT secret
openssl rand -base64 48

# Traefik basic auth
htpasswd -nb admin your_password
```

### 5. Build and Deploy

```bash
# Build production images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Initialize database
docker compose exec api npx prisma migrate deploy

# Check logs
docker compose logs -f
```

### 6. Configure DNS

Point your domains to your server IP:

```
A     screencraft.example.com        -> your-server-ip
A     api.screencraft.example.com    -> your-server-ip
A     traefik.screencraft.example.com -> your-server-ip
```

### 7. SSL Certificates

Traefik will automatically request Let's Encrypt certificates. Monitor:

```bash
docker compose logs traefik | grep -i acme
```

---

## Hetzner Server Setup

### Recommended Server Configuration

**Hetzner CPX51** or higher:
- 16 vCPU cores
- 64 GB RAM
- 360 GB NVMe SSD
- 20 TB traffic

### Resource Allocation

Based on 64GB RAM:

```yaml
PostgreSQL: 8GB RAM, 4 CPUs
Redis: 4GB RAM, 2 CPUs
MinIO: 4GB RAM, 2 CPUs
API (2 replicas): 8GB RAM total, 4 CPUs total
Workers (3 replicas): 36GB RAM total, 12 CPUs total
Frontend: 512MB RAM, 0.5 CPUs
Traefik: 512MB RAM, 1 CPU
---
Total: ~61GB RAM, 25.5 CPUs
```

### System Optimizations

```bash
# Increase file descriptors
echo "fs.file-max = 100000" >> /etc/sysctl.conf

# Optimize network
echo "net.core.somaxconn = 1024" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 2048" >> /etc/sysctl.conf

# Apply changes
sysctl -p

# Set Docker log limits
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker
```

### Firewall Configuration

```bash
# Install UFW
apt install ufw -y

# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable
```

---

## Monitoring & Maintenance

### Health Checks

```bash
# Check all services
docker compose ps

# View resource usage
docker stats

# Check specific service logs
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f postgres
```

### Database Backups

```bash
# Create backup script
cat > /home/deploy/backup-db.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/deploy/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker compose exec -T postgres pg_dump -U screencraft screencraft | \
  gzip > "$BACKUP_DIR/screencraft_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "screencraft_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/deploy/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/deploy/backup-db.sh
```

### Log Rotation

Logs are automatically rotated by Docker (max 3 files, 10MB each).

View aggregated logs:

```bash
docker compose logs --tail=100 -f
```

### Updates & Rollbacks

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Rollback if needed
git checkout <previous-commit>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs <service-name>

# Check container status
docker compose ps

# Restart specific service
docker compose restart <service-name>

# Recreate service
docker compose up -d --force-recreate <service-name>
```

### Database Connection Issues

```bash
# Check PostgreSQL logs
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U screencraft -d screencraft

# Check DATABASE_URL
docker compose exec api printenv DATABASE_URL
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker compose logs worker

# Check Redis connection
docker compose exec redis redis-cli ping

# Check BullMQ queue
docker compose exec api node -e "
const Redis = require('ioredis');
const redis = new Redis({host:'redis',port:6379});
redis.llen('bull:screenshots:wait').then(console.log);
"
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Reduce MAX_CONCURRENT_BROWSERS
# Edit .env and restart workers
nano .env
docker compose restart worker
```

### SSL Certificate Issues

```bash
# Check Traefik logs
docker compose logs traefik | grep -i acme

# Verify DNS
dig screencraft.example.com

# Test certificate
curl -vI https://screencraft.example.com
```

### Performance Issues

```bash
# Check browser pool
docker compose exec api node -e "
const Redis = require('ioredis');
const redis = new Redis({host:'redis',port:6379});
redis.get('browser:pool:size').then(console.log);
"

# Monitor queue length
watch -n 1 'docker compose exec redis redis-cli llen bull:screenshots:wait'

# Increase workers
# Edit docker-compose.prod.yml: deploy.replicas: 5
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=5
```

---

## Quick Commands Reference

```bash
# Start development
docker-compose up -d

# Start production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs
docker compose logs -f [service-name]

# Restart service
docker compose restart [service-name]

# Stop all
docker compose down

# Clean everything
docker compose down -v --remove-orphans

# Shell into container
docker compose exec [service-name] sh

# Run migrations
docker compose exec api npx prisma migrate deploy

# Backup database
docker compose exec postgres pg_dump -U screencraft screencraft > backup.sql

# Restore database
docker compose exec -T postgres psql -U screencraft screencraft < backup.sql
```

---

## Security Checklist

- [ ] Changed all default passwords
- [ ] Generated strong JWT secret (32+ chars)
- [ ] Configured firewall (UFW)
- [ ] Set up SSL certificates (Let's Encrypt)
- [ ] Enabled Traefik dashboard auth
- [ ] Configured database backups
- [ ] Set log rotation
- [ ] Disabled unnecessary ports
- [ ] Reviewed CORS origins
- [ ] Set up monitoring alerts

---

## Support

For issues or questions:
1. Check logs: `docker compose logs -f`
2. Review health checks: `docker compose ps`
3. Consult architecture docs: `api/ARCHITECTURE.md`
4. Check API docs: http://your-server:3000/docs
