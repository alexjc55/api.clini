# Clini API

[![API Version](https://img.shields.io/badge/API-v1.0-blue.svg)](docs/openapi.yaml)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-green.svg)](docs/openapi.yaml)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

A production-ready REST API for waste collection and household services platform. Designed as the single source of truth for ERP systems, client mobile applications, courier apps, and partner integrations.

## Features

- **Multi-tenant Architecture** - Supports client, courier, and staff user types
- **Role-Based Access Control (RBAC)** - Granular permissions with role inheritance
- **Internationalization (i18n)** - Full support for Hebrew, Russian, Arabic, and English
- **Gamification System** - Levels, streaks, achievements, and feature unlocking
- **Bonus & Loyalty Program** - Points earning, spending, expiration, and adjustments
- **Subscription Management** - Recurring orders with flexible scheduling rules
- **Partner Marketplace** - Partner offers with segment-based targeting
- **Real-time Webhooks** - Event notifications with HMAC-SHA256 signing
- **Feature Flags** - Gradual rollouts with percentage-based targeting
- **Sandbox Mode** - Isolated testing environment for integrations
- **Audit Logging** - Complete staff action history with change diffs
- **Soft Delete** - Recoverable deletions with `deletedAt` timestamps

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+ (recommended for production)

### Installation

```bash
# Clone the repository (into current directory)
git clone https://github.com/your-org/clini-api.git .

# Or clone into a new folder
git clone https://github.com/your-org/clini-api.git
cd clini-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see Environment Variables section)
nano .env

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SESSION_SECRET` | Secret for JWT signing (min 32 chars) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | No (uses memory) |
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | Environment: `development` or `production` | No |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | No |

**CORS Configuration:**

```bash
# Allow specific domains
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Allow all domains (development only, not recommended for production)
ALLOWED_ORIGINS=*

# If not set, defaults to allowing all origins
```

**DATABASE_URL Format:**
```
postgresql://username:password@host:5432/database_name
```

**Important:** If your password contains special characters, URL-encode them:
| Character | Encoded |
|-----------|---------|
| `#` | `%23` |
| `$` | `%24` |
| `@` | `%40` |
| `}` | `%7D` |
| `~` | `%7E` |

### Running in Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Running with PM2 (recommended for production)

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start npm --name "waste-api" -- start

# Save PM2 process list
pm2 save

# Set up auto-start on reboot
pm2 startup
```

## Database Migration

### Files Structure

| File | Description |
|------|-------------|
| `docs/database-schema.sql` | Full database schema dump (structure only) |
| `migrations/*.sql` | Incremental Drizzle migration files |
| `scripts/migrate.ts` | Safe migration script for production |
| `docs/MIGRATION_GUIDE.md` | Detailed migration instructions |

### Fresh Installation (New Empty Database Only)

```bash
# Option 1: Apply full schema directly (recommended)
psql $DATABASE_URL < docs/database-schema.sql

# Option 2: Use Drizzle push (ONLY for empty databases!)
npx drizzle-kit push --dialect=postgresql --schema=./server/database/schema.ts --url=$DATABASE_URL
```

> **Note:** Both options are ONLY for fresh installations on empty databases. For existing databases with data, use incremental migrations.

### Incremental Migration (Existing Database)

```bash
# 1. REQUIRED: Create backup first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migrations (preserves existing data)
npx tsx scripts/migrate.ts
```

### Generate New Migrations

When you modify `server/database/schema.ts`:

```bash
# Generate migration SQL (ALWAYS use --schema parameter explicitly)
npx drizzle-kit generate --dialect=postgresql --schema=./server/database/schema.ts --out=./migrations

# Review generated SQL before applying
cat migrations/XXXX_*.sql

# Apply migration
npx tsx scripts/migrate.ts

# For production (requires explicit confirmation)
NODE_ENV=production MIGRATE_CONFIRM=1 npx tsx scripts/migrate.ts
```

> **Warning:** Never use `drizzle-kit push` on production databases with existing data. It may delete columns/tables to sync schema. Use incremental migrations only.

See [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) for complete migration documentation.

## API Documentation

- **Interactive Docs**: Available at `/api-docs` when running the server
- **OpenAPI Spec (JSON)**: `GET /api/v1/openapi.json`
- **OpenAPI Spec (YAML)**: `GET /api/v1/openapi.yaml`

### Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.your-domain.com/api/v1` |
| Staging | `https://staging-api.your-domain.com/api/v1` |
| Development | `http://localhost:5000/api/v1` |

### Authentication

All protected endpoints require a Bearer token:

```http
Authorization: Bearer <access_token>
```

**Token Flow:**
1. Register or login to receive `accessToken` (15 min) and `refreshToken` (7 days)
2. Use `accessToken` in `Authorization` header for API requests
3. When `accessToken` expires, call refresh endpoint with `refreshToken`
4. Sessions are stored in PostgreSQL `device_sessions` table (survives server restarts)

**Endpoints:**
- `POST /api/v1/auth/register` - New user registration
- `POST /api/v1/auth/login` - User login (returns tokens + creates session)
- `POST /api/v1/auth/refresh` - Token refresh (rotates both tokens)
- `POST /api/v1/auth/logout` - Logout current session
- `POST /api/v1/auth/logout-all` - Logout all sessions
- `GET /api/v1/sessions` - List user sessions
- `DELETE /api/v1/sessions/:id` - Delete specific session

### Standard Headers

| Header | Description | Example |
|--------|-------------|---------|
| `Accept-Language` | Response language | `he`, `ru`, `ar`, `en` |
| `X-Request-Id` | Request tracking ID | UUID v4 |
| `Idempotency-Key` | Prevent duplicate POST requests | UUID v4 |
| `X-Environment` | Sandbox mode | `production`, `sandbox` |

### Response Formats

**Success Response:**
```json
{
  "status": "success",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "error": {
    "key": "order.not_found",
    "params": { "orderId": "123" }
  }
}
```

**Paginated Response:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 134,
    "hasNext": true
  }
}
```

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design documentation.

**Additional Documentation:**
- [MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) - Database migration instructions
- [PROJECT_DESCRIPTION.md](docs/PROJECT_DESCRIPTION.md) - Project overview
- [TECHNICAL_REPORT.md](docs/TECHNICAL_REPORT.md) - Technical specifications
- [CONTRACT_POLICY.md](docs/CONTRACT_POLICY.md) - API versioning policy

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL via Drizzle ORM (35 tables)
- **Storage**: Automatic selection (PostgreSQL when `DATABASE_URL` set, in-memory fallback)
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas
- **API Spec**: OpenAPI 3.0.3

### Database Setup

The API automatically detects and uses PostgreSQL when `DATABASE_URL` is configured:

```bash
# Push schema to database
npx drizzle-kit push --dialect=postgresql --schema=./server/database/schema.ts --url=$DATABASE_URL
```

**Database Schema (35 Tables):**

| Category | Tables |
|----------|--------|
| Core | users, roles, permissions, role_permissions, user_roles, addresses |
| Courier | couriers, courier_documents |
| Orders | orders, order_events, order_finance_snapshots |
| Sessions/Audit | device_sessions, audit_logs, events |
| User Data | user_activities, user_flags |
| Gamification | levels, user_levels, user_progress, progress_transactions, user_streaks, features, user_feature_access |
| Bonus System | bonus_accounts, bonus_transactions |
| Subscriptions | subscriptions, subscription_plans, subscription_rules |
| Partners | partners, partner_offers |
| Webhooks | webhooks, webhook_deliveries |
| System | feature_flags, idempotency_records |

### Project Structure

```
├── client/                 # Frontend (API documentation UI)
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Page components
│       └── lib/            # Utilities and helpers
├── server/                 # Backend API
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # In-memory storage (MemStorage)
│   ├── storage-factory.ts  # Automatic storage selection
│   ├── repositories.ts     # Storage interface definitions
│   ├── database/           # PostgreSQL integration
│   │   ├── schema.ts       # Drizzle ORM table definitions
│   │   ├── db-storage.ts   # PostgreSQL storage implementation
│   │   └── connection.ts   # Database connection pool
│   ├── middleware.ts       # Express middleware
│   ├── webhooks.ts         # Webhook dispatch system
│   └── sandbox-guard.ts    # Sandbox mode protection
├── shared/                 # Shared code
│   └── schema.ts           # Database schema and types
├── docs/                   # Documentation
│   ├── openapi.yaml        # OpenAPI specification
│   ├── openapi.json        # OpenAPI specification (JSON)
│   ├── database-schema.sql # Full database schema dump
│   ├── ARCHITECTURE.md     # System architecture
│   ├── CONTRACT_POLICY.md  # API contract policy
│   ├── MIGRATION_GUIDE.md  # Database migration guide
│   ├── PROJECT_DESCRIPTION.md # Project overview
│   └── TECHNICAL_REPORT.md # Technical specifications
├── migrations/             # Drizzle ORM migration files
├── scripts/
│   └── migrate.ts          # Safe migration runner
└── package.json
```

## API Endpoints Overview

### Core Resources

| Resource | Endpoints | Description |
|----------|-----------|-------------|
| Auth | `/auth/*` | Registration, login, sessions |
| Users | `/users/*` | User management (CRUD) |
| Orders | `/orders/*` | Order lifecycle management |
| Addresses | `/addresses/*` | User address management |
| Couriers | `/couriers/*` | Courier management and profiles |

### Convenience Endpoints for Mobile Apps

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/users/me` | GET | Get current user profile (no need to parse JWT for userId) |
| `/couriers/me` | GET | Get current courier profile (courier users only) |
| `/auth/me` | GET | Get current authenticated user info |

### Extended Features

| Resource | Endpoints | Description |
|----------|-----------|-------------|
| Bonus | `/bonus/*` | Loyalty points system |
| Subscriptions | `/subscriptions/*` | Recurring order management |
| Partners | `/partners/*` | Partner marketplace |
| Levels | `/levels/*` | Gamification levels |
| Streaks | `/streaks/*` | User engagement streaks |
| Webhooks | `/webhooks/*` | Partner notifications |
| Flags | `/flags/*` | Feature flags |

### Meta Endpoints

All `/meta/*` endpoints return enum values for UI rendering:

```bash
GET /api/v1/meta/order-statuses
GET /api/v1/meta/user-types
GET /api/v1/meta/bonus-transaction-types
# ... and more
```

Meta endpoints support HTTP caching:
- `Cache-Control: public, max-age=300`
- `ETag` for conditional requests

## Webhooks

Subscribe to real-time events:

| Event | Description |
|-------|-------------|
| `order.created` | New order placed |
| `order.assigned` | Courier assigned |
| `order.completed` | Order finished |
| `order.cancelled` | Order cancelled |
| `subscription.created` | New subscription |
| `bonus.earned` | Points earned |
| `bonus.redeemed` | Points spent |

All webhook payloads are signed with HMAC-SHA256:

```http
X-Webhook-Signature: sha256=<signature>
X-Webhook-Timestamp: <unix_timestamp>
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policies and vulnerability reporting.

## License

This project is proprietary software. See [LICENSE](LICENSE) for details.

## Support

- **Documentation**: [docs/](docs/)
- **API Reference**: `/api-docs`
- **Issues**: GitHub Issues
- **Email**: alexjc55@gmail.com

---

Built with enterprise-grade reliability for production deployments.
