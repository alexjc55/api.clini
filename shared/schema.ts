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
    code: string;
    message: string;
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
