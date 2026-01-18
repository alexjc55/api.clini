import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, extractToken } from "./auth";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userPermissions?: string[];
    }
  }
}

export function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({
    error: { code, message }
  });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req.headers.authorization);
  
  if (!token) {
    return sendError(res, 401, "UNAUTHORIZED", "Authentication required");
  }
  
  const userId = verifyAccessToken(token);
  if (!userId) {
    return sendError(res, 401, "UNAUTHORIZED", "Invalid or expired token");
  }
  
  const user = await storage.getUser(userId);
  if (!user) {
    return sendError(res, 401, "UNAUTHORIZED", "User not found");
  }
  
  if (user.status === "blocked") {
    return sendError(res, 403, "FORBIDDEN", "User account is blocked");
  }
  
  req.user = user;
  req.userPermissions = await storage.getUserPermissions(userId);
  
  next();
}

export function requirePermissions(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userPermissions) {
      return sendError(res, 401, "UNAUTHORIZED", "Authentication required");
    }
    
    const hasAllPermissions = requiredPermissions.every(
      perm => req.userPermissions!.includes(perm)
    );
    
    if (!hasAllPermissions) {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission");
    }
    
    next();
  };
}

export function requireUserType(...types: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "Authentication required");
    }
    
    if (!types.includes(req.user.type)) {
      return sendError(res, 403, "FORBIDDEN", "This action is not available for your user type");
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
