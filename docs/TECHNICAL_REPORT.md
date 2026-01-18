# Waste Collection API - Technical Report

## Overview

This document provides a comprehensive technical overview of the Waste Collection API - a production-ready RESTful backend designed for waste collection and household services platforms.

**Version:** 1.0  
**Base URL:** `/api/v1/*`  
**Protocol:** REST over HTTPS  
**Response Format:** JSON

---

## Architecture

### Design Principles

| Principle | Implementation |
|-----------|----------------|
| API-First | OpenAPI 3.0 specification at `/api/v1/openapi.json` and `/api/v1/openapi.yaml` |
| Stateless | JWT-based authentication, no server-side session state |
| Modular | Feature-based organization, extensible without contract changes |
| Event-Driven | Audit logging, analytics events, and webhooks for all operations |
| Feature Flags | Gradual rollouts with percentage control and user type targeting |
| Sandbox Mode | Isolated test environment for partner integrations |

### Technology Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Authentication:** JWT (jsonwebtoken) + bcryptjs for password hashing
- **Rate Limiting:** express-rate-limit
- **Storage:** In-memory (MVP) with PostgreSQL-ready interfaces
- **Validation:** Zod schemas with drizzle-zod
- **Webhooks:** HMAC-SHA256 signed notifications
- **Environment Isolation:** AsyncLocalStorage for request-scoped context

---

## Core Modules

### 1. Authentication & Authorization

**Endpoints:**
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - Session termination

**Security Features:**
- Access + Refresh token pattern
- Rate limiting on authentication endpoints
- Refresh token revocation
- Device/session tracking
- Password hashing with bcryptjs

**RBAC Implementation:**
- Roles: `client`, `courier`, `staff`, `admin`
- Granular permissions per role
- Middleware-based authorization

### 2. User Management

**Endpoints:**
- `GET /users` - List users (staff)
- `GET /users/:id` - Get user details
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Soft delete user

**Features:**
- Soft delete with `deletedAt` field
- Role assignment
- Profile management
- Activity tracking (`/users/:id/activity`)
- Feature flags for segmentation (`/users/:id/flags`)

### 3. Order Management

**Endpoints:**
- `GET /orders` - List orders
- `POST /orders` - Create order
- `GET /orders/:id` - Order details
- `PATCH /orders/:id` - Update order
- `DELETE /orders/:id` - Cancel order
- `POST /orders/:id/assign` - Assign courier
- `GET /orders/:id/finance` - Financial snapshot

**State Machine:**
```
created -> scheduled -> assigned -> in_progress -> completed
    |          |           |            |
    v          v           v            v
cancelled  cancelled   cancelled    cancelled
```

**Features:**
- Status transition validation
- Courier assignment with geo-matching
- Financial snapshots per order
- Soft delete support

### 4. Courier Management

**Endpoints:**
- `GET /couriers` - List couriers
- `GET /couriers/:id` - Courier profile
- `PATCH /couriers/:id` - Update profile
- `POST /couriers/:id/verify` - Verify courier
- `GET /couriers/:id/orders` - Courier's orders

**Features:**
- Profile verification workflow
- Order acceptance/completion
- Performance metrics

### 5. Address Management

**Endpoints:**
- `GET /users/:id/addresses` - List user addresses
- `POST /users/:id/addresses` - Add address
- `GET /addresses/:id` - Get address
- `PATCH /addresses/:id` - Update address
- `DELETE /addresses/:id` - Soft delete address

### 6. Bonus System

**Endpoints:**
- `GET /bonus/account/:userId` - Bonus balance
- `GET /bonus/transactions/:userId` - Transaction history
- `POST /bonus/earn` - Earn bonuses
- `POST /bonus/spend` - Spend bonuses

**Transaction Types:**
- `earn` - Accumulation (orders, referrals, promos)
- `spend` - Redemption
- `expire` - Expiration
- `adjust` - Manual adjustment

**Reasons:**
`order_completion`, `referral`, `promo`, `subscription`, `manual`, `order_payment`, `partner_offer`, `subscription_payment`, `bonus_expiration`

### 7. Subscriptions

**Endpoints:**
- `GET /subscriptions` - List subscriptions
- `POST /subscriptions` - Create subscription
- `GET /subscriptions/:id` - Subscription details
- `PATCH /subscriptions/:id` - Update subscription
- `POST /subscriptions/:id/pause` - Pause subscription
- `POST /subscriptions/:id/resume` - Resume subscription
- `POST /subscriptions/:id/cancel` - Cancel subscription

**Plan Endpoints:**
- `GET /subscription-plans` - List plans
- `POST /subscription-plans` - Create plan

**Features:**
- Day of week scheduling
- Time slot selection
- Pause/resume/cancel flow
- Automatic next order calculation

### 8. Partners & Marketplace

**Endpoints:**
- `GET /partners` - List partners
- `POST /partners` - Add partner
- `GET /partner-offers` - List offers
- `POST /partner-offers` - Create offer

**Features:**
- Segment-based offer targeting
- Bonus price support
- Partner categorization

---

## Gamification System

### 9. Levels & Progress

**Endpoints:**
- `GET /levels` - List all levels
- `POST /levels` - Create level (admin)
- `GET /levels/:code` - Get level by code
- `GET /users/:id/progress` - User progress + current level
- `POST /users/:id/progress` - Add progress points
- `GET /users/:id/progress/transactions` - Point history
- `GET /users/:id/level` - Current level with history
- `POST /users/:id/level` - Set user level (admin)

**Level Tiers (configurable via admin):**
| Code | Description |
|------|-------------|
| bronze | Entry level |
| silver | Intermediate level |
| gold | Advanced level |
| platinum | Top tier |

*Note: Actual `minPoints` thresholds are configured by administrators when creating levels.*

**Progress Point Reasons:**
| Reason | Description |
|--------|-------------|
| `daily_order` | Daily order completion |
| `shabbat_order` | Shabbat order bonus |
| `streak_3` | 3-day streak achieved |
| `streak_7` | 7-day streak achieved |
| `streak_14` | 14-day streak achieved |
| `streak_30` | 30-day streak achieved |
| `month_perfect` | Perfect month completion |
| `referral` | Successful referral |
| `first_order` | First order bonus |
| `subscription_started` | New subscription |
| `manual_adjust` | Admin adjustment |

### 10. Streaks

**Endpoints:**
- `GET /users/:id/streaks` - All user streaks
- `GET /users/:id/streaks/:type` - Specific streak
- `POST /users/:id/streaks/:type/increment` - Increment streak
- `POST /users/:id/streaks/:type/reset` - Reset streak

**Streak Types:**
| Type | Description |
|------|-------------|
| `daily_cleanup` | Daily cleanup activity |
| `weekly_order` | Weekly order placement |
| `shabbat_order` | Shabbat orders |

**Features:**
- Automatic reset if user skips a day
- Maximum streak tracking
- Date-based validation

### 11. Feature Unlocks

**Endpoints:**
- `GET /features` - List all features
- `POST /features` - Create feature (admin)
- `GET /features/:code` - Get feature by code
- `GET /users/:id/features` - User's unlocked features
- `GET /users/:id/features/:code` - Check access
- `POST /users/:id/features` - Grant feature access
- `DELETE /users/:id/features/:featureId` - Revoke access

**Feature Codes:**
| Code | Description |
|------|-------------|
| `shabbat_orders` | Shabbat order scheduling |
| `bonus_marketplace` | Bonus marketplace access |
| `priority_courier` | Priority courier matching |
| `partner_offers` | Partner offers access |
| `premium_support` | Premium support channel |
| `analytics_dashboard` | Analytics dashboard |

**Grant Types:**
- `level` - Automatic by level achievement
- `manual` - Admin grant
- `promo` - Promotional campaign

---

## System Features

### 12. Audit Logging

**Endpoints:**
- `GET /audit` - List audit logs (staff)

**Features:**
- All staff actions logged
- Change differentials stored
- Actor/target tracking
- Timestamp recording

### 13. Session Management

**Endpoints:**
- `GET /sessions` - List active sessions
- `DELETE /sessions/:id` - Terminate session

### 14. Analytics Events

**Endpoints:**
- `POST /events` - Track event
- `GET /events` - Query events

**Features:**
- Custom event tracking
- User segmentation
- Product analytics support

### 15. Meta Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /meta/roles` | Available roles |
| `GET /meta/permissions` | Available permissions |
| `GET /meta/order-statuses` | Order statuses |
| `GET /meta/bonus-types` | Bonus transaction types |
| `GET /meta/bonus-reasons` | Bonus reasons |
| `GET /meta/subscription-statuses` | Subscription statuses |
| `GET /meta/level-codes` | Level codes |
| `GET /meta/progress-reasons` | Progress reasons |
| `GET /meta/streak-types` | Streak types |
| `GET /meta/feature-codes` | Feature codes |
| `GET /meta/feature-grant-types` | Feature grant types |

---

## Internationalization (i18n)

**Supported Languages:**
- `he` - Hebrew
- `ru` - Russian
- `ar` - Arabic
- `en` - English (fallback)

**Implementation:**
- `Accept-Language` header
- Localization keys in responses
- Client-side translation

---

## Data Handling

### Date/Time
- ISO 8601 format
- UTC timezone

### Money Objects
```json
{
  "price": 100.00,
  "currency": "ILS"
}
```

### Soft Delete
Entities with `deletedAt`:
- User
- Order
- CourierProfile
- Address

---

## Security

| Feature | Implementation |
|---------|----------------|
| Authentication | JWT (access + refresh) |
| Password Storage | bcryptjs hashing |
| Rate Limiting | express-rate-limit |
| CORS | Configurable via `ALLOWED_ORIGINS` |
| Token Revocation | Refresh token blacklist |
| Session Tracking | Device/IP logging |

---

## Request Tracking (X-Request-Id)

All requests include `X-Request-Id` header:
- **Inbound:** If client sends `X-Request-Id`, it's preserved
- **Auto-generated:** If not provided, server generates UUID v4
- **Response:** Always returned in response header
- **Use case:** Logging, debugging, support tickets

---

## Idempotency

POST endpoints support `Idempotency-Key` header:

**Protected Endpoints:**
- `POST /orders`
- `POST /bonus/transactions`

**Mechanism:**
- Cache key: `userId + endpoint + idempotencyKey`
- Response cached for 24 hours
- Duplicate requests return cached response
- Header `X-Idempotency-Replayed: true` indicates replay

---

## Pagination Contract

**Standard format for all list endpoints:**
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

**Query Parameters:**
- `page` (default: 1)
- `perPage` (default: 20)

**Paginated Endpoints:**
- `GET /users` — User list (staff)
- `GET /orders` — Order list
- `GET /audit-logs` — Audit logs (staff)
- `GET /events` — Analytics events (staff)
- `GET /bonus/transactions/:userId` — Bonus transaction history

*Note: Other list endpoints return unpaginated arrays for simplicity. Pagination can be extended as needed.*

---

## OAuth-Ready Structure

**Client Types:**
| Code | Description |
|------|-------------|
| `mobile_client` | Client mobile app |
| `courier_app` | Courier mobile app |
| `erp` | ERP system |
| `partner` | Partner integration |
| `web` | Web application |

**Session Metadata:**
- `clientId` — Client application identifier
- `clientType` — Type of client application

**Future Capabilities:**
- Per-client rate limiting
- API key issuance
- Scope-based access control

---

## API Versioning

- Current: `/api/v1/*`
- Legacy support: `/api/*` (redirects to v1)
- Breaking changes require new version

---

## Error Responses

**Immutable Error Contract:**
```json
{
  "error": {
    "key": "order.not_found",
    "params": { "orderId": "123" }
  }
}
```

- `key` — Localization key for client-side translation
- `params` — Dynamic parameters for message interpolation

**Standard HTTP Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limited
- `500` - Server Error

---

## Webhooks

### 16. Webhook System

**Endpoints:**
- `GET /webhooks` - List registered webhooks
- `POST /webhooks` - Register new webhook
- `GET /webhooks/:id` - Get webhook details
- `PATCH /webhooks/:id` - Update webhook
- `DELETE /webhooks/:id` - Delete webhook
- `POST /webhooks/:id/test` - Send test event
- `GET /webhooks/:id/deliveries` - Delivery history

**Event Types:**
| Event | Trigger |
|-------|---------|
| `order.created` | New order created |
| `order.completed` | Order marked completed |
| `order.cancelled` | Order cancelled |
| `order.assigned` | Courier assigned to order |
| `subscription.created` | New subscription created |
| `bonus.earned` | Bonus points earned |
| `bonus.redeemed` | Bonus points redeemed |

**Security:**
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Secret generated per webhook registration
- Signature format: `sha256=<hmac_hex>`

**Delivery:**
- Up to 3 retry attempts with exponential backoff
- Delivery status tracking (statusCode, response, attempts)
- Success/failure logging

**Request Body:**
```json
{
  "event": "order.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": { ... }
}
```

---

## System Feature Flags

### 17. Feature Flags API

**Endpoints:**
- `GET /flags` - List all feature flags
- `POST /flags` - Create feature flag
- `GET /flags/:key` - Get flag by key
- `PATCH /flags/:key` - Update flag
- `DELETE /flags/:key` - Delete flag
- `GET /flags/:key/check?userId=` - Check if enabled for user

**Flag Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `key` | string | Unique identifier |
| `enabled` | boolean | Global on/off |
| `rolloutPercentage` | integer (0-100) | Gradual rollout |
| `targetUserTypes` | array | Target user types |
| `metadata` | object | Additional config |

**Rollout Logic:**
1. Check if flag is globally enabled
2. Check if user type matches target (if specified)
3. Apply rollout percentage using consistent hashing

**Use Cases:**
- Gradual feature rollouts
- A/B testing
- Kill switches for problematic features
- User type-specific features

---

## Sandbox Mode

### 18. Sandbox Environment

**Header:**
```
X-Environment: sandbox
```

**Behavior:**
- Isolated storage for transactional data
- Write restrictions enforced by middleware

**Isolated Entities (sandbox-specific):**
- Orders
- Subscriptions
- Bonus transactions

**Shared Entities (read-only in sandbox):**
- Users
- Addresses
- Couriers
- Partners

**Allowed Operations in Sandbox:**
| Path Pattern | Methods |
|--------------|---------|
| `/orders/*` | All |
| `/subscriptions/*` | All |
| `/bonus/*` | All |
| `/auth/*` | All |
| `/sessions/*` | All |
| `/environment` | GET |
| `/meta/*` | GET |
| `/flags/*` | All |

**Blocked Operations:**
All other write operations (POST, PATCH, PUT, DELETE) return:
```json
{
  "error": {
    "key": "sandbox.write_not_allowed"
  }
}
```

**Environment Endpoint:**
- `GET /environment` - Returns current mode
```json
{
  "mode": "sandbox",
  "isSandbox": true
}
```

**Meta Endpoint:**
- `GET /meta/environment-modes` - Available modes

---

## Meta Endpoints (Updated)

**Caching:**
- `Cache-Control: public, max-age=300` (5 minutes)
- `ETag` header for conditional requests
- 304 Not Modified responses when content unchanged

| Endpoint | Description |
|----------|-------------|
| `GET /meta/roles` | Available roles |
| `GET /meta/permissions` | Available permissions |
| `GET /meta/order-statuses` | Order statuses |
| `GET /meta/bonus-types` | Bonus transaction types |
| `GET /meta/bonus-reasons` | Bonus reasons |
| `GET /meta/subscription-statuses` | Subscription statuses |
| `GET /meta/level-codes` | Level codes |
| `GET /meta/progress-reasons` | Progress reasons |
| `GET /meta/streak-types` | Streak types |
| `GET /meta/feature-codes` | Feature codes |
| `GET /meta/feature-grant-types` | Feature grant types |
| `GET /meta/webhook-event-types` | Webhook event types |
| `GET /meta/feature-flag-keys` | System feature flag keys |
| `GET /meta/environment-modes` | Environment modes |

---

## Standard Headers (Updated)

| Header | Direction | Description |
|--------|-----------|-------------|
| `Authorization` | Request | Bearer token for authentication |
| `Accept-Language` | Request | Preferred language (he, ru, ar, en) |
| `X-Request-Id` | Both | Request tracking ID |
| `Idempotency-Key` | Request | Idempotency for POST requests |
| `X-Environment` | Request | Environment mode (production, sandbox) |
| `X-Webhook-Signature` | Webhook | HMAC-SHA256 signature |
| `X-Idempotency-Replayed` | Response | Indicates cached response |

---

## OpenAPI Specification

- JSON: `GET /api/v1/openapi.json`
- YAML: `GET /api/v1/openapi.yaml`

Full specification includes all endpoints, schemas, and examples.
