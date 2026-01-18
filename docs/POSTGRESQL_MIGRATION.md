# PostgreSQL Migration Guide

## Рекомендации по индексированию

При миграции на PostgreSQL необходимо создать следующие индексы для оптимальной производительности ERP-фильтрации.

### AuditLog Indexes

```sql
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

CREATE INDEX idx_audit_logs_entity_entityid ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_entity_action ON audit_logs(entity, action);
```

### User Indexes

```sql
CREATE UNIQUE INDEX idx_users_phone ON users(phone) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_type ON users(type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

### Order Indexes

```sql
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_orders_courier_id ON orders(courier_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_scheduled_at ON orders(scheduled_at);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_orders_status_scheduled ON orders(status, scheduled_at);
CREATE INDEX idx_orders_courier_status ON orders(courier_id, status);
```

### Address Indexes

```sql
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_deleted_at ON addresses(deleted_at) WHERE deleted_at IS NOT NULL;
```

### CourierProfile Indexes

```sql
CREATE INDEX idx_courier_profiles_availability ON courier_profiles(availability_status);
CREATE INDEX idx_courier_profiles_verification ON courier_profiles(verification_status);
CREATE INDEX idx_courier_profiles_deleted_at ON courier_profiles(deleted_at) WHERE deleted_at IS NOT NULL;
```

### Session Indexes

```sql
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_last_seen_at ON sessions(last_seen_at DESC);
```

### Role & Permission Indexes

```sql
CREATE UNIQUE INDEX idx_roles_name ON roles(name);
CREATE UNIQUE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
```

## Drizzle Schema Example

```typescript
import { pgTable, uuid, varchar, timestamp, text, integer, boolean, real, jsonb, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  passwordHash: text("password_hash").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  phoneIdx: index("idx_users_phone").on(table.phone),
  typeIdx: index("idx_users_type").on(table.type),
  statusIdx: index("idx_users_status").on(table.status),
}));

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => users.id),
  courierId: uuid("courier_id").references(() => users.id),
  addressId: uuid("address_id").notNull().references(() => addresses.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  timeWindow: varchar("time_window", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("created"),
  price: integer("price").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  clientIdx: index("idx_orders_client_id").on(table.clientId),
  courierIdx: index("idx_orders_courier_id").on(table.courierId),
  statusIdx: index("idx_orders_status").on(table.status),
  scheduledIdx: index("idx_orders_scheduled_at").on(table.scheduledAt),
}));

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  city: varchar("city", { length: 100 }).notNull(),
  street: varchar("street", { length: 200 }).notNull(),
  house: varchar("house", { length: 20 }).notNull(),
  apartment: varchar("apartment", { length: 20 }),
  floor: integer("floor"),
  hasElevator: boolean("has_elevator").default(false),
  comment: text("comment"),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  userIdx: index("idx_addresses_user_id").on(table.userId),
}));

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  userRole: varchar("user_role", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  messageKey: varchar("message_key", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  changes: jsonb("changes").default({}).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  entityIdx: index("idx_audit_logs_entity").on(table.entity),
  entityIdIdx: index("idx_audit_logs_entity_id").on(table.entityId),
  actionIdx: index("idx_audit_logs_action").on(table.action),
  createdAtIdx: index("idx_audit_logs_created_at").on(table.createdAt),
  userIdIdx: index("idx_audit_logs_user_id").on(table.userId),
}));
```

## Миграция данных

1. Создать таблицы с Drizzle
2. Экспортировать In-Memory данные в JSON
3. Импортировать в PostgreSQL
4. Переключить storage implementation

## Soft Delete Queries

```sql
SELECT * FROM users WHERE deleted_at IS NULL;

SELECT * FROM users WHERE deleted_at IS NULL OR :include_deleted = true;

SELECT * FROM addresses WHERE user_id = :user_id AND deleted_at IS NULL;
```
