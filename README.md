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
- **Authentication** (`src/auth/`, `src/services/auth.service.ts`, `src/routes/auth.routes.ts`) — multi-tenant login with JWT access tokens and rotating refresh tokens stored in the database; login and logout write audit records atomically with session changes
- **Audit logging** (`src/lib/audit.ts`, `src/constants/entity-types.ts`) — `withAuditedTransaction` wraps `prisma.$transaction` so business writes and `audit_logs` inserts commit or roll back together; typed `AuditEntityType` constants for `entityType`
- **Auth middleware** (`src/middleware/auth_middleware.ts`) — validates `Authorization: Bearer <token>` and attaches the user to `req.user`
- **Request validation** (`src/schemas/requests/`, `src/middleware/validate-request.ts`) — Zod schemas for incoming body, query, and route params; parsed values are stored on `req.validated` (required for Express 5, where `req.query` and `req.params` are read-only)
- **Experience search & pricing** (`GET /experiences`, `GET /experiences/:id`) — tenant-scoped search by destination, date range, party size, and price range; availability filtering, grouping, sorting, and pagination run in PostgreSQL; pricing previews are computed in application code from supplier pricing rules (group size, advance booking, seasonal) with Zod-validated JSONB rule configs

## Prerequisites

### Node.js (required)

**Prisma 7 will not run on older Node versions.** You must use one of:


| Requirement        | Version                             |
| ------------------ | ----------------------------------- |
| **Minimum**        | Node.js **20.19.0**                 |
| **Also supported** | Node.js **22.12.0+** or **24.0.0+** |
| **Recommended**    | Node.js **22 LTS** (latest)         |


Check your version:

```bash
node --version
```

If you see `v20.13.x` or lower, upgrade before continuing. On Windows, download the latest LTS from [nodejs.org](https://nodejs.org/) or use a version manager (`nvm-windows`, `fnm`).

### Other tools


| Tool           | Version used in this project  |
| -------------- | ----------------------------- |
| Docker Desktop | Latest (for Postgres + Redis) |
| npm            | 10+ (ships with Node)         |


## Required packages

Install all dependencies with `npm install`. These are the packages this project depends on:

### Production dependencies


| Package              | Version   | Purpose                                               |
| -------------------- | --------- | ----------------------------------------------------- |
| `@prisma/client`     | `^7.8.0`  | Prisma ORM client (generated after `prisma generate`) |
| `@prisma/adapter-pg` | `^7.8.0`  | PostgreSQL driver adapter (required by Prisma 7)      |
| `pg`                 | `^8.21.0` | PostgreSQL client for Node.js                         |
| `dotenv`             | `^17.4.2` | Loads `.env` for Prisma CLI and seed script           |
| `bcryptjs`           | `^3.0.3`  | Password hashing (seed data and login verification)   |
| `express`            | `^5.1.0`  | HTTP server                                           |
| `jsonwebtoken`       | `^9.0.3`  | JWT access and refresh token signing                  |
| `zod`                | `^4.4.3`  | Request schema validation                             |


### Development dependencies


| Package               | Version   | Purpose                                      |
| --------------------- | --------- | -------------------------------------------- |
| `prisma`              | `^7.8.0`  | Prisma CLI (migrate, generate, seed)         |
| `tsx`                 | `^4.22.4` | Runs TypeScript (seed script and API server) |
| `@types/bcryptjs`     | `^2.4.6`  | TypeScript types for bcryptjs                |
| `@types/express`      | `^5.0.3`  | TypeScript types for Express                 |
| `@types/jsonwebtoken` | `^9.0.10` | TypeScript types for jsonwebtoken            |
| `@types/pg`           | `^8.20.0` | TypeScript types for pg                      |


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

JWT_ACCESS_SECRET=change-me-in-production-use-a-long-random-string
JWT_REFRESH_SECRET=change-me-refresh-secret-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

**Important:**

- Use a **full connection string** in `DATABASE_URL`. Unlike Docker Compose, `.env` files do **not** expand `${POSTGRES_USER}`-style references.
- Set strong, unique values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in production.
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

Route handlers should use `asyncHandler`, `sendSuccess`, and throw errors from `src/errors`. Use `validateRequest` with Zod schemas from `src/schemas/requests/` to validate the body, query string, and/or route params before the handler runs. Handlers read parsed query and params from `req.validated` (Express 5 does not allow assigning back to `req.query` or `req.params`). The global error middleware in `src/app.ts` converts thrown errors into the standard error envelope.

```typescript
import { asyncHandler, sendSuccess } from "./http/index.js";
import { NotFoundError } from "./errors/index.js";
import { validateRequest } from "./middleware/validate-request.js";
import { createItemBodySchema } from "./schemas/requests/item.requests.js";

app.post(
  "/example",
  validateRequest({ body: createItemBodySchema }),
  asyncHandler(async (req, res) => {
    const item = await createItem(req.body);
    sendSuccess(res, item, 201);
  }),
);
```

### Request validation

Inputs are defined as Zod schemas in `src/schemas/requests/` and validated by `validateRequest` before the handler runs. Pass whichever parts apply to the route:

```typescript
validateRequest({ body: loginBodySchema });                              // POST JSON body
validateRequest({ query: experienceSearchQuerySchema });                 // GET ?query=params
validateRequest({ params: experienceIdParamsSchema, query: detailSchema }); // GET /:id?query
```

Parsed output is stored on `req.validated`:


| Part     | Read in handler                     |
| -------- | ----------------------------------- |
| `body`   | `req.body` and `req.validated.body` |
| `query`  | `req.validated.query`               |
| `params` | `req.validated.params`              |


```typescript
experiencesRouter.get(
  "/:id",
  validateRequest({ params: experienceIdParamsSchema, query: experienceDetailQuerySchema }),
  asyncHandler(async (req, res) => {
    const { id } = req.validated!.params as ExperienceIdParams;
    const query = req.validated!.query as ExperienceDetailQuery;
    // ...
  }),
);
```

Invalid input returns **400 Bad Request**:

```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request body",
    "details": {
      "issues": [
        { "path": "email", "message": "Invalid email address" }
      ]
    }
  },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
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

### Authentication

All auth routes are mounted under `/auth`. Protected routes require an `Authorization: Bearer <accessToken>` header.

#### `POST /auth/login`

Sign in with tenant slug, email, and password.

**Request body**

```json
{
  "tenantSlug": "summit-adventures",
  "email": "admin@summit-adventures.com",
  "password": "Password123!"
}
```

**200 OK**

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<opaque-token>",
    "expiresIn": 900,
    "user": {
      "id": "...",
      "tenantId": "...",
      "email": "admin@summit-adventures.com",
      "role": "ADMIN"
    }
  },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
```

**401 Unauthorized** — invalid credentials.

#### `POST /auth/refresh`

Exchange a refresh token for a new access/refresh token pair.

**Request body**

```json
{
  "refreshToken": "<refresh-token-from-login>"
}
```

**200 OK** — returns `accessToken`, `refreshToken`, and `expiresIn`.

#### `POST /auth/logout`

Revoke a refresh token.

**Request body**

```json
{
  "refreshToken": "<refresh-token>"
}
```

**200 OK**

```json
{
  "success": true,
  "data": { "loggedOut": true },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
```

#### `GET /auth/me`

Returns the currently authenticated user. Requires a valid access token.

**200 OK**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "tenantId": "...",
      "email": "admin@summit-adventures.com",
      "role": "ADMIN"
    }
  },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
```

**Example**

```bash
# Login
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"summit-adventures","email":"admin@summit-adventures.com","password":"Password123!"}'

# Get current user (replace TOKEN with accessToken from login)
curl -s http://localhost:3000/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### Experiences

#### `GET /experiences`

Search and filter bookable experiences for the authenticated user's tenant. Returns one row per experience that has at least one available slot in the date range. Requires a valid access token.

**Query parameters**


| Parameter     | Required | Default                   | Description                                                   |
| ------------- | -------- | ------------------------- | ------------------------------------------------------------- |
| `destination` | No       | — (all destinations)      | Case-insensitive partial match (e.g. `Italy`, `Chamonix`)     |
| `start_date`  | No       | Today (UTC)               | Range start, inclusive (`YYYY-MM-DD`)                         |
| `end_date`    | No       | Today + 90 days (UTC)     | Range end, inclusive (`YYYY-MM-DD`)                           |
| `party_size`  | No       | `1`                       | Minimum free spots required per slot (1–100)                  |
| `supplier_id` | No       | —                         | Filter by supplier UUID                                       |
| `min_price`   | No       | —                         | Minimum experience `basePrice`                                |
| `max_price`   | No       | —                         | Maximum experience `basePrice`                                |
| `sort_by`     | No       | `starts_at`               | `starts_at`, `price`, `title`, or `available_spots`           |
| `sort_order`  | No       | `asc`                     | `asc` or `desc`                                               |
| `page`        | No       | `1`                       | Page number                                                   |
| `page_size`   | No       | `20`                      | Results per page (max `100`)                                  |


`fromPrice` is the lowest total price for `party_size` across matching slots after applying supplier pricing rules (group size, advance booking, seasonal).

Search runs availability filtering, grouping, sorting, and pagination in PostgreSQL. Pricing previews are computed in application code because rule logic (e.g. seasonal surcharges, group discounts) cannot be expressed purely in SQL. Sorting by `price` fetches all matching experiences first, computes `fromPrice`, then paginates in memory.

**200 OK**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "...",
        "title": "Glacier Hike & Ice Caves",
        "destination": "Chamonix, France",
        "description": "Guided glacier trek...",
        "basePrice": "189",
        "capacity": 12,
        "supplier": { "id": "...", "name": "Alpine Guides Co." },
        "partySize": 4,
        "fromPrice": "680.40",
        "availableSlots": 2,
        "earliestSlotAt": "2026-06-24T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
```

**Examples**

```bash
# Search with no filters (defaults: party_size=1, today → +90 days, all destinations)
curl -s "http://localhost:3000/experiences" \
  -H "Authorization: Bearer TOKEN"

# Search with filters
curl -s "http://localhost:3000/experiences?destination=France&start_date=2026-06-18&end_date=2026-07-18&party_size=4" \
  -H "Authorization: Bearer TOKEN"
```

#### `GET /experiences/:id`

Experience detail with a real-time pricing preview and per-slot pricing for available slots. Requires a valid access token.

**Query parameters**


| Parameter    | Required | Description                                                                             |
| ------------ | -------- | --------------------------------------------------------------------------------------- |
| `party_size` | No       | Party size used for pricing and slot availability (1–100); defaults to `1` when omitted |
| `slot_id`    | No       | Focus pricing on a specific slot; returns 404 if not found on this experience           |
| `start_date` | No       | Filter returned slots — range start (`YYYY-MM-DD`)                                      |
| `end_date`   | No       | Filter returned slots — range end (`YYYY-MM-DD`)                                        |


Top-level `pricingPreview` uses the selected `slot_id`, or the earliest available slot when omitted. Each item in `slots` includes its own `pricingPreview` with date-aware rules applied. Only slots with enough free capacity for `party_size` are returned.

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "Glacier Hike & Ice Caves",
    "destination": "Chamonix, France",
    "description": "Guided glacier trek...",
    "basePrice": "189",
    "capacity": 12,
    "supplier": {
      "id": "...",
      "name": "Alpine Guides Co.",
      "email": "ops@alpineguides.com"
    },
    "partySize": 4,
    "pricingPreview": {
      "partySize": 4,
      "basePricePerPerson": "189.00",
      "subtotal": "756.00",
      "adjustments": [],
      "totalPrice": "756.00"
    },
    "slots": [
      {
        "slotId": "...",
        "startsAt": "2026-06-24T08:00:00.000Z",
        "endsAt": "2026-06-24T13:00:00.000Z",
        "slotCapacity": 12,
        "reserved": 4,
        "availableSpots": 8,
        "pricingPreview": {
          "partySize": 4,
          "basePricePerPerson": "189.00",
          "subtotal": "756.00",
          "adjustments": [],
          "totalPrice": "756.00"
        }
      }
    ]
  },
  "meta": { "timestamp": "2026-06-17T07:16:41.975Z" }
}
```

**Examples**

```bash
# Detail without party_size (defaults to 1)
curl -s "http://localhost:3000/experiences/<experience-id>" \
  -H "Authorization: Bearer TOKEN"

# Detail with party size and date filter
curl -s "http://localhost:3000/experiences/<experience-id>?party_size=6&start_date=2026-06-18&end_date=2026-12-31" \
  -H "Authorization: Bearer TOKEN"
```

### Audit logging

Mutating operations that should leave an audit trail use `withAuditedTransaction` from `src/lib/audit.ts`. The helper runs your callback inside a Prisma interactive transaction, then inserts a row into `audit_logs` using the same transactional client so both succeed or both roll back.

**Event types** are defined by the `AuditEventType` enum in `prisma/schema.prisma` (e.g. `LOGIN`, `LOGOUT`, `BOOKING_CONFIRMED`, `WEBHOOK_CREATED`).

**Entity types** are string constants in `src/constants/entity-types.ts` — use `AuditEntityType` instead of hardcoded strings:


| Constant                           | Value              |
| ---------------------------------- | ------------------ |
| `AuditEntityType.Tenant`           | `Tenant`           |
| `AuditEntityType.User`             | `User`             |
| `AuditEntityType.Supplier`         | `Supplier`         |
| `AuditEntityType.Experience`       | `Experience`       |
| `AuditEntityType.AvailabilitySlot` | `AvailabilitySlot` |
| `AuditEntityType.PricingRule`      | `PricingRule`      |
| `AuditEntityType.Booking`          | `Booking`          |
| `AuditEntityType.TenantWebhook`    | `TenantWebhook`    |


**Example — wrap a service mutation**

```typescript
import { AuditEventType } from "../generated/prisma/client.js";
import { AuditEntityType } from "../constants/entity-types.js";
import { withAuditedTransaction } from "../lib/audit.js";

await withAuditedTransaction(
  {
    eventType: AuditEventType.BOOKING_CONFIRMED,
    tenantId,
    actorUserId: userId,
    entityType: AuditEntityType.Booking,
    entityId: bookingId,
    metadata: { previousStatus: "RESERVED" },
  },
  async (tx) => {
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: "CONFIRMED" },
    });
  },
);
```

If you already have an open transaction callback, call `logAudit(tx, auditContext)` at the end instead. Inside any transaction, use only the `tx` client — not the global `prisma` instance — so all writes stay in the same transaction.

Login and logout in `auth.service.ts` already use this pattern (`LOGIN` and `LOGOUT` events on the `User` entity).

## Seed data


| Item                 | Details                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Tenants              | Summit Adventures (`summit-adventures`), Coastal Escapes (`coastal-escapes`)                 |
| Users                | 5 users across both tenants                                                                  |
| Password (all users) | `Password123!`                                                                               |
| Sample logins        | `admin@summit-adventures.com`, `manager@coastal-escapes.com`, `viewer@summit-adventures.com` |
| Bookings             | One each in CONFIRMED, RESERVED, CANCELLED, and EXPIRED status                               |


## npm scripts


| Script                | Command                  | Description                          |
| --------------------- | ------------------------ | ------------------------------------ |
| `npm start`           | `tsx src/index.ts`       | Start the API server                 |
| `npm run dev`         | `tsx watch src/index.ts` | Start the API server with hot reload |
| `npm run db:generate` | `prisma generate`        | Generate Prisma Client               |
| `npm run db:migrate`  | `prisma migrate dev`     | Apply migrations in development      |
| `npm run db:seed`     | `prisma db seed`         | Populate database with sample data   |


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
│   ├── auth/
│   │   ├── tokens.ts       # JWT signing, refresh token generation
│   │   └── types.ts        # Auth-related TypeScript types
│   ├── config/
│   │   └── env.ts          # Environment variable parsing
│   ├── constants/
│   │   └── entity-types.ts # AuditEntityType constants for audit_logs.entityType
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
│   │   ├── database.ts     # Database health checks
│   │   └── audit.ts        # withAuditedTransaction / logAudit helpers
│   ├── middleware/
│   │   ├── auth_middleware.ts  # Bearer JWT authentication
│   │   └── validate-request.ts # Zod validation; stores output on req.validated
│   ├── schemas/
│   │   ├── requests/           # Zod schemas for API inputs (body, query, params)
│   │   │   ├── auth.requests.ts
│   │   │   ├── experience.requests.ts
│   │   │   └── shared.requests.ts
│   │   └── responses/          # TypeScript types and Zod schemas for API outputs
│   │       ├── experience.responses.ts
│   │       ├── pagination.responses.ts
│   │       └── pricing.responses.ts  # PricingPreview types + rule config schemas
│   ├── routes/
│   │   ├── auth.routes.ts        # Login, refresh, logout, me
│   │   └── experiences.routes.ts # Experience search and detail
│   ├── services/
│   │   ├── auth.service.ts       # Auth business logic
│   │   ├── experience.service.ts # Experience search and detail (DB-first availability)
│   │   └── pricing.service.ts    # Real-time pricing preview from rule configs
│   ├── types/
│   │   └── express.d.ts    # Express Request augmentation (req.user, req.validated)
│   ├── utils/
│   │   └── utils.ts        # Shared date parsing helpers
│   └── generated/prisma/   # Generated client (not committed)
├── .env.example            # Environment template
└── .env                    # Local secrets (not committed)
```

## Stopping services

```bash
docker compose down
```

To remove volumes (deletes all database data):

```bash
docker compose down -v
```

