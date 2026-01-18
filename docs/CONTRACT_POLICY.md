# API Contract Policy

## Contract Freeze Declaration

**Effective Date:** January 2026  
**Version:** 1.0

This document establishes the immutability guarantees for the Waste Collection API contracts.

---

## Immutable Contracts

The following API contracts are **frozen** and will **never** change in `/api/v1/*`:

### 1. Error Response Format

```json
{
  "error": {
    "key": "localization.key",
    "params": { "param": "value" }
  }
}
```

| Property | Status | Description |
|----------|--------|-------------|
| `error.key` | **Immutable** | Localization key for client translation |
| `error.params` | **Immutable** | Optional interpolation parameters |

**Guarantee:** Clients can rely on this structure for all error handling.

### 2. Pagination Format

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

| Property | Status | Description |
|----------|--------|-------------|
| `meta.page` | **Immutable** | Current page (1-indexed) |
| `meta.perPage` | **Immutable** | Items per page |
| `meta.total` | **Immutable** | Total item count |
| `meta.hasNext` | **Immutable** | Next page indicator |

**Guarantee:** All paginated endpoints follow this exact structure.

### 3. Meta Endpoints

| Endpoint | Status |
|----------|--------|
| `GET /meta/*` | **Backward-Compatible** |

**Guarantee:** 
- Existing values will never be removed
- New values may be added
- Response structure remains stable

**Caching:**
- `Cache-Control: public, max-age=300`
- `ETag` header for conditional requests
- Clients should use `If-None-Match` for efficient polling

---

## Versioning Policy

### Breaking Changes

Any breaking change **requires** a new API version:

| Change Type | Action |
|-------------|--------|
| Remove field | `/api/v2/*` |
| Rename field | `/api/v2/*` |
| Change field type | `/api/v2/*` |
| Remove endpoint | `/api/v2/*` |
| Change error key | `/api/v2/*` |

### Non-Breaking Changes (Allowed in v1)

| Change Type | Status |
|-------------|--------|
| Add new endpoint | Allowed |
| Add optional field | Allowed |
| Add new enum value | Allowed |
| Add new meta value | Allowed |
| Performance improvement | Allowed |

---

## Event Ordering Guarantee

All business operations follow strict ordering:

```
1. Business Action (transaction commit)
     ↓
2. Audit Log (synchronous write)
     ↓
3. Webhook Enqueue (async dispatch)
```

**Guarantee:** 
- Audit log is **always** written before webhook dispatch
- Webhook is **never** sent if business action fails
- Audit log is **never** written if business action fails

---

## Deprecation Policy

1. **Announcement:** 90 days before deprecation
2. **Warning Header:** `Deprecation: true` in responses
3. **Documentation:** Updated with migration guide
4. **Removal:** Only in next major version

---

## Stability Tiers

| Tier | Endpoints | Guarantee |
|------|-----------|-----------|
| **Stable** | `/auth/*`, `/orders/*`, `/users/*` | Full backward compatibility |
| **Beta** | `/flags/*`, `/webhooks/*` | May have minor changes with notice |
| **Experimental** | None currently | Subject to change |

---

## Contact

For API contract questions or concerns, contact the API team before implementing clients.
