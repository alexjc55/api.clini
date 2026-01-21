# Waste Collection API - Project Description

## About the Project

Waste Collection API is a centralized backend service designed for waste collection and household services platforms. It serves as the single source of truth for an entire ecosystem including:

- ERP system
- Client mobile applications
- Courier mobile applications
- Partner integrations
- Analytics dashboards

---

## Technical Overview

**Current Version:** 1.0.0  
**API Base URL:** `/api/v1/*`  
**Database:** PostgreSQL via Drizzle ORM (35 tables)  
**Storage:** Dual-mode (PostgreSQL production / In-memory development)  
**Authentication:** JWT with access + refresh tokens  

### Database Schema

The API uses a comprehensive PostgreSQL database with 35 tables organized by domain:

| Domain | Tables Count | Description |
|--------|-------------|-------------|
| Core | 6 | Users, roles, permissions, addresses |
| Orders | 3 | Order lifecycle, events, financial snapshots |
| Courier | 2 | Courier profiles, document verification |
| Gamification | 7 | Levels, progress, streaks, features |
| Bonus System | 2 | Accounts, transactions |
| Subscriptions | 3 | Plans, rules, user subscriptions |
| Partners | 2 | Partner profiles, offers |
| Webhooks | 2 | Endpoints, delivery tracking |
| System | 4 | Feature flags, sessions, audit, events |

### Storage Architecture

The API implements a storage factory pattern:
- **Production:** Automatically uses PostgreSQL when `DATABASE_URL` is set
- **Development:** Falls back to in-memory storage for quick prototyping
- **Sandbox Mode:** Isolated transactional data via `X-Environment: sandbox` header

---

## Key Capabilities

### User Management

The API supports multiple user types with role-based access:

**Client Users:**
- Register and manage accounts
- Add multiple delivery addresses
- Place and track orders
- Manage subscriptions
- Earn and spend bonus points
- Unlock premium features through activity

**Courier Users:**
- Profile management and verification
- Order acceptance and completion
- Route optimization support
- Performance tracking

**Staff/Admin Users:**
- User management
- Order oversight
- Courier verification
- Audit log access
- System configuration

---

### Order Processing

Complete order lifecycle management:

1. **Creation** - Clients create orders with pickup details
2. **Scheduling** - Orders are scheduled for specific time slots
3. **Assignment** - System assigns orders to available couriers
4. **Execution** - Couriers complete pickups
5. **Completion** - Orders are marked complete with financial tracking

**Features:**
- Real-time status updates
- Courier geolocation matching
- Automatic scheduling
- Financial snapshot per order
- Cancellation with reason tracking

---

### Subscription Service

Automated recurring order system:

- Weekly scheduling by day of week
- Flexible time slots
- Pause/resume functionality
- Automatic order generation
- Multiple subscription plans

**Use Cases:**
- Regular waste collection
- Scheduled household services
- Recurring maintenance

---

### Bonus & Rewards System

Comprehensive loyalty program:

**Earning Points:**
- Order completion
- Referrals
- Promotions
- Subscription activation

**Spending Points:**
- Order discounts
- Partner offers
- Marketplace purchases

---

### Gamification System

Engagement-driven features to increase user retention:

**Levels (configurable thresholds):**
- Bronze (starter)
- Silver (intermediate)
- Gold (advanced)
- Platinum (top tier)

Each level unlocks additional benefits and features. Point thresholds are configurable by administrators.

**Streaks:**
- Daily cleanup streaks
- Weekly order streaks
- Special Shabbat order streaks

Streaks encourage consistent platform usage and reward dedication.

**Feature Unlocks:**
- Shabbat order scheduling
- Bonus marketplace access
- Priority courier matching
- Partner offers
- Premium support
- Analytics dashboard

Features can be unlocked through:
- Level achievements
- Admin grants
- Promotional campaigns

---

### Partner Marketplace

Integration with third-party services:

- Partner catalog management
- Segment-targeted offers
- Bonus point redemption
- Category-based browsing

---

### Analytics & Insights

Built-in analytics capabilities:

- User activity tracking
- Event logging
- Segment-based analysis
- Feature flag management
- Behavioral analytics

---

## Multi-Language Support

The API supports four languages:

| Code | Language |
|------|----------|
| he | Hebrew |
| ru | Russian |
| ar | Arabic |
| en | English (fallback) |

All user-facing messages use localization keys for client-side translation.

---

## Security Features

Enterprise-grade security:

- JWT-based authentication
- Token refresh mechanism
- Rate limiting protection
- CORS configuration
- Audit logging of all staff actions
- Soft delete for data recovery
- Session management and device tracking

---

## Integration Patterns

### For Mobile Apps

```
1. User registration/login -> Receive JWT tokens
2. Token refresh -> Maintain session
3. API calls with Bearer token
4. Localized responses via Accept-Language header
```

### For ERP Systems

```
1. Staff authentication
2. Bulk order management
3. Courier assignment
4. Financial reporting
5. Audit trail access
```

### For Analytics Platforms

```
1. Event tracking ingestion
2. User activity summaries
3. Segmentation data
4. Feature flag states
```

---

## API Documentation

The API provides multiple documentation formats:

- **OpenAPI Spec:** `/api/v1/openapi.json` and `/api/v1/openapi.yaml`
- **Web Documentation:** Available at the application URL
- **Meta Endpoints:** Self-describing enum values for all constants

---

## Typical Workflows

### New Client Onboarding

1. Register account via `/auth/register`
2. Add address via `/users/:id/addresses`
3. Place first order via `/orders`
4. Receive "first_order" bonus points
5. Unlock bronze level features

### Subscription Setup

1. Browse plans via `/subscription-plans`
2. Create subscription via `/subscriptions`
3. Select day and time slot
4. Automatic orders generated weekly
5. Manage via pause/resume/cancel

### Courier Day

1. Login and receive active orders
2. Accept orders via assignment
3. Complete pickups
4. Mark orders complete
5. Build streak for bonuses

### Gamification Flow

1. Complete daily activities
2. Build streaks (3, 7, 14, 30 days)
3. Earn progress points
4. Level up (bronze -> silver -> gold -> platinum)
5. Unlock premium features
6. Access exclusive partner offers

---

## Future Extensibility

The API is designed for growth:

- **Modular architecture** - Add features without breaking changes
- **Event-driven design** - Easy integration with external systems
- **PostgreSQL-ready** - Current in-memory storage can migrate to Postgres
- **Version support** - API versioning allows backward compatibility

---

## Contact

For API access, integration support, or technical questions, please refer to the API documentation or contact the development team.
