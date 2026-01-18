# Waste Collection API

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
- PostgreSQL 14+ (optional, uses in-memory storage by default)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/waste-collection-api.git
cd waste-collection-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `DATABASE_URL` | PostgreSQL connection string | No (uses memory) |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | No |
| `JWT_SECRET` | Secret for JWT signing | Yes |
| `JWT_EXPIRES_IN` | Access token expiration (e.g., `15m`) | No |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token expiration (e.g., `7d`) | No |

### Running in Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

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

Obtain tokens via:
- `POST /api/v1/auth/register` - New user registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh

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

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Storage**: In-memory (MVP) / PostgreSQL (production via Drizzle ORM)
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas
- **API Spec**: OpenAPI 3.0.3

### Project Structure

```
├── client/                 # Frontend (API documentation UI)
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── pages/          # Page components
│       └── lib/            # Utilities and helpers
├── server/                 # Backend API
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Data storage interface
│   ├── middleware.ts       # Express middleware
│   ├── webhooks.ts         # Webhook dispatch system
│   └── sandbox-guard.ts    # Sandbox mode protection
├── shared/                 # Shared code
│   └── schema.ts           # Database schema and types
├── docs/                   # Documentation
│   ├── openapi.yaml        # OpenAPI specification
│   ├── ARCHITECTURE.md     # System architecture
│   ├── CONTRACT_POLICY.md  # API contract policy
│   └── TECHNICAL_REPORT.md # Technical specifications
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
| Courier | `/courier/*` | Courier-specific operations |

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
- **Email**: api-support@your-domain.com

---

Built with enterprise-grade reliability for production deployments.
