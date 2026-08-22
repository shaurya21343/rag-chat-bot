# Docker Setup & Running Instructions

## Prerequisites
- Docker & Docker Compose installed
- Environment variables configured

## Quick Start

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Configure Environment Variables in `.env`
Update the following variables with your actual values:
- `CLERK_PUBLISHABLE_KEY` - Get from Clerk Dashboard
- `CLERK_SECRET_KEY` - Get from Clerk Dashboard
- `OPEN_ROUTER_API_KEY` - Get from OpenRouter.ai
- `QDRANT_API_KEY` - Set any secure string (used for Qdrant authentication)

### 3. Build and Start All Services
```bash
docker-compose up -d
```

This will start:
- **App** (Next.js) on `http://localhost:3000`
- **Worker** (Document processor) - running in background
- **Qdrant** (Vector DB) on `http://localhost:6333`
- **Valkey** (Redis) on `http://localhost:6379`

### 4. Verify Services are Running
```bash
docker-compose ps
```

### 5. View Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f worker
docker-compose logs -f qdrant
docker-compose logs -f valkey
```

## Stopping Services
```bash
docker-compose down
```

## Rebuilding Services (after code changes)
```bash
docker-compose up -d --build
```

## Environment Variables Explained

| Variable | Description | Example |
|----------|-------------|---------|
| `CLERK_PUBLISHABLE_KEY` | Clerk auth public key | pk_live_xxx |
| `CLERK_SECRET_KEY` | Clerk auth secret key | sk_live_xxx |
| `OPEN_ROUTER_API_KEY` | OpenRouter LLM API key | sk-or-xxx |
| `QDRANT_URL` | Qdrant vector DB URL | http://qdrant:6333 |
| `QDRANT_API_KEY` | Qdrant API authentication | any-secure-string |
| `REDIS_URL` | Redis/Valkey connection URL | redis://valkey:6379 |

## Troubleshooting

### Services not starting?
```bash
docker-compose logs
```

### Port already in use?
Change ports in docker-compose.yml:
- App: change `3000:3000` to `3001:3000`
- Qdrant: change `6333:6333` to `6334:6333`
- Redis: change `6379:6379` to `6380:6379`

### Worker not processing documents?
- Check worker logs: `docker-compose logs worker`
- Verify Redis connection: Valkey service must be running
- Verify Qdrant connection: Qdrant service must be running

### Database persistence
- Qdrant data is stored in `qdrant_data` volume
- Redis data is stored in `valkey_data` volume
- Both persist across container restarts

## Cleaning Up

### Remove containers and networks
```bash
docker-compose down
```

### Remove containers, networks, AND volumes (data)
```bash
docker-compose down -v
```

### Remove unused Docker images
```bash
docker image prune
```
