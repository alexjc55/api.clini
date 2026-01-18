import type {
  User, InsertUser, Role, InsertRole, Permission, InsertPermission,
  Address, InsertAddress, CourierProfile, UpdateCourierProfile,
  Order, InsertOrder, UpdateOrder, OrderEvent, InsertOrderEvent,
  UserType, UserStatus, OrderStatus, AuditLog, Session,
  Event, InsertEvent, ProductEventType, EventActorType,
  UserActivity, InsertUserActivity, UserActivityType,
  UserFlag, InsertUserFlag, UserFlagKey,
  BonusAccount, BonusTransaction, InsertBonusTransaction, BonusTransactionType,
  Subscription, InsertSubscription, UpdateSubscription, SubscriptionStatus,
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
  UserFeatureAccess, InsertUserFeatureAccess
} from "@shared/schema";

export interface IUserRepository {
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string, includeDeleted?: boolean): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  softDeleteUser(id: string): Promise<User | undefined>;
  getUsers(filters?: { type?: UserType; status?: UserStatus; includeDeleted?: boolean }): Promise<User[]>;
  verifyUserPassword(phone: string, password: string): Promise<User | undefined>;
}

export interface IRoleRepository {
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  getRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;
}

export interface IPermissionRepository {
  getPermission(id: string): Promise<Permission | undefined>;
  getPermissions(): Promise<Permission[]>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  getRolePermissions(roleId: string): Promise<Permission[]>;
  addRolePermission(roleId: string, permissionId: string): Promise<void>;
}

export interface IUserRoleRepository {
  getUserRoles(userId: string): Promise<Role[]>;
  getUserPermissions(userId: string): Promise<string[]>;
  addUserRole(userId: string, roleId: string): Promise<void>;
  setUserRoles(userId: string, roleIds: string[]): Promise<void>;
}

export interface IAddressRepository {
  getAddress(id: string, includeDeleted?: boolean): Promise<Address | undefined>;
  getAddressesByUser(userId: string, includeDeleted?: boolean): Promise<Address[]>;
  createAddress(userId: string, address: InsertAddress): Promise<Address>;
  updateAddress(id: string, updates: Partial<Address>): Promise<Address | undefined>;
  softDeleteAddress(id: string): Promise<Address | undefined>;
}

export interface ICourierRepository {
  getCourierProfile(courierId: string, includeDeleted?: boolean): Promise<CourierProfile | undefined>;
  getCouriers(includeDeleted?: boolean): Promise<CourierProfile[]>;
  createCourierProfile(courierId: string): Promise<CourierProfile>;
  updateCourierProfile(courierId: string, updates: UpdateCourierProfile): Promise<CourierProfile | undefined>;
  updateCourierVerification(courierId: string, status: "verified" | "rejected"): Promise<CourierProfile | undefined>;
  softDeleteCourier(courierId: string): Promise<CourierProfile | undefined>;
  incrementCourierOrders(courierId: string): Promise<void>;
}

export interface IOrderRepository {
  getOrder(id: string, includeDeleted?: boolean): Promise<Order | undefined>;
  getOrders(filters?: { clientId?: string; courierId?: string; status?: OrderStatus; includeDeleted?: boolean }): Promise<Order[]>;
  createOrder(clientId: string, order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: UpdateOrder, performedBy: string): Promise<Order | undefined>;
  assignCourier(orderId: string, courierId: string, performedBy: string): Promise<Order | undefined>;
  softDeleteOrder(orderId: string): Promise<Order | undefined>;
}

export interface IOrderEventRepository {
  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  createOrderEvent(performedBy: string, event: InsertOrderEvent): Promise<OrderEvent>;
}

export interface IAuditLogRepository {
  createAuditLog(log: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog>;
  getAuditLogs(filters?: { userId?: string; entity?: string; entityId?: string; action?: string }): Promise<AuditLog[]>;
}

export interface ISessionRepository {
  createSession(userId: string, refreshToken: string, deviceId: string, platform: "ios" | "android" | "web", userAgent: string | null): Promise<Session>;
  getSession(refreshToken: string): Promise<Session | undefined>;
  getUserSessions(userId: string): Promise<Session[]>;
  updateSessionLastSeen(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<boolean>;
  deleteUserSessions(userId: string): Promise<void>;
}

// ==================== V2 REPOSITORIES ====================

export interface IEventRepository {
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: string): Promise<Event | undefined>;
  getEvents(filters?: { type?: ProductEventType; actorType?: EventActorType; actorId?: string; entityType?: string; entityId?: string; from?: string; to?: string }): Promise<Event[]>;
}

export interface IUserActivityRepository {
  createUserActivity(userId: string, activity: InsertUserActivity): Promise<UserActivity>;
  getUserActivities(userId: string, filters?: { eventType?: UserActivityType; from?: string; to?: string }): Promise<UserActivity[]>;
  getUserActivitySummary(userId: string): Promise<Record<UserActivityType, number>>;
}

export interface IUserFlagRepository {
  getUserFlags(userId: string): Promise<UserFlag[]>;
  getUserFlag(userId: string, key: UserFlagKey): Promise<UserFlag | undefined>;
  setUserFlag(userId: string, flag: InsertUserFlag): Promise<UserFlag>;
  deleteUserFlag(userId: string, key: UserFlagKey): Promise<boolean>;
  getUsersByFlag(key: UserFlagKey, value?: boolean): Promise<string[]>;
}

export interface IBonusRepository {
  getBonusAccount(userId: string): Promise<BonusAccount>;
  createBonusTransaction(userId: string, transaction: InsertBonusTransaction): Promise<BonusTransaction>;
  getBonusTransactions(userId: string, filters?: { type?: BonusTransactionType; from?: string; to?: string }): Promise<BonusTransaction[]>;
}

export interface ISubscriptionRepository {
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionsByUser(userId: string): Promise<Subscription[]>;
  createSubscription(userId: string, subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: UpdateSubscription): Promise<Subscription | undefined>;
  getSubscriptionRules(subscriptionId: string): Promise<SubscriptionRule[]>;
  createSubscriptionRule(subscriptionId: string, rule: InsertSubscriptionRule): Promise<SubscriptionRule>;
  deleteSubscriptionRule(ruleId: string): Promise<boolean>;
}

export interface ISubscriptionPlanRepository {
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlans(activeOnly?: boolean): Promise<SubscriptionPlan[]>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
}

export interface IPartnerRepository {
  getPartner(id: string): Promise<Partner | undefined>;
  getPartners(filters?: { category?: PartnerCategory; status?: PartnerStatus }): Promise<Partner[]>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, updates: Partial<Partner>): Promise<Partner | undefined>;
  getPartnerOffers(partnerId: string, activeOnly?: boolean): Promise<PartnerOffer[]>;
  getPartnerOffer(id: string): Promise<PartnerOffer | undefined>;
  createPartnerOffer(partnerId: string, offer: InsertPartnerOffer): Promise<PartnerOffer>;
  updatePartnerOffer(id: string, updates: Partial<PartnerOffer>): Promise<PartnerOffer | undefined>;
  getOffersForSegments(segments: string[]): Promise<PartnerOffer[]>;
}

export interface IOrderFinanceRepository {
  getOrderFinanceSnapshot(orderId: string): Promise<OrderFinanceSnapshot | undefined>;
  createOrderFinanceSnapshot(orderId: string, snapshot: InsertOrderFinanceSnapshot): Promise<OrderFinanceSnapshot>;
  updateOrderFinanceSnapshot(orderId: string, updates: Partial<InsertOrderFinanceSnapshot>): Promise<OrderFinanceSnapshot | undefined>;
}

// ==================== GAMIFICATION REPOSITORIES ====================

export interface ILevelRepository {
  getLevel(id: string): Promise<Level | undefined>;
  getLevelByCode(code: LevelCode): Promise<Level | undefined>;
  getLevels(): Promise<Level[]>;
  createLevel(level: InsertLevel): Promise<Level>;
}

export interface IUserLevelRepository {
  getUserLevel(userId: string): Promise<UserLevel | undefined>;
  getUserLevelHistory(userId: string): Promise<UserLevel[]>;
  createUserLevel(userId: string, userLevel: InsertUserLevel): Promise<UserLevel>;
}

export interface IProgressRepository {
  getUserProgress(userId: string): Promise<UserProgress>;
  createProgressTransaction(userId: string, tx: InsertProgressTransaction): Promise<ProgressTransaction>;
  getProgressTransactions(userId: string, filters?: { reason?: ProgressReason; from?: string; to?: string }): Promise<ProgressTransaction[]>;
}

export interface IStreakRepository {
  getUserStreak(userId: string, type: StreakType): Promise<UserStreak | undefined>;
  getUserStreaks(userId: string): Promise<UserStreak[]>;
  updateStreak(userId: string, type: StreakType, updates: UpdateStreak): Promise<UserStreak>;
  incrementStreak(userId: string, type: StreakType): Promise<UserStreak>;
  resetStreak(userId: string, type: StreakType): Promise<UserStreak>;
}

export interface IFeatureRepository {
  getFeature(id: string): Promise<Feature | undefined>;
  getFeatureByCode(code: FeatureCode): Promise<Feature | undefined>;
  getFeatures(): Promise<Feature[]>;
  createFeature(feature: InsertFeature): Promise<Feature>;
}

export interface IUserFeatureAccessRepository {
  getUserFeatureAccess(userId: string): Promise<UserFeatureAccess[]>;
  hasFeatureAccess(userId: string, featureCode: FeatureCode): Promise<boolean>;
  grantFeatureAccess(userId: string, access: InsertUserFeatureAccess): Promise<UserFeatureAccess>;
  revokeFeatureAccess(userId: string, featureId: string): Promise<boolean>;
}

export interface IStorage extends 
  IUserRepository,
  IRoleRepository,
  IPermissionRepository,
  IUserRoleRepository,
  IAddressRepository,
  ICourierRepository,
  IOrderRepository,
  IOrderEventRepository,
  IAuditLogRepository,
  ISessionRepository,
  IEventRepository,
  IUserActivityRepository,
  IUserFlagRepository,
  IBonusRepository,
  ISubscriptionRepository,
  ISubscriptionPlanRepository,
  IPartnerRepository,
  IOrderFinanceRepository,
  ILevelRepository,
  IUserLevelRepository,
  IProgressRepository,
  IStreakRepository,
  IFeatureRepository,
  IUserFeatureAccessRepository {
  initDefaults(): Promise<void>;
}
