import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateTokens, refreshAccessToken } from "./auth";
import { authMiddleware, requirePermissions, requireUserType, sendError } from "./middleware";
import {
  insertUserSchema, loginSchema, insertAddressSchema, insertOrderSchema,
  updateOrderSchema, updateCourierProfileSchema, insertRoleSchema, orderStatuses
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await storage.initDefaults();

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByPhone(data.phone);
      if (existing) {
        return sendError(res, 409, "CONFLICT", "User with this phone already exists");
      }
      
      const user = await storage.createUser(data);
      const tokens = generateTokens(user.id);
      
      res.status(201).json(tokens);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, "BAD_REQUEST", err.errors[0].message);
      }
      return sendError(res, 500, "INTERNAL_ERROR", "Registration failed");
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.verifyUserPassword(data.phone, data.password);
      if (!user) {
        return sendError(res, 401, "UNAUTHORIZED", "Invalid phone or password");
      }
      
      if (user.status === "blocked") {
        return sendError(res, 403, "FORBIDDEN", "User account is blocked");
      }
      
      const tokens = generateTokens(user.id);
      res.json(tokens);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, "BAD_REQUEST", err.errors[0].message);
      }
      return sendError(res, 500, "INTERNAL_ERROR", "Login failed");
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return sendError(res, 400, "BAD_REQUEST", "Refresh token required");
      }
      
      const tokens = refreshAccessToken(refreshToken);
      if (!tokens) {
        return sendError(res, 401, "UNAUTHORIZED", "Invalid or expired refresh token");
      }
      
      res.json(tokens);
    } catch {
      return sendError(res, 500, "INTERNAL_ERROR", "Token refresh failed");
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const { passwordHash, ...user } = req.user!;
    const roles = await storage.getUserRoles(user.id);
    res.json({ ...user, roles: roles.map(r => r.name) });
  });

  app.get("/api/users", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const { type, status, page = "1", limit = "20" } = req.query;
    const users = await storage.getUsers({
      type: type as any,
      status: status as any
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
      return sendError(res, 404, "NOT_FOUND", "User not found");
    }
    
    const { passwordHash, ...userData } = user;
    const roles = await storage.getUserRoles(user.id);
    res.json({ ...userData, roles: roles.map(r => r.name) });
  });

  app.patch("/api/users/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const user = await storage.updateUser(req.params.id, req.body);
    if (!user) {
      return sendError(res, 404, "NOT_FOUND", "User not found");
    }
    const { passwordHash, ...userData } = user;
    res.json(userData);
  });

  app.post("/api/users/:id/roles", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) {
      return sendError(res, 400, "BAD_REQUEST", "roleIds must be an array");
    }
    
    const user = await storage.getUser(req.params.id);
    if (!user) {
      return sendError(res, 404, "NOT_FOUND", "User not found");
    }
    
    await storage.setUserRoles(req.params.id, roleIds);
    res.json({ success: true });
  });

  app.get("/api/addresses", authMiddleware, async (req, res) => {
    const addresses = await storage.getAddressesByUser(req.user!.id);
    res.json(addresses);
  });

  app.post("/api/addresses", authMiddleware, async (req, res) => {
    try {
      const data = insertAddressSchema.parse(req.body);
      const address = await storage.createAddress(req.user!.id, data);
      res.status(201).json(address);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, "BAD_REQUEST", err.errors[0].message);
      }
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to create address");
    }
  });

  app.patch("/api/addresses/:id", authMiddleware, async (req, res) => {
    const address = await storage.getAddress(req.params.id);
    if (!address) {
      return sendError(res, 404, "NOT_FOUND", "Address not found");
    }
    if (address.userId !== req.user!.id && !req.userPermissions?.includes("addresses.manage")) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission");
    }
    
    const updated = await storage.updateAddress(req.params.id, req.body);
    res.json(updated);
  });

  app.delete("/api/addresses/:id", authMiddleware, async (req, res) => {
    const address = await storage.getAddress(req.params.id);
    if (!address) {
      return sendError(res, 404, "NOT_FOUND", "Address not found");
    }
    if (address.userId !== req.user!.id && !req.userPermissions?.includes("addresses.manage")) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission");
    }
    
    await storage.deleteAddress(req.params.id);
    res.status(204).send();
  });

  app.post("/api/orders", authMiddleware, async (req, res) => {
    try {
      const data = insertOrderSchema.parse(req.body);
      
      const address = await storage.getAddress(data.addressId);
      if (!address) {
        return sendError(res, 400, "BAD_REQUEST", "Invalid address");
      }
      if (address.userId !== req.user!.id) {
        return sendError(res, 403, "FORBIDDEN", "Address does not belong to you");
      }
      
      const order = await storage.createOrder(req.user!.id, data);
      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, "BAD_REQUEST", err.errors[0].message);
      }
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to create order");
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
      return sendError(res, 404, "NOT_FOUND", "Order not found");
    }
    
    const canView = req.userPermissions?.includes("orders.read") ||
      order.clientId === req.user!.id ||
      order.courierId === req.user!.id;
    
    if (!canView) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission");
    }
    
    const address = await storage.getAddress(order.addressId);
    const events = await storage.getOrderEvents(order.id);
    
    res.json({ ...order, address, events });
  });

  app.patch("/api/orders/:id", authMiddleware, async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return sendError(res, 404, "NOT_FOUND", "Order not found");
      }
      
      const hasPermission = req.userPermissions?.includes("orders.update_status");
      const isOwner = order.clientId === req.user!.id;
      const isCourier = order.courierId === req.user!.id;
      
      if (!hasPermission && !isOwner && !isCourier) {
        return sendError(res, 403, "FORBIDDEN", "You do not have permission");
      }
      
      const data = updateOrderSchema.parse(req.body);
      const updated = await storage.updateOrder(req.params.id, data, req.user!.id);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, "BAD_REQUEST", err.errors[0].message);
      }
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to update order");
    }
  });

  app.post("/api/orders/:id/assign", authMiddleware, requirePermissions("orders.assign"), async (req, res) => {
    const { courierId } = req.body;
    if (!courierId) {
      return sendError(res, 400, "BAD_REQUEST", "courierId required");
    }
    
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, "NOT_FOUND", "Order not found");
    }
    
    if (order.courierId) {
      return sendError(res, 409, "CONFLICT", "Order already has a courier assigned");
    }
    
    const courier = await storage.getUser(courierId);
    if (!courier || courier.type !== "courier") {
      return sendError(res, 400, "BAD_REQUEST", "Invalid courier");
    }
    
    const updated = await storage.assignCourier(req.params.id, courierId, req.user!.id);
    res.json(updated);
  });

  app.post("/api/orders/:id/cancel", authMiddleware, async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, "NOT_FOUND", "Order not found");
    }
    
    const canCancel = req.userPermissions?.includes("orders.update_status") ||
      order.clientId === req.user!.id;
    
    if (!canCancel) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission");
    }
    
    if (order.status === "completed" || order.status === "cancelled") {
      return sendError(res, 409, "CONFLICT", "Cannot cancel order in current status");
    }
    
    const updated = await storage.updateOrder(req.params.id, { status: "cancelled" }, req.user!.id);
    
    await storage.createOrderEvent(req.user!.id, {
      orderId: order.id,
      eventType: "cancelled",
      metadata: { reason: req.body.reason || "No reason provided" }
    });
    
    res.json(updated);
  });

  app.get("/api/courier/profile", authMiddleware, requireUserType("courier"), async (req, res) => {
    const profile = await storage.getCourierProfile(req.user!.id);
    if (!profile) {
      return sendError(res, 404, "NOT_FOUND", "Courier profile not found");
    }
    res.json(profile);
  });

  app.patch("/api/courier/profile", authMiddleware, requireUserType("courier"), async (req, res) => {
    try {
      const data = updateCourierProfileSchema.parse(req.body);
      const profile = await storage.updateCourierProfile(req.user!.id, data);
      if (!profile) {
        return sendError(res, 404, "NOT_FOUND", "Courier profile not found");
      }
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, "BAD_REQUEST", err.errors[0].message);
      }
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to update profile");
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
      return sendError(res, 404, "NOT_FOUND", "Order not found");
    }
    
    if (order.courierId !== req.user!.id) {
      return sendError(res, 403, "FORBIDDEN", "This order is not assigned to you");
    }
    
    if (order.status !== "assigned") {
      return sendError(res, 409, "CONFLICT", "Order is not in assigned status");
    }
    
    const updated = await storage.updateOrder(req.params.id, { status: "in_progress" }, req.user!.id);
    
    await storage.createOrderEvent(req.user!.id, {
      orderId: order.id,
      eventType: "started",
      metadata: {}
    });
    
    res.json(updated);
  });

  app.post("/api/courier/orders/:id/complete", authMiddleware, requireUserType("courier"), async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    if (!order) {
      return sendError(res, 404, "NOT_FOUND", "Order not found");
    }
    
    if (order.courierId !== req.user!.id) {
      return sendError(res, 403, "FORBIDDEN", "This order is not assigned to you");
    }
    
    if (order.status !== "in_progress") {
      return sendError(res, 409, "CONFLICT", "Order is not in progress");
    }
    
    const updated = await storage.updateOrder(req.params.id, { status: "completed" }, req.user!.id);
    
    await storage.createOrderEvent(req.user!.id, {
      orderId: order.id,
      eventType: "completed",
      metadata: {}
    });
    
    res.json(updated);
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
      res.status(201).json({ ...role, permissions: permissions.map(p => p.name) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, "BAD_REQUEST", err.errors[0].message);
      }
      return sendError(res, 500, "INTERNAL_ERROR", "Failed to create role");
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
      return sendError(res, 400, "BAD_REQUEST", "Invalid verification status");
    }
    
    const courier = await storage.getUser(req.params.id);
    if (!courier || courier.type !== "courier") {
      return sendError(res, 404, "NOT_FOUND", "Courier not found");
    }
    
    const profile = await storage.getCourierProfile(req.params.id);
    if (!profile) {
      return sendError(res, 404, "NOT_FOUND", "Courier profile not found");
    }
    
    const updated = await storage.updateCourierProfile(req.params.id, { verificationStatus: status } as any);
    res.json(updated);
  });

  return httpServer;
}
