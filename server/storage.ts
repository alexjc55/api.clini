import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getCurrentEnvironment } from "./environment-context";
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
  FeatureFlag, InsertFeatureFlag, SystemFeatureFlag
} from "@shared/schema";
import { userActivityTypes } from "@shared/schema";
import { IStorage } from "./repositories";

export type { IStorage };

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();
  private rolePermissions: Map<string, Set<string>> = new Map();
  private userRoles: Map<string, Set<string>> = new Map();
  private addresses: Map<string, Address> = new Map();
  private courierProfiles: Map<string, CourierProfile> = new Map();
  
  private productionOrders: Map<string, Order> = new Map();
  private sandboxOrders: Map<string, Order> = new Map();
  private productionOrderEvents: Map<string, OrderEvent[]> = new Map();
  private sandboxOrderEvents: Map<string, OrderEvent[]> = new Map();
  
  private get orders(): Map<string, Order> {
    return getCurrentEnvironment() === "sandbox" ? this.sandboxOrders : this.productionOrders;
  }
  
  private get orderEvents(): Map<string, OrderEvent[]> {
    return getCurrentEnvironment() === "sandbox" ? this.sandboxOrderEvents : this.productionOrderEvents;
  }
  private auditLogs: AuditLog[] = [];
  private sessions: Map<string, Session> = new Map();
  
  // V2 Storage
  private events: Map<string, Event> = new Map();
  private userActivities: Map<string, UserActivity[]> = new Map();
  private userFlags: Map<string, Map<UserFlagKey, UserFlag>> = new Map();
  
  private productionBonusAccounts: Map<string, BonusAccount> = new Map();
  private sandboxBonusAccounts: Map<string, BonusAccount> = new Map();
  private productionBonusTransactions: Map<string, BonusTransaction[]> = new Map();
  private sandboxBonusTransactions: Map<string, BonusTransaction[]> = new Map();
  private productionSubscriptions: Map<string, Subscription> = new Map();
  private sandboxSubscriptions: Map<string, Subscription> = new Map();
  private productionSubscriptionRules: Map<string, SubscriptionRule[]> = new Map();
  private sandboxSubscriptionRules: Map<string, SubscriptionRule[]> = new Map();
  
  private get bonusAccounts(): Map<string, BonusAccount> {
    return getCurrentEnvironment() === "sandbox" ? this.sandboxBonusAccounts : this.productionBonusAccounts;
  }
  
  private get bonusTransactions(): Map<string, BonusTransaction[]> {
    return getCurrentEnvironment() === "sandbox" ? this.sandboxBonusTransactions : this.productionBonusTransactions;
  }
  
  private get subscriptions(): Map<string, Subscription> {
    return getCurrentEnvironment() === "sandbox" ? this.sandboxSubscriptions : this.productionSubscriptions;
  }
  
  private get subscriptionRules(): Map<string, SubscriptionRule[]> {
    return getCurrentEnvironment() === "sandbox" ? this.sandboxSubscriptionRules : this.productionSubscriptionRules;
  }
  private subscriptionPlans: Map<string, SubscriptionPlan> = new Map();
  private partners: Map<string, Partner> = new Map();
  private partnerOffers: Map<string, PartnerOffer[]> = new Map();
  private orderFinanceSnapshots: Map<string, OrderFinanceSnapshot> = new Map();
  
  // Gamification Storage
  private levels: Map<string, Level> = new Map();
  private userLevels: Map<string, UserLevel[]> = new Map();
  private userProgress: Map<string, UserProgress> = new Map();
  private progressTransactions: Map<string, ProgressTransaction[]> = new Map();
  private userStreaks: Map<string, Map<StreakType, UserStreak>> = new Map();
  private features: Map<string, Feature> = new Map();
  private userFeatureAccess: Map<string, UserFeatureAccess[]> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByPhone(phone: string, includeDeleted = false): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => 
      u.phone === phone && (includeDeleted || !u.deletedAt)
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      type: insertUser.type,
      phone: insertUser.phone,
      email: insertUser.email || null,
      passwordHash: await hashPassword(insertUser.password),
      status: "active",
      createdAt: new Date().toISOString(),
      deletedAt: null
    };
    this.users.set(id, user);

    if (insertUser.type === "courier") {
      await this.createCourierProfile(id);
    }

    if (insertUser.type === "staff") {
      const adminRole = await this.getRoleByName("admin");
      if (adminRole) {
        await this.addUserRole(id, adminRole.id);
      }
    }

    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async softDeleteUser(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    user.deletedAt = new Date().toISOString();
    this.users.set(id, user);
    return user;
  }

  async getUsers(filters?: { type?: UserType; status?: UserStatus; includeDeleted?: boolean }): Promise<User[]> {
    let users = Array.from(this.users.values());
    if (!filters?.includeDeleted) {
      users = users.filter(u => !u.deletedAt);
    }
    if (filters?.type) users = users.filter(u => u.type === filters.type);
    if (filters?.status) users = users.filter(u => u.status === filters.status);
    return users;
  }

  async verifyUserPassword(phone: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByPhone(phone);
    if (!user) return undefined;
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return undefined;
    return user;
  }

  async getRole(id: string): Promise<Role | undefined> {
    return this.roles.get(id);
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    return Array.from(this.roles.values()).find(r => r.name === name);
  }

  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  async createRole(role: InsertRole): Promise<Role> {
    const id = randomUUID();
    const newRole: Role = { id, name: role.name, description: role.description || null };
    this.roles.set(id, newRole);
    this.rolePermissions.set(id, new Set());
    return newRole;
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    return this.permissions.get(id);
  }

  async getPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values());
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const id = randomUUID();
    const newPermission: Permission = { id, name: permission.name, description: permission.description || null };
    this.permissions.set(id, newPermission);
    return newPermission;
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const permIds = this.rolePermissions.get(roleId);
    if (!permIds) return [];
    return Array.from(permIds).map(id => this.permissions.get(id)).filter(Boolean) as Permission[];
  }

  async addRolePermission(roleId: string, permissionId: string): Promise<void> {
    if (!this.rolePermissions.has(roleId)) {
      this.rolePermissions.set(roleId, new Set());
    }
    this.rolePermissions.get(roleId)!.add(permissionId);
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const roleIds = this.userRoles.get(userId);
    if (!roleIds) return [];
    return Array.from(roleIds).map(id => this.roles.get(id)).filter(Boolean) as Role[];
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
    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, new Set());
    }
    this.userRoles.get(userId)!.add(roleId);
  }

  async setUserRoles(userId: string, roleIds: string[]): Promise<void> {
    this.userRoles.set(userId, new Set(roleIds));
  }

  async getAddress(id: string, includeDeleted = false): Promise<Address | undefined> {
    const address = this.addresses.get(id);
    if (!address) return undefined;
    if (!includeDeleted && address.deletedAt) return undefined;
    return address;
  }

  async getAddressesByUser(userId: string, includeDeleted = false): Promise<Address[]> {
    let addresses = Array.from(this.addresses.values()).filter(a => a.userId === userId);
    if (!includeDeleted) {
      addresses = addresses.filter(a => !a.deletedAt);
    }
    return addresses;
  }

  async createAddress(userId: string, address: InsertAddress): Promise<Address> {
    const id = randomUUID();
    const newAddress: Address = {
      id,
      userId,
      city: address.city,
      street: address.street,
      house: address.house,
      apartment: address.apartment || null,
      floor: address.floor || null,
      hasElevator: address.hasElevator || false,
      comment: address.comment || null,
      deletedAt: null
    };
    this.addresses.set(id, newAddress);
    return newAddress;
  }

  async updateAddress(id: string, updates: Partial<Address>): Promise<Address | undefined> {
    const address = this.addresses.get(id);
    if (!address || address.deletedAt) return undefined;
    const updated = { ...address, ...updates };
    this.addresses.set(id, updated);
    return updated;
  }

  async softDeleteAddress(id: string): Promise<Address | undefined> {
    const address = this.addresses.get(id);
    if (!address) return undefined;
    address.deletedAt = new Date().toISOString();
    this.addresses.set(id, address);
    return address;
  }

  async getCourierProfile(courierId: string, includeDeleted = false): Promise<CourierProfile | undefined> {
    const profile = this.courierProfiles.get(courierId);
    if (!profile) return undefined;
    if (!includeDeleted && profile.deletedAt) return undefined;
    return profile;
  }

  async getCouriers(includeDeleted = false): Promise<CourierProfile[]> {
    let profiles = Array.from(this.courierProfiles.values());
    if (!includeDeleted) {
      profiles = profiles.filter(p => !p.deletedAt);
    }
    return profiles;
  }

  async createCourierProfile(courierId: string): Promise<CourierProfile> {
    const profile: CourierProfile = {
      courierId,
      availabilityStatus: "offline",
      rating: 0,
      completedOrdersCount: 0,
      verificationStatus: "pending",
      deletedAt: null
    };
    this.courierProfiles.set(courierId, profile);
    return profile;
  }

  async updateCourierProfile(courierId: string, updates: UpdateCourierProfile): Promise<CourierProfile | undefined> {
    const profile = this.courierProfiles.get(courierId);
    if (!profile || profile.deletedAt) return undefined;
    const updated = { ...profile, ...updates };
    this.courierProfiles.set(courierId, updated);
    return updated;
  }

  async updateCourierVerification(courierId: string, status: "verified" | "rejected"): Promise<CourierProfile | undefined> {
    const profile = this.courierProfiles.get(courierId);
    if (!profile) return undefined;
    profile.verificationStatus = status;
    this.courierProfiles.set(courierId, profile);
    return profile;
  }

  async softDeleteCourier(courierId: string): Promise<CourierProfile | undefined> {
    const profile = this.courierProfiles.get(courierId);
    if (!profile) return undefined;
    profile.deletedAt = new Date().toISOString();
    this.courierProfiles.set(courierId, profile);
    return profile;
  }

  async incrementCourierOrders(courierId: string): Promise<void> {
    const profile = this.courierProfiles.get(courierId);
    if (profile && !profile.deletedAt) {
      profile.completedOrdersCount++;
      this.courierProfiles.set(courierId, profile);
    }
  }

  async getOrder(id: string, includeDeleted = false): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    if (!includeDeleted && order.deletedAt) return undefined;
    return order;
  }

  async getOrders(filters?: { clientId?: string; courierId?: string; status?: OrderStatus; includeDeleted?: boolean }): Promise<Order[]> {
    let orders = Array.from(this.orders.values());
    if (!filters?.includeDeleted) {
      orders = orders.filter(o => !o.deletedAt);
    }
    if (filters?.clientId) orders = orders.filter(o => o.clientId === filters.clientId);
    if (filters?.courierId) orders = orders.filter(o => o.courierId === filters.courierId);
    if (filters?.status) orders = orders.filter(o => o.status === filters.status);
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createOrder(clientId: string, order: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const newOrder: Order = {
      id,
      clientId,
      courierId: null,
      addressId: order.addressId,
      scheduledAt: order.scheduledAt,
      timeWindow: order.timeWindow,
      status: "created",
      price: order.price || 500,
      createdAt: new Date().toISOString(),
      completedAt: null,
      deletedAt: null
    };
    this.orders.set(id, newOrder);
    this.orderEvents.set(id, []);

    await this.createOrderEvent(clientId, {
      orderId: id,
      eventType: "created",
      metadata: { price: newOrder.price }
    });

    return newOrder;
  }

  async updateOrder(id: string, updates: UpdateOrder, performedBy: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    const oldStatus = order.status;
    const updated: Order = { ...order };

    if (updates.status) {
      updated.status = updates.status;
      if (updates.status === "completed") {
        updated.completedAt = new Date().toISOString();
        if (order.courierId) {
          await this.incrementCourierOrders(order.courierId);
        }
      }
    }
    if (updates.courierId !== undefined) updated.courierId = updates.courierId;
    if (updates.scheduledAt) updated.scheduledAt = updates.scheduledAt;
    if (updates.timeWindow) updated.timeWindow = updates.timeWindow;
    if (updates.price) updated.price = updates.price;

    this.orders.set(id, updated);

    if (updates.status && updates.status !== oldStatus) {
      await this.createOrderEvent(performedBy, {
        orderId: id,
        eventType: "status_changed",
        metadata: { from: oldStatus, to: updates.status }
      });
    }

    return updated;
  }

  async assignCourier(orderId: string, courierId: string, performedBy: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order || order.deletedAt) return undefined;
    
    order.courierId = courierId;
    order.status = "assigned";
    this.orders.set(orderId, order);

    await this.createOrderEvent(performedBy, {
      orderId,
      eventType: "assigned",
      metadata: { courierId }
    });

    return order;
  }

  async softDeleteOrder(orderId: string): Promise<Order | undefined> {
    const order = this.orders.get(orderId);
    if (!order) return undefined;
    order.deletedAt = new Date().toISOString();
    this.orders.set(orderId, order);
    return order;
  }

  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    return this.orderEvents.get(orderId) || [];
  }

  async createOrderEvent(performedBy: string, event: InsertOrderEvent): Promise<OrderEvent> {
    const id = randomUUID();
    const newEvent: OrderEvent = {
      id,
      orderId: event.orderId,
      eventType: event.eventType,
      performedBy,
      metadata: event.metadata || {},
      createdAt: new Date().toISOString()
    };
    
    if (!this.orderEvents.has(event.orderId)) {
      this.orderEvents.set(event.orderId, []);
    }
    this.orderEvents.get(event.orderId)!.push(newEvent);
    
    return newEvent;
  }

  async createAuditLog(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: randomUUID(),
      ...log,
      createdAt: new Date().toISOString()
    };
    this.auditLogs.push(auditLog);
    return auditLog;
  }

  async getAuditLogs(filters?: { userId?: string; entity?: string; entityId?: string; action?: string }): Promise<AuditLog[]> {
    let logs = [...this.auditLogs];
    if (filters?.userId) logs = logs.filter(l => l.userId === filters.userId);
    if (filters?.entity) logs = logs.filter(l => l.entity === filters.entity);
    if (filters?.entityId) logs = logs.filter(l => l.entityId === filters.entityId);
    if (filters?.action) logs = logs.filter(l => l.action === filters.action);
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createSession(userId: string, refreshToken: string, deviceId: string, platform: "ios" | "android" | "web", userAgent: string | null, clientId?: string, clientType?: "mobile_client" | "courier_app" | "erp" | "partner" | "web"): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      userId,
      refreshToken,
      deviceId,
      platform,
      userAgent,
      clientId: clientId || null,
      clientType: clientType || null,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSession(refreshToken: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.refreshToken === refreshToken);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  async updateSessionLastSeen(sessionId: string, clientId?: string, clientType?: "mobile_client" | "courier_app" | "erp" | "partner" | "web"): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastSeenAt = new Date().toISOString();
      if (clientId) session.clientId = clientId;
      if (clientType) session.clientType = clientType;
      this.sessions.set(sessionId, session);
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const entries = Array.from(this.sessions.entries());
    for (const [id, session] of entries) {
      if (session.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }

  // ==================== V2 IMPLEMENTATIONS ====================

  // Events
  async createEvent(event: InsertEvent): Promise<Event> {
    const newEvent: Event = {
      id: randomUUID(),
      type: event.type,
      actorType: event.actorType,
      actorId: event.actorId || null,
      entityType: event.entityType || null,
      entityId: event.entityId || null,
      payload: event.payload || {},
      createdAt: new Date().toISOString()
    };
    this.events.set(newEvent.id, newEvent);
    return newEvent;
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEvents(filters?: { type?: ProductEventType; actorType?: EventActorType; actorId?: string; entityType?: string; entityId?: string; from?: string; to?: string }): Promise<Event[]> {
    let events = Array.from(this.events.values());
    if (filters?.type) events = events.filter(e => e.type === filters.type);
    if (filters?.actorType) events = events.filter(e => e.actorType === filters.actorType);
    if (filters?.actorId) events = events.filter(e => e.actorId === filters.actorId);
    if (filters?.entityType) events = events.filter(e => e.entityType === filters.entityType);
    if (filters?.entityId) events = events.filter(e => e.entityId === filters.entityId);
    if (filters?.from) events = events.filter(e => new Date(e.createdAt) >= new Date(filters.from!));
    if (filters?.to) events = events.filter(e => new Date(e.createdAt) <= new Date(filters.to!));
    return events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // User Activity
  async createUserActivity(userId: string, activity: InsertUserActivity): Promise<UserActivity> {
    const newActivity: UserActivity = {
      id: randomUUID(),
      userId,
      eventType: activity.eventType,
      referenceType: activity.referenceType || null,
      referenceId: activity.referenceId || null,
      metadata: activity.metadata || {},
      createdAt: new Date().toISOString()
    };
    if (!this.userActivities.has(userId)) {
      this.userActivities.set(userId, []);
    }
    this.userActivities.get(userId)!.push(newActivity);
    return newActivity;
  }

  async getUserActivities(userId: string, filters?: { eventType?: UserActivityType; from?: string; to?: string }): Promise<UserActivity[]> {
    let activities = this.userActivities.get(userId) || [];
    if (filters?.eventType) activities = activities.filter(a => a.eventType === filters.eventType);
    if (filters?.from) activities = activities.filter(a => new Date(a.createdAt) >= new Date(filters.from!));
    if (filters?.to) activities = activities.filter(a => new Date(a.createdAt) <= new Date(filters.to!));
    return activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUserActivitySummary(userId: string): Promise<Record<UserActivityType, number>> {
    const activities = this.userActivities.get(userId) || [];
    const summary: Record<string, number> = {};
    for (const type of userActivityTypes) {
      summary[type] = activities.filter(a => a.eventType === type).length;
    }
    return summary as Record<UserActivityType, number>;
  }

  // User Flags
  async getUserFlags(userId: string): Promise<UserFlag[]> {
    const flags = this.userFlags.get(userId);
    if (!flags) return [];
    return Array.from(flags.values());
  }

  async getUserFlag(userId: string, key: UserFlagKey): Promise<UserFlag | undefined> {
    return this.userFlags.get(userId)?.get(key);
  }

  async setUserFlag(userId: string, flag: InsertUserFlag): Promise<UserFlag> {
    if (!this.userFlags.has(userId)) {
      this.userFlags.set(userId, new Map());
    }
    const existing = this.userFlags.get(userId)!.get(flag.key);
    const userFlag: UserFlag = {
      id: existing?.id || randomUUID(),
      userId,
      key: flag.key,
      value: flag.value ?? true,
      source: flag.source || "manual",
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    this.userFlags.get(userId)!.set(flag.key, userFlag);
    return userFlag;
  }

  async deleteUserFlag(userId: string, key: UserFlagKey): Promise<boolean> {
    return this.userFlags.get(userId)?.delete(key) || false;
  }

  async getUsersByFlag(key: UserFlagKey, value = true): Promise<string[]> {
    const userIds: string[] = [];
    const entries = Array.from(this.userFlags.entries());
    for (const [userId, flags] of entries) {
      const flag = flags.get(key);
      if (flag && flag.value === value) {
        userIds.push(userId);
      }
    }
    return userIds;
  }

  // Bonus System
  async getBonusAccount(userId: string): Promise<BonusAccount> {
    let account = this.bonusAccounts.get(userId);
    if (!account) {
      account = { userId, balance: 0, updatedAt: new Date().toISOString() };
      this.bonusAccounts.set(userId, account);
    }
    return account;
  }

  async createBonusTransaction(userId: string, transaction: InsertBonusTransaction): Promise<BonusTransaction> {
    const account = await this.getBonusAccount(userId);
    
    const newTransaction: BonusTransaction = {
      id: randomUUID(),
      userId,
      type: transaction.type,
      amount: transaction.amount,
      reason: transaction.reason,
      referenceType: transaction.referenceType || null,
      referenceId: transaction.referenceId || null,
      createdAt: new Date().toISOString()
    };

    // Update balance
    if (transaction.type === "earn") {
      account.balance += transaction.amount;
    } else if (transaction.type === "spend" || transaction.type === "expire") {
      account.balance -= transaction.amount;
    } else if (transaction.type === "adjust") {
      account.balance += transaction.amount; // Can be negative
    }
    account.updatedAt = new Date().toISOString();
    this.bonusAccounts.set(userId, account);

    if (!this.bonusTransactions.has(userId)) {
      this.bonusTransactions.set(userId, []);
    }
    this.bonusTransactions.get(userId)!.push(newTransaction);
    return newTransaction;
  }

  async getBonusTransactions(userId: string, filters?: { type?: BonusTransactionType; from?: string; to?: string }): Promise<BonusTransaction[]> {
    let transactions = this.bonusTransactions.get(userId) || [];
    if (filters?.type) transactions = transactions.filter(t => t.type === filters.type);
    if (filters?.from) transactions = transactions.filter(t => new Date(t.createdAt) >= new Date(filters.from!));
    if (filters?.to) transactions = transactions.filter(t => new Date(t.createdAt) <= new Date(filters.to!));
    return transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Subscriptions
  async getSubscription(id: string): Promise<Subscription | undefined> {
    return this.subscriptions.get(id);
  }

  async getSubscriptionsByUser(userId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values()).filter(s => s.userId === userId);
  }

  async createSubscription(userId: string, subscription: InsertSubscription): Promise<Subscription> {
    const newSubscription: Subscription = {
      id: randomUUID(),
      userId,
      planId: subscription.planId,
      status: "active",
      startedAt: subscription.startedAt || new Date().toISOString(),
      pausedAt: null,
      cancelledAt: null,
      nextBillingAt: null,
      createdAt: new Date().toISOString()
    };
    this.subscriptions.set(newSubscription.id, newSubscription);
    this.subscriptionRules.set(newSubscription.id, []);
    return newSubscription;
  }

  async updateSubscription(id: string, updates: UpdateSubscription): Promise<Subscription | undefined> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return undefined;
    
    if (updates.status === "paused" && subscription.status === "active") {
      subscription.pausedAt = new Date().toISOString();
    } else if (updates.status === "cancelled") {
      subscription.cancelledAt = new Date().toISOString();
    }
    
    Object.assign(subscription, updates);
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async getSubscriptionRules(subscriptionId: string): Promise<SubscriptionRule[]> {
    return this.subscriptionRules.get(subscriptionId) || [];
  }

  async createSubscriptionRule(subscriptionId: string, rule: InsertSubscriptionRule): Promise<SubscriptionRule> {
    const newRule: SubscriptionRule = {
      id: randomUUID(),
      subscriptionId,
      type: rule.type,
      timeWindow: rule.timeWindow,
      priceModifier: rule.priceModifier || 0,
      daysOfWeek: rule.daysOfWeek || null,
      createdAt: new Date().toISOString()
    };
    if (!this.subscriptionRules.has(subscriptionId)) {
      this.subscriptionRules.set(subscriptionId, []);
    }
    this.subscriptionRules.get(subscriptionId)!.push(newRule);
    return newRule;
  }

  async deleteSubscriptionRule(ruleId: string): Promise<boolean> {
    const entries = Array.from(this.subscriptionRules.entries());
    for (const [_subId, rules] of entries) {
      const idx = rules.findIndex((r: SubscriptionRule) => r.id === ruleId);
      if (idx !== -1) {
        rules.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  // Subscription Plans
  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    return this.subscriptionPlans.get(id);
  }

  async getSubscriptionPlans(activeOnly = false): Promise<SubscriptionPlan[]> {
    let plans = Array.from(this.subscriptionPlans.values());
    if (activeOnly) plans = plans.filter(p => p.isActive);
    return plans;
  }

  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const newPlan: SubscriptionPlan = {
      id: randomUUID(),
      name: plan.name,
      descriptionKey: plan.descriptionKey,
      basePrice: plan.basePrice,
      currency: plan.currency || "ILS",
      isActive: plan.isActive ?? true,
      createdAt: new Date().toISOString()
    };
    this.subscriptionPlans.set(newPlan.id, newPlan);
    return newPlan;
  }

  async updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const plan = this.subscriptionPlans.get(id);
    if (!plan) return undefined;
    Object.assign(plan, updates);
    this.subscriptionPlans.set(id, plan);
    return plan;
  }

  // Partners
  async getPartner(id: string): Promise<Partner | undefined> {
    return this.partners.get(id);
  }

  async getPartners(filters?: { category?: PartnerCategory; status?: PartnerStatus }): Promise<Partner[]> {
    let partners = Array.from(this.partners.values());
    if (filters?.category) partners = partners.filter(p => p.category === filters.category);
    if (filters?.status) partners = partners.filter(p => p.status === filters.status);
    return partners;
  }

  async createPartner(partner: InsertPartner): Promise<Partner> {
    const newPartner: Partner = {
      id: randomUUID(),
      name: partner.name,
      category: partner.category,
      status: partner.status || "pending",
      contactEmail: partner.contactEmail || null,
      contactPhone: partner.contactPhone || null,
      createdAt: new Date().toISOString()
    };
    this.partners.set(newPartner.id, newPartner);
    this.partnerOffers.set(newPartner.id, []);
    return newPartner;
  }

  async updatePartner(id: string, updates: Partial<Partner>): Promise<Partner | undefined> {
    const partner = this.partners.get(id);
    if (!partner) return undefined;
    Object.assign(partner, updates);
    this.partners.set(id, partner);
    return partner;
  }

  async getPartnerOffers(partnerId: string, activeOnly = false): Promise<PartnerOffer[]> {
    let offers = this.partnerOffers.get(partnerId) || [];
    if (activeOnly) offers = offers.filter(o => o.isActive);
    return offers;
  }

  async getPartnerOffer(id: string): Promise<PartnerOffer | undefined> {
    const allOfferLists = Array.from(this.partnerOffers.values());
    for (const offers of allOfferLists) {
      const offer = offers.find((o: PartnerOffer) => o.id === id);
      if (offer) return offer;
    }
    return undefined;
  }

  async createPartnerOffer(partnerId: string, offer: InsertPartnerOffer): Promise<PartnerOffer> {
    const newOffer: PartnerOffer = {
      id: randomUUID(),
      partnerId,
      titleKey: offer.titleKey,
      descriptionKey: offer.descriptionKey,
      price: offer.price,
      bonusPrice: offer.bonusPrice || null,
      currency: offer.currency || "ILS",
      availableForSegments: offer.availableForSegments || [],
      isActive: offer.isActive ?? true,
      createdAt: new Date().toISOString()
    };
    if (!this.partnerOffers.has(partnerId)) {
      this.partnerOffers.set(partnerId, []);
    }
    this.partnerOffers.get(partnerId)!.push(newOffer);
    return newOffer;
  }

  async updatePartnerOffer(id: string, updates: Partial<PartnerOffer>): Promise<PartnerOffer | undefined> {
    const allOfferLists = Array.from(this.partnerOffers.values());
    for (const offers of allOfferLists) {
      const offer = offers.find((o: PartnerOffer) => o.id === id);
      if (offer) {
        Object.assign(offer, updates);
        return offer;
      }
    }
    return undefined;
  }

  async getOffersForSegments(segments: string[]): Promise<PartnerOffer[]> {
    const allOffers: PartnerOffer[] = [];
    const allOfferLists = Array.from(this.partnerOffers.values());
    for (const offers of allOfferLists) {
      for (const offer of offers) {
        if (!offer.isActive) continue;
        if (offer.availableForSegments.length === 0 || 
            offer.availableForSegments.some((s: string) => segments.includes(s))) {
          allOffers.push(offer);
        }
      }
    }
    return allOffers;
  }

  // Order Finance Snapshot
  async getOrderFinanceSnapshot(orderId: string): Promise<OrderFinanceSnapshot | undefined> {
    return this.orderFinanceSnapshots.get(orderId);
  }

  async createOrderFinanceSnapshot(orderId: string, snapshot: InsertOrderFinanceSnapshot): Promise<OrderFinanceSnapshot> {
    const margin = snapshot.clientPrice - snapshot.courierPayout - snapshot.platformFee;
    const newSnapshot: OrderFinanceSnapshot = {
      id: randomUUID(),
      orderId,
      clientPrice: snapshot.clientPrice,
      courierPayout: snapshot.courierPayout,
      bonusSpent: snapshot.bonusSpent || 0,
      platformFee: snapshot.platformFee || 0,
      margin,
      currency: "ILS",
      createdAt: new Date().toISOString()
    };
    this.orderFinanceSnapshots.set(orderId, newSnapshot);
    return newSnapshot;
  }

  async updateOrderFinanceSnapshot(orderId: string, updates: Partial<InsertOrderFinanceSnapshot>): Promise<OrderFinanceSnapshot | undefined> {
    const snapshot = this.orderFinanceSnapshots.get(orderId);
    if (!snapshot) return undefined;
    
    if (updates.clientPrice !== undefined) snapshot.clientPrice = updates.clientPrice;
    if (updates.courierPayout !== undefined) snapshot.courierPayout = updates.courierPayout;
    if (updates.bonusSpent !== undefined) snapshot.bonusSpent = updates.bonusSpent;
    if (updates.platformFee !== undefined) snapshot.platformFee = updates.platformFee;
    
    snapshot.margin = snapshot.clientPrice - snapshot.courierPayout - snapshot.platformFee;
    this.orderFinanceSnapshots.set(orderId, snapshot);
    return snapshot;
  }

  // ==================== GAMIFICATION METHODS ====================

  // Levels
  async getLevel(id: string): Promise<Level | undefined> {
    return this.levels.get(id);
  }

  async getLevelByCode(code: LevelCode): Promise<Level | undefined> {
    return Array.from(this.levels.values()).find(l => l.code === code);
  }

  async getLevels(): Promise<Level[]> {
    return Array.from(this.levels.values()).sort((a, b) => a.minPoints - b.minPoints);
  }

  async createLevel(level: InsertLevel): Promise<Level> {
    const newLevel: Level = {
      id: randomUUID(),
      code: level.code,
      nameKey: level.nameKey,
      minPoints: level.minPoints,
      benefits: level.benefits || {},
      createdAt: new Date().toISOString()
    };
    this.levels.set(newLevel.id, newLevel);
    return newLevel;
  }

  // User Levels
  async getUserLevel(userId: string): Promise<UserLevel | undefined> {
    const userLevelList = this.userLevels.get(userId) || [];
    return userLevelList.find(ul => ul.current);
  }

  async getUserLevelHistory(userId: string): Promise<UserLevel[]> {
    return this.userLevels.get(userId) || [];
  }

  async createUserLevel(userId: string, userLevel: InsertUserLevel): Promise<UserLevel> {
    if (!this.userLevels.has(userId)) {
      this.userLevels.set(userId, []);
    }
    const userLevelList = this.userLevels.get(userId)!;
    
    if (userLevel.current) {
      userLevelList.forEach(ul => ul.current = false);
    }
    
    const newUserLevel: UserLevel = {
      id: randomUUID(),
      userId,
      levelId: userLevel.levelId,
      achievedAt: new Date().toISOString(),
      current: userLevel.current ?? true
    };
    userLevelList.push(newUserLevel);
    return newUserLevel;
  }

  // Progress
  async getUserProgress(userId: string): Promise<UserProgress> {
    let progress = this.userProgress.get(userId);
    if (!progress) {
      progress = {
        userId,
        totalPoints: 0,
        updatedAt: new Date().toISOString()
      };
      this.userProgress.set(userId, progress);
    }
    return progress;
  }

  async createProgressTransaction(userId: string, tx: InsertProgressTransaction): Promise<ProgressTransaction> {
    const progress = await this.getUserProgress(userId);
    progress.totalPoints += tx.points;
    progress.updatedAt = new Date().toISOString();
    this.userProgress.set(userId, progress);

    const newTx: ProgressTransaction = {
      id: randomUUID(),
      userId,
      points: tx.points,
      reason: tx.reason,
      referenceType: tx.referenceType || null,
      referenceId: tx.referenceId || null,
      createdAt: new Date().toISOString()
    };
    
    if (!this.progressTransactions.has(userId)) {
      this.progressTransactions.set(userId, []);
    }
    this.progressTransactions.get(userId)!.push(newTx);
    return newTx;
  }

  async getProgressTransactions(userId: string, filters?: { reason?: ProgressReason; from?: string; to?: string }): Promise<ProgressTransaction[]> {
    let transactions = this.progressTransactions.get(userId) || [];
    if (filters?.reason) transactions = transactions.filter(t => t.reason === filters.reason);
    if (filters?.from) transactions = transactions.filter(t => t.createdAt >= filters.from!);
    if (filters?.to) transactions = transactions.filter(t => t.createdAt <= filters.to!);
    return transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // Streaks
  async getUserStreak(userId: string, type: StreakType): Promise<UserStreak | undefined> {
    return this.userStreaks.get(userId)?.get(type);
  }

  async getUserStreaks(userId: string): Promise<UserStreak[]> {
    const streakMap = this.userStreaks.get(userId);
    if (!streakMap) return [];
    return Array.from(streakMap.values());
  }

  async updateStreak(userId: string, type: StreakType, updates: UpdateStreak): Promise<UserStreak> {
    if (!this.userStreaks.has(userId)) {
      this.userStreaks.set(userId, new Map());
    }
    const streakMap = this.userStreaks.get(userId)!;
    
    let streak = streakMap.get(type);
    if (!streak) {
      streak = {
        userId,
        type,
        currentCount: 0,
        maxCount: 0,
        lastActionDate: new Date().toISOString().split('T')[0]
      };
    }
    
    if (updates.currentCount !== undefined) streak.currentCount = updates.currentCount;
    if (updates.maxCount !== undefined) streak.maxCount = updates.maxCount;
    if (updates.lastActionDate !== undefined) streak.lastActionDate = updates.lastActionDate;
    
    if (streak.currentCount > streak.maxCount) {
      streak.maxCount = streak.currentCount;
    }
    
    streakMap.set(type, streak);
    return streak;
  }

  async incrementStreak(userId: string, type: StreakType): Promise<UserStreak> {
    const today = new Date().toISOString().split('T')[0];
    const streak = await this.getUserStreak(userId, type);
    
    if (!streak) {
      return this.updateStreak(userId, type, { currentCount: 1, lastActionDate: today });
    }
    
    const lastDate = new Date(streak.lastActionDate);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return streak;
    } else if (diffDays === 1) {
      return this.updateStreak(userId, type, { 
        currentCount: streak.currentCount + 1, 
        lastActionDate: today 
      });
    } else {
      return this.updateStreak(userId, type, { currentCount: 1, lastActionDate: today });
    }
  }

  async resetStreak(userId: string, type: StreakType): Promise<UserStreak> {
    return this.updateStreak(userId, type, { currentCount: 0 });
  }

  // Features
  async getFeature(id: string): Promise<Feature | undefined> {
    return this.features.get(id);
  }

  async getFeatureByCode(code: FeatureCode): Promise<Feature | undefined> {
    return Array.from(this.features.values()).find(f => f.code === code);
  }

  async getFeatures(): Promise<Feature[]> {
    return Array.from(this.features.values());
  }

  async createFeature(feature: InsertFeature): Promise<Feature> {
    const newFeature: Feature = {
      id: randomUUID(),
      code: feature.code,
      descriptionKey: feature.descriptionKey,
      createdAt: new Date().toISOString()
    };
    this.features.set(newFeature.id, newFeature);
    return newFeature;
  }

  // User Feature Access
  async getUserFeatureAccess(userId: string): Promise<UserFeatureAccess[]> {
    const now = new Date().toISOString();
    const accessList = this.userFeatureAccess.get(userId) || [];
    return accessList.filter(a => !a.expiresAt || a.expiresAt > now);
  }

  async hasFeatureAccess(userId: string, featureCode: FeatureCode): Promise<boolean> {
    const feature = await this.getFeatureByCode(featureCode);
    if (!feature) return false;
    
    const now = new Date().toISOString();
    const accessList = this.userFeatureAccess.get(userId) || [];
    return accessList.some(a => 
      a.featureId === feature.id && (!a.expiresAt || a.expiresAt > now)
    );
  }

  async grantFeatureAccess(userId: string, access: InsertUserFeatureAccess): Promise<UserFeatureAccess> {
    if (!this.userFeatureAccess.has(userId)) {
      this.userFeatureAccess.set(userId, []);
    }
    
    const newAccess: UserFeatureAccess = {
      id: randomUUID(),
      userId,
      featureId: access.featureId,
      grantedBy: access.grantedBy,
      expiresAt: access.expiresAt || null,
      createdAt: new Date().toISOString()
    };
    
    this.userFeatureAccess.get(userId)!.push(newAccess);
    return newAccess;
  }

  async revokeFeatureAccess(userId: string, featureId: string): Promise<boolean> {
    const accessList = this.userFeatureAccess.get(userId);
    if (!accessList) return false;
    
    const idx = accessList.findIndex(a => a.featureId === featureId);
    if (idx === -1) return false;
    
    accessList.splice(idx, 1);
    return true;
  }

  async initDefaults(): Promise<void> {
    const { defaultPermissions, defaultRoles } = await import("@shared/schema");
    
    const permMap = new Map<string, string>();
    for (const permName of defaultPermissions) {
      const perm = await this.createPermission({ name: permName, description: null });
      permMap.set(permName, perm.id);
    }

    for (const roleDef of defaultRoles) {
      const role = await this.createRole({ name: roleDef.name, description: null });
      for (const permName of roleDef.permissions) {
        const permId = permMap.get(permName);
        if (permId) {
          await this.addRolePermission(role.id, permId);
        }
      }
    }
  }

  // Webhooks
  private webhooks: Map<string, Webhook> = new Map();
  private webhookDeliveries: Map<string, WebhookDelivery> = new Map();

  async createWebhook(partnerId: string, data: InsertWebhook): Promise<Webhook> {
    const webhook: Webhook = {
      id: randomUUID(),
      partnerId,
      url: data.url,
      secret: randomUUID().replace(/-/g, ''),
      events: data.events,
      status: "active",
      failCount: 0,
      lastTriggeredAt: null,
      createdAt: new Date().toISOString()
    };
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async getWebhook(id: string): Promise<Webhook | undefined> {
    return this.webhooks.get(id);
  }

  async getWebhooksByPartner(partnerId: string): Promise<Webhook[]> {
    return Array.from(this.webhooks.values()).filter(w => w.partnerId === partnerId);
  }

  async getWebhooksByEvent(eventType: WebhookEventType): Promise<Webhook[]> {
    return Array.from(this.webhooks.values())
      .filter(w => w.status === "active" && w.events.includes(eventType));
  }

  async updateWebhook(id: string, data: Partial<InsertWebhook & { status: WebhookStatus }>): Promise<Webhook | undefined> {
    const webhook = this.webhooks.get(id);
    if (!webhook) return undefined;
    
    if (data.url) webhook.url = data.url;
    if (data.events) webhook.events = data.events;
    if (data.status) webhook.status = data.status;
    
    this.webhooks.set(id, webhook);
    return webhook;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    return this.webhooks.delete(id);
  }

  async createWebhookDelivery(webhookId: string, eventType: WebhookEventType, payload: Record<string, unknown>): Promise<WebhookDelivery> {
    const delivery: WebhookDelivery = {
      id: randomUUID(),
      webhookId,
      eventType,
      payload,
      statusCode: null,
      response: null,
      attempts: 0,
      deliveredAt: null,
      createdAt: new Date().toISOString()
    };
    this.webhookDeliveries.set(delivery.id, delivery);
    return delivery;
  }

  async updateWebhookDelivery(id: string, statusCode: number, response: string): Promise<void> {
    const delivery = this.webhookDeliveries.get(id);
    if (delivery) {
      delivery.statusCode = statusCode;
      delivery.response = response;
      delivery.attempts += 1;
      if (statusCode >= 200 && statusCode < 300) {
        delivery.deliveredAt = new Date().toISOString();
      }
      this.webhookDeliveries.set(id, delivery);
    }
  }

  async getWebhookDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
    return Array.from(this.webhookDeliveries.values())
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Feature Flags (system-level)
  private featureFlags: Map<string, FeatureFlag> = new Map();

  async createFeatureFlag(data: InsertFeatureFlag): Promise<FeatureFlag> {
    const flag: FeatureFlag = {
      id: randomUUID(),
      key: data.key,
      enabled: data.enabled ?? false,
      rolloutPercentage: data.rolloutPercentage ?? 0,
      targetUserTypes: data.targetUserTypes ?? [],
      metadata: data.metadata ?? {},
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    this.featureFlags.set(flag.id, flag);
    return flag;
  }

  async getFeatureFlag(id: string): Promise<FeatureFlag | undefined> {
    return this.featureFlags.get(id);
  }

  async getFeatureFlagByKey(key: SystemFeatureFlag): Promise<FeatureFlag | undefined> {
    return Array.from(this.featureFlags.values()).find(f => f.key === key);
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.featureFlags.values());
  }

  async updateFeatureFlag(id: string, data: Partial<InsertFeatureFlag>): Promise<FeatureFlag | undefined> {
    const flag = this.featureFlags.get(id);
    if (!flag) return undefined;
    
    if (data.enabled !== undefined) flag.enabled = data.enabled;
    if (data.rolloutPercentage !== undefined) flag.rolloutPercentage = data.rolloutPercentage;
    if (data.targetUserTypes) flag.targetUserTypes = data.targetUserTypes;
    if (data.metadata) flag.metadata = { ...flag.metadata, ...data.metadata };
    flag.updatedAt = new Date().toISOString();
    
    this.featureFlags.set(id, flag);
    return flag;
  }

  async deleteFeatureFlag(id: string): Promise<boolean> {
    return this.featureFlags.delete(id);
  }

  async isFeatureEnabled(key: SystemFeatureFlag, userType?: UserType): Promise<boolean> {
    const flag = await this.getFeatureFlagByKey(key);
    if (!flag || !flag.enabled) return false;
    
    if (flag.targetUserTypes.length > 0 && userType) {
      if (!flag.targetUserTypes.includes(userType)) return false;
    }
    
    if (flag.rolloutPercentage < 100) {
      return Math.random() * 100 < flag.rolloutPercentage;
    }
    
    return true;
  }
}

export const storage = new MemStorage();
