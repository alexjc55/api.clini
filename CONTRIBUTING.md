# Contributing to Clini API

Thank you for your interest in contributing to the Clini API! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [API Design Guidelines](#api-design-guidelines)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and constructive in discussions
- Welcome newcomers and help them get started
- Focus on what is best for the community and project
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git
- PostgreSQL 14+ (for database testing)
- A code editor with TypeScript support (VS Code recommended)

### First-time Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/clini-api.git
   cd clini-api
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/your-org/clini-api.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your local settings
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

## Development Setup

### Environment Configuration

Create a `.env` file with the following variables:

```env
SESSION_SECRET=your-dev-session-secret
JWT_SECRET=your-dev-jwt-secret
DATABASE_URL=postgresql://user:pass@localhost:5432/waste_collection_dev
ALLOWED_ORIGINS=http://localhost:5000
```

### Database Setup (Optional)

For features requiring PostgreSQL:

```bash
# Create database
createdb waste_collection_dev

# Run migrations
npm run db:push
```

### IDE Configuration

**VS Code Extensions (Recommended)**:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- REST Client (for API testing)

**Settings**:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/user-preferences` |
| `fix/` | Bug fixes | `fix/order-status-transition` |
| `docs/` | Documentation | `docs/api-examples` |
| `refactor/` | Code refactoring | `refactor/storage-interface` |
| `test/` | Test additions | `test/webhook-integration` |
| `perf/` | Performance improvements | `perf/query-optimization` |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(orders): add bulk order creation endpoint

fix(auth): prevent token refresh race condition

docs(api): update webhook signature examples
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Coding Standards

### TypeScript Guidelines

1. **Use strict TypeScript**:
   ```typescript
   // Good
   function processOrder(order: Order): ProcessedOrder {
     return { ...order, processed: true };
   }

   // Bad
   function processOrder(order: any): any {
     return { ...order, processed: true };
   }
   ```

2. **Prefer interfaces over types for objects**:
   ```typescript
   // Good
   interface UserData {
     id: string;
     email: string;
   }

   // Use types for unions/intersections
   type UserStatus = 'active' | 'blocked' | 'pending';
   ```

3. **Use Zod for runtime validation**:
   ```typescript
   const orderSchema = z.object({
     addressId: z.string().uuid(),
     scheduledDate: z.string().datetime(),
   });
   ```

### API Route Guidelines

1. **Use the storage interface**:
   ```typescript
   // Good
   const user = await storage.getUser(id);

   // Bad - direct database access
   const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
   ```

2. **Validate request bodies**:
   ```typescript
   try {
     const data = insertOrderSchema.parse(req.body);
     // ... handle request
   } catch (err) {
     if (err instanceof z.ZodError) {
       return sendError(res, 400, L.common.validation_error);
     }
   }
   ```

3. **Use localization keys**:
   ```typescript
   // Good
   return sendError(res, 404, L.order.not_found);

   // Bad
   return res.status(404).json({ error: 'Order not found' });
   ```

### File Organization

```
server/
├── routes.ts          # All API routes (single file for simplicity)
├── storage.ts         # Storage interface and implementations
├── middleware.ts      # Express middleware
├── webhooks.ts        # Webhook system
├── i18n.ts            # Localization keys
└── utils/             # Utility functions (if needed)
```

## API Design Guidelines

### Endpoint Naming

- Use plural nouns for resources: `/users`, `/orders`
- Use kebab-case for multi-word resources: `/audit-logs`
- Nest related resources: `/users/:id/addresses`
- Use verbs only for actions: `/auth/login`, `/orders/:id/cancel`

### HTTP Methods

| Method | Purpose | Idempotent |
|--------|---------|------------|
| GET | Retrieve resource(s) | Yes |
| POST | Create resource | No |
| PATCH | Partial update | Yes |
| DELETE | Remove resource | Yes |

### Response Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET/PATCH |
| 201 | Successful POST (created) |
| 204 | Successful DELETE |
| 400 | Validation error |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Resource not found |
| 409 | State conflict |
| 429 | Rate limited |

### Breaking vs Non-Breaking Changes

**Non-Breaking (allowed in v1)**:
- Adding new optional fields to responses
- Adding new endpoints
- Adding new enum values to `/meta/*`

**Breaking (requires v2)**:
- Removing or renaming fields
- Changing field types
- Removing endpoints
- Changing error formats

See [docs/CONTRACT_POLICY.md](docs/CONTRACT_POLICY.md) for details.

## Testing Requirements

### Test Coverage

All PRs must include tests for:
- New endpoints (happy path + error cases)
- Business logic changes
- Bug fixes (regression test)

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- orders.test.ts

# Run with coverage
npm run test:coverage
```

### Test Structure

```typescript
describe('POST /api/v1/orders', () => {
  it('should create order with valid data', async () => {
    // Arrange
    const orderData = { ... };

    // Act
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(orderData);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('created');
  });

  it('should reject order without address', async () => {
    // ...
  });
});
```

## Documentation

### Code Documentation

- Document complex functions with JSDoc
- Explain non-obvious business logic
- Keep comments updated with code changes

```typescript
/**
 * Validates order status transition according to state machine.
 * @param currentStatus - Current order status
 * @param newStatus - Requested new status
 * @returns true if transition is valid
 * @throws Error if transition is not allowed
 */
function validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  // ...
}
```

### API Documentation

- Update `docs/openapi.yaml` for endpoint changes
- Update `client/src/pages/api-docs.tsx` for UI changes
- Keep examples current and working

## Pull Request Process

### Before Submitting

1. [ ] Code follows project style guidelines
2. [ ] All tests pass locally
3. [ ] New code has test coverage
4. [ ] Documentation updated (if applicable)
5. [ ] OpenAPI spec updated (if applicable)
6. [ ] No console.log statements (use proper logging)
7. [ ] No hardcoded secrets or credentials

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how to test the changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] OpenAPI spec updated
```

### Review Process

1. Submit PR against `main` branch
2. Automated checks must pass
3. At least one maintainer approval required
4. Address review feedback
5. Squash and merge after approval

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking API changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release tag
4. Deploy to staging
5. Run integration tests
6. Deploy to production

---

## Questions?

- Check existing issues and discussions
- Open a new issue for bugs or feature requests
- Contact maintainers for security issues (see [SECURITY.md](SECURITY.md))

Thank you for contributing!
