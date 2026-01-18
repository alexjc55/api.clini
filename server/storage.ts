import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type {
  User, InsertUser, Role, InsertRole, Permission, InsertPermission,
  Address, InsertAddress, CourierProfile, UpdateCourierProfile,
  Order, InsertOrder, UpdateOrder, OrderEvent, InsertOrderEvent,
  UserType, UserStatus, OrderStatus
} from "@shared/schema";

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUsers(filters?: { type?: UserType; status?: UserStatus }): Promise<User[]>;
  verifyUserPassword(phone: string, password: string): Promise<User | undefined>;

  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  getRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;

  getPermission(id: string): Promise<Permission | undefined>;
  getPermissions(): Promise<Permission[]>;
  createPermission(permission: InsertPermission): Promise<Permission>;

  getRolePermissions(roleId: string): Promise<Permission[]>;
  addRolePermission(roleId: string, permissionId: string): Promise<void>;

  getUserRoles(userId: string): Promise<Role[]>;
  getUserPermissions(userId: string): Promise<string[]>;
  addUserRole(userId: string, roleId: string): Promise<void>;
  setUserRoles(userId: string, roleIds: string[]): Promise<void>;

  getAddress(id: string): Promise<Address | undefined>;
  getAddressesByUser(userId: string): Promise<Address[]>;
  createAddress(userId: string, address: InsertAddress): Promise<Address>;
  updateAddress(id: string, updates: Partial<Address>): Promise<Address | undefined>;
  deleteAddress(id: string): Promise<boolean>;

  getCourierProfile(courierId: string): Promise<CourierProfile | undefined>;
  createCourierProfile(courierId: string): Promise<CourierProfile>;
  updateCourierProfile(courierId: string, updates: UpdateCourierProfile): Promise<CourierProfile | undefined>;
  incrementCourierOrders(courierId: string): Promise<void>;

  getOrder(id: string): Promise<Order | undefined>;
  getOrders(filters?: { clientId?: string; courierId?: string; status?: OrderStatus }): Promise<Order[]>;
  createOrder(clientId: string, order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: UpdateOrder, performedBy: string): Promise<Order | undefined>;
  assignCourier(orderId: string, courierId: string, performedBy: string): Promise<Order | undefined>;

  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  createOrderEvent(performedBy: string, event: InsertOrderEvent): Promise<OrderEvent>;

  initDefaults(): Promise<void>;
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

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.phone === phone);
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
      createdAt: new Date().toISOString()
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

  async getUsers(filters?: { type?: UserType; status?: UserStatus }): Promise<User[]> {
    let users = Array.from(this.users.values());
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

  async getAddress(id: string): Promise<Address | undefined> {
    return this.addresses.get(id);
  }

  async getAddressesByUser(userId: string): Promise<Address[]> {
    return Array.from(this.addresses.values()).filter(a => a.userId === userId);
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
      comment: address.comment || null
    };
    this.addresses.set(id, newAddress);
    return newAddress;
  }

  async updateAddress(id: string, updates: Partial<Address>): Promise<Address | undefined> {
    const address = this.addresses.get(id);
    if (!address) return undefined;
    const updated = { ...address, ...updates };
    this.addresses.set(id, updated);
    return updated;
  }

  async deleteAddress(id: string): Promise<boolean> {
    return this.addresses.delete(id);
  }

  async getCourierProfile(courierId: string): Promise<CourierProfile | undefined> {
    return this.courierProfiles.get(courierId);
  }

  async createCourierProfile(courierId: string): Promise<CourierProfile> {
    const profile: CourierProfile = {
      courierId,
      availabilityStatus: "offline",
      rating: 0,
      completedOrdersCount: 0,
      verificationStatus: "pending"
    };
    this.courierProfiles.set(courierId, profile);
    return profile;
  }

  async updateCourierProfile(courierId: string, updates: UpdateCourierProfile): Promise<CourierProfile | undefined> {
    const profile = this.courierProfiles.get(courierId);
    if (!profile) return undefined;
    const updated = { ...profile, ...updates };
    this.courierProfiles.set(courierId, updated);
    return updated;
  }

  async incrementCourierOrders(courierId: string): Promise<void> {
    const profile = this.courierProfiles.get(courierId);
    if (profile) {
      profile.completedOrdersCount++;
      this.courierProfiles.set(courierId, profile);
    }
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrders(filters?: { clientId?: string; courierId?: string; status?: OrderStatus }): Promise<Order[]> {
    let orders = Array.from(this.orders.values());
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
      completedAt: null
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
    if (!order) return undefined;
    
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
