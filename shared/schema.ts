import { z } from "zod";

export const userTypes = ["client", "courier", "staff"] as const;
export type UserType = (typeof userTypes)[number];

export const userStatuses = ["active", "blocked", "pending"] as const;
export type UserStatus = (typeof userStatuses)[number];

export const orderStatuses = ["created", "scheduled", "assigned", "in_progress", "completed", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export const orderStatusTransitions: Record<OrderStatus, OrderStatus[]> = {
  created: ["scheduled", "assigned", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return orderStatusTransitions[from].includes(to);
}

export const availabilityStatuses = ["available", "busy", "offline"] as const;
export type AvailabilityStatus = (typeof availabilityStatuses)[number];

export const verificationStatuses = ["pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];

export const orderEventTypes = [
  "created", "scheduled", "assigned", "started", "completed", "cancelled",
  "status_changed", "courier_changed", "price_changed", "note_added"
] as const;
export type OrderEventType = (typeof orderEventTypes)[number];

export interface User {
  id: string;
  type: UserType;
  phone: string;
  email: string | null;
  passwordHash: string;
  status: UserStatus;
  createdAt: string;
  deletedAt: string | null;
}

export interface AuditLog {
  id: string;
  userId: string;
  userRole: string;
  action: string;
  messageKey: string;
  entity: string;
  entityId: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const auditActions = [
  "CREATE_USER", "UPDATE_USER", "DELETE_USER", "BLOCK_USER",
  "CREATE_ORDER", "UPDATE_ORDER", "DELETE_ORDER", "ASSIGN_COURIER", "CANCEL_ORDER",
  "CREATE_ROLE", "UPDATE_ROLE", "ASSIGN_ROLE",
  "VERIFY_COURIER"
] as const;
export type AuditAction = (typeof auditActions)[number];

export const clientTypes = ["mobile_client", "courier_app", "erp", "partner", "web"] as const;
export type ClientType = (typeof clientTypes)[number];

export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  deviceId: string;
  platform: "ios" | "android" | "web";
  userAgent: string | null;
  clientId: string | null;
  clientType: ClientType | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface IdempotencyRecord {
  key: string;
  userId: string;
  endpoint: string;
  statusCode: number;
  response: unknown;
  createdAt: string;
  expiresAt: string;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  hasNext: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const insertUserSchema = z.object({
  type: z.enum(userTypes),
  phone: z.string().min(10),
  email: z.string().email().nullable().optional(),
  password: z.string().min(6),
});
export type InsertUser = z.infer<typeof insertUserSchema>;

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export const insertRoleSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
});
export type InsertRole = z.infer<typeof insertRoleSchema>;

export interface Permission {
  id: string;
  name: string;
  description: string | null;
}

export const insertPermissionSchema = z.object({
  name: z.string().min(2),
  description: z.string().nullable().optional(),
});
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export interface RolePermission {
  roleId: string;
  permissionId: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
}

export interface Address {
  id: string;
  userId: string;
  city: string;
  street: string;
  house: string;
  apartment: string | null;
  floor: number | null;
  hasElevator: boolean;
  comment: string | null;
  deletedAt: string | null;
}

export const insertAddressSchema = z.object({
  city: z.string().min(2),
  street: z.string().min(2),
  house: z.string().min(1),
  apartment: z.string().nullable().optional(),
  floor: z.number().nullable().optional(),
  hasElevator: z.boolean().optional().default(false),
  comment: z.string().nullable().optional(),
});
export type InsertAddress = z.infer<typeof insertAddressSchema>;

export interface CourierProfile {
  courierId: string;
  availabilityStatus: AvailabilityStatus;
  rating: number;
  completedOrdersCount: number;
  verificationStatus: VerificationStatus;
  deletedAt: string | null;
}

export const updateCourierProfileSchema = z.object({
  availabilityStatus: z.enum(availabilityStatuses).optional(),
});
export type UpdateCourierProfile = z.infer<typeof updateCourierProfileSchema>;

export interface Order {
  id: string;
  clientId: string;
  courierId: string | null;
  addressId: string;
  scheduledAt: string;
  timeWindow: string;
  status: OrderStatus;
  price: number;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

export const insertOrderSchema = z.object({
  addressId: z.string().uuid(),
  scheduledAt: z.string(),
  timeWindow: z.string(),
  price: z.number().positive().optional(),
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export const updateOrderSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  courierId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().optional(),
  timeWindow: z.string().optional(),
  price: z.number().positive().optional(),
});
export type UpdateOrder = z.infer<typeof updateOrderSchema>;

export interface OrderEvent {
  id: string;
  orderId: string;
  eventType: OrderEventType;
  performedBy: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const insertOrderEventSchema = z.object({
  orderId: z.string().uuid(),
  eventType: z.enum(orderEventTypes),
  metadata: z.record(z.unknown()).optional(),
});
export type InsertOrderEvent = z.infer<typeof insertOrderEventSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(6),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const registerSchema = insertUserSchema;
export type RegisterRequest = z.infer<typeof registerSchema>;

export interface ApiError {
  error: {
    key: string;
    params: Record<string, unknown>;
  };
}

export interface ApiEndpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  summary: string;
  description: string;
  tags: string[];
  auth: boolean;
  permissions?: string[];
  requestBody?: {
    type: string;
    schema: Record<string, unknown>;
  };
  responses: {
    status: number;
    description: string;
    schema?: Record<string, unknown>;
  }[];
}

export const defaultPermissions: string[] = [
  "orders.read",
  "orders.create",
  "orders.assign",
  "orders.update_status",
  "users.read",
  "users.manage",
  "couriers.verify",
  "payments.read",
  "reports.read",
  "subscriptions.manage",
  "addresses.read",
  "addresses.manage",
];

export const defaultRoles: { name: string; permissions: string[] }[] = [
  {
    name: "admin",
    permissions: defaultPermissions,
  },
  {
    name: "manager",
    permissions: ["orders.read", "orders.assign", "orders.update_status", "users.read", "couriers.verify"],
  },
  {
    name: "accountant",
    permissions: ["orders.read", "payments.read", "reports.read"],
  },
  {
    name: "support",
    permissions: ["orders.read", "users.read", "addresses.read"],
  },
  {
    name: "dispatcher",
    permissions: ["orders.read", "orders.assign", "orders.update_status"],
  },
];

// ==================== V2 MODULES ====================

// Event System - Product Analytics (separate from AuditLog)
export const eventActorTypes = ["client", "courier", "system"] as const;
export type EventActorType = (typeof eventActorTypes)[number];

export const productEventTypes = [
  "order.created", "order.completed", "order.completed.shabbat", "order.cancelled",
  "subscription.started", "subscription.paused", "subscription.cancelled",
  "bonus.earned", "bonus.redeemed", "bonus.expired",
  "courier.batch.completed",
  "user.segment.entered", "user.segment.exited",
  "partner.offer.viewed", "partner.offer.redeemed"
] as const;
export type ProductEventType = (typeof productEventTypes)[number];

export interface Event {
  id: string;
  type: ProductEventType;
  actorType: EventActorType;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export const insertEventSchema = z.object({
  type: z.enum(productEventTypes),
  actorType: z.enum(eventActorTypes),
  actorId: z.string().uuid().nullable().optional(),
  entityType: z.string().nullable().optional(),
  entityId: z.string().uuid().nullable().optional(),
  payload: z.record(z.unknown()).optional().default({}),
});
export type InsertEvent = z.infer<typeof insertEventSchema>;

// User Activity - Behavior History (Customer Timeline)
export const userActivityTypes = [
  "daily_pickup", "skip_day", "cancellation", "shabbat_call",
  "tip_given", "app_opened", "order_rated", "support_contacted",
  "subscription_changed", "address_added", "referral_sent"
] as const;
export type UserActivityType = (typeof userActivityTypes)[number];

export interface UserActivity {
  id: string;
  userId: string;
  eventType: UserActivityType;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const insertUserActivitySchema = z.object({
  eventType: z.enum(userActivityTypes),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;

// User Flags - Segmentation
export const userFlagSources = ["system", "manual", "ml"] as const;
export type UserFlagSource = (typeof userFlagSources)[number];

export const userFlagKeys = [
  "daily_user", "shabbat_orders", "high_frequency", "no_tips",
  "premium_candidate", "churn_risk", "high_ltv", "price_sensitive",
  "early_adopter", "referrer", "vip"
] as const;
export type UserFlagKey = (typeof userFlagKeys)[number];

export interface UserFlag {
  id: string;
  userId: string;
  key: UserFlagKey;
  value: boolean;
  source: UserFlagSource;
  createdAt: string;
}

export const insertUserFlagSchema = z.object({
  key: z.enum(userFlagKeys),
  value: z.boolean().default(true),
  source: z.enum(userFlagSources).default("manual"),
});
export type InsertUserFlag = z.infer<typeof insertUserFlagSchema>;

// Bonus System
export interface BonusAccount {
  userId: string;
  balance: number;
  updatedAt: string;
}

export const bonusTransactionTypes = ["earn", "spend", "expire", "adjust"] as const;
export type BonusTransactionType = (typeof bonusTransactionTypes)[number];

export const bonusReasons = [
  "daily_streak", "referral", "partner_service", "order_completion",
  "shabbat_bonus", "loyalty_reward", "manual_adjustment", "expiration",
  "order_payment", "partner_payment", "promo_code"
] as const;
export type BonusReason = (typeof bonusReasons)[number];

export interface BonusTransaction {
  id: string;
  userId: string;
  type: BonusTransactionType;
  amount: number;
  reason: BonusReason;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export const insertBonusTransactionSchema = z.object({
  type: z.enum(bonusTransactionTypes),
  amount: z.number().int(),
  reason: z.enum(bonusReasons),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
});
export type InsertBonusTransaction = z.infer<typeof insertBonusTransactionSchema>;

// Subscriptions
export const subscriptionStatuses = ["active", "paused", "cancelled", "expired"] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  pausedAt: string | null;
  cancelledAt: string | null;
  nextBillingAt: string | null;
  createdAt: string;
}

export const insertSubscriptionSchema = z.object({
  planId: z.string().uuid(),
  startedAt: z.string().optional(),
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export const updateSubscriptionSchema = z.object({
  status: z.enum(subscriptionStatuses).optional(),
  nextBillingAt: z.string().nullable().optional(),
});
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;

// Subscription Rules
export const subscriptionRuleTypes = ["daily", "weekdays", "weekend", "custom"] as const;
export type SubscriptionRuleType = (typeof subscriptionRuleTypes)[number];

export interface SubscriptionRule {
  id: string;
  subscriptionId: string;
  type: SubscriptionRuleType;
  timeWindow: string;
  priceModifier: number;
  daysOfWeek: number[] | null;
  createdAt: string;
}

export const insertSubscriptionRuleSchema = z.object({
  type: z.enum(subscriptionRuleTypes),
  timeWindow: z.string(),
  priceModifier: z.number().default(0),
  daysOfWeek: z.array(z.number().min(0).max(6)).nullable().optional(),
});
export type InsertSubscriptionRule = z.infer<typeof insertSubscriptionRuleSchema>;

// Subscription Plans
export interface SubscriptionPlan {
  id: string;
  name: string;
  descriptionKey: string;
  basePrice: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export const insertSubscriptionPlanSchema = z.object({
  name: z.string().min(2),
  descriptionKey: z.string(),
  basePrice: z.number().positive(),
  currency: z.string().default("ILS"),
  isActive: z.boolean().default(true),
});
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

// Partners / Marketplace
export const partnerCategories = [
  "cleaning", "pets", "moving", "water_delivery",
  "insurance", "telecom", "laundry", "handyman", "other"
] as const;
export type PartnerCategory = (typeof partnerCategories)[number];

export const partnerStatuses = ["active", "inactive", "pending"] as const;
export type PartnerStatus = (typeof partnerStatuses)[number];

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  status: PartnerStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
}

export const insertPartnerSchema = z.object({
  name: z.string().min(2),
  category: z.enum(partnerCategories),
  status: z.enum(partnerStatuses).default("pending"),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
});
export type InsertPartner = z.infer<typeof insertPartnerSchema>;

export interface PartnerOffer {
  id: string;
  partnerId: string;
  titleKey: string;
  descriptionKey: string;
  price: number;
  bonusPrice: number | null;
  currency: string;
  availableForSegments: string[];
  isActive: boolean;
  createdAt: string;
}

export const insertPartnerOfferSchema = z.object({
  titleKey: z.string(),
  descriptionKey: z.string(),
  price: z.number().positive(),
  bonusPrice: z.number().positive().nullable().optional(),
  currency: z.string().default("ILS"),
  availableForSegments: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});
export type InsertPartnerOffer = z.infer<typeof insertPartnerOfferSchema>;

// Order Finance Snapshot - Unit Economics
export interface OrderFinanceSnapshot {
  id: string;
  orderId: string;
  clientPrice: number;
  courierPayout: number;
  bonusSpent: number;
  platformFee: number;
  margin: number;
  currency: string;
  createdAt: string;
}

export const insertOrderFinanceSnapshotSchema = z.object({
  clientPrice: z.number(),
  courierPayout: z.number(),
  bonusSpent: z.number().default(0),
  platformFee: z.number().default(0),
});
export type InsertOrderFinanceSnapshot = z.infer<typeof insertOrderFinanceSnapshotSchema>;

// ==================== GAMIFICATION ====================

// Level codes (progression tiers)
export const levelCodes = ["bronze", "silver", "gold", "platinum"] as const;
export type LevelCode = (typeof levelCodes)[number];

// Level definition
export interface Level {
  id: string;
  code: LevelCode;
  nameKey: string;
  minPoints: number;
  benefits: Record<string, unknown>;
  createdAt: string;
}

export const insertLevelSchema = z.object({
  code: z.enum(levelCodes),
  nameKey: z.string(),
  minPoints: z.number().min(0),
  benefits: z.record(z.unknown()).default({}),
});
export type InsertLevel = z.infer<typeof insertLevelSchema>;

// User's current level
export interface UserLevel {
  id: string;
  userId: string;
  levelId: string;
  achievedAt: string;
  current: boolean;
}

export const insertUserLevelSchema = z.object({
  levelId: z.string().uuid(),
  current: z.boolean().default(true),
});
export type InsertUserLevel = z.infer<typeof insertUserLevelSchema>;

// User progress (total points)
export interface UserProgress {
  userId: string;
  totalPoints: number;
  updatedAt: string;
}

// Progress transaction reasons
export const progressReasons = [
  "daily_order", "shabbat_order", "streak_3", "streak_7", "streak_14", "streak_30",
  "month_perfect", "referral", "first_order", "subscription_started", "manual_adjust"
] as const;
export type ProgressReason = (typeof progressReasons)[number];

export interface ProgressTransaction {
  id: string;
  userId: string;
  points: number;
  reason: ProgressReason;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export const insertProgressTransactionSchema = z.object({
  points: z.number(),
  reason: z.enum(progressReasons),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
});
export type InsertProgressTransaction = z.infer<typeof insertProgressTransactionSchema>;

// Streak types
export const streakTypes = ["daily_cleanup", "weekly_order", "shabbat_order"] as const;
export type StreakType = (typeof streakTypes)[number];

export interface UserStreak {
  userId: string;
  type: StreakType;
  currentCount: number;
  maxCount: number;
  lastActionDate: string;
}

export const updateStreakSchema = z.object({
  currentCount: z.number().min(0).optional(),
  maxCount: z.number().min(0).optional(),
  lastActionDate: z.string().optional(),
});
export type UpdateStreak = z.infer<typeof updateStreakSchema>;

// Feature codes (unlockable features)
export const featureCodes = [
  "shabbat_orders", "bonus_marketplace", "priority_courier",
  "partner_offers", "premium_support", "analytics_dashboard"
] as const;
export type FeatureCode = (typeof featureCodes)[number];

export interface Feature {
  id: string;
  code: FeatureCode;
  descriptionKey: string;
  createdAt: string;
}

export const insertFeatureSchema = z.object({
  code: z.enum(featureCodes),
  descriptionKey: z.string(),
});
export type InsertFeature = z.infer<typeof insertFeatureSchema>;

// Feature access grant types
export const featureGrantTypes = ["level", "manual", "promo"] as const;
export type FeatureGrantType = (typeof featureGrantTypes)[number];

export interface UserFeatureAccess {
  id: string;
  userId: string;
  featureId: string;
  grantedBy: FeatureGrantType;
  expiresAt: string | null;
  createdAt: string;
}

export const insertUserFeatureAccessSchema = z.object({
  featureId: z.string().uuid(),
  grantedBy: z.enum(featureGrantTypes),
  expiresAt: z.string().nullable().optional(),
});
export type InsertUserFeatureAccess = z.infer<typeof insertUserFeatureAccessSchema>;
