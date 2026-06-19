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

- **Node.js** 20.19.0+ (22 LTS recommended) — Prisma 7 requires this
- **Docker Desktop** — Postgres 18 and Redis 7
- **npm** 10+

## Quick start

```bash
git clone https://github.com/alaaharbyy/Booking-Availability-Platform.git
cd Booking-Availability-Platform
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Verify: `curl http://localhost:3000/health`

**Notes**

- Postgres runs on host port **5433** (see `DATABASE_URL` in `.env.example`)
- Redis must be up before starting the server (booking expiry worker)
- Seed clears and repopulates all data; password for all users: `Password123!`

## npm scripts

| Script | Description |
| ------ | ----------- |
| `npm start` / `npm run dev` | Start API + expiry worker |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Load sample data |

## Seed logins

| Tenant | Email | Role |
| ------ | ----- | ---- |
| `summit-adventures` | `admin@summit-adventures.com` | ADMIN |
| `summit-adventures` | `manager@summit-adventures.com` | TRAVEL_MANAGER |
| `summit-adventures` | `viewer@summit-adventures.com` | VIEWER |
| `coastal-escapes` | `admin@coastal-escapes.com` | ADMIN |
| `coastal-escapes` | `manager@coastal-escapes.com` | TRAVEL_MANAGER |

## API

All responses use `{ success, data, meta }` or `{ success, false, error, meta }`. Protected routes need `Authorization: Bearer <accessToken>`. Query/body validation via Zod → `req.validated`.

### Endpoints

| Method | Path | Roles | Description |
| ------ | ---- | ----- | ----------- |
| `GET` | `/health` | — | Health check |
| `POST` | `/auth/login` | — | Sign in (`tenantSlug`, `email`, `password`) |
| `POST` | `/auth/refresh` | — | Rotate tokens |
| `POST` | `/auth/logout` | — | Revoke refresh token |
| `GET` | `/auth/me` | Any | Current user |
| `GET` | `/experiences` | Any | Search experiences (filters: `destination`, dates, `party_size`, `supplier_id`, price, sort, pagination) |
| `GET` | `/experiences/:id` | Any | Detail + slot pricing (`party_size`, `slot_id`, date filters) |
| `POST` | `/bookings` | Any | Reserve slot (`slot_id`, `party_size`) |
| `GET` | `/bookings/:ref` | Own | Booking detail |
| `PATCH` | `/bookings/:ref/confirm` | Own | Confirm reservation |
| `DELETE` | `/bookings/:ref` | Own | Cancel (`reason` in body) |
| `GET` | `/admin/bookings` | ADMIN, TRAVEL_MANAGER | Tenant booking list (filters: `status`, `user_id`, `experience_id`, `reference`, date ranges, sort, pagination) |
| `GET` | `/admin/audit-log` | ADMIN | Audit trail (filters: `event_type`, `entity_type`, `entity_id`, `actor_user_id`, dates, pagination) |
| `POST` | `/webhooks` | ADMIN | Register/update webhook URL (upsert, rotates secret) |
| `POST` | `/webhooks/test` | ADMIN | Send signed test event (optional `data` in body) |

Own bookings are scoped to `tenantId` + `userId`. Cross-tenant access returns **404**.

### Auth example

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"summit-adventures","email":"admin@summit-adventures.com","password":"Password123!"}'
```

### Bookings

Reservations hold for `BOOKING_RESERVE_TTL` (default 15m), then expire via background worker.

Experience search/detail responses are cached in Redis (`AVAILABILITY_CACHE_TTL_SECONDS`, default 300s). Cache is cleared for the whole tenant when a booking reserves, cancels, or expires a slot.

```bash
curl -s -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"slot_id":"<uuid>","party_size":4}'
```

### Webhooks

One webhook per tenant. Outbound requests include HMAC-SHA256 headers: `X-Webhook-Id`, `X-Webhook-Timestamp`, `X-Webhook-Signature` (`t=<ts>,v1=<hex>` over `${timestamp}.${rawBody}`).

**Booking events** (sent automatically after reserve, confirm, cancel, or expiry): `booking.reserved`, `booking.confirmed`, `booking.cancelled`, `booking.expired`. Test events use `webhook.test`.

**Testing:** Get a free URL at [Webhook.site](https://webhook.site/), register it, then create a booking or call `/webhooks/test`.

```bash
curl -s -X POST http://localhost:3000/webhooks \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/your-id"}'

curl -s -X POST http://localhost:3000/webhooks/test \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":{"message":"Hello"}}'
```

Secret is returned only on register — store it securely.

## Project layout

```
prisma/          schema, migrations, seed
src/
  routes/        HTTP route handlers
  services/      Business logic
  middleware/    auth, roles, validation
  schemas/       Zod request + response types
  workers/       BullMQ workers
  lib/           prisma, redis, audit, webhook signing
```

Audit writes use `withAuditedTransaction` in `src/lib/audit.ts`.

## Stopping services

```bash
docker compose down      # stop containers
docker compose down -v   # also delete data volumes
```
