import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { verifyAccessToken, extractToken } from "./auth";
import { storage } from "./storage";
import type { User, EnvironmentMode } from "@shared/schema";
import { L } from "./localization-keys";
import { i18nMiddleware, sendLocalizedError } from "./i18n";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userPermissions?: string[];
      requestId: string;
      environment: EnvironmentMode;
      isSandbox: boolean;
    }
  }
}

export { i18nMiddleware };

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

const idempotencyCache = new Map<string, { statusCode: number; response: unknown; expiresAt: number }>();

export function idempotencyMiddleware(endpoint: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers["idempotency-key"] as string;
    
    if (!idempotencyKey) {
      return next();
    }
    
    const userId = req.user?.id || "anonymous";
    const cacheKey = `${userId}:${endpoint}:${idempotencyKey}`;
    
    const cached = idempotencyCache.get(cacheKey);
    if (cached) {
      if (Date.now() < cached.expiresAt) {
        res.setHeader("X-Idempotency-Replayed", "true");
        return res.status(cached.statusCode).json(cached.response);
      }
      idempotencyCache.delete(cacheKey);
    }
    
    const originalJson = res.json.bind(res);
    res.json = function(body: unknown) {
      idempotencyCache.set(cacheKey, {
        statusCode: res.statusCode,
        response: body,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      });
      return originalJson(body);
    };
    
    next();
  };
}

export function sendError(res: Response, status: number, key: string, params?: Record<string, unknown>) {
  sendLocalizedError(res, status, key, params);
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization);
  
  if (!token) {
    return sendError(res, 401, L.auth.missing_token);
  }
  
  const userId = verifyAccessToken(token);
  if (!userId) {
    return sendError(res, 401, L.auth.invalid_token);
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    return sendError(res, 401, L.user.not_found);
  }
  
  if (user.status === "blocked") {
    return sendError(res, 403, L.auth.user_blocked);
  }
  
  req.user = user;
  req.userPermissions = await storage.getUserPermissions(userId);
  
  next();
}

export function requirePermissions(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userPermissions) {
      return sendError(res, 401, L.auth.missing_token);
    }
    
    const hasAllPermissions = requiredPermissions.every(
      perm => req.userPermissions!.includes(perm)
    );
    
    if (!hasAllPermissions) {
      return sendError(res, 403, L.common.missing_permission, { 
        required: requiredPermissions 
      });
    }
    
    next();
  };
}

export function requireUserType(...types: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 401, L.auth.missing_token);
    }
    
    if (!types.includes(req.user.type)) {
      return sendError(res, 403, L.common.invalid_user_type, { 
        required: types,
        current: req.user.type 
      });
    }
    
    next();
  };
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization);
  
  if (!token) {
    return next();
  }
  
  const userId = verifyAccessToken(token);
  if (!userId) {
    return next();
  }
  
  storage.getUser(userId).then(user => {
    if (user && user.status !== "blocked") {
      req.user = user;
      storage.getUserPermissions(userId).then(perms => {
        req.userPermissions = perms;
        next();
      });
    } else {
      next();
    }
  });
}

import { environmentStorage } from "./environment-context";

export function sandboxMiddleware(req: Request, res: Response, next: NextFunction) {
  const envHeader = req.headers["x-environment"] as string;
  
  if (envHeader === "sandbox") {
    req.environment = "sandbox";
    req.isSandbox = true;
    res.setHeader("X-Environment", "sandbox");
  } else {
    req.environment = "production";
    req.isSandbox = false;
  }
  
  environmentStorage.run({ environment: req.environment }, () => {
    next();
  });
}
