# Waste Collection API

## Overview
This project is a centralized REST API designed to serve as the backend for a waste collection and household services platform. It aims to be the single source of truth for an ERP system, client mobile applications, courier mobile applications, and future products. The API supports various user types (client, courier, staff) and is built for scalability and extensibility.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.
Do not make changes to the `docs/POSTGRESQL_MIGRATION.md` file.

## System Architecture
The API follows an API-first, stateless REST architecture, returning JSON responses. It implements Role & Permission Based Access Control (RBAC) with granular permissions. Key architectural decisions include:
- **Modularity:** Designed for extension without contract changes.
- **Event-based history:** For auditing and analytics.
- **API Versioning:** `/api/v1/*` is recommended, with `/api/*` for backward compatibility.
- **Soft Delete:** Entities like `User`, `Order`, `CourierProfile`, and `Address` use a `deletedAt` field.
- **Audit Logging:** All staff actions are logged with change differentials.
- **Internationalization (i18n):** Supports `he`, `ru`, `ar`, `en` (fallback) via `Accept-Language` header. Responses use localization keys instead of hardcoded text.
- **Security:** Includes rate limiting on authentication endpoints, refresh token revocation, state machine validation for status transitions, and device/session tracking. CORS is configurable via `ALLOWED_ORIGINS`.
- **OpenAPI Specification:** Available at `GET /api/v1/openapi.json` and `GET /api/v1/openapi.yaml`.

**Technical Implementations:**
- **Core Technologies:** Node.js, TypeScript, Express, `express-rate-limit`.
- **Authentication:** JWT (access + refresh tokens) using `jsonwebtoken`, password hashing with `bcryptjs`.
- **Data Storage:** Dual storage support - In-memory storage (MemStorage) for MVP/development, PostgreSQL via Drizzle ORM (DatabaseStorage) for production. Automatically selected based on `DATABASE_URL` environment variable.
- **ORM:** Drizzle ORM with PostgreSQL dialect, 30+ tables covering all features.
- **Date/Money Handling:** Dates are ISO 8601, money objects include `price` and `currency`.

**Key Features:**
- **User Management:** Registration, login, session management, user information, roles assignment.
- **Order Management:** Creation, listing, detail viewing, updating, cancellation, courier assignment.
- **Courier Management:** Profile management, order acceptance/completion, verification.
- **Address Management:** CRUD operations for user addresses.
- **Audit & Sessions:** Viewing audit logs and managing user sessions.
- **Roles and Permissions:** Listing roles and permissions, managing courier verification.
- **Analytics & Events:** Event tracking for product analytics (`/events`).
- **User Activity:** Tracking and summarizing user activity (`/users/:id/activity`).
- **Feature Flags & Segmentation:** Managing user flags for segmentation (`/users/:id/flags`).
- **Bonus System:** Bonus accounts, transactions with earn/spend/expire/adjust types (`/bonus/*`).
- **Subscriptions:** Subscription management, plans, and rules with scheduling (`/subscriptions`, `/subscription-plans`).
- **Partners & Marketplace:** Managing partners and offers by segment (`/partners`, `/partner-offers`).
- **Order Financial Snapshots:** Financial tracking per order (`/orders/:id/finance`).
- **Webhooks:** Real-time event notifications for partners/ERP with HMAC-SHA256 signing, 7 event types (`/webhooks`).
- **System Feature Flags:** Global feature toggles with rollout percentage and user type targeting (`/flags`).
- **Sandbox Mode:** Isolated testing environment via `X-Environment: sandbox` header with separate transactional data.

**Order Status State Machine:** Defines allowed transitions between order statuses (`created` → `scheduled` → `assigned` → `in_progress` → `completed`, with `cancelled` as a possible state at several points).

## External Dependencies
- **jsonwebtoken:** For JWT-based authentication.
- **bcryptjs:** For secure password hashing.
- **express-rate-limit:** For API rate limiting.
- **drizzle-orm:** PostgreSQL ORM for database operations.
- **pg:** PostgreSQL client library.
- **In-Memory Storage:** Used as the primary data store when DATABASE_URL is not set.

## Database Architecture

### Storage Factory Pattern
The application uses a storage factory (`server/storage-factory.ts`) that automatically selects the appropriate storage implementation:
- If `DATABASE_URL` is set and database is accessible → Uses `DatabaseStorage` (PostgreSQL)
- Otherwise → Falls back to `MemStorage` (in-memory)

### Database Schema (server/database/schema.ts)
30+ tables organized by feature domain:
- **Core:** users, roles, permissions, role_permissions, user_roles, addresses
- **Courier:** couriers, courier_documents
- **Orders:** orders, order_events, order_finance_snapshots
- **Sessions/Audit:** device_sessions, audit_logs, events
- **User Data:** user_activities, user_flags
- **Gamification:** levels, user_levels, user_progress, progress_transactions, user_streaks, features, user_feature_access
- **Bonus System:** bonus_accounts, bonus_transactions
- **Subscriptions:** subscriptions, subscription_plans, subscription_rules
- **Partners:** partners, partner_offers
- **Webhooks:** webhooks, webhook_deliveries
- **System:** feature_flags, idempotency_records

### Running Migrations

**Generate new migrations (after schema changes):**
```bash
npx drizzle-kit generate --dialect=postgresql --schema=./server/database/schema.ts --out=./migrations
```

**Apply migrations (development):**
```bash
npx tsx scripts/migrate.ts
```

**Apply migrations (production):**
```bash
NODE_ENV=production MIGRATE_CONFIRM=1 npx tsx scripts/migrate.ts
```

**Fresh install (new server only):**
```bash
psql $DATABASE_URL < docs/database-schema.sql
```

> **Warning:** Never use `drizzle-kit push` on production databases with existing data.

### Migration Files
- `docs/database-schema.sql` - Full schema dump for reference
- `migrations/*.sql` - Incremental migration files
- `scripts/migrate.ts` - Safe migration runner with production safeguards
- `docs/MIGRATION_GUIDE.md` - Complete migration documentation