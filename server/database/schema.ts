import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, jsonb, primaryKey, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull(),
  phone: varchar("phone", { length: 20 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("users_type_status_idx").on(table.type, table.status),
]);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  city: varchar("city", { length: 100 }).notNull(),
  street: varchar("street", { length: 200 }).notNull(),
  house: varchar("house", { length: 20 }).notNull(),
  apartment: varchar("apartment", { length: 20 }),
  floor: integer("floor"),
  hasElevator: boolean("has_elevator").notNull().default(false),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const couriers = pgTable("couriers", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  availabilityStatus: varchar("availability_status", { length: 20 }).notNull().default("offline"),
  verificationStatus: varchar("verification_status", { length: 20 }).notNull().default("pending"),
  rating: decimal("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  completedOrdersCount: integer("completed_orders_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const courierDocuments = pgTable("courier_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  courierId: uuid("courier_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  fileUrl: text("file_url").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => users.id),
  courierId: uuid("courier_id").references(() => users.id),
  addressId: uuid("address_id").notNull().references(() => addresses.id),
  status: varchar("status", { length: 20 }).notNull().default("created"),
  scheduledAt: timestamp("scheduled_at"),
  timeWindow: varchar("time_window", { length: 50 }),
  price: integer("price").notNull().default(0),
  currency: varchar("currency", { length: 10 }).notNull().default("ILS"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("orders_status_courier_idx").on(table.status, table.courierId),
  index("orders_client_idx").on(table.clientId),
]);

export const orderEvents = pgTable("order_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  performedBy: uuid("performed_by").notNull().references(() => users.id),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("order_events_order_idx").on(table.orderId),
]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  userRole: varchar("user_role", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  messageKey: varchar("message_key", { length: 100 }).notNull(),
  entity: varchar("entity", { length: 50 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  changes: jsonb("changes").notNull().default({}),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("audit_logs_user_created_idx").on(table.userId, table.createdAt),
]);

export const deviceSessions = pgTable("device_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  deviceId: varchar("device_id", { length: 100 }).notNull(),
  platform: varchar("platform", { length: 20 }).notNull(),
  userAgent: text("user_agent"),
  clientId: varchar("client_id", { length: 100 }),
  clientType: varchar("client_type", { length: 50 }),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("device_sessions_user_idx").on(table.userId),
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  actorType: varchar("actor_type", { length: 20 }).notNull(),
  actorId: uuid("actor_id"),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: uuid("entity_id"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userActivities = pgTable("user_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: uuid("reference_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userFlags = pgTable("user_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 50 }).notNull(),
  value: boolean("value").notNull().default(true),
  source: varchar("source", { length: 20 }).notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bonusAccounts = pgTable("bonus_accounts", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bonusTransactions = pgTable("bonus_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  descriptionKey: varchar("description_key", { length: 100 }).notNull(),
  basePrice: integer("base_price").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("ILS"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  pausedAt: timestamp("paused_at"),
  cancelledAt: timestamp("cancelled_at"),
  nextBillingAt: timestamp("next_billing_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionRules = pgTable("subscription_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  timeWindow: varchar("time_window", { length: 50 }).notNull(),
  priceModifier: integer("price_modifier").notNull().default(0),
  daysOfWeek: jsonb("days_of_week"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partnerOffers = pgTable("partner_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
  titleKey: varchar("title_key", { length: 100 }).notNull(),
  descriptionKey: varchar("description_key", { length: 100 }).notNull(),
  price: integer("price").notNull(),
  bonusPrice: integer("bonus_price"),
  currency: varchar("currency", { length: 10 }).notNull().default("ILS"),
  availableForSegments: jsonb("available_for_segments").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderFinanceSnapshots = pgTable("order_finance_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }).unique(),
  clientPrice: integer("client_price").notNull(),
  courierPayout: integer("courier_payout").notNull(),
  bonusSpent: integer("bonus_spent").notNull().default(0),
  platformFee: integer("platform_fee").notNull().default(0),
  margin: integer("margin").notNull().default(0),
  currency: varchar("currency", { length: 10 }).notNull().default("ILS"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const levels = pgTable("levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).unique().notNull(),
  nameKey: varchar("name_key", { length: 100 }).notNull(),
  minPoints: integer("min_points").notNull().default(0),
  benefits: jsonb("benefits").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userLevels = pgTable("user_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  levelId: uuid("level_id").notNull().references(() => levels.id),
  achievedAt: timestamp("achieved_at").notNull().defaultNow(),
  current: boolean("current").notNull().default(true),
});

export const userProgress = pgTable("user_progress", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  totalPoints: integer("total_points").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const progressTransactions = pgTable("progress_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: varchar("reason", { length: 50 }).notNull(),
  referenceType: varchar("reference_type", { length: 50 }),
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userStreaks = pgTable("user_streaks", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  currentCount: integer("current_count").notNull().default(0),
  maxCount: integer("max_count").notNull().default(0),
  lastActionDate: timestamp("last_action_date").notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.type] }),
]);

export const features = pgTable("features", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  descriptionKey: varchar("description_key", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userFeatureAccess = pgTable("user_feature_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  featureId: uuid("feature_id").notNull().references(() => features.id, { onDelete: "cascade" }),
  grantedBy: varchar("granted_by", { length: 20 }).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: jsonb("events").notNull().default([]),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  failCount: integer("fail_count").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  payload: jsonb("payload").notNull().default({}),
  statusCode: integer("status_code"),
  response: text("response"),
  attempts: integer("attempts").notNull().default(0),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 50 }).unique().notNull(),
  enabled: boolean("enabled").notNull().default(false),
  rolloutPercentage: integer("rollout_percentage").notNull().default(0),
  targetUserTypes: jsonb("target_user_types").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const idempotencyRecords = pgTable("idempotency_records", {
  key: varchar("key", { length: 255 }).primaryKey(),
  userId: uuid("user_id").notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  statusCode: integer("status_code").notNull(),
  response: jsonb("response").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});
