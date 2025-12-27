# ScreenCraft Docker Management
# Quick commands for common Docker operations

.PHONY: help dev prod build clean logs shell db-migrate db-reset backup

# Default target
help:
	@echo "ScreenCraft Docker Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-down     - Stop development environment"
	@echo "  make dev-logs     - View development logs"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-down    - Stop production environment"
	@echo "  make prod-logs    - View production logs"
	@echo "  make prod-build   - Rebuild production images"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-reset     - Reset database (dangerous!)"
	@echo "  make db-backup    - Backup database"
	@echo "  make db-restore   - Restore database from backup"
	@echo ""
	@echo "Utilities:"
	@echo "  make shell-api    - Shell into API container"
	@echo "  make shell-worker - Shell into worker container"
	@echo "  make shell-db     - Shell into PostgreSQL"
	@echo "  make logs         - View all logs"
	@echo "  make clean        - Remove all containers and volumes"
	@echo "  make status       - Show container status"

# ============================================
# Development
# ============================================
dev:
	docker-compose up -d
	@echo "Development environment started!"
	@echo "Frontend: http://localhost:4321"
	@echo "API: http://localhost:3000"
	@echo "MinIO Console: http://localhost:9001"

dev-down:
	docker-compose down

dev-logs:
	docker-compose logs -f

dev-build:
	docker-compose build

# ============================================
# Production
# ============================================
prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo "Production environment started!"

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

prod-build:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# ============================================
# Database Operations
# ============================================
db-migrate:
	docker-compose exec api npx prisma migrate deploy

db-generate:
	docker-compose exec api npx prisma generate

db-reset:
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose exec api npx prisma migrate reset --force; \
	fi

db-backup:
	@mkdir -p ./backups
	@TIMESTAMP=$$(date +%Y%m%d_%H%M%S); \
	docker-compose exec -T postgres pg_dump -U screencraft screencraft | \
	gzip > ./backups/screencraft_$$TIMESTAMP.sql.gz
	@echo "Backup created: ./backups/screencraft_$$TIMESTAMP.sql.gz"

db-restore:
	@echo "Available backups:"
	@ls -1 ./backups/*.sql.gz
	@read -p "Enter backup filename: " BACKUP; \
	if [ -f "./backups/$$BACKUP" ]; then \
		gunzip -c ./backups/$$BACKUP | \
		docker-compose exec -T postgres psql -U screencraft screencraft; \
		echo "Database restored from $$BACKUP"; \
	else \
		echo "Backup file not found!"; \
	fi

# ============================================
# Shell Access
# ============================================
shell-api:
	docker-compose exec api sh

shell-worker:
	docker-compose exec worker sh

shell-db:
	docker-compose exec postgres psql -U screencraft screencraft

shell-redis:
	docker-compose exec redis redis-cli

shell-web:
	docker-compose exec web sh

# ============================================
# Utilities
# ============================================
logs:
	docker-compose logs -f

status:
	docker-compose ps

clean:
	@echo "WARNING: This will remove all containers and volumes!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v --remove-orphans; \
		echo "Cleaned!"; \
	fi

restart:
	docker-compose restart

restart-api:
	docker-compose restart api

restart-worker:
	docker-compose restart worker

# ============================================
# Health & Monitoring
# ============================================
health:
	@echo "=== Container Health ==="
	@docker-compose ps
	@echo ""
	@echo "=== Resource Usage ==="
	@docker stats --no-stream

queue-length:
	docker-compose exec redis redis-cli llen bull:screenshots:wait

browser-pool:
	docker-compose exec redis redis-cli get browser:pool:size

# ============================================
# Quick Fixes
# ============================================
fix-permissions:
	docker-compose exec api chown -R node:node /app
	docker-compose exec worker chown -R node:node /app

rebuild-all: clean dev db-migrate
	@echo "Complete rebuild finished!"
