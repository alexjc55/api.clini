import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
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
  OrderFinanceSnapshot, InsertOrderFinanceSnapshot
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
  private orders: Map<string, Order> = new Map();
  private orderEvents: Map<string, OrderEvent[]> = new Map();
  private auditLogs: AuditLog[] = [];
  private sessions: Map<string, Session> = new Map();
  
  // V2 Storage
  private events: Map<string, Event> = new Map();
  private userActivities: Map<string, UserActivity[]> = new Map();
  private userFlags: Map<string, Map<UserFlagKey, UserFlag>> = new Map();
  private bonusAccounts: Map<string, BonusAccount> = new Map();
  private bonusTransactions: Map<string, BonusTransaction[]> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionRules: Map<string, SubscriptionRule[]> = new Map();
  private subscriptionPlans: Map<string, SubscriptionPlan> = new Map();
  private partners: Map<string, Partner> = new Map();
  private partnerOffers: Map<string, PartnerOffer[]> = new Map();
  private orderFinanceSnapshots: Map<string, OrderFinanceSnapshot> = new Map();

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

  async createSession(userId: string, refreshToken: string, deviceId: string, platform: "ios" | "android" | "web", userAgent: string | null): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      userId,
      refreshToken,
      deviceId,
      platform,
      userAgent,
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

  async updateSessionLastSeen(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastSeenAt = new Date().toISOString();
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
}

export const storage = new MemStorage();
