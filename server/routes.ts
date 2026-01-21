import type { Express, Router, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Router as ExpressRouter } from "express";
import rateLimit from "express-rate-limit";
import { readFileSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";
import { getStorage } from "./storage-factory";
import type { IStorage } from "./repositories";

let storage: IStorage;
import { generateTokens, refreshAccessToken, revokeUserTokens } from "./auth";
import { authMiddleware, requirePermissions, requireUserType, sendError, i18nMiddleware, requestIdMiddleware, idempotencyMiddleware, sandboxMiddleware, metaCacheMiddleware } from "./middleware";
import { sandboxWriteGuard } from "./sandbox-guard";
import {
  insertUserSchema, loginSchema, insertAddressSchema, insertOrderSchema,
  updateOrderSchema, updateCourierProfileSchema, insertRoleSchema,
  orderStatuses, userTypes, userStatuses, availabilityStatuses, verificationStatuses, orderEventTypes,
  isValidStatusTransition, type OrderStatus, type AuditAction,
  insertEventSchema, productEventTypes, eventActorTypes,
  insertUserActivitySchema, userActivityTypes,
  insertUserFlagSchema, userFlagKeys,
  insertBonusTransactionSchema, bonusTransactionTypes, bonusReasons,
  insertSubscriptionSchema, updateSubscriptionSchema, subscriptionStatuses,
  insertSubscriptionRuleSchema, subscriptionRuleTypes,
  insertSubscriptionPlanSchema,
  insertPartnerSchema, partnerCategories, partnerStatuses,
  insertPartnerOfferSchema,
  insertOrderFinanceSnapshotSchema,
  insertLevelSchema, levelCodes, insertProgressTransactionSchema, progressReasons,
  insertFeatureSchema, featureCodes, insertUserFeatureAccessSchema, featureGrantTypes, streakTypes,
  insertWebhookSchema, webhookEventTypes,
  insertFeatureFlagSchema, systemFeatureFlags, environmentModes,
  type SystemFeatureFlag,
  type ProductEventType, type EventActorType, type UserActivityType, type UserFlagKey, type BonusTransactionType,
  type ProgressReason, type StreakType, type FeatureCode
} from "@shared/schema";
import { z } from "zod";
import { L } from "./localization-keys";
import { sendLocalizedSuccess } from "./i18n";
import { dispatchWebhook, dispatchEventToSubscribers } from "./webhooks";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) return value[0] as string;
  return value as string | undefined;
}

function getQueryParamBool(req: Request, key: string): boolean {
  const value = getQueryParam(req, key);
  return value === "true";
}

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

function paginate<T>(items: T[], page: number, perPage: number): { data: T[]; meta: { page: number; perPage: number; total: number; hasNext: boolean } } {
  const total = items.length;
  const start = (page - 1) * perPage;
  const paginatedItems = items.slice(start, start + perPage);
  return {
    data: paginatedItems,
    meta: {
      page,
      perPage,
      total,
      hasNext: start + perPage < total
    }
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  storage = await getStorage();
  
  app.use(requestIdMiddleware);
  app.use(i18nMiddleware);
  app.use(sandboxMiddleware);
  app.use(sandboxWriteGuard);
  
  const v1Router = ExpressRouter();

  v1Router.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  v1Router.get("/meta/order-statuses", metaCacheMiddleware, (_req, res) => {
    res.json(orderStatuses.map(code => ({ code })));
  });

  v1Router.get("/meta/user-types", metaCacheMiddleware, (_req, res) => {
    res.json(userTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/user-statuses", metaCacheMiddleware, (_req, res) => {
    res.json(userStatuses.map(code => ({ code })));
  });

  v1Router.get("/meta/availability-statuses", metaCacheMiddleware, (_req, res) => {
    res.json(availabilityStatuses.map(code => ({ code })));
  });

  v1Router.get("/meta/verification-statuses", metaCacheMiddleware, (_req, res) => {
    res.json(verificationStatuses.map(code => ({ code })));
  });

  v1Router.get("/meta/order-event-types", metaCacheMiddleware, (_req, res) => {
    res.json(orderEventTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/client-types", metaCacheMiddleware, (_req, res) => {
    res.json(["mobile_client", "courier_app", "erp", "partner", "web"].map(code => ({ code })));
  });

  v1Router.get("/meta/environment-modes", metaCacheMiddleware, (_req, res) => {
    res.json(environmentModes.map(code => ({ code })));
  });

  v1Router.get("/environment", (req, res) => {
    res.json({
      mode: req.environment,
      isSandbox: req.isSandbox
    });
  });

  v1Router.post("/auth/register", authRateLimiter, async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByPhone(data.phone);
      if (existing) {
        return sendError(res, 409, L.common.conflict, { field: "phone" });
      }
      
      const user = await storage.createUser(data);
      const tokens = generateTokens(user.id);
      
      const deviceId = req.headers["x-device-id"] as string || "unknown";
      const userAgent = req.headers["user-agent"] || null;
      const platform = (req.body.platform || "web") as "ios" | "android" | "web";
      const clientId = req.body.clientId;
      const clientType = req.body.clientType;
      
      await storage.createSession(
        user.id,
        tokens.refreshToken,
        deviceId,
        platform,
        userAgent,
        clientId,
        clientType
      );
      
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
      const { deviceId, platform, clientId, clientType } = req.body;
      
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
        userAgent,
        clientId,
        clientType
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
      const { refreshToken, clientId, clientType } = req.body;
      if (!refreshToken) {
        return sendError(res, 400, L.common.bad_request, { field: "refreshToken" });
      }
      
      const existingSession = await storage.getSession(refreshToken);
      if (!existingSession) {
        return sendError(res, 401, L.auth.token_expired);
      }
      
      const tokens = await refreshAccessToken(refreshToken, storage);
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

  v1Router.get("/auth/me", authMiddleware, async (req, res) => {
    const { passwordHash, ...user } = req.user!;
    const roles = await storage.getUserRoles(user.id);
    res.json({ ...user, roles: roles.map(r => r.name) });
  });

  v1Router.get("/users", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const { type, status, includeDeleted, page = "1", perPage = "20" } = req.query;
    const users = await storage.getUsers({
      type: type as any,
      status: status as any,
      includeDeleted: includeDeleted === "true"
    });
    
    const pageNum = parseInt(page as string) || 1;
    const perPageNum = parseInt(perPage as string) || 20;
    const sanitizedUsers = users.map(({ passwordHash, ...u }) => u);
    const result = paginate(sanitizedUsers, pageNum, perPageNum);
    
    res.json(result);
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
      await revokeUserTokens(user.id, storage);
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
    await revokeUserTokens(req.params.id, storage);
    
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

  v1Router.post("/orders", authMiddleware, idempotencyMiddleware("/orders"), async (req, res) => {
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
      
      dispatchEventToSubscribers("order.created", {
        orderId: order.id,
        clientId: order.clientId,
        addressId: order.addressId,
        price: order.price,
        createdAt: order.createdAt
      });
      
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
    const { status, includeDeleted, page = "1", perPage = "20" } = req.query;
    
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
    
    const pageNum = parseInt(page as string) || 1;
    const perPageNum = parseInt(perPage as string) || 20;
    const result = paginate(orders, pageNum, perPageNum);
    
    res.json(result);
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
    
    dispatchEventToSubscribers("order.assigned", {
      orderId: order.id,
      clientId: order.clientId,
      courierId,
      assignedAt: new Date().toISOString()
    });
    
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
    
    dispatchEventToSubscribers("order.cancelled", {
      orderId: order.id,
      clientId: order.clientId,
      courierId: order.courierId,
      previousStatus: order.status,
      reason: req.body.reason,
      cancelledAt: new Date().toISOString()
    });
    
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
    
    dispatchEventToSubscribers("order.completed", {
      orderId: order.id,
      clientId: order.clientId,
      courierId: order.courierId,
      status: "completed",
      completedAt: new Date().toISOString()
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
    const { userId, entity, entityId, action, page = "1", perPage = "50" } = req.query;
    const logs = await storage.getAuditLogs({
      userId: userId as string,
      entity: entity as string,
      entityId: entityId as string,
      action: action as string
    });
    
    const pageNum = parseInt(page as string) || 1;
    const perPageNum = parseInt(perPage as string) || 50;
    const result = paginate(logs, pageNum, perPageNum);
    
    res.json(result);
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
    await revokeUserTokens(req.user!.id, storage);
    res.json({ 
      status: "success", 
      message: { key: L.session.all_sessions_deleted } 
    });
  });

  // ==================== V2 ENDPOINTS ====================

  // Events
  v1Router.post("/events", authMiddleware, async (req, res) => {
    try {
      const data = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(data);
      res.status(201).json({ status: "success", data: event });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/events", authMiddleware, requirePermissions("reports.read"), async (req, res) => {
    const filters: { type?: ProductEventType; actorType?: EventActorType; actorId?: string; entityType?: string; entityId?: string; from?: string; to?: string } = {};
    const type = getQueryParam(req, "type");
    const actorType = getQueryParam(req, "actorType");
    const actorId = getQueryParam(req, "actorId");
    const entityType = getQueryParam(req, "entityType");
    const entityId = getQueryParam(req, "entityId");
    const from = getQueryParam(req, "from");
    const to = getQueryParam(req, "to");
    const page = getQueryParam(req, "page") || "1";
    const perPage = getQueryParam(req, "perPage") || "20";
    if (type) filters.type = type as ProductEventType;
    if (actorType) filters.actorType = actorType as EventActorType;
    if (actorId) filters.actorId = actorId;
    if (entityType) filters.entityType = entityType;
    if (entityId) filters.entityId = entityId;
    if (from) filters.from = from;
    if (to) filters.to = to;
    const events = await storage.getEvents(filters);
    const pageNum = parseInt(page) || 1;
    const perPageNum = parseInt(perPage) || 20;
    const result = paginate(events, pageNum, perPageNum);
    res.json(result);
  });

  v1Router.get("/events/:id", authMiddleware, requirePermissions("reports.read"), async (req, res) => {
    const event = await storage.getEvent(req.params.id);
    if (!event) return sendError(res, 404, L.common.not_found);
    res.json(event);
  });

  // Meta endpoints for v2 enums
  v1Router.get("/meta/event-types", metaCacheMiddleware, (_req, res) => {
    res.json(productEventTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/event-actor-types", metaCacheMiddleware, (_req, res) => {
    res.json(eventActorTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/activity-types", metaCacheMiddleware, (_req, res) => {
    res.json(userActivityTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/user-flag-keys", metaCacheMiddleware, (_req, res) => {
    res.json(userFlagKeys.map(code => ({ code })));
  });

  v1Router.get("/meta/bonus-transaction-types", metaCacheMiddleware, (_req, res) => {
    res.json(bonusTransactionTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/bonus-reasons", metaCacheMiddleware, (_req, res) => {
    res.json(bonusReasons.map(code => ({ code })));
  });

  v1Router.get("/meta/subscription-statuses", metaCacheMiddleware, (_req, res) => {
    res.json(subscriptionStatuses.map(code => ({ code })));
  });

  v1Router.get("/meta/subscription-rule-types", metaCacheMiddleware, (_req, res) => {
    res.json(subscriptionRuleTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/partner-categories", metaCacheMiddleware, (_req, res) => {
    res.json(partnerCategories.map(code => ({ code })));
  });

  v1Router.get("/meta/partner-statuses", metaCacheMiddleware, (_req, res) => {
    res.json(partnerStatuses.map(code => ({ code })));
  });

  // User Activity
  v1Router.post("/users/:id/activity", authMiddleware, async (req, res) => {
    try {
      const userId = req.params.id;
      if (req.user!.id !== userId && req.user!.type !== "staff") {
        return sendError(res, 403, L.common.forbidden);
      }
      const data = insertUserActivitySchema.parse(req.body);
      const activity = await storage.createUserActivity(userId, data);
      res.status(201).json({ status: "success", data: activity });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/users/:id/activity", authMiddleware, async (req, res) => {
    const userId = req.params.id;
    if (req.user!.id !== userId && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const filters: { eventType?: UserActivityType; from?: string; to?: string } = {};
    const eventType = getQueryParam(req, "eventType");
    const from = getQueryParam(req, "from");
    const to = getQueryParam(req, "to");
    if (eventType) filters.eventType = eventType as UserActivityType;
    if (from) filters.from = from;
    if (to) filters.to = to;
    const activities = await storage.getUserActivities(userId, filters);
    res.json(activities);
  });

  v1Router.get("/users/:id/activity/summary", authMiddleware, async (req, res) => {
    const userId = req.params.id;
    if (req.user!.id !== userId && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const summary = await storage.getUserActivitySummary(userId);
    res.json(summary);
  });

  // User Flags
  v1Router.get("/users/:id/flags", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const flags = await storage.getUserFlags(req.params.id);
    res.json(flags);
  });

  v1Router.post("/users/:id/flags", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertUserFlagSchema.parse(req.body);
      const flag = await storage.setUserFlag(req.params.id, data);
      res.status(201).json({ status: "success", data: flag });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.delete("/users/:id/flags/:key", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const deleted = await storage.deleteUserFlag(req.params.id, req.params.key as UserFlagKey);
    if (!deleted) return sendError(res, 404, L.common.not_found);
    res.status(204).send();
  });

  v1Router.get("/flags/:key/users", authMiddleware, requirePermissions("users.read"), async (req, res) => {
    const valueParam = getQueryParam(req, "value");
    const value = valueParam === "false" ? false : true;
    const userIds = await storage.getUsersByFlag(req.params.key as UserFlagKey, value);
    res.json(userIds);
  });

  // Bonus System
  v1Router.get("/bonus/accounts/:userId", authMiddleware, async (req, res) => {
    const userId = req.params.userId;
    if (req.user!.id !== userId && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const account = await storage.getBonusAccount(userId);
    res.json(account);
  });

  v1Router.post("/bonus/transactions", authMiddleware, requirePermissions("payments.read"), idempotencyMiddleware("/bonus/transactions"), async (req, res) => {
    try {
      const { userId, ...transactionData } = req.body;
      const data = insertBonusTransactionSchema.parse(transactionData);
      const transaction = await storage.createBonusTransaction(userId, data);
      
      if (data.type === "earn") {
        dispatchEventToSubscribers("bonus.earned", {
          userId,
          amount: transaction.amount,
          reason: transaction.reason,
          createdAt: transaction.createdAt
        });
      } else if (data.type === "spend") {
        dispatchEventToSubscribers("bonus.redeemed", {
          userId,
          amount: transaction.amount,
          reason: transaction.reason,
          createdAt: transaction.createdAt
        });
      }
      
      res.status(201).json({ status: "success", data: transaction });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/bonus/transactions/:userId", authMiddleware, async (req, res) => {
    const userId = req.params.userId;
    if (req.user!.id !== userId && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const filters: { type?: BonusTransactionType; from?: string; to?: string } = {};
    const type = getQueryParam(req, "type");
    const from = getQueryParam(req, "from");
    const to = getQueryParam(req, "to");
    const page = getQueryParam(req, "page") || "1";
    const perPage = getQueryParam(req, "perPage") || "20";
    if (type) filters.type = type as BonusTransactionType;
    if (from) filters.from = from;
    if (to) filters.to = to;
    const transactions = await storage.getBonusTransactions(userId, filters);
    const pageNum = parseInt(page) || 1;
    const perPageNum = parseInt(perPage) || 20;
    const result = paginate(transactions, pageNum, perPageNum);
    res.json(result);
  });

  // Subscriptions
  v1Router.get("/subscriptions", authMiddleware, async (req, res) => {
    if (req.user!.type === "staff") {
      // Staff can see all (would need pagination in production)
      const userId = getQueryParam(req, "userId") || "";
      const allSubs = await storage.getSubscriptionsByUser(userId);
      return res.json(allSubs);
    }
    const subscriptions = await storage.getSubscriptionsByUser(req.user!.id);
    res.json(subscriptions);
  });

  v1Router.get("/subscriptions/:id", authMiddleware, async (req, res) => {
    const subscription = await storage.getSubscription(req.params.id);
    if (!subscription) return sendError(res, 404, L.common.not_found);
    if (subscription.userId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    res.json(subscription);
  });

  v1Router.post("/subscriptions", authMiddleware, async (req, res) => {
    try {
      const data = insertSubscriptionSchema.parse(req.body);
      const subscription = await storage.createSubscription(req.user!.id, data);
      
      dispatchEventToSubscribers("subscription.created", {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        status: subscription.status,
        createdAt: subscription.createdAt
      });
      
      res.status(201).json({ status: "success", data: subscription });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.patch("/subscriptions/:id", authMiddleware, async (req, res) => {
    const subscription = await storage.getSubscription(req.params.id);
    if (!subscription) return sendError(res, 404, L.common.not_found);
    if (subscription.userId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    try {
      const data = updateSubscriptionSchema.parse(req.body);
      const updated = await storage.updateSubscription(req.params.id, data);
      res.json({ status: "success", data: updated });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/subscriptions/:id/rules", authMiddleware, async (req, res) => {
    const subscription = await storage.getSubscription(req.params.id);
    if (!subscription) return sendError(res, 404, L.common.not_found);
    if (subscription.userId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const rules = await storage.getSubscriptionRules(req.params.id);
    res.json(rules);
  });

  v1Router.post("/subscriptions/:id/rules", authMiddleware, async (req, res) => {
    const subscription = await storage.getSubscription(req.params.id);
    if (!subscription) return sendError(res, 404, L.common.not_found);
    if (subscription.userId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    try {
      const data = insertSubscriptionRuleSchema.parse(req.body);
      const rule = await storage.createSubscriptionRule(req.params.id, data);
      res.status(201).json({ status: "success", data: rule });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.delete("/subscriptions/rules/:ruleId", authMiddleware, async (req, res) => {
    const deleted = await storage.deleteSubscriptionRule(req.params.ruleId);
    if (!deleted) return sendError(res, 404, L.common.not_found);
    res.status(204).send();
  });

  // Subscription Plans
  v1Router.get("/subscription-plans", async (_req, res) => {
    const plans = await storage.getSubscriptionPlans(true);
    res.json(plans);
  });

  v1Router.get("/subscription-plans/:id", async (req, res) => {
    const plan = await storage.getSubscriptionPlan(req.params.id);
    if (!plan) return sendError(res, 404, L.common.not_found);
    res.json(plan);
  });

  v1Router.post("/subscription-plans", authMiddleware, requirePermissions("subscriptions.manage"), async (req, res) => {
    try {
      const data = insertSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan(data);
      res.status(201).json({ status: "success", data: plan });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.patch("/subscription-plans/:id", authMiddleware, requirePermissions("subscriptions.manage"), async (req, res) => {
    const updated = await storage.updateSubscriptionPlan(req.params.id, req.body);
    if (!updated) return sendError(res, 404, L.common.not_found);
    res.json({ status: "success", data: updated });
  });

  // Partners
  v1Router.get("/partners", async (req, res) => {
    const filters: { category?: string; status?: string } = {};
    const category = getQueryParam(req, "category");
    const status = getQueryParam(req, "status");
    if (category) filters.category = category;
    if (status) filters.status = status;
    const partners = await storage.getPartners(filters);
    res.json(partners);
  });

  v1Router.get("/partners/:id", async (req, res) => {
    const partner = await storage.getPartner(req.params.id);
    if (!partner) return sendError(res, 404, L.common.not_found);
    res.json(partner);
  });

  v1Router.post("/partners", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertPartnerSchema.parse(req.body);
      const partner = await storage.createPartner(data);
      res.status(201).json({ status: "success", data: partner });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.patch("/partners/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const updated = await storage.updatePartner(req.params.id, req.body);
    if (!updated) return sendError(res, 404, L.common.not_found);
    res.json({ status: "success", data: updated });
  });

  // Partner Offers
  v1Router.get("/partners/:id/offers", async (req, res) => {
    const activeOnly = getQueryParamBool(req, "activeOnly");
    const offers = await storage.getPartnerOffers(req.params.id, activeOnly);
    res.json(offers);
  });

  v1Router.post("/partners/:id/offers", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertPartnerOfferSchema.parse(req.body);
      const offer = await storage.createPartnerOffer(req.params.id, data);
      res.status(201).json({ status: "success", data: offer });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/partner-offers", async (req, res) => {
    const segmentsParam = getQueryParam(req, "segments");
    const segments = segmentsParam ? segmentsParam.split(",") : [];
    const offers = await storage.getOffersForSegments(segments);
    res.json(offers);
  });

  v1Router.get("/partner-offers/:id", async (req, res) => {
    const offer = await storage.getPartnerOffer(req.params.id);
    if (!offer) return sendError(res, 404, L.common.not_found);
    res.json(offer);
  });

  v1Router.patch("/partner-offers/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const updated = await storage.updatePartnerOffer(req.params.id, req.body);
    if (!updated) return sendError(res, 404, L.common.not_found);
    res.json({ status: "success", data: updated });
  });

  // Order Finance Snapshots
  v1Router.get("/orders/:id/finance", authMiddleware, requirePermissions("payments.read"), async (req, res) => {
    const snapshot = await storage.getOrderFinanceSnapshot(req.params.id);
    if (!snapshot) return sendError(res, 404, L.common.not_found);
    res.json(snapshot);
  });

  v1Router.post("/orders/:id/finance", authMiddleware, requirePermissions("payments.read"), async (req, res) => {
    try {
      const data = insertOrderFinanceSnapshotSchema.parse(req.body);
      const snapshot = await storage.createOrderFinanceSnapshot(req.params.id, data);
      res.status(201).json({ status: "success", data: snapshot });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.patch("/orders/:id/finance", authMiddleware, requirePermissions("payments.read"), async (req, res) => {
    const updated = await storage.updateOrderFinanceSnapshot(req.params.id, req.body);
    if (!updated) return sendError(res, 404, L.common.not_found);
    res.json({ status: "success", data: updated });
  });

  // ==================== GAMIFICATION ENDPOINTS ====================

  // Meta endpoints for gamification
  v1Router.get("/meta/level-codes", metaCacheMiddleware, (_req, res) => {
    res.json(levelCodes.map(code => ({ code })));
  });

  v1Router.get("/meta/progress-reasons", metaCacheMiddleware, (_req, res) => {
    res.json(progressReasons.map(code => ({ code })));
  });

  v1Router.get("/meta/streak-types", metaCacheMiddleware, (_req, res) => {
    res.json(streakTypes.map(code => ({ code })));
  });

  v1Router.get("/meta/feature-codes", metaCacheMiddleware, (_req, res) => {
    res.json(featureCodes.map(code => ({ code })));
  });

  v1Router.get("/meta/feature-grant-types", metaCacheMiddleware, (_req, res) => {
    res.json(featureGrantTypes.map(code => ({ code })));
  });

  // Levels (Admin management)
  v1Router.get("/levels", async (_req, res) => {
    const levels = await storage.getLevels();
    res.json(levels);
  });

  v1Router.post("/levels", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertLevelSchema.parse(req.body);
      const level = await storage.createLevel(data);
      res.status(201).json({ status: "success", data: level });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/levels/:code", async (req, res) => {
    const level = await storage.getLevelByCode(req.params.code as any);
    if (!level) return sendError(res, 404, L.common.not_found);
    res.json(level);
  });

  // User Progress & Levels
  v1Router.get("/users/:id/progress", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.read")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const progress = await storage.getUserProgress(req.params.id);
    const currentLevel = await storage.getUserLevel(req.params.id);
    const levelDetails = currentLevel ? await storage.getLevel(currentLevel.levelId) : null;
    res.json({ ...progress, currentLevel: levelDetails });
  });

  v1Router.post("/users/:id/progress", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertProgressTransactionSchema.parse(req.body);
      const tx = await storage.createProgressTransaction(req.params.id, data);
      res.status(201).json({ status: "success", data: tx });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/users/:id/progress/transactions", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.read")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const reason = getQueryParam(req, "reason") as ProgressReason | undefined;
    const from = getQueryParam(req, "from");
    const to = getQueryParam(req, "to");
    const transactions = await storage.getProgressTransactions(req.params.id, { reason, from, to });
    res.json(transactions);
  });

  v1Router.get("/users/:id/level", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.read")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const userLevel = await storage.getUserLevel(req.params.id);
    if (!userLevel) {
      return res.json({ currentLevel: null, history: [] });
    }
    const level = await storage.getLevel(userLevel.levelId);
    const history = await storage.getUserLevelHistory(req.params.id);
    res.json({ currentLevel: level, achievedAt: userLevel.achievedAt, history });
  });

  v1Router.post("/users/:id/level", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const { levelId } = req.body;
      if (!levelId) {
        return sendError(res, 400, L.common.validation_error, { details: "levelId required" });
      }
      const level = await storage.getLevel(levelId);
      if (!level) return sendError(res, 404, L.common.not_found);
      
      const userLevel = await storage.createUserLevel(req.params.id, { levelId, current: true });
      res.status(201).json({ status: "success", data: { userLevel, level } });
    } catch (err) {
      return sendError(res, 500, L.common.internal_error);
    }
  });

  // Streaks
  v1Router.get("/users/:id/streaks", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.read")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const streaks = await storage.getUserStreaks(req.params.id);
    res.json(streaks);
  });

  v1Router.get("/users/:id/streaks/:type", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.read")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const streak = await storage.getUserStreak(req.params.id, req.params.type as StreakType);
    if (!streak) {
      return res.json({ userId: req.params.id, type: req.params.type, currentCount: 0, maxCount: 0 });
    }
    res.json(streak);
  });

  v1Router.post("/users/:id/streaks/:type/increment", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.manage")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const streak = await storage.incrementStreak(req.params.id, req.params.type as StreakType);
    res.json({ status: "success", data: streak });
  });

  v1Router.post("/users/:id/streaks/:type/reset", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const streak = await storage.resetStreak(req.params.id, req.params.type as StreakType);
    res.json({ status: "success", data: streak });
  });

  // Features (Admin management)
  v1Router.get("/features", async (_req, res) => {
    const features = await storage.getFeatures();
    res.json(features);
  });

  v1Router.post("/features", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertFeatureSchema.parse(req.body);
      const feature = await storage.createFeature(data);
      res.status(201).json({ status: "success", data: feature });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/features/:code", async (req, res) => {
    const feature = await storage.getFeatureByCode(req.params.code as FeatureCode);
    if (!feature) return sendError(res, 404, L.common.not_found);
    res.json(feature);
  });

  // User Feature Access
  v1Router.get("/users/:id/features", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.read")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const accessList = await storage.getUserFeatureAccess(req.params.id);
    const featuresWithDetails = await Promise.all(
      accessList.map(async (a) => {
        const feature = await storage.getFeature(a.featureId);
        return { ...a, feature };
      })
    );
    res.json(featuresWithDetails);
  });

  v1Router.get("/users/:id/features/:code", authMiddleware, async (req, res) => {
    if (req.user!.id !== req.params.id) {
      const perms = await storage.getUserPermissions(req.user!.id);
      if (!perms.includes("users.read")) {
        return sendError(res, 403, L.common.forbidden);
      }
    }
    const hasAccess = await storage.hasFeatureAccess(req.params.id, req.params.code as FeatureCode);
    res.json({ featureCode: req.params.code, hasAccess });
  });

  v1Router.post("/users/:id/features", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertUserFeatureAccessSchema.parse(req.body);
      const access = await storage.grantFeatureAccess(req.params.id, data);
      res.status(201).json({ status: "success", data: access });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.delete("/users/:id/features/:featureId", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const success = await storage.revokeFeatureAccess(req.params.id, req.params.featureId);
    if (!success) return sendError(res, 404, L.common.not_found);
    res.json({ status: "success" });
  });

  // ==================== WEBHOOKS ====================

  v1Router.get("/meta/webhook-event-types", metaCacheMiddleware, (_req, res) => {
    res.json(webhookEventTypes.map(code => ({ code })));
  });

  v1Router.post("/webhooks", authMiddleware, requireUserType(["staff", "courier"]), async (req, res) => {
    try {
      const data = insertWebhookSchema.parse(req.body);
      const webhook = await storage.createWebhook(req.user!.id, data);
      res.status(201).json({
        status: "success",
        message: { key: L.webhook.created },
        data: webhook
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.get("/webhooks", authMiddleware, async (req, res) => {
    const webhooks = await storage.getWebhooksByPartner(req.user!.id);
    res.json(webhooks.map(w => ({ ...w, secret: w.secret.substring(0, 8) + "..." })));
  });

  v1Router.get("/webhooks/:id", authMiddleware, async (req, res) => {
    const webhook = await storage.getWebhook(req.params.id);
    if (!webhook) return sendError(res, 404, L.common.not_found);
    if (webhook.partnerId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    res.json({ ...webhook, secret: webhook.secret.substring(0, 8) + "..." });
  });

  v1Router.patch("/webhooks/:id", authMiddleware, async (req, res) => {
    const webhook = await storage.getWebhook(req.params.id);
    if (!webhook) return sendError(res, 404, L.common.not_found);
    if (webhook.partnerId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const updated = await storage.updateWebhook(req.params.id, req.body);
    res.json({ status: "success", data: updated });
  });

  v1Router.delete("/webhooks/:id", authMiddleware, async (req, res) => {
    const webhook = await storage.getWebhook(req.params.id);
    if (!webhook) return sendError(res, 404, L.common.not_found);
    if (webhook.partnerId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    await storage.deleteWebhook(req.params.id);
    res.json({ status: "success" });
  });

  v1Router.get("/webhooks/:id/deliveries", authMiddleware, async (req, res) => {
    const webhook = await storage.getWebhook(req.params.id);
    if (!webhook) return sendError(res, 404, L.common.not_found);
    if (webhook.partnerId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const deliveries = await storage.getWebhookDeliveries(req.params.id);
    res.json(deliveries);
  });

  v1Router.post("/webhooks/:id/test", authMiddleware, async (req, res) => {
    const webhook = await storage.getWebhook(req.params.id);
    if (!webhook) return sendError(res, 404, L.common.not_found);
    if (webhook.partnerId !== req.user!.id && req.user!.type !== "staff") {
      return sendError(res, 403, L.common.forbidden);
    }
    const result = await dispatchWebhook(webhook, "order.completed", {
      orderId: "test-order-123",
      status: "completed",
      completedAt: new Date().toISOString()
    }, true);
    res.json({ 
      status: result.success ? "success" : "failed", 
      message: { key: result.success ? L.webhook.test_sent : L.webhook.delivery_failed }, 
      statusCode: result.statusCode,
      error: result.error
    });
  });

  // ==================== FEATURE FLAGS (SYSTEM) ====================

  v1Router.get("/flags", authMiddleware, requirePermissions("reports.read"), async (_req, res) => {
    const flags = await storage.getAllFeatureFlags();
    res.json(flags);
  });

  v1Router.get("/flags/:key", authMiddleware, async (req, res) => {
    const flag = await storage.getFeatureFlagByKey(req.params.key as SystemFeatureFlag);
    if (!flag) return sendError(res, 404, L.common.not_found);
    const isEnabled = await storage.isFeatureEnabled(req.params.key as SystemFeatureFlag, req.user!.type);
    res.json({ ...flag, enabledForUser: isEnabled });
  });

  v1Router.post("/flags", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    try {
      const data = insertFeatureFlagSchema.parse(req.body);
      const flag = await storage.createFeatureFlag(data);
      res.status(201).json({ status: "success", data: flag });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return sendError(res, 400, L.common.validation_error, { details: err.errors[0].message });
      }
      return sendError(res, 500, L.common.internal_error);
    }
  });

  v1Router.patch("/flags/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const flag = await storage.getFeatureFlag(req.params.id);
    if (!flag) return sendError(res, 404, L.common.not_found);
    const updated = await storage.updateFeatureFlag(req.params.id, req.body);
    res.json({ status: "success", data: updated });
  });

  v1Router.delete("/flags/:id", authMiddleware, requirePermissions("users.manage"), async (req, res) => {
    const success = await storage.deleteFeatureFlag(req.params.id);
    if (!success) return sendError(res, 404, L.common.not_found);
    res.json({ status: "success" });
  });

  v1Router.get("/meta/feature-flag-keys", metaCacheMiddleware, (_req, res) => {
    res.json(systemFeatureFlags.map(code => ({ code })));
  });

  // ==================== END V2 ENDPOINTS ====================

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
