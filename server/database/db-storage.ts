import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { eq, and, or, desc, gte, lte, inArray, isNull, sql } from "drizzle-orm";
import { getDatabase } from "./connection";
import * as dbSchema from "./schema";
import { getCurrentEnvironment } from "../environment-context";
import type { IStorage } from "../repositories";
import type {
  User, InsertUser, Role, InsertRole, Permission, InsertPermission,
  Address, InsertAddress, CourierProfile, UpdateCourierProfile,
  Order, InsertOrder, UpdateOrder, OrderEvent, InsertOrderEvent,
  UserType, UserStatus, OrderStatus, AuditLog, Session,
  Event, InsertEvent, ProductEventType, EventActorType,
  UserActivity, InsertUserActivity, UserActivityType,
  UserFlag, InsertUserFlag, UserFlagKey,
  BonusAccount, BonusTransaction, InsertBonusTransaction, BonusTransactionType,
  Subscription, InsertSubscription, UpdateSubscription,
  SubscriptionRule, InsertSubscriptionRule,
  SubscriptionPlan, InsertSubscriptionPlan,
  Partner, InsertPartner, PartnerCategory, PartnerStatus,
  PartnerOffer, InsertPartnerOffer,
  OrderFinanceSnapshot, InsertOrderFinanceSnapshot,
  Level, InsertLevel, LevelCode,
  UserLevel, InsertUserLevel,
  UserProgress, ProgressTransaction, InsertProgressTransaction, ProgressReason,
  UserStreak, UpdateStreak, StreakType,
  Feature, InsertFeature, FeatureCode,
  UserFeatureAccess, InsertUserFeatureAccess,
  Webhook, InsertWebhook, WebhookDelivery, WebhookEventType, WebhookStatus,
  FeatureFlag, InsertFeatureFlag, SystemFeatureFlag, IdempotencyRecord
} from "@shared/schema";
import { userActivityTypes } from "@shared/schema";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function toISOString(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toISOStringRequired(date: Date): string {
  return date.toISOString();
}

export class DatabaseStorage implements IStorage {
  private get db() {
    return getDatabase();
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(dbSchema.users).where(eq(dbSchema.users.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapUser(result[0]);
  }

  async getUserByPhone(phone: string, includeDeleted = false): Promise<User | undefined> {
    const conditions = includeDeleted
      ? [eq(dbSchema.users.phone, phone)]
      : [eq(dbSchema.users.phone, phone), isNull(dbSchema.users.deletedAt)];
    const result = await this.db.select().from(dbSchema.users).where(and(...conditions)).limit(1);
    if (!result[0]) return undefined;
    return this.mapUser(result[0]);
  }

  async createUser(data: InsertUser): Promise<User> {
    const passwordHash = await hashPassword(data.password);
    const result = await this.db.insert(dbSchema.users).values({
      type: data.type,
      phone: data.phone,
      email: data.email || null,
      passwordHash,
      status: "active",
    }).returning();
    
    if (data.type === "courier") {
      await this.createCourierProfile(result[0].id);
    }
    
    return this.mapUser(result[0]);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.type !== undefined) updateData.type = updates.type;
    
    const result = await this.db.update(dbSchema.users)
      .set(updateData)
      .where(eq(dbSchema.users.id, id))
      .returning();
    if (!result[0]) return undefined;
    return this.mapUser(result[0]);
  }

  async softDeleteUser(id: string): Promise<User | undefined> {
    const result = await this.db.update(dbSchema.users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(dbSchema.users.id, id))
      .returning();
    if (!result[0]) return undefined;
    return this.mapUser(result[0]);
  }

  async getUsers(filters?: { type?: UserType; status?: UserStatus; includeDeleted?: boolean }): Promise<User[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.type) conditions.push(eq(dbSchema.users.type, filters.type));
    if (filters?.status) conditions.push(eq(dbSchema.users.status, filters.status));
    if (!filters?.includeDeleted) conditions.push(isNull(dbSchema.users.deletedAt));
    
    const result = await this.db.select().from(dbSchema.users)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result.map(u => this.mapUser(u));
  }

  async verifyUserPassword(phone: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByPhone(phone);
    if (!user) return undefined;
    const dbUser = await this.db.select().from(dbSchema.users).where(eq(dbSchema.users.id, user.id)).limit(1);
    if (!dbUser[0]) return undefined;
    const valid = await verifyPassword(password, dbUser[0].passwordHash);
    return valid ? user : undefined;
  }

  private mapUser(row: typeof dbSchema.users.$inferSelect): User {
    return {
      id: row.id,
      type: row.type as UserType,
      phone: row.phone,
      email: row.email,
      passwordHash: row.passwordHash,
      status: row.status as UserStatus,
      createdAt: toISOStringRequired(row.createdAt),
      deletedAt: toISOString(row.deletedAt),
    };
  }

  async getRole(id: string): Promise<Role | undefined> {
    const result = await this.db.select().from(dbSchema.roles).where(eq(dbSchema.roles.id, id)).limit(1);
    if (!result[0]) return undefined;
    return { id: result[0].id, name: result[0].name, description: result[0].description };
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const result = await this.db.select().from(dbSchema.roles).where(eq(dbSchema.roles.name, name)).limit(1);
    if (!result[0]) return undefined;
    return { id: result[0].id, name: result[0].name, description: result[0].description };
  }

  async getRoles(): Promise<Role[]> {
    const result = await this.db.select().from(dbSchema.roles);
    return result.map(r => ({ id: r.id, name: r.name, description: r.description }));
  }

  async createRole(role: InsertRole): Promise<Role> {
    const result = await this.db.insert(dbSchema.roles).values({
      name: role.name,
      description: role.description || null,
    }).returning();
    return { id: result[0].id, name: result[0].name, description: result[0].description };
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    const result = await this.db.select().from(dbSchema.permissions).where(eq(dbSchema.permissions.id, id)).limit(1);
    if (!result[0]) return undefined;
    return { id: result[0].id, name: result[0].name, description: result[0].description };
  }

  async getPermissions(): Promise<Permission[]> {
    const result = await this.db.select().from(dbSchema.permissions);
    return result.map(p => ({ id: p.id, name: p.name, description: p.description }));
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const result = await this.db.insert(dbSchema.permissions).values({
      name: permission.name,
      description: permission.description || null,
    }).returning();
    return { id: result[0].id, name: result[0].name, description: result[0].description };
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const result = await this.db
      .select({ permission: dbSchema.permissions })
      .from(dbSchema.rolePermissions)
      .innerJoin(dbSchema.permissions, eq(dbSchema.rolePermissions.permissionId, dbSchema.permissions.id))
      .where(eq(dbSchema.rolePermissions.roleId, roleId));
    return result.map(r => ({ id: r.permission.id, name: r.permission.name, description: r.permission.description }));
  }

  async addRolePermission(roleId: string, permissionId: string): Promise<void> {
    await this.db.insert(dbSchema.rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const result = await this.db
      .select({ role: dbSchema.roles })
      .from(dbSchema.userRoles)
      .innerJoin(dbSchema.roles, eq(dbSchema.userRoles.roleId, dbSchema.roles.id))
      .where(eq(dbSchema.userRoles.userId, userId));
    return result.map(r => ({ id: r.role.id, name: r.role.name, description: r.role.description }));
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const permissionSet = new Set<string>();
    for (const role of roles) {
      const perms = await this.getRolePermissions(role.id);
      perms.forEach(p => permissionSet.add(p.name));
    }
    return Array.from(permissionSet);
  }

  async addUserRole(userId: string, roleId: string): Promise<void> {
    await this.db.insert(dbSchema.userRoles).values({ userId, roleId }).onConflictDoNothing();
  }

  async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.db.delete(dbSchema.userRoles).where(eq(dbSchema.userRoles.userId, userId));
    if (roleIds.length > 0) {
      await this.db.insert(dbSchema.userRoles).values(roleIds.map(roleId => ({ userId, roleId })));
    }
  }

  async getAddress(id: string, includeDeleted = false): Promise<Address | undefined> {
    const conditions = includeDeleted
      ? [eq(dbSchema.addresses.id, id)]
      : [eq(dbSchema.addresses.id, id), isNull(dbSchema.addresses.deletedAt)];
    const result = await this.db.select().from(dbSchema.addresses).where(and(...conditions)).limit(1);
    if (!result[0]) return undefined;
    return this.mapAddress(result[0]);
  }

  async getAddressesByUser(userId: string, includeDeleted = false): Promise<Address[]> {
    const conditions = includeDeleted
      ? [eq(dbSchema.addresses.userId, userId)]
      : [eq(dbSchema.addresses.userId, userId), isNull(dbSchema.addresses.deletedAt)];
    const result = await this.db.select().from(dbSchema.addresses).where(and(...conditions));
    return result.map(a => this.mapAddress(a));
  }

  async createAddress(userId: string, address: InsertAddress): Promise<Address> {
    const result = await this.db.insert(dbSchema.addresses).values({
      userId,
      city: address.city,
      street: address.street,
      house: address.house,
      apartment: address.apartment || null,
      floor: address.floor || null,
      hasElevator: address.hasElevator ?? false,
      comment: address.comment || null,
    }).returning();
    return this.mapAddress(result[0]);
  }

  async updateAddress(id: string, updates: Partial<Address>): Promise<Address | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.street !== undefined) updateData.street = updates.street;
    if (updates.house !== undefined) updateData.house = updates.house;
    if (updates.apartment !== undefined) updateData.apartment = updates.apartment;
    if (updates.floor !== undefined) updateData.floor = updates.floor;
    if (updates.hasElevator !== undefined) updateData.hasElevator = updates.hasElevator;
    if (updates.comment !== undefined) updateData.comment = updates.comment;
    
    const result = await this.db.update(dbSchema.addresses).set(updateData).where(eq(dbSchema.addresses.id, id)).returning();
    if (!result[0]) return undefined;
    return this.mapAddress(result[0]);
  }

  async softDeleteAddress(id: string): Promise<Address | undefined> {
    const result = await this.db.update(dbSchema.addresses)
      .set({ deletedAt: new Date() })
      .where(eq(dbSchema.addresses.id, id))
      .returning();
    if (!result[0]) return undefined;
    return this.mapAddress(result[0]);
  }

  private mapAddress(row: typeof dbSchema.addresses.$inferSelect): Address {
    return {
      id: row.id,
      userId: row.userId,
      city: row.city,
      street: row.street,
      house: row.house,
      apartment: row.apartment,
      floor: row.floor,
      hasElevator: row.hasElevator,
      comment: row.comment,
      deletedAt: toISOString(row.deletedAt),
    };
  }

  async getCourierProfile(courierId: string, includeDeleted = false): Promise<CourierProfile | undefined> {
    const conditions = includeDeleted
      ? [eq(dbSchema.couriers.userId, courierId)]
      : [eq(dbSchema.couriers.userId, courierId), isNull(dbSchema.couriers.deletedAt)];
    const result = await this.db.select().from(dbSchema.couriers).where(and(...conditions)).limit(1);
    if (!result[0]) return undefined;
    return this.mapCourierProfile(result[0]);
  }

  async getCouriers(includeDeleted = false): Promise<CourierProfile[]> {
    const conditions = includeDeleted ? [] : [isNull(dbSchema.couriers.deletedAt)];
    const result = await this.db.select().from(dbSchema.couriers)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result.map(c => this.mapCourierProfile(c));
  }

  async createCourierProfile(courierId: string): Promise<CourierProfile> {
    const result = await this.db.insert(dbSchema.couriers).values({
      userId: courierId,
      availabilityStatus: "offline",
      verificationStatus: "pending",
      rating: "0",
      completedOrdersCount: 0,
    }).returning();
    return this.mapCourierProfile(result[0]);
  }

  async updateCourierProfile(courierId: string, updates: UpdateCourierProfile): Promise<CourierProfile | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.availabilityStatus !== undefined) updateData.availabilityStatus = updates.availabilityStatus;
    
    const result = await this.db.update(dbSchema.couriers).set(updateData)
      .where(eq(dbSchema.couriers.userId, courierId)).returning();
    if (!result[0]) return undefined;
    return this.mapCourierProfile(result[0]);
  }

  async updateCourierVerification(courierId: string, status: "verified" | "rejected"): Promise<CourierProfile | undefined> {
    const result = await this.db.update(dbSchema.couriers)
      .set({ verificationStatus: status })
      .where(eq(dbSchema.couriers.userId, courierId))
      .returning();
    if (!result[0]) return undefined;
    return this.mapCourierProfile(result[0]);
  }

  async softDeleteCourier(courierId: string): Promise<CourierProfile | undefined> {
    const result = await this.db.update(dbSchema.couriers)
      .set({ deletedAt: new Date() })
      .where(eq(dbSchema.couriers.userId, courierId))
      .returning();
    if (!result[0]) return undefined;
    return this.mapCourierProfile(result[0]);
  }

  async incrementCourierOrders(courierId: string): Promise<void> {
    await this.db.update(dbSchema.couriers)
      .set({ completedOrdersCount: sql`${dbSchema.couriers.completedOrdersCount} + 1` })
      .where(eq(dbSchema.couriers.userId, courierId));
  }

  private mapCourierProfile(row: typeof dbSchema.couriers.$inferSelect): CourierProfile {
    return {
      courierId: row.userId,
      availabilityStatus: row.availabilityStatus as "available" | "busy" | "offline",
      verificationStatus: row.verificationStatus as "pending" | "verified" | "rejected",
      rating: parseFloat(row.rating),
      completedOrdersCount: row.completedOrdersCount,
      deletedAt: toISOString(row.deletedAt),
    };
  }

  async getOrder(id: string, includeDeleted = false): Promise<Order | undefined> {
    const conditions = includeDeleted
      ? [eq(dbSchema.orders.id, id)]
      : [eq(dbSchema.orders.id, id), isNull(dbSchema.orders.deletedAt)];
    const result = await this.db.select().from(dbSchema.orders).where(and(...conditions)).limit(1);
    if (!result[0]) return undefined;
    return this.mapOrder(result[0]);
  }

  async getOrders(filters?: { clientId?: string; courierId?: string; status?: OrderStatus; includeDeleted?: boolean }): Promise<Order[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.clientId) conditions.push(eq(dbSchema.orders.clientId, filters.clientId));
    if (filters?.courierId) conditions.push(eq(dbSchema.orders.courierId, filters.courierId));
    if (filters?.status) conditions.push(eq(dbSchema.orders.status, filters.status));
    if (!filters?.includeDeleted) conditions.push(isNull(dbSchema.orders.deletedAt));
    
    const result = await this.db.select().from(dbSchema.orders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dbSchema.orders.createdAt));
    return result.map(o => this.mapOrder(o));
  }

  async createOrder(clientId: string, order: InsertOrder): Promise<Order> {
    const result = await this.db.insert(dbSchema.orders).values({
      clientId,
      addressId: order.addressId,
      scheduledAt: order.scheduledAt ? new Date(order.scheduledAt) : null,
      timeWindow: order.timeWindow,
      price: order.price || 0,
      status: "created",
    }).returning();
    
    await this.createOrderEvent(clientId, {
      orderId: result[0].id,
      eventType: "created",
      metadata: {},
    });
    
    return this.mapOrder(result[0]);
  }

  async updateOrder(id: string, updates: UpdateOrder, performedBy: string): Promise<Order | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.courierId !== undefined) updateData.courierId = updates.courierId;
    if (updates.scheduledAt !== undefined) updateData.scheduledAt = new Date(updates.scheduledAt);
    if (updates.timeWindow !== undefined) updateData.timeWindow = updates.timeWindow;
    if (updates.price !== undefined) updateData.price = updates.price;
    
    if (updates.status === "completed") {
      updateData.completedAt = new Date();
    }
    
    const result = await this.db.update(dbSchema.orders).set(updateData).where(eq(dbSchema.orders.id, id)).returning();
    if (!result[0]) return undefined;
    
    if (updates.status) {
      await this.createOrderEvent(performedBy, {
        orderId: id,
        eventType: "status_changed",
        metadata: { status: updates.status },
      });
    }
    
    return this.mapOrder(result[0]);
  }

  async assignCourier(orderId: string, courierId: string, performedBy: string): Promise<Order | undefined> {
    const result = await this.db.update(dbSchema.orders)
      .set({ courierId, status: "assigned", updatedAt: new Date() })
      .where(eq(dbSchema.orders.id, orderId))
      .returning();
    if (!result[0]) return undefined;
    
    await this.createOrderEvent(performedBy, {
      orderId,
      eventType: "assigned",
      metadata: { courierId },
    });
    
    return this.mapOrder(result[0]);
  }

  async softDeleteOrder(orderId: string): Promise<Order | undefined> {
    const result = await this.db.update(dbSchema.orders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(dbSchema.orders.id, orderId))
      .returning();
    if (!result[0]) return undefined;
    return this.mapOrder(result[0]);
  }

  private mapOrder(row: typeof dbSchema.orders.$inferSelect): Order {
    return {
      id: row.id,
      clientId: row.clientId,
      courierId: row.courierId,
      addressId: row.addressId,
      scheduledAt: row.scheduledAt ? toISOStringRequired(row.scheduledAt) : "",
      timeWindow: row.timeWindow || "",
      status: row.status as OrderStatus,
      price: row.price,
      createdAt: toISOStringRequired(row.createdAt),
      completedAt: toISOString(row.completedAt),
      deletedAt: toISOString(row.deletedAt),
    };
  }

  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    const result = await this.db.select().from(dbSchema.orderEvents)
      .where(eq(dbSchema.orderEvents.orderId, orderId))
      .orderBy(desc(dbSchema.orderEvents.createdAt));
    return result.map(e => ({
      id: e.id,
      orderId: e.orderId,
      eventType: e.eventType as OrderEvent["eventType"],
      performedBy: e.performedBy,
      metadata: e.metadata as Record<string, unknown>,
      createdAt: toISOStringRequired(e.createdAt),
    }));
  }

  async createOrderEvent(performedBy: string, event: InsertOrderEvent): Promise<OrderEvent> {
    const result = await this.db.insert(dbSchema.orderEvents).values({
      orderId: event.orderId,
      eventType: event.eventType,
      performedBy,
      metadata: event.metadata || {},
    }).returning();
    return {
      id: result[0].id,
      orderId: result[0].orderId,
      eventType: result[0].eventType as OrderEvent["eventType"],
      performedBy: result[0].performedBy,
      metadata: result[0].metadata as Record<string, unknown>,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async createAuditLog(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    const result = await this.db.insert(dbSchema.auditLogs).values({
      userId: log.userId,
      userRole: log.userRole,
      action: log.action,
      messageKey: log.messageKey,
      entity: log.entity,
      entityId: log.entityId,
      changes: log.changes,
      metadata: log.metadata,
    }).returning();
    return {
      id: result[0].id,
      userId: result[0].userId,
      userRole: result[0].userRole,
      action: result[0].action,
      messageKey: result[0].messageKey,
      entity: result[0].entity,
      entityId: result[0].entityId,
      changes: result[0].changes as Record<string, { from: unknown; to: unknown }>,
      metadata: result[0].metadata as Record<string, unknown>,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getAuditLogs(filters?: { userId?: string; entity?: string; entityId?: string; action?: string }): Promise<AuditLog[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.userId) conditions.push(eq(dbSchema.auditLogs.userId, filters.userId));
    if (filters?.entity) conditions.push(eq(dbSchema.auditLogs.entity, filters.entity));
    if (filters?.entityId) conditions.push(eq(dbSchema.auditLogs.entityId, filters.entityId));
    if (filters?.action) conditions.push(eq(dbSchema.auditLogs.action, filters.action));
    
    const result = await this.db.select().from(dbSchema.auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dbSchema.auditLogs.createdAt));
    return result.map(l => ({
      id: l.id,
      userId: l.userId,
      userRole: l.userRole,
      action: l.action,
      messageKey: l.messageKey,
      entity: l.entity,
      entityId: l.entityId,
      changes: l.changes as Record<string, { from: unknown; to: unknown }>,
      metadata: l.metadata as Record<string, unknown>,
      createdAt: toISOStringRequired(l.createdAt),
    }));
  }

  async createSession(userId: string, refreshToken: string, deviceId: string, platform: "ios" | "android" | "web", userAgent: string | null, clientId?: string, clientType?: "mobile_client" | "courier_app" | "erp" | "partner" | "web"): Promise<Session> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const result = await this.db.insert(dbSchema.deviceSessions).values({
      userId,
      refreshTokenHash,
      deviceId,
      platform,
      userAgent,
      clientId: clientId || null,
      clientType: clientType || null,
    }).returning();
    return {
      id: result[0].id,
      userId: result[0].userId,
      refreshToken,
      deviceId: result[0].deviceId,
      platform: result[0].platform as "ios" | "android" | "web",
      userAgent: result[0].userAgent,
      clientId: result[0].clientId,
      clientType: result[0].clientType as Session["clientType"],
      lastSeenAt: toISOStringRequired(result[0].lastSeenAt),
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getSession(refreshToken: string): Promise<Session | undefined> {
    const sessions = await this.db.select().from(dbSchema.deviceSessions);
    for (const session of sessions) {
      const valid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
      if (valid) {
        return {
          id: session.id,
          userId: session.userId,
          refreshToken,
          deviceId: session.deviceId,
          platform: session.platform as "ios" | "android" | "web",
          userAgent: session.userAgent,
          clientId: session.clientId,
          clientType: session.clientType as Session["clientType"],
          lastSeenAt: toISOStringRequired(session.lastSeenAt),
          createdAt: toISOStringRequired(session.createdAt),
        };
      }
    }
    return undefined;
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    const result = await this.db.select().from(dbSchema.deviceSessions)
      .where(eq(dbSchema.deviceSessions.userId, userId));
    return result.map(s => ({
      id: s.id,
      userId: s.userId,
      refreshToken: "",
      deviceId: s.deviceId,
      platform: s.platform as "ios" | "android" | "web",
      userAgent: s.userAgent,
      clientId: s.clientId,
      clientType: s.clientType as Session["clientType"],
      lastSeenAt: toISOStringRequired(s.lastSeenAt),
      createdAt: toISOStringRequired(s.createdAt),
    }));
  }

  async updateSessionLastSeen(sessionId: string, clientId?: string, clientType?: string): Promise<void> {
    const updateData: Record<string, unknown> = { lastSeenAt: new Date() };
    if (clientId !== undefined) updateData.clientId = clientId;
    if (clientType !== undefined) updateData.clientType = clientType;
    await this.db.update(dbSchema.deviceSessions)
      .set(updateData)
      .where(eq(dbSchema.deviceSessions.id, sessionId));
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.db.delete(dbSchema.deviceSessions).where(eq(dbSchema.deviceSessions.id, sessionId)).returning();
    return result.length > 0;
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(dbSchema.deviceSessions).where(eq(dbSchema.deviceSessions.userId, userId));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const result = await this.db.insert(dbSchema.events).values({
      type: event.type,
      actorType: event.actorType,
      actorId: event.actorId || null,
      entityType: event.entityType || null,
      entityId: event.entityId || null,
      payload: event.payload || {},
    }).returning();
    return {
      id: result[0].id,
      type: result[0].type as ProductEventType,
      actorType: result[0].actorType as EventActorType,
      actorId: result[0].actorId,
      entityType: result[0].entityType,
      entityId: result[0].entityId,
      payload: result[0].payload as Record<string, unknown>,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const result = await this.db.select().from(dbSchema.events).where(eq(dbSchema.events.id, id)).limit(1);
    if (!result[0]) return undefined;
    return {
      id: result[0].id,
      type: result[0].type as ProductEventType,
      actorType: result[0].actorType as EventActorType,
      actorId: result[0].actorId,
      entityType: result[0].entityType,
      entityId: result[0].entityId,
      payload: result[0].payload as Record<string, unknown>,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getEvents(filters?: { type?: ProductEventType; actorType?: EventActorType; actorId?: string; entityType?: string; entityId?: string; from?: string; to?: string }): Promise<Event[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.type) conditions.push(eq(dbSchema.events.type, filters.type));
    if (filters?.actorType) conditions.push(eq(dbSchema.events.actorType, filters.actorType));
    if (filters?.actorId) conditions.push(eq(dbSchema.events.actorId, filters.actorId));
    if (filters?.entityType) conditions.push(eq(dbSchema.events.entityType, filters.entityType));
    if (filters?.entityId) conditions.push(eq(dbSchema.events.entityId, filters.entityId));
    
    const result = await this.db.select().from(dbSchema.events)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dbSchema.events.createdAt));
    return result.map(e => ({
      id: e.id,
      type: e.type as ProductEventType,
      actorType: e.actorType as EventActorType,
      actorId: e.actorId,
      entityType: e.entityType,
      entityId: e.entityId,
      payload: e.payload as Record<string, unknown>,
      createdAt: toISOStringRequired(e.createdAt),
    }));
  }

  async createUserActivity(userId: string, activity: InsertUserActivity): Promise<UserActivity> {
    const result = await this.db.insert(dbSchema.userActivities).values({
      userId,
      eventType: activity.eventType,
      referenceType: activity.referenceType || null,
      referenceId: activity.referenceId || null,
      metadata: activity.metadata || {},
    }).returning();
    return {
      id: result[0].id,
      userId: result[0].userId,
      eventType: result[0].eventType as UserActivityType,
      referenceType: result[0].referenceType,
      referenceId: result[0].referenceId,
      metadata: result[0].metadata as Record<string, unknown>,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getUserActivities(userId: string, filters?: { eventType?: UserActivityType; from?: string; to?: string }): Promise<UserActivity[]> {
    const conditions = [eq(dbSchema.userActivities.userId, userId)];
    if (filters?.eventType) conditions.push(eq(dbSchema.userActivities.eventType, filters.eventType));
    
    const result = await this.db.select().from(dbSchema.userActivities)
      .where(and(...conditions))
      .orderBy(desc(dbSchema.userActivities.createdAt));
    return result.map(a => ({
      id: a.id,
      userId: a.userId,
      eventType: a.eventType as UserActivityType,
      referenceType: a.referenceType,
      referenceId: a.referenceId,
      metadata: a.metadata as Record<string, unknown>,
      createdAt: toISOStringRequired(a.createdAt),
    }));
  }

  async getUserActivitySummary(userId: string): Promise<Record<UserActivityType, number>> {
    const activities = await this.getUserActivities(userId);
    const summary = {} as Record<UserActivityType, number>;
    for (const type of userActivityTypes) {
      summary[type] = 0;
    }
    for (const activity of activities) {
      summary[activity.eventType]++;
    }
    return summary;
  }

  async getUserFlags(userId: string): Promise<UserFlag[]> {
    const result = await this.db.select().from(dbSchema.userFlags).where(eq(dbSchema.userFlags.userId, userId));
    return result.map(f => ({
      id: f.id,
      userId: f.userId,
      key: f.key as UserFlagKey,
      value: f.value,
      source: f.source as "system" | "manual" | "ml",
      createdAt: toISOStringRequired(f.createdAt),
    }));
  }

  async getUserFlag(userId: string, key: UserFlagKey): Promise<UserFlag | undefined> {
    const result = await this.db.select().from(dbSchema.userFlags)
      .where(and(eq(dbSchema.userFlags.userId, userId), eq(dbSchema.userFlags.key, key))).limit(1);
    if (!result[0]) return undefined;
    return {
      id: result[0].id,
      userId: result[0].userId,
      key: result[0].key as UserFlagKey,
      value: result[0].value,
      source: result[0].source as "system" | "manual" | "ml",
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async setUserFlag(userId: string, flag: InsertUserFlag): Promise<UserFlag> {
    const existing = await this.getUserFlag(userId, flag.key);
    if (existing) {
      const result = await this.db.update(dbSchema.userFlags)
        .set({ value: flag.value, source: flag.source })
        .where(and(eq(dbSchema.userFlags.userId, userId), eq(dbSchema.userFlags.key, flag.key)))
        .returning();
      return {
        id: result[0].id,
        userId: result[0].userId,
        key: result[0].key as UserFlagKey,
        value: result[0].value,
        source: result[0].source as "system" | "manual" | "ml",
        createdAt: toISOStringRequired(result[0].createdAt),
      };
    }
    const result = await this.db.insert(dbSchema.userFlags).values({
      userId,
      key: flag.key,
      value: flag.value,
      source: flag.source,
    }).returning();
    return {
      id: result[0].id,
      userId: result[0].userId,
      key: result[0].key as UserFlagKey,
      value: result[0].value,
      source: result[0].source as "system" | "manual" | "ml",
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async deleteUserFlag(userId: string, key: UserFlagKey): Promise<boolean> {
    const result = await this.db.delete(dbSchema.userFlags)
      .where(and(eq(dbSchema.userFlags.userId, userId), eq(dbSchema.userFlags.key, key))).returning();
    return result.length > 0;
  }

  async getUsersByFlag(key: UserFlagKey, value = true): Promise<string[]> {
    const result = await this.db.select({ userId: dbSchema.userFlags.userId })
      .from(dbSchema.userFlags)
      .where(and(eq(dbSchema.userFlags.key, key), eq(dbSchema.userFlags.value, value)));
    return result.map(r => r.userId);
  }

  async getBonusAccount(userId: string): Promise<BonusAccount> {
    const result = await this.db.select().from(dbSchema.bonusAccounts).where(eq(dbSchema.bonusAccounts.userId, userId)).limit(1);
    if (!result[0]) {
      const created = await this.db.insert(dbSchema.bonusAccounts).values({ userId, balance: 0 }).returning();
      return { userId: created[0].userId, balance: created[0].balance, updatedAt: toISOStringRequired(created[0].updatedAt) };
    }
    return { userId: result[0].userId, balance: result[0].balance, updatedAt: toISOStringRequired(result[0].updatedAt) };
  }

  async createBonusTransaction(userId: string, transaction: InsertBonusTransaction): Promise<BonusTransaction> {
    const account = await this.getBonusAccount(userId);
    let newBalance = account.balance;
    
    if (transaction.type === "earn" || transaction.type === "adjust") {
      newBalance += transaction.amount;
    } else if (transaction.type === "spend" || transaction.type === "expire") {
      newBalance -= transaction.amount;
    }
    
    await this.db.update(dbSchema.bonusAccounts)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(dbSchema.bonusAccounts.userId, userId));
    
    const result = await this.db.insert(dbSchema.bonusTransactions).values({
      userId,
      type: transaction.type,
      amount: transaction.amount,
      reason: transaction.reason,
      referenceType: transaction.referenceType || null,
      referenceId: transaction.referenceId || null,
    }).returning();
    
    return {
      id: result[0].id,
      userId: result[0].userId,
      type: result[0].type as BonusTransactionType,
      amount: result[0].amount,
      reason: result[0].reason as BonusTransaction["reason"],
      referenceType: result[0].referenceType,
      referenceId: result[0].referenceId,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getBonusTransactions(userId: string, filters?: { type?: BonusTransactionType; from?: string; to?: string }): Promise<BonusTransaction[]> {
    const conditions = [eq(dbSchema.bonusTransactions.userId, userId)];
    if (filters?.type) conditions.push(eq(dbSchema.bonusTransactions.type, filters.type));
    
    const result = await this.db.select().from(dbSchema.bonusTransactions)
      .where(and(...conditions))
      .orderBy(desc(dbSchema.bonusTransactions.createdAt));
    return result.map(t => ({
      id: t.id,
      userId: t.userId,
      type: t.type as BonusTransactionType,
      amount: t.amount,
      reason: t.reason as BonusTransaction["reason"],
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      createdAt: toISOStringRequired(t.createdAt),
    }));
  }

  async getSubscription(id: string): Promise<Subscription | undefined> {
    const result = await this.db.select().from(dbSchema.subscriptions).where(eq(dbSchema.subscriptions.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapSubscription(result[0]);
  }

  async getSubscriptionsByUser(userId: string): Promise<Subscription[]> {
    const result = await this.db.select().from(dbSchema.subscriptions).where(eq(dbSchema.subscriptions.userId, userId));
    return result.map(s => this.mapSubscription(s));
  }

  async createSubscription(userId: string, subscription: InsertSubscription): Promise<Subscription> {
    const result = await this.db.insert(dbSchema.subscriptions).values({
      userId,
      planId: subscription.planId,
      status: "active",
      startedAt: subscription.startedAt ? new Date(subscription.startedAt) : new Date(),
    }).returning();
    return this.mapSubscription(result[0]);
  }

  async updateSubscription(id: string, updates: UpdateSubscription): Promise<Subscription | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status === "paused") updateData.pausedAt = new Date();
      if (updates.status === "cancelled") updateData.cancelledAt = new Date();
    }
    if (updates.nextBillingAt !== undefined) updateData.nextBillingAt = updates.nextBillingAt ? new Date(updates.nextBillingAt) : null;
    
    const result = await this.db.update(dbSchema.subscriptions).set(updateData).where(eq(dbSchema.subscriptions.id, id)).returning();
    if (!result[0]) return undefined;
    return this.mapSubscription(result[0]);
  }

  private mapSubscription(row: typeof dbSchema.subscriptions.$inferSelect): Subscription {
    return {
      id: row.id,
      userId: row.userId,
      planId: row.planId,
      status: row.status as Subscription["status"],
      startedAt: toISOStringRequired(row.startedAt),
      pausedAt: toISOString(row.pausedAt),
      cancelledAt: toISOString(row.cancelledAt),
      nextBillingAt: toISOString(row.nextBillingAt),
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async getSubscriptionRules(subscriptionId: string): Promise<SubscriptionRule[]> {
    const result = await this.db.select().from(dbSchema.subscriptionRules)
      .where(eq(dbSchema.subscriptionRules.subscriptionId, subscriptionId));
    return result.map(r => ({
      id: r.id,
      subscriptionId: r.subscriptionId,
      type: r.type as SubscriptionRule["type"],
      timeWindow: r.timeWindow,
      priceModifier: r.priceModifier,
      daysOfWeek: r.daysOfWeek as number[] | null,
      createdAt: toISOStringRequired(r.createdAt),
    }));
  }

  async createSubscriptionRule(subscriptionId: string, rule: InsertSubscriptionRule): Promise<SubscriptionRule> {
    const result = await this.db.insert(dbSchema.subscriptionRules).values({
      subscriptionId,
      type: rule.type,
      timeWindow: rule.timeWindow,
      priceModifier: rule.priceModifier || 0,
      daysOfWeek: rule.daysOfWeek || null,
    }).returning();
    return {
      id: result[0].id,
      subscriptionId: result[0].subscriptionId,
      type: result[0].type as SubscriptionRule["type"],
      timeWindow: result[0].timeWindow,
      priceModifier: result[0].priceModifier,
      daysOfWeek: result[0].daysOfWeek as number[] | null,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async deleteSubscriptionRule(ruleId: string): Promise<boolean> {
    const result = await this.db.delete(dbSchema.subscriptionRules).where(eq(dbSchema.subscriptionRules.id, ruleId)).returning();
    return result.length > 0;
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const result = await this.db.select().from(dbSchema.subscriptionPlans).where(eq(dbSchema.subscriptionPlans.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapSubscriptionPlan(result[0]);
  }

  async getSubscriptionPlans(activeOnly = false): Promise<SubscriptionPlan[]> {
    const conditions = activeOnly ? [eq(dbSchema.subscriptionPlans.isActive, true)] : [];
    const result = await this.db.select().from(dbSchema.subscriptionPlans)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result.map(p => this.mapSubscriptionPlan(p));
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const result = await this.db.insert(dbSchema.subscriptionPlans).values({
      name: plan.name,
      descriptionKey: plan.descriptionKey,
      basePrice: plan.basePrice,
      currency: plan.currency || "ILS",
      isActive: plan.isActive ?? true,
    }).returning();
    return this.mapSubscriptionPlan(result[0]);
  }

  async updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.descriptionKey !== undefined) updateData.descriptionKey = updates.descriptionKey;
    if (updates.basePrice !== undefined) updateData.basePrice = updates.basePrice;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    
    const result = await this.db.update(dbSchema.subscriptionPlans).set(updateData).where(eq(dbSchema.subscriptionPlans.id, id)).returning();
    if (!result[0]) return undefined;
    return this.mapSubscriptionPlan(result[0]);
  }

  private mapSubscriptionPlan(row: typeof dbSchema.subscriptionPlans.$inferSelect): SubscriptionPlan {
    return {
      id: row.id,
      name: row.name,
      descriptionKey: row.descriptionKey,
      basePrice: row.basePrice,
      currency: row.currency,
      isActive: row.isActive,
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async getPartner(id: string): Promise<Partner | undefined> {
    const result = await this.db.select().from(dbSchema.partners).where(eq(dbSchema.partners.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapPartner(result[0]);
  }

  async getPartners(filters?: { category?: PartnerCategory; status?: PartnerStatus }): Promise<Partner[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (filters?.category) conditions.push(eq(dbSchema.partners.category, filters.category));
    if (filters?.status) conditions.push(eq(dbSchema.partners.status, filters.status));
    
    const result = await this.db.select().from(dbSchema.partners)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result.map(p => this.mapPartner(p));
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const result = await this.db.insert(dbSchema.partners).values({
      name: partner.name,
      category: partner.category,
      status: partner.status || "pending",
      contactEmail: partner.contactEmail || null,
      contactPhone: partner.contactPhone || null,
    }).returning();
    return this.mapPartner(result[0]);
  }

  async updatePartner(id: string, updates: Partial<Partner>): Promise<Partner | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.contactEmail !== undefined) updateData.contactEmail = updates.contactEmail;
    if (updates.contactPhone !== undefined) updateData.contactPhone = updates.contactPhone;
    
    const result = await this.db.update(dbSchema.partners).set(updateData).where(eq(dbSchema.partners.id, id)).returning();
    if (!result[0]) return undefined;
    return this.mapPartner(result[0]);
  }

  private mapPartner(row: typeof dbSchema.partners.$inferSelect): Partner {
    return {
      id: row.id,
      name: row.name,
      category: row.category as PartnerCategory,
      status: row.status as PartnerStatus,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async getPartnerOffers(partnerId: string, activeOnly = false): Promise<PartnerOffer[]> {
    const conditions = [eq(dbSchema.partnerOffers.partnerId, partnerId)];
    if (activeOnly) conditions.push(eq(dbSchema.partnerOffers.isActive, true));
    
    const result = await this.db.select().from(dbSchema.partnerOffers).where(and(...conditions));
    return result.map(o => this.mapPartnerOffer(o));
  }

  async getPartnerOffer(id: string): Promise<PartnerOffer | undefined> {
    const result = await this.db.select().from(dbSchema.partnerOffers).where(eq(dbSchema.partnerOffers.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapPartnerOffer(result[0]);
  }

  async createPartnerOffer(partnerId: string, offer: InsertPartnerOffer): Promise<PartnerOffer> {
    const result = await this.db.insert(dbSchema.partnerOffers).values({
      partnerId,
      titleKey: offer.titleKey,
      descriptionKey: offer.descriptionKey,
      price: offer.price,
      bonusPrice: offer.bonusPrice || null,
      currency: offer.currency || "ILS",
      availableForSegments: offer.availableForSegments || [],
      isActive: offer.isActive ?? true,
    }).returning();
    return this.mapPartnerOffer(result[0]);
  }

  async updatePartnerOffer(id: string, updates: Partial<PartnerOffer>): Promise<PartnerOffer | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.titleKey !== undefined) updateData.titleKey = updates.titleKey;
    if (updates.descriptionKey !== undefined) updateData.descriptionKey = updates.descriptionKey;
    if (updates.price !== undefined) updateData.price = updates.price;
    if (updates.bonusPrice !== undefined) updateData.bonusPrice = updates.bonusPrice;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.availableForSegments !== undefined) updateData.availableForSegments = updates.availableForSegments;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    
    const result = await this.db.update(dbSchema.partnerOffers).set(updateData).where(eq(dbSchema.partnerOffers.id, id)).returning();
    if (!result[0]) return undefined;
    return this.mapPartnerOffer(result[0]);
  }

  async getOffersForSegments(segments: string[]): Promise<PartnerOffer[]> {
    const result = await this.db.select().from(dbSchema.partnerOffers).where(eq(dbSchema.partnerOffers.isActive, true));
    return result
      .filter(o => {
        const available = o.availableForSegments as string[];
        return available.length === 0 || available.some(s => segments.includes(s));
      })
      .map(o => this.mapPartnerOffer(o));
  }

  private mapPartnerOffer(row: typeof dbSchema.partnerOffers.$inferSelect): PartnerOffer {
    return {
      id: row.id,
      partnerId: row.partnerId,
      titleKey: row.titleKey,
      descriptionKey: row.descriptionKey,
      price: row.price,
      bonusPrice: row.bonusPrice,
      currency: row.currency,
      availableForSegments: row.availableForSegments as string[],
      isActive: row.isActive,
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async getOrderFinanceSnapshot(orderId: string): Promise<OrderFinanceSnapshot | undefined> {
    const result = await this.db.select().from(dbSchema.orderFinanceSnapshots)
      .where(eq(dbSchema.orderFinanceSnapshots.orderId, orderId)).limit(1);
    if (!result[0]) return undefined;
    return this.mapOrderFinanceSnapshot(result[0]);
  }

  async createOrderFinanceSnapshot(orderId: string, snapshot: InsertOrderFinanceSnapshot): Promise<OrderFinanceSnapshot> {
    const margin = snapshot.clientPrice - snapshot.courierPayout - snapshot.bonusSpent - snapshot.platformFee;
    const result = await this.db.insert(dbSchema.orderFinanceSnapshots).values({
      orderId,
      clientPrice: snapshot.clientPrice,
      courierPayout: snapshot.courierPayout,
      bonusSpent: snapshot.bonusSpent || 0,
      platformFee: snapshot.platformFee || 0,
      margin,
      currency: "ILS",
    }).returning();
    return this.mapOrderFinanceSnapshot(result[0]);
  }

  async updateOrderFinanceSnapshot(orderId: string, updates: Partial<InsertOrderFinanceSnapshot>): Promise<OrderFinanceSnapshot | undefined> {
    const existing = await this.getOrderFinanceSnapshot(orderId);
    if (!existing) return undefined;
    
    const updateData: Record<string, unknown> = {};
    if (updates.clientPrice !== undefined) updateData.clientPrice = updates.clientPrice;
    if (updates.courierPayout !== undefined) updateData.courierPayout = updates.courierPayout;
    if (updates.bonusSpent !== undefined) updateData.bonusSpent = updates.bonusSpent;
    if (updates.platformFee !== undefined) updateData.platformFee = updates.platformFee;
    
    const result = await this.db.update(dbSchema.orderFinanceSnapshots)
      .set(updateData)
      .where(eq(dbSchema.orderFinanceSnapshots.orderId, orderId))
      .returning();
    if (!result[0]) return undefined;
    return this.mapOrderFinanceSnapshot(result[0]);
  }

  private mapOrderFinanceSnapshot(row: typeof dbSchema.orderFinanceSnapshots.$inferSelect): OrderFinanceSnapshot {
    return {
      id: row.id,
      orderId: row.orderId,
      clientPrice: row.clientPrice,
      courierPayout: row.courierPayout,
      bonusSpent: row.bonusSpent,
      platformFee: row.platformFee,
      margin: row.margin,
      currency: row.currency,
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async getLevel(id: string): Promise<Level | undefined> {
    const result = await this.db.select().from(dbSchema.levels).where(eq(dbSchema.levels.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapLevel(result[0]);
  }

  async getLevelByCode(code: LevelCode): Promise<Level | undefined> {
    const result = await this.db.select().from(dbSchema.levels).where(eq(dbSchema.levels.code, code)).limit(1);
    if (!result[0]) return undefined;
    return this.mapLevel(result[0]);
  }

  async getLevels(): Promise<Level[]> {
    const result = await this.db.select().from(dbSchema.levels);
    return result.map(l => this.mapLevel(l));
  }

  async createLevel(level: InsertLevel): Promise<Level> {
    const result = await this.db.insert(dbSchema.levels).values({
      code: level.code,
      nameKey: level.nameKey,
      minPoints: level.minPoints,
      benefits: level.benefits || {},
    }).returning();
    return this.mapLevel(result[0]);
  }

  private mapLevel(row: typeof dbSchema.levels.$inferSelect): Level {
    return {
      id: row.id,
      code: row.code as LevelCode,
      nameKey: row.nameKey,
      minPoints: row.minPoints,
      benefits: row.benefits as Record<string, unknown>,
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async getUserLevel(userId: string): Promise<UserLevel | undefined> {
    const result = await this.db.select().from(dbSchema.userLevels)
      .where(and(eq(dbSchema.userLevels.userId, userId), eq(dbSchema.userLevels.current, true))).limit(1);
    if (!result[0]) return undefined;
    return {
      id: result[0].id,
      userId: result[0].userId,
      levelId: result[0].levelId,
      achievedAt: toISOStringRequired(result[0].achievedAt),
      current: result[0].current,
    };
  }

  async getUserLevelHistory(userId: string): Promise<UserLevel[]> {
    const result = await this.db.select().from(dbSchema.userLevels)
      .where(eq(dbSchema.userLevels.userId, userId))
      .orderBy(desc(dbSchema.userLevels.achievedAt));
    return result.map(l => ({
      id: l.id,
      userId: l.userId,
      levelId: l.levelId,
      achievedAt: toISOStringRequired(l.achievedAt),
      current: l.current,
    }));
  }

  async createUserLevel(userId: string, userLevel: InsertUserLevel): Promise<UserLevel> {
    await this.db.update(dbSchema.userLevels)
      .set({ current: false })
      .where(eq(dbSchema.userLevels.userId, userId));
    
    const result = await this.db.insert(dbSchema.userLevels).values({
      userId,
      levelId: userLevel.levelId,
      current: userLevel.current ?? true,
    }).returning();
    return {
      id: result[0].id,
      userId: result[0].userId,
      levelId: result[0].levelId,
      achievedAt: toISOStringRequired(result[0].achievedAt),
      current: result[0].current,
    };
  }

  async getUserProgress(userId: string): Promise<UserProgress> {
    const result = await this.db.select().from(dbSchema.userProgress).where(eq(dbSchema.userProgress.userId, userId)).limit(1);
    if (!result[0]) {
      const created = await this.db.insert(dbSchema.userProgress).values({ userId, totalPoints: 0 }).returning();
      return { userId: created[0].userId, totalPoints: created[0].totalPoints, updatedAt: toISOStringRequired(created[0].updatedAt) };
    }
    return { userId: result[0].userId, totalPoints: result[0].totalPoints, updatedAt: toISOStringRequired(result[0].updatedAt) };
  }

  async createProgressTransaction(userId: string, tx: InsertProgressTransaction): Promise<ProgressTransaction> {
    const progress = await this.getUserProgress(userId);
    const newPoints = progress.totalPoints + tx.points;
    
    await this.db.update(dbSchema.userProgress)
      .set({ totalPoints: newPoints, updatedAt: new Date() })
      .where(eq(dbSchema.userProgress.userId, userId));
    
    const result = await this.db.insert(dbSchema.progressTransactions).values({
      userId,
      points: tx.points,
      reason: tx.reason,
      referenceType: tx.referenceType || null,
      referenceId: tx.referenceId || null,
    }).returning();
    
    return {
      id: result[0].id,
      userId: result[0].userId,
      points: result[0].points,
      reason: result[0].reason as ProgressReason,
      referenceType: result[0].referenceType,
      referenceId: result[0].referenceId,
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getProgressTransactions(userId: string, filters?: { reason?: ProgressReason; from?: string; to?: string }): Promise<ProgressTransaction[]> {
    const conditions = [eq(dbSchema.progressTransactions.userId, userId)];
    if (filters?.reason) conditions.push(eq(dbSchema.progressTransactions.reason, filters.reason));
    
    const result = await this.db.select().from(dbSchema.progressTransactions)
      .where(and(...conditions))
      .orderBy(desc(dbSchema.progressTransactions.createdAt));
    return result.map(t => ({
      id: t.id,
      userId: t.userId,
      points: t.points,
      reason: t.reason as ProgressReason,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      createdAt: toISOStringRequired(t.createdAt),
    }));
  }

  async getUserStreak(userId: string, type: StreakType): Promise<UserStreak | undefined> {
    const result = await this.db.select().from(dbSchema.userStreaks)
      .where(and(eq(dbSchema.userStreaks.userId, userId), eq(dbSchema.userStreaks.type, type))).limit(1);
    if (!result[0]) return undefined;
    return {
      userId: result[0].userId,
      type: result[0].type as StreakType,
      currentCount: result[0].currentCount,
      maxCount: result[0].maxCount,
      lastActionDate: toISOStringRequired(result[0].lastActionDate),
    };
  }

  async getUserStreaks(userId: string): Promise<UserStreak[]> {
    const result = await this.db.select().from(dbSchema.userStreaks).where(eq(dbSchema.userStreaks.userId, userId));
    return result.map(s => ({
      userId: s.userId,
      type: s.type as StreakType,
      currentCount: s.currentCount,
      maxCount: s.maxCount,
      lastActionDate: toISOStringRequired(s.lastActionDate),
    }));
  }

  async updateStreak(userId: string, type: StreakType, updates: UpdateStreak): Promise<UserStreak> {
    const existing = await this.getUserStreak(userId, type);
    if (!existing) {
      const result = await this.db.insert(dbSchema.userStreaks).values({
        userId,
        type,
        currentCount: updates.currentCount || 0,
        maxCount: updates.maxCount || 0,
        lastActionDate: updates.lastActionDate ? new Date(updates.lastActionDate) : new Date(),
      }).returning();
      return {
        userId: result[0].userId,
        type: result[0].type as StreakType,
        currentCount: result[0].currentCount,
        maxCount: result[0].maxCount,
        lastActionDate: toISOStringRequired(result[0].lastActionDate),
      };
    }
    
    const updateData: Record<string, unknown> = {};
    if (updates.currentCount !== undefined) updateData.currentCount = updates.currentCount;
    if (updates.maxCount !== undefined) updateData.maxCount = updates.maxCount;
    if (updates.lastActionDate !== undefined) updateData.lastActionDate = new Date(updates.lastActionDate);
    
    const result = await this.db.update(dbSchema.userStreaks)
      .set(updateData)
      .where(and(eq(dbSchema.userStreaks.userId, userId), eq(dbSchema.userStreaks.type, type)))
      .returning();
    return {
      userId: result[0].userId,
      type: result[0].type as StreakType,
      currentCount: result[0].currentCount,
      maxCount: result[0].maxCount,
      lastActionDate: toISOStringRequired(result[0].lastActionDate),
    };
  }

  async incrementStreak(userId: string, type: StreakType): Promise<UserStreak> {
    const existing = await this.getUserStreak(userId, type);
    const newCount = (existing?.currentCount || 0) + 1;
    const newMax = Math.max(existing?.maxCount || 0, newCount);
    return this.updateStreak(userId, type, { currentCount: newCount, maxCount: newMax, lastActionDate: new Date().toISOString() });
  }

  async resetStreak(userId: string, type: StreakType): Promise<UserStreak> {
    return this.updateStreak(userId, type, { currentCount: 0, lastActionDate: new Date().toISOString() });
  }

  async getFeature(id: string): Promise<Feature | undefined> {
    const result = await this.db.select().from(dbSchema.features).where(eq(dbSchema.features.id, id)).limit(1);
    if (!result[0]) return undefined;
    return { id: result[0].id, code: result[0].code as FeatureCode, descriptionKey: result[0].descriptionKey, createdAt: toISOStringRequired(result[0].createdAt) };
  }

  async getFeatureByCode(code: FeatureCode): Promise<Feature | undefined> {
    const result = await this.db.select().from(dbSchema.features).where(eq(dbSchema.features.code, code)).limit(1);
    if (!result[0]) return undefined;
    return { id: result[0].id, code: result[0].code as FeatureCode, descriptionKey: result[0].descriptionKey, createdAt: toISOStringRequired(result[0].createdAt) };
  }

  async getFeatures(): Promise<Feature[]> {
    const result = await this.db.select().from(dbSchema.features);
    return result.map(f => ({ id: f.id, code: f.code as FeatureCode, descriptionKey: f.descriptionKey, createdAt: toISOStringRequired(f.createdAt) }));
  }

  async createFeature(feature: InsertFeature): Promise<Feature> {
    const result = await this.db.insert(dbSchema.features).values({
      code: feature.code,
      descriptionKey: feature.descriptionKey,
    }).returning();
    return { id: result[0].id, code: result[0].code as FeatureCode, descriptionKey: result[0].descriptionKey, createdAt: toISOStringRequired(result[0].createdAt) };
  }

  async getUserFeatureAccess(userId: string): Promise<UserFeatureAccess[]> {
    const result = await this.db.select().from(dbSchema.userFeatureAccess).where(eq(dbSchema.userFeatureAccess.userId, userId));
    return result.map(a => ({
      id: a.id,
      userId: a.userId,
      featureId: a.featureId,
      grantedBy: a.grantedBy as UserFeatureAccess["grantedBy"],
      expiresAt: toISOString(a.expiresAt),
      createdAt: toISOStringRequired(a.createdAt),
    }));
  }

  async getUserFeatureAccessByCode(userId: string, featureCode: FeatureCode): Promise<UserFeatureAccess | undefined> {
    const feature = await this.getFeatureByCode(featureCode);
    if (!feature) return undefined;
    const result = await this.db.select().from(dbSchema.userFeatureAccess)
      .where(and(eq(dbSchema.userFeatureAccess.userId, userId), eq(dbSchema.userFeatureAccess.featureId, feature.id))).limit(1);
    if (!result[0]) return undefined;
    return {
      id: result[0].id,
      userId: result[0].userId,
      featureId: result[0].featureId,
      grantedBy: result[0].grantedBy as UserFeatureAccess["grantedBy"],
      expiresAt: toISOString(result[0].expiresAt),
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async grantUserFeatureAccess(userId: string, access: InsertUserFeatureAccess): Promise<UserFeatureAccess> {
    const result = await this.db.insert(dbSchema.userFeatureAccess).values({
      userId,
      featureId: access.featureId,
      grantedBy: access.grantedBy,
      expiresAt: access.expiresAt ? new Date(access.expiresAt) : null,
    }).returning();
    return {
      id: result[0].id,
      userId: result[0].userId,
      featureId: result[0].featureId,
      grantedBy: result[0].grantedBy as UserFeatureAccess["grantedBy"],
      expiresAt: toISOString(result[0].expiresAt),
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async revokeUserFeatureAccess(userId: string, featureId: string): Promise<boolean> {
    const result = await this.db.delete(dbSchema.userFeatureAccess)
      .where(and(eq(dbSchema.userFeatureAccess.userId, userId), eq(dbSchema.userFeatureAccess.featureId, featureId))).returning();
    return result.length > 0;
  }

  async getWebhook(id: string): Promise<Webhook | undefined> {
    const result = await this.db.select().from(dbSchema.webhooks).where(eq(dbSchema.webhooks.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapWebhook(result[0]);
  }

  async getWebhooks(partnerId?: string): Promise<Webhook[]> {
    const conditions = partnerId ? [eq(dbSchema.webhooks.partnerId, partnerId)] : [];
    const result = await this.db.select().from(dbSchema.webhooks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    return result.map(w => this.mapWebhook(w));
  }

  async getWebhooksByEvent(event: WebhookEventType): Promise<Webhook[]> {
    const result = await this.db.select().from(dbSchema.webhooks).where(eq(dbSchema.webhooks.status, "active"));
    return result
      .filter(w => (w.events as string[]).includes(event))
      .map(w => this.mapWebhook(w));
  }

  async getWebhooksByPartner(partnerId: string): Promise<Webhook[]> {
    const result = await this.db.select().from(dbSchema.webhooks).where(eq(dbSchema.webhooks.partnerId, partnerId));
    return result.map(w => this.mapWebhook(w));
  }

  async createWebhook(partnerId: string, webhook: InsertWebhook): Promise<Webhook> {
    const secret = randomUUID();
    const result = await this.db.insert(dbSchema.webhooks).values({
      partnerId,
      url: webhook.url,
      secret,
      events: webhook.events,
      status: "active",
      failCount: 0,
    }).returning();
    return this.mapWebhook(result[0]);
  }

  async updateWebhook(id: string, updates: Partial<Webhook>): Promise<Webhook | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.url !== undefined) updateData.url = updates.url;
    if (updates.events !== undefined) updateData.events = updates.events;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.failCount !== undefined) updateData.failCount = updates.failCount;
    if (updates.lastTriggeredAt !== undefined && updates.lastTriggeredAt !== null) updateData.lastTriggeredAt = new Date(updates.lastTriggeredAt);
    
    const result = await this.db.update(dbSchema.webhooks).set(updateData).where(eq(dbSchema.webhooks.id, id)).returning();
    if (!result[0]) return undefined;
    return this.mapWebhook(result[0]);
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const result = await this.db.delete(dbSchema.webhooks).where(eq(dbSchema.webhooks.id, id)).returning();
    return result.length > 0;
  }

  private mapWebhook(row: typeof dbSchema.webhooks.$inferSelect): Webhook {
    return {
      id: row.id,
      partnerId: row.partnerId,
      url: row.url,
      secret: row.secret,
      events: row.events as WebhookEventType[],
      status: row.status as WebhookStatus,
      failCount: row.failCount,
      lastTriggeredAt: toISOString(row.lastTriggeredAt),
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async createWebhookDelivery(webhookId: string, eventType: WebhookEventType, payload: Record<string, unknown>): Promise<WebhookDelivery> {
    const result = await this.db.insert(dbSchema.webhookDeliveries).values({
      webhookId,
      eventType,
      payload,
      attempts: 0,
    }).returning();
    return {
      id: result[0].id,
      webhookId: result[0].webhookId,
      eventType: result[0].eventType as WebhookEventType,
      payload: result[0].payload as Record<string, unknown>,
      statusCode: result[0].statusCode,
      response: result[0].response,
      attempts: result[0].attempts,
      deliveredAt: toISOString(result[0].deliveredAt),
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async updateWebhookDelivery(id: string, updates: Partial<WebhookDelivery>): Promise<WebhookDelivery | undefined> {
    const updateData: Record<string, unknown> = {};
    if (updates.statusCode !== undefined) updateData.statusCode = updates.statusCode;
    if (updates.response !== undefined) updateData.response = updates.response;
    if (updates.attempts !== undefined) updateData.attempts = updates.attempts;
    if (updates.deliveredAt !== undefined && updates.deliveredAt !== null) updateData.deliveredAt = new Date(updates.deliveredAt);
    
    const result = await this.db.update(dbSchema.webhookDeliveries).set(updateData).where(eq(dbSchema.webhookDeliveries.id, id)).returning();
    if (!result[0]) return undefined;
    return {
      id: result[0].id,
      webhookId: result[0].webhookId,
      eventType: result[0].eventType as WebhookEventType,
      payload: result[0].payload as Record<string, unknown>,
      statusCode: result[0].statusCode,
      response: result[0].response,
      attempts: result[0].attempts,
      deliveredAt: toISOString(result[0].deliveredAt),
      createdAt: toISOStringRequired(result[0].createdAt),
    };
  }

  async getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    const result = await this.db.select().from(dbSchema.webhookDeliveries)
      .where(eq(dbSchema.webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(dbSchema.webhookDeliveries.createdAt));
    return result.map(d => ({
      id: d.id,
      webhookId: d.webhookId,
      eventType: d.eventType as WebhookEventType,
      payload: d.payload as Record<string, unknown>,
      statusCode: d.statusCode,
      response: d.response,
      attempts: d.attempts,
      deliveredAt: toISOString(d.deliveredAt),
      createdAt: toISOStringRequired(d.createdAt),
    }));
  }

  async getFeatureFlag(id: string): Promise<FeatureFlag | undefined> {
    const result = await this.db.select().from(dbSchema.featureFlags).where(eq(dbSchema.featureFlags.id, id)).limit(1);
    if (!result[0]) return undefined;
    return this.mapFeatureFlag(result[0]);
  }

  async getFeatureFlagByKey(key: SystemFeatureFlag): Promise<FeatureFlag | undefined> {
    const result = await this.db.select().from(dbSchema.featureFlags).where(eq(dbSchema.featureFlags.key, key)).limit(1);
    if (!result[0]) return undefined;
    return this.mapFeatureFlag(result[0]);
  }

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    const result = await this.db.select().from(dbSchema.featureFlags);
    return result.map(f => this.mapFeatureFlag(f));
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return this.getFeatureFlags();
  }

  async createFeatureFlag(flag: InsertFeatureFlag): Promise<FeatureFlag> {
    const result = await this.db.insert(dbSchema.featureFlags).values({
      key: flag.key,
      enabled: flag.enabled ?? false,
      rolloutPercentage: flag.rolloutPercentage ?? 0,
      targetUserTypes: flag.targetUserTypes || [],
      metadata: flag.metadata || {},
    }).returning();
    return this.mapFeatureFlag(result[0]);
  }

  async updateFeatureFlag(id: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.enabled !== undefined) updateData.enabled = updates.enabled;
    if (updates.rolloutPercentage !== undefined) updateData.rolloutPercentage = updates.rolloutPercentage;
    if (updates.targetUserTypes !== undefined) updateData.targetUserTypes = updates.targetUserTypes;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    
    const result = await this.db.update(dbSchema.featureFlags).set(updateData).where(eq(dbSchema.featureFlags.id, id)).returning();
    if (!result[0]) return undefined;
    return this.mapFeatureFlag(result[0]);
  }

  async deleteFeatureFlag(id: string): Promise<boolean> {
    const result = await this.db.delete(dbSchema.featureFlags).where(eq(dbSchema.featureFlags.id, id)).returning();
    return result.length > 0;
  }

  async isFeatureEnabled(key: SystemFeatureFlag, userType?: UserType): Promise<boolean> {
    const flag = await this.getFeatureFlagByKey(key);
    if (!flag) return false;
    if (!flag.enabled) return false;
    if (flag.targetUserTypes && flag.targetUserTypes.length > 0 && userType) {
      if (!flag.targetUserTypes.includes(userType)) return false;
    }
    if (flag.rolloutPercentage < 100) {
      return Math.random() * 100 < flag.rolloutPercentage;
    }
    return true;
  }

  private mapFeatureFlag(row: typeof dbSchema.featureFlags.$inferSelect): FeatureFlag {
    return {
      id: row.id,
      key: row.key as SystemFeatureFlag,
      enabled: row.enabled,
      rolloutPercentage: row.rolloutPercentage,
      targetUserTypes: row.targetUserTypes as FeatureFlag["targetUserTypes"],
      metadata: row.metadata as Record<string, unknown>,
      updatedAt: toISOStringRequired(row.updatedAt),
      createdAt: toISOStringRequired(row.createdAt),
    };
  }

  async getIdempotencyRecord(key: string, userId: string, endpoint: string): Promise<IdempotencyRecord | undefined> {
    const result = await this.db.select().from(dbSchema.idempotencyRecords)
      .where(eq(dbSchema.idempotencyRecords.key, key)).limit(1);
    if (!result[0]) return undefined;
    if (new Date(result[0].expiresAt) < new Date()) {
      await this.db.delete(dbSchema.idempotencyRecords).where(eq(dbSchema.idempotencyRecords.key, key));
      return undefined;
    }
    return {
      key: result[0].key,
      userId: result[0].userId,
      endpoint: result[0].endpoint,
      statusCode: result[0].statusCode,
      response: result[0].response,
      createdAt: toISOStringRequired(result[0].createdAt),
      expiresAt: toISOStringRequired(result[0].expiresAt),
    };
  }

  async setIdempotencyRecord(record: IdempotencyRecord): Promise<void> {
    await this.db.insert(dbSchema.idempotencyRecords).values({
      key: record.key,
      userId: record.userId,
      endpoint: record.endpoint,
      statusCode: record.statusCode,
      response: record.response,
      createdAt: new Date(record.createdAt),
      expiresAt: new Date(record.expiresAt),
    }).onConflictDoNothing();
  }

  async initializeDefaultRolesAndPermissions(): Promise<void> {
    const { defaultPermissions, defaultRoles } = await import("@shared/schema");
    
    for (const permName of defaultPermissions) {
      const existing = await this.db.select().from(dbSchema.permissions).where(eq(dbSchema.permissions.name, permName)).limit(1);
      if (!existing[0]) {
        await this.db.insert(dbSchema.permissions).values({ name: permName, description: null });
      }
    }
    
    for (const roleData of defaultRoles) {
      let role = await this.getRoleByName(roleData.name);
      if (!role) {
        role = await this.createRole({ name: roleData.name, description: null });
      }
      
      for (const permName of roleData.permissions) {
        const perm = await this.db.select().from(dbSchema.permissions).where(eq(dbSchema.permissions.name, permName)).limit(1);
        if (perm[0]) {
          await this.addRolePermission(role.id, perm[0].id);
        }
      }
    }
  }

  async hasFeatureAccess(userId: string, featureCode: FeatureCode): Promise<boolean> {
    const access = await this.getUserFeatureAccessByCode(userId, featureCode);
    if (!access) return false;
    if (access.expiresAt && new Date(access.expiresAt) < new Date()) return false;
    return true;
  }

  async grantFeatureAccess(userId: string, access: InsertUserFeatureAccess): Promise<UserFeatureAccess> {
    return this.grantUserFeatureAccess(userId, access);
  }

  async revokeFeatureAccess(userId: string, featureId: string): Promise<boolean> {
    return this.revokeUserFeatureAccess(userId, featureId);
  }

  async initDefaults(): Promise<void> {
    await this.initializeDefaultRolesAndPermissions();
  }
}
