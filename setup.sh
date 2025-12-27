#!/bin/bash

# ScreenCraft Docker Setup Script
# Automated setup for development and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

check_requirements() {
    print_info "Checking requirements..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_success "Docker $(docker --version)"
    print_success "Docker Compose $(docker compose version)"
}

setup_environment() {
    local ENV_TYPE=$1

    print_info "Setting up $ENV_TYPE environment..."

    # Root .env
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"

        if [ "$ENV_TYPE" == "production" ]; then
            print_info "Generating secure passwords..."

            POSTGRES_PASSWORD=$(openssl rand -base64 32)
            REDIS_PASSWORD=$(openssl rand -base64 32)
            MINIO_PASSWORD=$(openssl rand -base64 32)
            JWT_SECRET=$(openssl rand -base64 48)

            sed -i "s/your_strong_postgres_password_here/$POSTGRES_PASSWORD/g" .env
            sed -i "s/your_strong_redis_password_here/$REDIS_PASSWORD/g" .env
            sed -i "s/your_strong_minio_password_here/$MINIO_PASSWORD/g" .env
            sed -i "s/your_super_secret_jwt_key_min_32_chars_long_change_this/$JWT_SECRET/g" .env

            print_success "Generated secure passwords"
            print_info "Please edit .env and configure:"
            print_info "  - CORS_ORIGIN"
            print_info "  - ACME_EMAIL"
            print_info "  - Domain names"
        fi
    else
        print_info ".env already exists, skipping..."
    fi

    # API .env
    if [ ! -f api/.env ]; then
        cp api/.env.example api/.env
        print_success "Created api/.env from api/.env.example"
    else
        print_info "api/.env already exists, skipping..."
    fi
}

build_images() {
    local ENV_TYPE=$1

    print_info "Building Docker images for $ENV_TYPE..."

    if [ "$ENV_TYPE" == "production" ]; then
        docker compose -f docker-compose.yml -f docker-compose.prod.yml build
    else
        docker-compose build
    fi

    print_success "Docker images built successfully"
}

start_services() {
    local ENV_TYPE=$1

    print_info "Starting services..."

    if [ "$ENV_TYPE" == "production" ]; then
        docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    else
        docker-compose up -d
    fi

    print_success "Services started"
}

wait_for_services() {
    print_info "Waiting for services to be healthy..."

    local MAX_ATTEMPTS=30
    local ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if docker compose ps | grep -q "healthy"; then
            print_success "Services are healthy"
            return 0
        fi

        ATTEMPT=$((ATTEMPT + 1))
        echo -n "."
        sleep 2
    done

    print_error "Services failed to become healthy"
    docker compose ps
    return 1
}

initialize_database() {
    print_info "Initializing database..."

    # Wait a bit for postgres to be fully ready
    sleep 5

    # Generate Prisma Client
    docker compose exec -T api npx prisma generate
    print_success "Generated Prisma Client"

    # Run migrations
    docker compose exec -T api npx prisma migrate deploy
    print_success "Database migrations completed"

    # Seed database (optional)
    read -p "Do you want to seed the database with test data? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose exec -T api npm run prisma:seed
        print_success "Database seeded"
    fi
}

show_status() {
    print_info "Service Status:"
    docker compose ps

    echo ""
    print_info "Access URLs:"
    echo "  Frontend:      http://localhost:4321"
    echo "  API:           http://localhost:3000"
    echo "  API Docs:      http://localhost:3000/docs"
    echo "  MinIO Console: http://localhost:9001"
    echo "  Traefik:       http://localhost:8080"
}

# Main script
main() {
    echo "ScreenCraft Docker Setup"
    echo "========================"
    echo ""

    # Ask for environment type
    echo "Select environment type:"
    echo "  1) Development"
    echo "  2) Production"
    read -p "Enter choice [1-2]: " choice

    case $choice in
        1)
            ENV_TYPE="development"
            ;;
        2)
            ENV_TYPE="production"
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac

    echo ""

    # Run setup steps
    check_requirements
    echo ""

    setup_environment $ENV_TYPE
    echo ""

    read -p "Build Docker images? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_images $ENV_TYPE
        echo ""
    fi

    read -p "Start services? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_services $ENV_TYPE
        echo ""

        wait_for_services
        echo ""

        read -p "Initialize database? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            initialize_database
            echo ""
        fi
    fi

    show_status
    echo ""

    print_success "Setup complete!"

    if [ "$ENV_TYPE" == "production" ]; then
        echo ""
        print_info "IMPORTANT: Production Setup"
        print_info "1. Review and update .env with your domain and settings"
        print_info "2. Configure DNS to point to your server IP"
        print_info "3. Update Traefik labels in docker-compose.prod.yml"
        print_info "4. Set up automated backups (see DOCKER_DEPLOYMENT.md)"
        print_info "5. Configure firewall (ports 80, 443, 22 only)"
    else
        echo ""
        print_info "Next steps:"
        print_info "1. View logs: make logs"
        print_info "2. Access services (URLs shown above)"
        print_info "3. Read documentation: DOCKER_README.md"
    fi
}

# Run main
main
