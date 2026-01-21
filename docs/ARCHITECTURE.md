# Architecture Documentation

## Overview

The Waste Collection API is a RESTful backend service designed to power a waste collection and household services platform. It serves as the central data hub for multiple client applications including:

- **Client Mobile App** - End-user ordering and account management
- **Courier Mobile App** - Order fulfillment and route management
- **ERP Dashboard** - Staff operations and business analytics
- **Partner Integrations** - Third-party service connections

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                             │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  Mobile Client  │  Courier App    │  ERP Dashboard  │  Partner Systems      │
│  (iOS/Android)  │  (iOS/Android)  │  (Web)          │  (Webhooks)           │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         └─────────────────┴────────┬────────┴────────────────────┘
                                    │
                              HTTPS/REST
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                           API Gateway Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Rate Limit  │  │    CORS     │  │  Auth/JWT   │  │  i18n       │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Request ID  │  │ Idempotency │  │   Sandbox   │  │ Permissions │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                           Application Layer                                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         Express Router                               │  │
│  │  /auth/*  /users/*  /orders/*  /bonus/*  /webhooks/*  /flags/*      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        Business Logic                                │  │
│  │  Order State Machine │ Gamification │ Bonus System │ Subscriptions  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                           Storage Layer                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      IStorage Interface                              │  │
│  │  getUser() │ createOrder() │ updateStatus() │ getBonusAccount()     │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────┐  ┌─────────────────────────────────────────┐  │
│  │   MemStorage (MVP)     │  │         DatabaseStorage (Prod)          │  │
│  │   In-Memory Maps       │  │         PostgreSQL + Drizzle            │  │
│  │   (Current Default)    │  │         (Production Ready)              │  │
│  └────────────────────────┘  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┴───────────────────────────────────────┐
│                           External Services                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐│
│  │  Webhook Queue  │  │   Audit Log     │  │   Event Analytics           ││
│  │  (Async Dispatch)│  │   (Change Diff) │  │   (Product Events)          ││
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. API-First Design

The API contract is the primary interface. All features are designed API-first:

- OpenAPI 3.0 specification as source of truth
- Contract stability (see [CONTRACT_POLICY.md](CONTRACT_POLICY.md))
- Versioning via URL path (`/api/v1/*`)

### 2. Stateless Architecture

Each request contains all necessary information:

- JWT tokens for authentication state
- No server-side sessions for API requests
- Horizontal scaling without session affinity

### 3. Storage Abstraction

All data access goes through the `IStorage` interface:

```typescript
interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  
  // Orders
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(userId: string, data: InsertOrder): Promise<Order>;
  // ... etc
}
```

Benefits:
- Easy testing with mock implementations
- Database migration without route changes
- Clear separation of concerns

### 4. Database Migrations

The API uses Drizzle ORM migrations for safe, incremental schema updates:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Migration Workflow                            │
│                                                                  │
│  Schema Change                                                   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   Modify    │ ──▶ │  Generate   │ ──▶ │   Review    │        │
│  │ schema.ts   │     │ Migration   │     │    SQL      │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                            │                                     │
│                            ▼                                     │
│                   ┌─────────────────┐                           │
│                   │ Apply to Target │                           │
│                   │    Database     │                           │
│                   └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

**Key Files:**

| File | Purpose |
|------|---------|
| `server/database/schema.ts` | Source of truth for database schema |
| `migrations/*.sql` | Generated incremental migrations |
| `scripts/migrate.ts` | Safe migration runner |
| `docs/database-schema.sql` | Full schema dump for reference |
| `docs/MIGRATION_GUIDE.md` | Complete migration documentation |

**Safety Features:**
- Production migrations require `MIGRATE_CONFIRM=1`
- Displays host/database before applying
- Tracks applied migrations in `__drizzle_migrations`
- Never use `drizzle-kit push` on production with existing data

### 5. Event-Driven History

All significant actions produce events:

```
Business Action → Audit Log → Webhook Dispatch
```

This ordering is guaranteed (see [CONTRACT_POLICY.md](CONTRACT_POLICY.md)).

## Component Details

### Authentication System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Flow                           │
│                                                                  │
│  Login Request                                                   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │  Validate   │ ──▶ │  Generate   │ ──▶ │   Return    │        │
│  │ Credentials │     │   Tokens    │     │   Tokens    │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                            │                                     │
│                            ▼                                     │
│                   ┌─────────────────┐                           │
│                   │ Create Session  │                           │
│                   │ (Device Track)  │                           │
│                   └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

**Token Structure:**
- **Access Token**: Short-lived (15m default), contains user ID and type
- **Refresh Token**: Long-lived (7d default), used to obtain new access tokens

**Session Tracking:**
- Device information stored per session
- IP address and user agent logged
- Multiple active sessions supported

### Order State Machine

```
                    ┌──────────────────────────────────┐
                    │                                  │
                    ▼                                  │
              ┌─────────┐                             │
              │ CREATED │ ──────────────────────────┐ │
              └────┬────┘                           │ │
                   │                                │ │
                   ▼                                │ │
             ┌───────────┐                          │ │
             │ SCHEDULED │ ─────────────────────┐   │ │
             └─────┬─────┘                      │   │ │
                   │                            │   │ │
                   ▼                            │   │ │
             ┌──────────┐                       │   │ │
             │ ASSIGNED │ ──────────────────┐   │   │ │
             └────┬─────┘                   │   │   │ │
                  │                         │   │   │ │
                  ▼                         ▼   ▼   ▼ │
           ┌─────────────┐             ┌───────────┐ │
           │ IN_PROGRESS │ ──────────▶ │ CANCELLED │◀┘
           └──────┬──────┘             └───────────┘
                  │
                  ▼
            ┌───────────┐
            │ COMPLETED │
            └───────────┘
```

**Transition Rules:**
- `created` → `scheduled`, `cancelled`
- `scheduled` → `assigned`, `cancelled`
- `assigned` → `in_progress`, `cancelled`
- `in_progress` → `completed`, `cancelled`
- `completed` → (terminal)
- `cancelled` → (terminal)

### Gamification System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Gamification Components                       │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │   Levels    │     │   Streaks   │     │  Features   │        │
│  │             │     │             │     │             │        │
│  │ bronze      │     │ daily       │     │ priority    │        │
│  │ silver      │     │ weekly      │     │ premium_ui  │        │
│  │ gold        │     │ monthly     │     │ analytics   │        │
│  │ platinum    │     │             │     │ ...         │        │
│  │ diamond     │     │             │     │             │        │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘        │
│         │                   │                   │                │
│         └───────────────────┴───────────────────┘                │
│                             │                                    │
│                             ▼                                    │
│                    ┌─────────────────┐                          │
│                    │  User Progress  │                          │
│                    │                 │                          │
│                    │ currentLevel    │                          │
│                    │ currentXp       │                          │
│                    │ totalXp         │                          │
│                    │ streakCounts    │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

**XP Sources:**
- Order completion
- Streak maintenance
- Referrals
- Achievements

**Feature Unlocking:**
- Level-based (automatic at level threshold)
- Manual grants (staff action)
- Time-limited access

### Webhook System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Webhook Dispatch Flow                         │
│                                                                  │
│  Business Event                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ Audit Log   │ ──▶ │ Find Subs   │ ──▶ │  Build      │        │
│  │ Created     │     │ for Event   │     │  Payload    │        │
│  └─────────────┘     └─────────────┘     └─────────────┘        │
│                                                │                 │
│                                                ▼                 │
│                                         ┌─────────────┐         │
│                                         │ HMAC Sign   │         │
│                                         │ SHA-256     │         │
│                                         └──────┬──────┘         │
│                                                │                 │
│                                                ▼                 │
│                                         ┌─────────────┐         │
│                                         │ HTTP POST   │         │
│                                         │ to Partner  │         │
│                                         └─────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

**Event Types:**
| Event | Trigger |
|-------|---------|
| `order.created` | New order placed |
| `order.assigned` | Courier assigned |
| `order.completed` | Order finished |
| `order.cancelled` | Order cancelled |
| `subscription.created` | New subscription |
| `bonus.earned` | Points credited |
| `bonus.redeemed` | Points spent |

**Security:**
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Timestamp in `X-Webhook-Timestamp` header
- Partner-specific secret keys

### Sandbox Mode

```
┌─────────────────────────────────────────────────────────────────┐
│                    Environment Isolation                         │
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │     Production          │  │      Sandbox            │       │
│  │                         │  │                         │       │
│  │  X-Environment: prod    │  │  X-Environment: sandbox │       │
│  │  (or missing header)    │  │                         │       │
│  │                         │  │                         │       │
│  │  Full write access      │  │  Limited writes:        │       │
│  │  Real data              │  │  - Orders (Yes)         │       │
│  │  Production webhooks    │  │  - Subscriptions (Yes)  │       │
│  │                         │  │  - Bonus (Yes)          │       │
│  │                         │  │  - Users (No)           │       │
│  │                         │  │  - Webhooks (No)        │       │
│  └─────────────────────────┘  └─────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Core Entities

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │────▶│   Address   │     │   Session   │
│             │     │             │     │             │
│ id          │     │ id          │     │ id          │
│ phone       │     │ userId      │     │ userId      │
│ email       │     │ street      │     │ token       │
│ type        │     │ city        │     │ device      │
│ status      │     │ coords      │     │ expiresAt   │
│ deletedAt   │     │ deletedAt   │     │ revokedAt   │
└──────┬──────┘     └─────────────┘     └─────────────┘
       │
       │            ┌─────────────┐     ┌─────────────┐
       └───────────▶│    Order    │────▶│OrderHistory │
                    │             │     │             │
                    │ id          │     │ id          │
                    │ userId      │     │ orderId     │
                    │ addressId   │     │ status      │
                    │ status      │     │ changedAt   │
                    │ courierId   │     │ changedBy   │
                    │ deletedAt   │     │             │
                    └─────────────┘     └─────────────┘
```

### Gamification Entities

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Level     │     │ UserProgress│     │   Streak    │
│             │     │             │     │             │
│ code        │◀────│ userId      │────▶│ userId      │
│ name        │     │ levelCode   │     │ type        │
│ minXp       │     │ currentXp   │     │ count       │
│ features    │     │ totalXp     │     │ lastDate    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │FeatureAccess│
                    │             │
                    │ userId      │
                    │ featureCode │
                    │ grantType   │
                    │ expiresAt   │
                    └─────────────┘
```

### Bonus System

```
┌─────────────┐     ┌─────────────────┐
│BonusAccount │────▶│BonusTransaction │
│             │     │                 │
│ userId      │     │ id              │
│ balance     │     │ accountId       │
│ totalEarned │     │ type (earn/     │
│ totalSpent  │     │       spend/    │
│             │     │       expire/   │
│             │     │       adjust)   │
│             │     │ amount          │
│             │     │ reason          │
└─────────────┘     └─────────────────┘
```

## Middleware Pipeline

Request processing order:

```
1. CORS                 → Cross-origin handling
2. Request ID           → Tracking header injection
3. Rate Limiting        → DDoS protection (auth endpoints)
4. Body Parser          → JSON parsing
5. i18n                 → Language detection
6. Environment          → Sandbox mode detection
7. Auth (conditional)   → JWT validation
8. Permissions          → RBAC check
9. Idempotency          → Duplicate prevention
10. Sandbox Guard       → Write restrictions
11. Route Handler       → Business logic
12. Error Handler       → Consistent error format
```

## Security Architecture

### Authentication

- **Password Storage**: bcrypt with cost factor 10
- **Token Signing**: HMAC-SHA256 (HS256)
- **Token Refresh**: Via `/auth/refresh` endpoint

### Authorization

```
User → Roles → Permissions

Example:
  staff_admin → [
    users.read,
    users.manage,
    orders.read,
    orders.manage,
    audit.read,
    reports.read
  ]
```

### Rate Limiting

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| `/auth/*` (login, register, refresh) | 15 min | 10 |
| All others | No limit | - |

Note: General rate limiting can be configured via reverse proxy.

## Scalability Considerations

### Horizontal Scaling

The stateless design supports horizontal scaling:

- No session affinity required
- JWT tokens self-contained
- Database as single source of truth

### Database Optimization

- Indexed queries on common filters
- Soft delete with `deletedAt` index
- Pagination for all list endpoints

### Caching Strategy

- Meta endpoints: 5-minute cache with ETag
- Static assets: Long-term cache
- No response caching for user-specific data

## Monitoring & Observability

### Request Tracking

Every request has a unique `X-Request-Id`:

```
Request → X-Request-Id: abc-123
  └─▶ Audit Log: requestId = abc-123
  └─▶ Error Log: requestId = abc-123
  └─▶ Webhook: requestId = abc-123
```

### Audit Trail

All staff actions logged with:
- Who (user ID)
- What (action type)
- When (timestamp)
- Changes (before/after diff)

### Health Checks

- `GET /api/v1/health` - Basic liveness
- Future: `/ready` for readiness probe

## Future Considerations

### Planned Enhancements

1. **GraphQL API** - Alternative query interface
2. **Real-time Updates** - WebSocket subscriptions
3. **Geolocation** - Courier tracking
4. **Push Notifications** - Mobile alerts
5. **Payment Processing** - Integrated billing

### Migration Path

The storage abstraction enables:
- PostgreSQL → other databases
- In-memory → Redis caching
- Monolith → Microservices

---

See also:
- [CONTRACT_POLICY.md](CONTRACT_POLICY.md) - API stability guarantees
- [TECHNICAL_REPORT.md](TECHNICAL_REPORT.md) - Implementation details
- [../SECURITY.md](../SECURITY.md) - Security policies
