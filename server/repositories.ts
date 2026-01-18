import type {
  User, InsertUser, Role, InsertRole, Permission, InsertPermission,
  Address, InsertAddress, CourierProfile, UpdateCourierProfile,
  Order, InsertOrder, UpdateOrder, OrderEvent, InsertOrderEvent,
  UserType, UserStatus, OrderStatus, AuditLog, Session
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
  ISessionRepository {
  initDefaults(): Promise<void>;
}
