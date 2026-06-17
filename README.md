# Booking Availability Platform

Multi-tenant travel booking platform with availability management, pricing rules, audit logging, and webhook support.

## What's implemented so far

- **Database schema** (`prisma/schema.prisma`) — Prisma 7 models for:
  - Multi-tenant users with roles (`ADMIN`, `TRAVEL_MANAGER`, `VIEWER`)
  - Suppliers, experiences, and availability slots
  - Bookings with status lifecycle (`RESERVED`, `CONFIRMED`, `CANCELLED`, `EXPIRED`)
  - Pricing rules (group size, advance booking, seasonal)
  - Refresh token families, tenant webhooks, audit logs, and outbox events
- **Initial migration** (`prisma/migrations/20260617060501_init`)
- **Prisma 7 config** (`prisma.config.ts`) — database URL and seed command
- **Seed script** (`prisma/seed.ts`) — sample tenants, users, experiences, slots, and bookings
- **Docker Compose** — PostgreSQL 18 and Redis 7 for local development
- **Express HTTP server** (`src/index.ts`, `src/app.ts`) — API entry point with global error handling
- **HTTP layer** (`src/http/`) — consistent API response envelope, `asyncHandler`, and typed success/error bodies
- **Error types** (`src/errors/`) — reusable `AppError` subclasses (`NotFoundError`, `BadRequestError`, etc.)
- **Health endpoint** (`GET /health`) — verifies server and database connectivity via `assertDatabaseHealthy()`

## Prerequisites

### Node.js (required)

**Prisma 7 will not run on older Node versions.** You must use one of:

| Requirement | Version |
|-------------|---------|
| **Minimum** | Node.js **20.19.0** |
| **Also supported** | Node.js **22.12.0+** or **24.0.0+** |
| **Recommended** | Node.js **22 LTS** (latest) |

Check your version:

```bash
node --version
```

If you see `v20.13.x` or lower, upgrade before continuing. On Windows, download the latest LTS from [nodejs.org](https://nodejs.org/) or use a version manager (`nvm-windows`, `fnm`).

### Other tools

| Tool | Version used in this project |
|------|------------------------------|
| Docker Desktop | Latest (for Postgres + Redis) |
| npm | 10+ (ships with Node) |

## Required packages

Install all dependencies with `npm install`. These are the packages this project depends on:

### Production dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/client` | `^7.8.0` | Prisma ORM client (generated after `prisma generate`) |
| `@prisma/adapter-pg` | `^7.8.0` | PostgreSQL driver adapter (required by Prisma 7) |
| `pg` | `^8.21.0` | PostgreSQL client for Node.js |
| `dotenv` | `^17.4.2` | Loads `.env` for Prisma CLI and seed script |
| `bcryptjs` | `^3.0.3` | Password hashing in seed data |
| `express` | `^5.1.0` | HTTP server |

### Development dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `prisma` | `^7.8.0` | Prisma CLI (migrate, generate, seed) |
| `tsx` | `^4.22.4` | Runs TypeScript (seed script and API server) |
| `@types/bcryptjs` | `^2.4.6` | TypeScript types for bcryptjs |
| `@types/express` | `^5.0.3` | TypeScript types for Express |
| `@types/pg` | `^8.20.0` | TypeScript types for pg |

> **Note:** Do not rely on `npx prisma` alone without installing packages first — it downloads Prisma into a temp cache and is more likely to hit version/engine issues. Always run `npm install` in the project root first.

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/alaaharbyy/Booking-Availability-Platform.git
cd Booking-Availability-Platform
npm install
```

### 2. Configure environment

Copy the example env file and adjust if needed:

```bash
cp .env.example .env
```

Default `.env` values:

```env
POSTGRES_DB=booking-availability-platform
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/booking-availability-platform"
PORT=3000
```

**Important:**

- Use a **full connection string** in `DATABASE_URL`. Unlike Docker Compose, `.env` files do **not** expand `${POSTGRES_USER}`-style references.
- Postgres is mapped to host port **5433** (not 5432) to avoid conflicts with a local PostgreSQL installation. If you have no other Postgres running, you can change the compose port mapping to `5432:5432` and update `DATABASE_URL` accordingly.

### 3. Start the database

```bash
docker compose up -d
```

Wait until containers are healthy:

```bash
docker compose ps
```

### 4. Generate Prisma Client

```bash
npm run db:generate
```

This outputs the client to `src/generated/prisma` (gitignored — each developer must generate locally).

### 5. Run migrations

```bash
npm run db:migrate
```

On a fresh database this applies the existing `init` migration. If prompted for a migration name on an empty DB, use `init`.

### 6. Seed the database

```bash
npm run db:seed
```

The seed script **clears all existing data** and repopulates the tables.

### 7. Start the API server

```bash
npm start        # start the server
# or
npm run dev      # start with hot reload
```

Verify the app is working:

```bash
curl http://localhost:3000/health
```

## API

All endpoints return a consistent envelope:

**Success**
```json
{
  "success": true,
  "data": { },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
```

**Error**
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Database is not reachable",
    "details": { "database": "disconnected" }
  },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
```

Route handlers should use `asyncHandler`, `sendSuccess`, and throw errors from `src/errors`. The global error middleware in `src/app.ts` converts them into the standard error envelope.

```typescript
import { asyncHandler, sendSuccess } from "./http/index.js";
import { NotFoundError } from "./errors/index.js";

app.get(
  "/example/:id",
  asyncHandler(async (req, res) => {
    const item = await findItem(req.params.id);
    if (!item) throw new NotFoundError("Item not found");
    sendSuccess(res, item);
  }),
);
```

### `GET /health`

Health check — confirms the server is running and the database is reachable.

**200 OK**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected"
  },
  "meta": {
    "timestamp": "2026-06-17T07:16:41.975Z"
  }
}
```

**503 Service Unavailable** (server up, database down)

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Database is not reachable",
    "details": {
      "database": "disconnected"
    }
  },
  "meta": {
    "timestamp": "2026-06-17T07:16:41.975Z"
  }
}
```

## Seed data

| Item | Details |
|------|---------|
| Tenants | Summit Adventures, Coastal Escapes |
| Users | 5 users across both tenants |
| Password (all users) | `Password123!` |
| Sample logins | `admin@summit-adventures.com`, `manager@coastal-escapes.com`, `viewer@summit-adventures.com` |
| Bookings | One each in CONFIRMED, RESERVED, CANCELLED, and EXPIRED status |

## npm scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `tsx src/index.ts` | Start the API server |
| `npm run dev` | `tsx watch src/index.ts` | Start the API server with hot reload |
| `npm run db:generate` | `prisma generate` | Generate Prisma Client |
| `npm run db:migrate` | `prisma migrate dev` | Apply migrations in development |
| `npm run db:seed` | `prisma db seed` | Populate database with sample data |

## Project structure

```
├── docker-compose.yml      # Postgres (5433) + Redis (6379)
├── prisma.config.ts        # Prisma 7 CLI config (DB URL, seed command)
├── prisma/
│   ├── schema.prisma       # Data model
│   ├── seed.ts             # Seed script
│   └── migrations/         # SQL migrations
├── src/
│   ├── index.ts            # Server entry point (loads env, starts listener)
│   ├── app.ts              # Express app, routes, global error middleware
│   ├── errors/
│   │   ├── app-error.ts    # Base AppError class
│   │   ├── http-errors.ts  # HTTP-specific error subclasses
│   │   └── index.ts        # Public exports (barrel)
│   ├── http/
│   │   ├── async-handler.ts # Wraps async routes; forwards errors to middleware
│   │   ├── response.ts     # sendSuccess / sendError helpers
│   │   ├── types.ts        # ApiSuccessBody, ApiErrorBody, etc.
│   │   └── index.ts        # Public exports (barrel)
│   ├── lib/
│   │   ├── prisma.ts       # Shared Prisma client
│   │   └── database.ts     # Database health checks
│   └── generated/prisma/   # Generated client (not committed)
├── .env.example            # Environment template
└── .env                    # Local secrets (not committed)
```

## Troubleshooting

### `EBADENGINE` / Prisma refuses to install

Your Node.js version is too old. Upgrade to **20.19+**, **22.12+**, or **24+**.

### `P1000: Authentication failed`

Usually one of:

1. **Wrong port** — ensure `DATABASE_URL` uses port `5433` (Docker mapping), not `5432`.
2. **Docker not running** — run `docker compose up -d postgres`.
3. **Stale shell variable** — if you previously exported `DATABASE_URL` in your terminal, clear it:
   ```powershell
   Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
   ```

### Database name shows `${POSTGRES_DB}` or `%7B...%7D`

`DATABASE_URL` contains unexpanded variables. Use the literal connection string from `.env.example`.

### `/health` returns 503 with `SERVICE_UNAVAILABLE`

The API server is running but cannot reach Postgres. The response will include `"details": { "database": "disconnected" }`. Check that Docker is up, `DATABASE_URL` is correct, and port `5433` is reachable.

### `npx` cleanup `EPERM` warnings on Windows

Harmless npm cache cleanup warnings. Run `npm install` locally and use `npx prisma` from `node_modules` instead of relying on the global npx cache.

## Stopping services

```bash
docker compose down
```

To remove volumes (deletes all database data):

```bash
docker compose down -v
```
