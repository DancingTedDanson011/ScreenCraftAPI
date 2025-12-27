# ScreenCraft API Backend

Screenshot Generation Service built with Fastify, Playwright, and BullMQ.

## Features

- **Screenshot Generation**: Create screenshots of websites using Playwright
- **Job Queue**: Async job processing with BullMQ and Redis
- **Object Storage**: MinIO/S3 compatible storage for screenshots
- **Rate Limiting**: Built-in API rate limiting
- **Type Safety**: Full TypeScript support with Zod validation
- **Production Ready**: Docker support, health checks, graceful shutdown

## Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose
- pnpm/npm/yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Infrastructure

```bash
npm run docker:up
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- MinIO on ports 9000 (API) and 9001 (Console)

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration.

### 4. Setup Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

API will be available at `http://localhost:3000`

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (includes dependencies)

### API

- `GET /api/v1` - API information

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services
- `npm run docker:logs` - View Docker logs
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## Project Structure

```
api/
├── src/
│   ├── server.ts          # Fastify server setup
│   ├── config/            # Configuration and env validation
│   ├── routes/            # API routes
│   ├── controllers/       # Route handlers
│   ├── services/          # Business logic
│   ├── middleware/        # Custom middleware
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
├── docker/
│   ├── Dockerfile         # Production Docker image
│   └── docker-compose.yml # Local infrastructure
├── prisma/
│   └── schema.prisma      # Database schema
└── package.json
```

## Environment Variables

See `.env.example` for all available configuration options.

## License

MIT
