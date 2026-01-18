import type { Express, Router, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { storage } from "./storage";
import { generateTokens, refreshAccessToken, revokeUserTokens } from "./auth";
import { authMiddleware, requirePermissions, requireUserType, sendError, i18nMiddleware } from "./middleware";
import {
  insertUserSchema, loginSchema, insertAddressSchema, insertOrderSchema,
  updateOrderSchema, updateCourierProfileSchema, insertRoleSchema, orderStatuses,
  isValidStatusTransition, type OrderStatus, type AuditAction
} from "@shared/schema";
import { z } from "zod";
import { L } from "./localization-keys";
import { sendLocalizedSuccess } from "./i18n";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { key: L.common.rate_limit_exceeded, params: {} } },
  standardHeaders: true,
  legacyHeaders: false,
});

const AUDIT_MESSAGE_KEYS: Record<AuditAction, string> = {
  CREATE_USER: L.audit.user_created,
  UPDATE_USER: L.audit.user_updated,
  DELETE_USER: L.audit.user_deleted,
  BLOCK_USER: L.audit.user_blocked,
  CREATE_ORDER: L.audit.order_created,
  UPDATE_ORDER: L.audit.order_updated,
  DELETE_ORDER: L.audit.order_deleted,
  ASSIGN_COURIER: L.audit.order_assigned,
  CANCEL_ORDER: L.audit.order_cancelled,
  VERIFY_COURIER: L.audit.courier_verified,
  CREATE_ROLE: L.audit.role_created,
  UPDATE_ROLE: L.audit.role_updated,
  ASSIGN_ROLE: L.audit.user_roles_assigned,
};

async function createAuditLogEntry(
  userId: string,
  action: AuditAction,
  entity: string,
  entityId: string,
  changes: Record<string, { from: unknown; to: unknown }>,
  metadata: Record<string, unknown> = {}
) {
  const userRoles = await storage.getUserRoles(userId);
  await storage.createAuditLog({
    userId,
    userRole: userRoles.map(r => r.name).join(","),
    action,
    messageKey: AUDIT_MESSAGE_KEYS[action],
    entity,
    entityId,
    changes,
    metadata
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await storage.initDefaults();
  
  app.use(i18nMiddleware);
  
  const v1Router = ExpressRouter();

  v1Router.post("/auth/register", authRateLimiter, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByPhone(data.phone);
      if (existing) {
        return sendError(res, 409, L.common.conflict, { field: "phone" });
      }
      
      const user = await storage.createUser(data);
      const tokens = generateTokens(user.id);
      
      await createAuditLogEntry(user.id, "CREATE_USER", "user", user.id, {}, { self: true });
      
      res.status(201).json({
        status: "success",
        message: { key: L.auth.register_success, params: { userId: user.id } },
        data: tokens
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.post("/auth/login", authRateLimiter, async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const { deviceId, platform } = req.body;
      
      const user = await storage.verifyUserPassword(data.phone, data.password);
      if (!user) {
        return sendError(res, 401, L.auth.invalid_credentials);
      }
      
      if (user.status === "blocked") {
        return sendError(res, 403, L.auth.user_blocked);
      }
      
      if (user.deletedAt) {
        return sendError(res, 401, L.auth.user_deleted);
      }
      
      const tokens = generateTokens(user.id);
      
      const userAgent = req.headers["user-agent"] || null;
      await storage.createSession(
        user.id,
        tokens.refreshToken,
        deviceId || "unknown",
        platform || "web",
        userAgent
      );
      
      res.json({
        status: "success",
        message: { key: L.auth.login_success, params: { userId: user.id } },
        data: tokens
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.post("/auth/refresh", authRateLimiter, async (req, res) => {
    try {
      const { refreshToken, deviceId, platform } = req.body;
      if (!refreshToken) {
        return sendError(res, 400, L.common.bad_request, { field: "refreshToken" });
      }
      
      const existingSession = await storage.getSession(refreshToken);
      const tokens = refreshAccessToken(refreshToken);
      if (!tokens) {
        return sendError(res, 401, L.auth.token_expired);
      }
      
      if (existingSession) {
        await storage.updateSessionLastSeen(existingSession.id);
      }
      
      res.json({
        status: "success",
        message: { key: L.auth.refresh_success },
        data: tokens
      });
    } catch {
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/auth/me", authMiddleware, async (req, res) => {
    const { passwordHash, ...user } = req.user!;
    const roles = await storage.getUserRoles(user.id);
    res.json({ ...user, roles: roles.map(r => r.name) });
  });

  v1Router.get("/users", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const { type, status, includeDeleted, page = "1", limit = "20" } = req.query;
    const users = await storage.getUsers({
      type: type as any,
      status: status as any,
      includeDeleted: includeDeleted === "true"
    });
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const start = (pageNum - 1) * limitNum;
    const paginatedUsers = users.slice(start, start + limitNum);
    
    res.json({
      users: paginatedUsers.map(({ passwordHash, ...u }) => u),
      total: users.length,
      page: pageNum,
      limit: limitNum
    });
  });

  v1Router.get("/users/:id", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return sendError(res, 404, L.user.not_found, { userId: req.params.id });
    }
    
    const { passwordHash, ...userData } = user;
    const roles = await storage.getUserRoles(user.id);
    res.json({ ...userData, roles: roles.map(r => r.name) });
  });

  v1Router.patch("/users/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const existingUser = await storage.getUser(req.params.id);
    if (!existingUser) {
      return sendError(res, 404, L.user.not_found, { userId: req.params.id });
    }
    
    const user = await storage.updateUser(req.params.id, req.body);
    if (!user) {
      return sendError(res, 404, L.user.not_found, { userId: req.params.id });
    }
    
    if (req.body.status === "blocked" && existingUser.status !== "blocked") {
      revokeUserTokens(user.id);
      await storage.deleteUserSessions(user.id);
      await createAuditLogEntry(req.user!.id, "BLOCK_USER", "user", req.params.id, 
        { status: { from: existingUser.status, to: "blocked" } });
    } else if (Object.keys(req.body).length > 0) {
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of Object.keys(req.body)) {
        if ((existingUser as any)[key] !== req.body[key]) {
          changes[key] = { from: (existingUser as any)[key], to: req.body[key] };
        }
      }
      if (Object.keys(changes).length > 0) {
        await createAuditLogEntry(req.user!.id, "UPDATE_USER", "user", req.params.id, changes);
      }
    }
    
    const { passwordHash, ...userData } = user;
    res.json(userData);
  });

  v1Router.post("/users/:id/roles", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) {
      return sendError(res, 400, L.role.invalid_role_ids);
    }
    
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return sendError(res, 404, L.user.not_found, { userId: req.params.id });
    }
    
    const oldRoles = await storage.getUserRoles(req.params.id);
    await storage.setUserRoles(req.params.id, roleIds);
    const newRoles = await storage.getUserRoles(req.params.id);
    
    await createAuditLogEntry(req.user!.id, "ASSIGN_ROLE", "user", req.params.id,
      { roles: { from: oldRoles.map(r => r.name), to: newRoles.map(r => r.name) } });
    
    res.json({ 
      status: "success", 
      message: { key: L.user.roles_assigned, params: { userId: req.params.id } } 
    });
  });

  v1Router.delete("/users/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return sendError(res, 404, L.user.not_found, { userId: req.params.id });
    }
    
    if (user.deletedAt) {
      return sendError(res, 409, L.user.already_deleted, { userId: req.params.id });
    }
    
    const deleted = await storage.softDeleteUser(req.params.id);
    revokeUserTokens(req.params.id);
    await storage.deleteUserSessions(req.params.id);
    
    await createAuditLogEntry(req.user!.id, "DELETE_USER", "user", req.params.id,
      { deletedAt: { from: null, to: deleted?.deletedAt } });
    
    res.status(204).send();
  });

  v1Router.get("/addresses", authMiddleware, async (req, res) => {
    const addresses = await storage.getAddressesByUser(req.user!.id);
    res.json(addresses);
  });

  v1Router.post("/addresses", authMiddleware, async (req, res) => {
    try {
      const data = insertAddressSchema.parse(req.body);
      const address = await storage.createAddress(req.user!.id, data);
      res.status(201).json({
        status: "success",
        message: { key: L.address.created, params: { addressId: address.id } },
        data: address
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.patch("/addresses/:id", authMiddleware, async (req, res) => {
    const address = await storage.getAddress(req.params.id);
    if (!address) {
      return sendError(res, 404, L.address.not_found, { addressId: req.params.id });
    }
    if (address.userId !== req.user!.id && !req.userPermissions?.includes("addresses.manage")) {
      return sendError(res, 403, L.address.forbidden);
    }
    
    const updated = await storage.updateAddress(req.params.id, req.body);
    res.json(updated);
  });

  v1Router.delete("/addresses/:id", authMiddleware, async (req, res) => {
    const address = await storage.getAddress(req.params.id as string, true);
    if (!address) {
      return sendError(res, 404, L.address.not_found, { addressId: req.params.id as string });
    }
    if (address.deletedAt) {
      return sendError(res, 400, L.address.already_deleted, { addressId: req.params.id as string });
    }
    if (address.userId !== req.user!.id && !req.userPermissions?.includes("addresses.manage")) {
      return sendError(res, 403, L.address.forbidden);
    }
    
    await storage.softDeleteAddress(req.params.id as string);
    res.json({
      status: "success",
      message: { key: L.address.deleted, params: { addressId: req.params.id } }
    });
  });

  v1Router.post("/orders", authMiddleware, async (req, res) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      
      const address = await storage.getAddress(data.addressId);
      if (!address) {
        return sendError(res, 400, L.address.not_found, { addressId: data.addressId });
      }
      if (address.userId !== req.user!.id) {
        return sendError(res, 403, L.address.forbidden);
      }
      
      const order = await storage.createOrder(req.user!.id, data);
      
      await createAuditLogEntry(req.user!.id, "CREATE_ORDER", "order", order.id, {}, { price: order.price });
      
      res.status(201).json({
        status: "success",
        message: { key: L.order.created, params: { orderId: order.id } },
        data: order
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/orders", authMiddleware, async (req, res) => {
    const { status, includeDeleted, page = "1", limit = "20" } = req.query;
    
    let orders;
    const filters: { clientId?: string; courierId?: string; status?: OrderStatus; includeDeleted?: boolean } = {
      status: status as OrderStatus | undefined,
      includeDeleted: includeDeleted === "true" && req.userPermissions?.includes("orders.read")
    };
    
    if (req.userPermissions?.includes("orders.read")) {
      orders = await storage.getOrders(filters);
    } else if (req.user!.type === "courier") {
      orders = await storage.getOrders({ ...filters, courierId: req.user!.id });
    } else {
      orders = await storage.getOrders({ ...filters, clientId: req.user!.id });
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const start = (pageNum - 1) * limitNum;
    const paginatedOrders = orders.slice(start, start + limitNum);
    
    res.json({
      orders: paginatedOrders,
      total: orders.length,
      page: pageNum,
      limit: limitNum
    });
  });

  v1Router.get("/orders/:id", authMiddleware, async (req, res) => {
    const includeDeleted = req.query.includeDeleted === "true" && req.userPermissions?.includes("orders.read");
    const order = await storage.getOrder(req.params.id, includeDeleted);
    if (!order) {
      return sendError(res, 404, L.order.not_found, { orderId: req.params.id });
    }
    
    const canView = req.userPermissions?.includes("orders.read") ||
      order.clientId === req.user!.id ||
      order.courierId === req.user!.id;
    
    if (!canView) {
      return sendError(res, 403, L.common.forbidden);
    }
    
    const address = await storage.getAddress(order.addressId);
    const events = await storage.getOrderEvents(order.id);
    
    res.json({ ...order, address, events });
  });

  v1Router.patch("/orders/:id", authMiddleware, async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return sendError(res, 404, L.order.not_found, { orderId: req.params.id });
      }
      
      const hasPermission = req.userPermissions?.includes("orders.update_status");
      const isOwner = order.clientId === req.user!.id;
      const isCourier = order.courierId === req.user!.id;
      
      if (!hasPermission && !isOwner && !isCourier) {
        return sendError(res, 403, L.common.forbidden);
      }
      
      const data = updateOrderSchema.parse(req.body);
      
      if (data.status && !isValidStatusTransition(order.status, data.status)) {
        return sendError(res, 409, L.order.invalid_status_transition, { from: order.status, to: data.status });
      }
      
      const updated = await storage.updateOrder(req.params.id, data, req.user!.id);
      
      if (hasPermission && data.status) {
        await createAuditLogEntry(req.user!.id, "UPDATE_ORDER", "order", req.params.id,
          { status: { from: order.status, to: data.status } });
      }
      
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.delete("/orders/:id", authMiddleware, requirePermissions("orders.update_status"), async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, L.order.not_found, { orderId: req.params.id });
    }
    
    if (order.deletedAt) {
      return sendError(res, 409, L.order.already_deleted, { orderId: req.params.id });
    }
    
    const deleted = await storage.softDeleteOrder(req.params.id);
    
    await createAuditLogEntry(req.user!.id, "CANCEL_ORDER", "order", req.params.id,
      { deletedAt: { from: null, to: deleted?.deletedAt } });
    
    res.status(204).send();
  });

  v1Router.post("/orders/:id/assign", authMiddleware, requirePermissions("orders.assign"), async (req, res) => {
    const { courierId } = req.body;
    if (!courierId) {
      return sendError(res, 400, L.common.bad_request, { field: "courierId" });
    }
    
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, L.order.not_found, { orderId: req.params.id });
    }
    
    if (order.courierId) {
      return sendError(res, 409, L.order.already_assigned, { orderId: req.params.id });
    }
    
    const courier = await storage.getUser(courierId);
    if (!courier || courier.type !== "courier") {
      return sendError(res, 400, L.courier.not_found, { courierId });
    }
    
    const updated = await storage.assignCourier(req.params.id, courierId, req.user!.id);
    
    await createAuditLogEntry(req.user!.id, "ASSIGN_COURIER", "order", req.params.id,
      { courierId: { from: null, to: courierId } });
    
    res.json({
      status: "success",
      message: { key: L.order.assigned, params: { orderId: req.params.id, courierId } },
      data: updated
    });
  });

  v1Router.post("/orders/:id/cancel", authMiddleware, async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, L.order.not_found, { orderId: req.params.id });
    }
    
    const canCancel = req.userPermissions?.includes("orders.update_status") ||
      order.clientId === req.user!.id;
    
    if (!canCancel) {
      return sendError(res, 403, L.common.forbidden);
    }
    
    if (order.status === "completed" || order.status === "cancelled") {
      return sendError(res, 409, L.order.cannot_cancel, { orderId: req.params.id, status: order.status });
    }
    
    const updated = await storage.updateOrder(req.params.id, { status: "cancelled" }, req.user!.id);
    
    await storage.createOrderEvent(req.user!.id, {
      orderId: order.id,
      eventType: "cancelled",
      metadata: { reason: req.body.reason }
    });
    
    await createAuditLogEntry(req.user!.id, "CANCEL_ORDER", "order", req.params.id,
      { status: { from: order.status, to: "cancelled" } }, { reason: req.body.reason });
    
    res.json({
      status: "success",
      message: { key: L.order.cancelled, params: { orderId: req.params.id } },
      data: updated
    });
  });

  v1Router.get("/courier/profile", authMiddleware, requireUserType("courier"), async (req, res) => {
    const profile = await storage.getCourierProfile(req.user!.id);
    if (!profile) {
      return sendError(res, 404, L.courier.profile_not_found);
    }
    res.json(profile);
  });

  v1Router.patch("/courier/profile", authMiddleware, requireUserType("courier"), async (req, res) => {
    try {
      const data = updateCourierProfileSchema.parse(req.body);
      const profile = await storage.updateCourierProfile(req.user!.id, data);
      if (!profile) {
        return sendError(res, 404, L.courier.profile_not_found);
      }
      res.json({
        status: "success",
        message: { key: L.courier.profile_updated },
        data: profile
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/courier/orders", authMiddleware, requireUserType("courier"), async (req, res) => {
    const { status } = req.query;
    const orders = await storage.getOrders({ courierId: req.user!.id, status: status as any });
    
    const ordersWithAddress = await Promise.all(
      orders.map(async (order) => {
        const address = await storage.getAddress(order.addressId);
        return { ...order, address };
      })
    );
    
    res.json({ orders: ordersWithAddress });
  });

  v1Router.post("/courier/orders/:id/accept", authMiddleware, requireUserType("courier"), async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, L.order.not_found, { orderId: req.params.id });
    }
    
    if (order.courierId !== req.user!.id) {
      return sendError(res, 403, L.order.not_assigned_to_you, { orderId: req.params.id });
    }
    
    if (order.status !== "assigned") {
      return sendError(res, 409, L.order.not_in_assigned_status, { orderId: req.params.id, status: order.status });
    }
    
    const updated = await storage.updateOrder(req.params.id, { status: "in_progress" }, req.user!.id);
    
    await storage.createOrderEvent(req.user!.id, {
      orderId: order.id,
      eventType: "started",
      metadata: {}
    });
    
    res.json({
      status: "success",
      message: { key: L.order.started, params: { orderId: req.params.id } },
      data: updated
    });
  });

  v1Router.post("/courier/orders/:id/complete", authMiddleware, requireUserType("courier"), async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, L.order.not_found, { orderId: req.params.id });
    }
    
    if (order.courierId !== req.user!.id) {
      return sendError(res, 403, L.order.not_assigned_to_you, { orderId: req.params.id });
    }
    
    if (order.status !== "in_progress") {
      return sendError(res, 409, L.order.not_in_progress, { orderId: req.params.id, status: order.status });
    }
    
    const updated = await storage.updateOrder(req.params.id, { status: "completed" }, req.user!.id);
    
    await storage.createOrderEvent(req.user!.id, {
      orderId: order.id,
      eventType: "completed",
      metadata: {}
    });
    
    res.json({
      status: "success",
      message: { key: L.order.completed, params: { orderId: req.params.id } },
      data: updated
    });
  });

  v1Router.get("/roles", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const roles = await storage.getRoles();
    const rolesWithPermissions = await Promise.all(
      roles.map(async (role) => {
        const permissions = await storage.getRolePermissions(role.id);
        return { ...role, permissions: permissions.map(p => p.name) };
      })
    );
    res.json(rolesWithPermissions);
  });

  v1Router.post("/roles", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const { name, description, permissionIds } = req.body;
      const data = insertRoleSchema.parse({ name, description });
      
      const role = await storage.createRole(data);
      
      if (Array.isArray(permissionIds)) {
        for (const permId of permissionIds) {
          await storage.addRolePermission(role.id, permId);
        }
      }
      
      await createAuditLogEntry(req.user!.id, "CREATE_ROLE", "role", role.id, {}, { name: role.name });
      
      const permissions = await storage.getRolePermissions(role.id);
      res.status(201).json({
        status: "success",
        message: { key: L.role.created, params: { roleId: role.id } },
        data: { ...role, permissions: permissions.map(p => p.name) }
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/permissions", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const permissions = await storage.getPermissions();
    res.json(permissions);
  });

  v1Router.get("/couriers", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const { includeDeleted } = req.query;
    const couriers = await storage.getUsers({ type: "courier", includeDeleted: includeDeleted === "true" });
    
    const couriersWithProfiles = await Promise.all(
      couriers.map(async (courier) => {
        const { passwordHash, ...userData } = courier;
        const profile = await storage.getCourierProfile(courier.id, includeDeleted === "true");
        return { ...userData, profile };
      })
    );
    
    res.json(couriersWithProfiles);
  });

  v1Router.patch("/couriers/:id/verify", authMiddleware, requirePermissions("couriers.verify"), async (req, res) => {
    const { status } = req.body;
    if (!["verified", "rejected"].includes(status)) {
      return sendError(res, 400, L.courier.invalid_verification_status);
    }
    
    const courier = await storage.getUser(req.params.id);
    if (!courier || courier.type !== "courier") {
      return sendError(res, 404, L.courier.not_found, { courierId: req.params.id });
    }
    
    const profile = await storage.getCourierProfile(req.params.id);
    if (!profile) {
      return sendError(res, 404, L.courier.profile_not_found, { courierId: req.params.id });
    }
    
    const oldStatus = profile.verificationStatus;
    const updated = await storage.updateCourierVerification(req.params.id, status);
    
    await createAuditLogEntry(req.user!.id, "VERIFY_COURIER", "courier", req.params.id,
      { verificationStatus: { from: oldStatus, to: status } });
    
    res.json({
      status: "success",
      message: { key: L.courier.verified, params: { courierId: req.params.id, status } },
      data: updated
    });
  });

  v1Router.get("/audit-logs", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const { userId, entity, entityId, action, page = "1", limit = "50" } = req.query;
    const logs = await storage.getAuditLogs({
      userId: userId as string,
      entity: entity as string,
      entityId: entityId as string,
      action: action as string
    });
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const start = (pageNum - 1) * limitNum;
    const paginatedLogs = logs.slice(start, start + limitNum);
    
    res.json({
      logs: paginatedLogs,
      total: logs.length,
      page: pageNum,
      limit: limitNum
    });
  });

  v1Router.get("/auth/sessions", authMiddleware, async (req, res) => {
    const sessions = await storage.getUserSessions(req.user!.id);
    res.json(sessions.map(s => ({
      id: s.id,
      deviceId: s.deviceId,
      platform: s.platform,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt
    })));
  });

  v1Router.delete("/auth/sessions/:id", authMiddleware, async (req, res) => {
    const sessions = await storage.getUserSessions(req.user!.id);
    const session = sessions.find(s => s.id === req.params.id);
    
    if (!session) {
      return sendError(res, 404, L.session.device_not_found, { sessionId: req.params.id as string });
    }
    
    await storage.deleteSession(req.params.id as string);
    res.json({ 
      status: "success", 
      message: { key: L.session.deleted, params: { sessionId: req.params.id } } 
    });
  });

  v1Router.post("/auth/logout-all", authMiddleware, async (req, res) => {
    await storage.deleteUserSessions(req.user!.id);
    revokeUserTokens(req.user!.id);
    res.json({ 
      status: "success", 
      message: { key: L.session.all_sessions_deleted } 
    });
  });

  v1Router.get("/openapi.json", (_req, res) => {
    try {
      const yamlContent = readFileSync(join(process.cwd(), "docs/openapi.yaml"), "utf-8");
      const openApiSpec = yaml.load(yamlContent);
      res.json(openApiSpec);
    } catch (err) {
      res.status(500).json({ error: "OpenAPI spec not found" });
    }
  });

  v1Router.get("/openapi.yaml", (_req, res) => {
    try {
      const yamlContent = readFileSync(join(process.cwd(), "docs/openapi.yaml"), "utf-8");
      res.type("text/yaml").send(yamlContent);
    } catch (err) {
      res.status(500).json({ error: "OpenAPI spec not found" });
    }
  });

  app.use("/api/v1", v1Router);
  
  app.use("/api", v1Router);

  return httpServer;
}
