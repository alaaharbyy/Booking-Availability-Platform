# Booking Availability Platform

Multi-tenant travel booking platform with availability management, pricing rules, audit logging, and webhooks.

## Features

- Multi-tenant auth (JWT + rotating refresh tokens), roles: `ADMIN`, `TRAVEL_MANAGER`, `VIEWER`
- Experience search and pricing (group size, advance booking, seasonal rules)
- Booking lifecycle: `RESERVED` → `CONFIRMED` | `CANCELLED` | `EXPIRED` with optimistic slot locking
- Background expiry worker (BullMQ + Redis)
- Admin: tenant booking list, audit log
- Webhooks: one URL per tenant, HMAC-SHA256 signed delivery on booking lifecycle events
- Availability cache: Redis-backed `GET /experiences` and `GET /experiences/:id`, broad tenant invalidation on slot changes
- Tenant isolation on all resource access (`req.user.tenantId`)

## Prerequisites

- **Docker Desktop** (recommended — runs everything with one command)
- Or for local dev: **Node.js** 20.19.0+ (22 LTS recommended) and **npm** 10+

## Quick start (Docker)

```bash
git clone https://github.com/alaaharbyy/Booking-Availability-Platform.git
cd Booking-Availability-Platform
docker compose up --build
```

API: http://localhost:3000

Verify: `curl http://localhost:3000/health`

On first start the app container runs migrations and seeds sample data (`SEED_ON_START=true` by default). Set `SEED_ON_START=false` in a `.env` file or your environment to skip re-seeding on later runs.

Stop: `docker compose down` — add `-v` to delete database volumes.

## Local development (API on host)

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Use `DATABASE_URL` with `localhost:5433` and `REDIS_URL=redis://localhost:6379` (see `.env.example`).

## npm scripts

| Script | Description |
| ------ | ----------- |
| `npm start` / `npm run dev` | Start API + expiry worker |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply migrations (interactive dev) |
| `npm run db:deploy` | Apply migrations (non-interactive) |
| `npm run db:seed` | Load sample data |

## Seed logins

Password for all users: `Password123!`

| Tenant | Email | Role |
| ------ | ----- | ---- |
| `summit-adventures` | `admin@summit-adventures.com` | ADMIN |
| `summit-adventures` | `manager@summit-adventures.com` | TRAVEL_MANAGER |
| `summit-adventures` | `viewer@summit-adventures.com` | VIEWER |
| `coastal-escapes` | `admin@coastal-escapes.com` | ADMIN |
| `coastal-escapes` | `manager@coastal-escapes.com` | TRAVEL_MANAGER |

## API

All responses use `{ success, data, meta }` or `{ success, false, error, meta }`. Protected routes need `Authorization: Bearer <accessToken>`.

### Endpoints

| Method | Path | Roles | Description |
| ------ | ---- | ----- | ----------- |
| `GET` | `/health` | — | Health check |
| `POST` | `/auth/login` | — | Sign in |
| `POST` | `/auth/refresh` | — | Rotate tokens |
| `POST` | `/auth/logout` | — | Revoke refresh token |
| `GET` | `/auth/me` | Any | Current user |
| `GET` | `/experiences` | Any | Search experiences |
| `GET` | `/experiences/:id` | Any | Experience detail + slots |
| `POST` | `/bookings` | Any | Reserve slot |
| `GET` | `/bookings/:ref` | Own | Booking detail |
| `PATCH` | `/bookings/:ref/confirm` | Own | Confirm reservation |
| `DELETE` | `/bookings/:ref` | Own | Cancel booking |
| `GET` | `/admin/bookings` | ADMIN, TRAVEL_MANAGER | Tenant booking list |
| `GET` | `/admin/audit-log` | ADMIN | Audit trail |
| `POST` | `/webhooks` | ADMIN | Register webhook URL |
| `POST` | `/webhooks/test` | ADMIN | Send test webhook |

### Auth example

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"summit-adventures","email":"admin@summit-adventures.com","password":"Password123!"}'
```

### Webhooks

Register at [Webhook.site](https://webhook.site/) for testing. Booking events: `booking.reserved`, `booking.confirmed`, `booking.cancelled`, `booking.expired`.

## Project layout

```
docker/           entrypoint (migrate, seed, start)
prisma/           schema, migrations, seed
src/              API, services, workers
docker-compose.yml  app + postgres + redis
```
