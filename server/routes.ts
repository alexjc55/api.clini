import type { Express } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { generateTokens, refreshAccessToken, revokeUserTokens } from "./auth";
import { authMiddleware, requirePermissions, requireUserType, sendError, i18nMiddleware } from "./middleware";
import {
  insertUserSchema, loginSchema, insertAddressSchema, insertOrderSchema,
  updateOrderSchema, updateCourierProfileSchema, insertRoleSchema, orderStatuses,
  isValidStatusTransition, type OrderStatus
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await storage.initDefaults();
  
  app.use(i18nMiddleware);

  app.post("/api/auth/register", authRateLimiter, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByPhone(data.phone);
      if (existing) {
        return sendError(res, 409, L.common.conflict, { field: "phone" });
      }
      
      const user = await storage.createUser(data);
      const tokens = generateTokens(user.id);
      
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

  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
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
      
      if (deviceId) {
        const userAgent = req.headers["user-agent"] || null;
        await storage.createSession(
          user.id,
          tokens.refreshToken,
          deviceId,
          platform || "web",
          userAgent
        );
      }
      
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

  app.post("/api/auth/refresh", authRateLimiter, async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return sendError(res, 400, L.common.bad_request, { field: "refreshToken" });
      }
      
      const tokens = refreshAccessToken(refreshToken);
      if (!tokens) {
        return sendError(res, 401, L.auth.token_expired);
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

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const { passwordHash, ...user } = req.user!;
    const roles = await storage.getUserRoles(user.id);
    res.json({ ...user, roles: roles.map(r => r.name) });
  });

  app.get("/api/users", authMiddleware, requirePermissions("users.read"), async (req, res) => {
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

  app.get("/api/users/:id", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return sendError(res, 404, L.user.not_found, { userId: req.params.id });
    }
    
    const { passwordHash, ...userData } = user;
    const roles = await storage.getUserRoles(user.id);
    res.json({ ...userData, roles: roles.map(r => r.name) });
  });

  app.patch("/api/users/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
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
      
      const userRoles = await storage.getUserRoles(req.user!.id);
      await storage.createAuditLog({
        userId: req.user!.id,
        userRole: userRoles.map(r => r.name).join(","),
        action: "BLOCK_USER",
        entity: "user",
        entityId: req.params.id,
        changes: { status: { from: existingUser.status, to: "blocked" } },
        metadata: {}
      });
    } else if (Object.keys(req.body).length > 0) {
      const userRoles = await storage.getUserRoles(req.user!.id);
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of Object.keys(req.body)) {
        if ((existingUser as any)[key] !== req.body[key]) {
          changes[key] = { from: (existingUser as any)[key], to: req.body[key] };
        }
      }
      if (Object.keys(changes).length > 0) {
        await storage.createAuditLog({
          userId: req.user!.id,
          userRole: userRoles.map(r => r.name).join(","),
          action: "UPDATE_USER",
          entity: "user",
          entityId: req.params.id,
          changes,
          metadata: {}
        });
      }
    }
    
    const { passwordHash, ...userData } = user;
    res.json(userData);
  });

  app.post("/api/users/:id/roles", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
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
    
    const userRoles = await storage.getUserRoles(req.user!.id);
    await storage.createAuditLog({
      userId: req.user!.id,
      userRole: userRoles.map(r => r.name).join(","),
      action: "ASSIGN_ROLE",
      entity: "user",
      entityId: req.params.id,
      changes: { roles: { from: oldRoles.map(r => r.name), to: newRoles.map(r => r.name) } },
      metadata: {}
    });
    
    res.json({ 
      status: "success", 
      message: { key: L.user.roles_assigned, params: { userId: req.params.id } } 
    });
  });

  app.delete("/api/users/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
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
    
    const userRoles = await storage.getUserRoles(req.user!.id);
    await storage.createAuditLog({
      userId: req.user!.id,
      userRole: userRoles.map(r => r.name).join(","),
      action: "DELETE_USER",
      entity: "user",
      entityId: req.params.id,
      changes: { deletedAt: { from: null, to: deleted?.deletedAt } },
      metadata: {}
    });
    
    res.status(204).send();
  });

  app.get("/api/addresses", authMiddleware, async (req, res) => {
    const addresses = await storage.getAddressesByUser(req.user!.id);
    res.json(addresses);
  });

  app.post("/api/addresses", authMiddleware, async (req, res) => {
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

  app.patch("/api/addresses/:id", authMiddleware, async (req, res) => {
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

  app.delete("/api/addresses/:id", authMiddleware, async (req, res) => {
    const address = await storage.getAddress(req.params.id);
    if (!address) {
      return sendError(res, 404, L.address.not_found, { addressId: req.params.id });
    }
    if (address.userId !== req.user!.id && !req.userPermissions?.includes("addresses.manage")) {
      return sendError(res, 403, L.address.forbidden);
    }
    
    await storage.deleteAddress(req.params.id);
    res.status(204).send();
  });

  app.post("/api/orders", authMiddleware, async (req, res) => {
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

  app.get("/api/orders", authMiddleware, async (req, res) => {
    const { status, page = "1", limit = "20" } = req.query;
    
    let orders;
    if (req.userPermissions?.includes("orders.read")) {
      orders = await storage.getOrders({ status: status as any });
    } else if (req.user!.type === "courier") {
      orders = await storage.getOrders({ courierId: req.user!.id, status: status as any });
    } else {
      orders = await storage.getOrders({ clientId: req.user!.id, status: status as any });
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

  app.get("/api/orders/:id", authMiddleware, async (req, res) => {
    const order = await storage.getOrder(req.params.id);
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

  app.patch("/api/orders/:id", authMiddleware, async (req, res) => {
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
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  app.post("/api/orders/:id/assign", authMiddleware, requirePermissions("orders.assign"), async (req, res) => {
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
    res.json({
      status: "success",
      message: { key: L.order.assigned, params: { orderId: req.params.id, courierId } },
      data: updated
    });
  });

  app.post("/api/orders/:id/cancel", authMiddleware, async (req, res) => {
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
    
    res.json({
      status: "success",
      message: { key: L.order.cancelled, params: { orderId: req.params.id } },
      data: updated
    });
  });

  app.get("/api/courier/profile", authMiddleware, requireUserType("courier"), async (req, res) => {
    const profile = await storage.getCourierProfile(req.user!.id);
    if (!profile) {
      return sendError(res, 404, L.courier.profile_not_found);
    }
    res.json(profile);
  });

  app.patch("/api/courier/profile", authMiddleware, requireUserType("courier"), async (req, res) => {
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

  app.get("/api/courier/orders", authMiddleware, requireUserType("courier"), async (req, res) => {
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

  app.post("/api/courier/orders/:id/accept", authMiddleware, requireUserType("courier"), async (req, res) => {
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

  app.post("/api/courier/orders/:id/complete", authMiddleware, requireUserType("courier"), async (req, res) => {
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

  app.get("/api/roles", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const roles = await storage.getRoles();
    const rolesWithPermissions = await Promise.all(
      roles.map(async (role) => {
        const permissions = await storage.getRolePermissions(role.id);
        return { ...role, permissions: permissions.map(p => p.name) };
      })
    );
    res.json(rolesWithPermissions);
  });

  app.post("/api/roles", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const { name, description, permissionIds } = req.body;
      const data = insertRoleSchema.parse({ name, description });
      
      const role = await storage.createRole(data);
      
      if (Array.isArray(permissionIds)) {
        for (const permId of permissionIds) {
          await storage.addRolePermission(role.id, permId);
        }
      }
      
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

  app.get("/api/permissions", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const permissions = await storage.getPermissions();
    res.json(permissions);
  });

  app.get("/api/couriers", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const couriers = await storage.getUsers({ type: "courier" });
    
    const couriersWithProfiles = await Promise.all(
      couriers.map(async (courier) => {
        const { passwordHash, ...userData } = courier;
        const profile = await storage.getCourierProfile(courier.id);
        return { ...userData, profile };
      })
    );
    
    res.json(couriersWithProfiles);
  });

  app.patch("/api/couriers/:id/verify", authMiddleware, requirePermissions("couriers.verify"), async (req, res) => {
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
    const updated = await storage.updateCourierProfile(req.params.id, { verificationStatus: status } as any);
    
    const userRoles = await storage.getUserRoles(req.user!.id);
    await storage.createAuditLog({
      userId: req.user!.id,
      userRole: userRoles.map(r => r.name).join(","),
      action: "VERIFY_COURIER",
      entity: "courier",
      entityId: req.params.id,
      changes: { verificationStatus: { from: oldStatus, to: status } },
      metadata: {}
    });
    
    res.json({
      status: "success",
      message: { key: L.courier.verified, params: { courierId: req.params.id, status } },
      data: updated
    });
  });

  app.get("/api/audit-logs", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const { userId, entity, entityId, page = "1", limit = "50" } = req.query;
    const logs = await storage.getAuditLogs({
      userId: userId as string,
      entity: entity as string,
      entityId: entityId as string
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

  app.get("/api/auth/sessions", authMiddleware, async (req, res) => {
    const sessions = await storage.getUserSessions(req.user!.id);
    res.json(sessions.map(s => ({
      id: s.id,
      deviceId: s.deviceId,
      platform: s.platform,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt
    })));
  });

  app.delete("/api/auth/sessions/:id", authMiddleware, async (req, res) => {
    const sessions = await storage.getUserSessions(req.user!.id);
    const session = sessions.find(s => s.id === req.params.id);
    
    if (!session) {
      return sendError(res, 404, L.auth.session_not_found, { sessionId: req.params.id });
    }
    
    await storage.deleteSession(req.params.id);
    res.status(204).send();
  });

  app.post("/api/auth/logout-all", authMiddleware, async (req, res) => {
    await storage.deleteUserSessions(req.user!.id);
    revokeUserTokens(req.user!.id);
    res.json({ 
      status: "success", 
      message: { key: L.auth.logout_all_success } 
    });
  });

  return httpServer;
}
