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
- **Data Storage:** In-memory storage (for MVP), with interfaces ready for PostgreSQL migration.
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

**Order Status State Machine:** Defines allowed transitions between order statuses (`created` → `scheduled` → `assigned` → `in_progress` → `completed`, with `cancelled` as a possible state at several points).

## External Dependencies
- **jsonwebtoken:** For JWT-based authentication.
- **bcryptjs:** For secure password hashing.
- **express-rate-limit:** For API rate limiting.
- **In-Memory Storage:** Used as the primary data store in the MVP.