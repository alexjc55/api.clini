# Security Policy

## Overview

The Waste Collection API takes security seriously. This document outlines our security practices, vulnerability reporting process, and security-related guidelines for contributors.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Reporting a Vulnerability

### Process

If you discover a security vulnerability, please follow responsible disclosure:

1. **Do NOT** open a public issue
2. Email security details to: `security@your-domain.com`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 24 hours |
| Initial Assessment | Within 72 hours |
| Status Update | Weekly |
| Resolution Target | 30-90 days (severity dependent) |

### What to Expect

- Acknowledgment of your report
- Regular updates on progress
- Credit in security advisory (if desired)
- No legal action for good-faith research

## Security Measures

### Authentication

#### Password Security

- **Hashing**: bcrypt with cost factor 10
- **Minimum Requirements**:
  - 8+ characters
  - Mixed case, numbers, or symbols recommended
- **No Password Storage**: Only hashes stored

#### Token Security

- **Access Tokens**:
  - JWT signed with HS256
  - Short-lived (15 minutes default)
  - Contains minimal claims (user ID, type)
  
- **Refresh Tokens**:
  - Cryptographically random
  - Long-lived (7 days default)
  - Revocable per-session
  - Stored in database with user association

#### Session Management

- Multiple active sessions supported
- Device and IP tracking
- Manual session revocation
- Automatic expiration

### Authorization

#### Role-Based Access Control (RBAC)

```
Roles:
├── client (default)
│   └── Own resources only
├── courier
│   └── + Assigned orders
├── staff_support
│   └── + Read access to users/orders
├── staff_admin
│   └── + Full management access
└── super_admin
    └── + System configuration
```

#### Permission Enforcement

- Permissions checked at middleware level
- Fail-closed design (deny by default)
- Audit logging of permission failures

### API Security

#### Rate Limiting

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 10 requests | 15 minutes |
| General API | No limit (configurable) | - |

Rate limiting is applied to auth endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`).

#### Request Validation

- All inputs validated with Zod schemas
- Type coercion disabled
- Maximum payload sizes enforced
- SQL injection prevented via parameterized queries

#### Response Security

- No stack traces in production errors
- Localization keys instead of raw messages
- Minimal error details to prevent enumeration

### Data Protection

#### Sensitive Data Handling

| Data Type | Protection |
|-----------|------------|
| Passwords | bcrypt hash (cost 10), never logged |
| Tokens | Not logged, redacted in responses |
| Phone/Email | Access controlled, audit logged |
| Addresses | Access controlled via user ownership |

#### Soft Delete

- Deleted data retained with `deletedAt` timestamp
- Not returned in normal queries
- ERP access only via `?includeDeleted=true`
- Permanent deletion requires admin action

### Webhook Security

#### Signature Verification

All webhooks signed with HMAC-SHA256:

```
Signature = HMAC-SHA256(
  key: partner_secret,
  message: timestamp + "." + payload
)
```

#### Verification Steps

1. Extract `X-Webhook-Signature` header
2. Extract `X-Webhook-Timestamp` header
3. Validate timestamp is recent (< 5 minutes)
4. Compute expected signature
5. Compare using constant-time comparison

#### Example Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  // Check timestamp freshness
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false; // Too old
  }

  // Compute expected signature
  const message = `${timestamp}.${payload}`;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Infrastructure Security

#### Environment Variables

| Variable | Security Level |
|----------|---------------|
| `SESSION_SECRET` | High - Never commit |
| `JWT_SECRET` | High - Never commit |
| `DATABASE_URL` | High - Contains credentials |
| `ALLOWED_ORIGINS` | Medium - CORS config |

#### CORS Configuration

- Explicit origin allowlist via `ALLOWED_ORIGINS`
- Credentials mode requires exact origin match
- No wildcard (`*`) in production

#### Headers

Recommended production headers (via reverse proxy):

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### Sandbox Mode

#### Isolation Guarantees

Sandbox mode (`X-Environment: sandbox`) provides:

- Separate data namespace
- Limited write operations
- No production webhook triggers
- No real payment processing

#### Allowed Operations in Sandbox

| Operation | Allowed |
|-----------|---------|
| Create orders | Yes |
| Create subscriptions | Yes |
| Bonus transactions | Yes |
| Create users | No |
| Register webhooks | No |
| Manage feature flags | No |

## Security Best Practices for Contributors

### Code Security

1. **Never commit secrets**
   ```bash
   # Add to .gitignore
   .env
   .env.local
   *.pem
   *.key
   ```

2. **Use parameterized queries**
   ```typescript
   // Good
   const user = await db.query(
     'SELECT * FROM users WHERE id = $1',
     [userId]
   );

   // Bad - SQL injection risk
   const user = await db.query(
     `SELECT * FROM users WHERE id = '${userId}'`
   );
   ```

3. **Validate all inputs**
   ```typescript
   const schema = z.object({
     email: z.string().email(),
     age: z.number().int().positive().max(150),
   });
   
   const data = schema.parse(req.body);
   ```

4. **Use constant-time comparison for secrets**
   ```typescript
   import { timingSafeEqual } from 'crypto';
   
   // Good
   const valid = timingSafeEqual(
     Buffer.from(provided),
     Buffer.from(expected)
   );
   
   // Bad - timing attack vulnerable
   const valid = provided === expected;
   ```

5. **Sanitize logging**
   ```typescript
   // Good
   logger.info('User login', { userId: user.id });
   
   // Bad - logs sensitive data
   logger.info('User login', { user });
   ```

### Dependency Security

- Regular `npm audit` checks
- Automated dependency updates
- No unnecessary dependencies
- Review new dependency licenses

### Review Checklist

Before merging security-sensitive code:

- [ ] No hardcoded secrets or credentials
- [ ] Input validation present
- [ ] Output encoding/escaping applied
- [ ] Error messages don't leak internals
- [ ] Logging doesn't include sensitive data
- [ ] New endpoints have proper auth/permissions
- [ ] Rate limiting considered
- [ ] Audit logging for sensitive operations

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| Critical | Active exploitation, data breach | Immediate |
| High | Exploitable vulnerability | 24 hours |
| Medium | Potential vulnerability | 72 hours |
| Low | Security improvement | Next release |

### Response Steps

1. **Containment**: Limit damage scope
2. **Assessment**: Determine impact
3. **Remediation**: Deploy fix
4. **Communication**: Notify affected parties
5. **Post-mortem**: Document lessons learned

## Compliance Considerations

### Data Protection

- Minimal data collection principle
- User consent for data processing
- Right to deletion (via soft delete)
- Data export capabilities

### Audit Trail

All sensitive operations logged:
- Authentication events
- Permission changes
- Data modifications
- Admin actions

### Access Controls

- Principle of least privilege
- Regular access reviews
- Separation of duties for critical operations

## Contact

- **Security Issues**: security@your-domain.com
- **General Questions**: api-support@your-domain.com
- **Emergency**: +1-XXX-XXX-XXXX (24/7 hotline)

---

Last updated: January 2026
