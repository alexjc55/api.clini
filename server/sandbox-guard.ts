import { Request, Response, NextFunction } from "express";
import { sendError } from "./middleware";
import { L } from "./localization-keys";

const SANDBOX_ALLOWED_WRITE_ENDPOINTS = [
  /^\/api\/v1\/orders/,
  /^\/api\/v1\/subscriptions/,
  /^\/api\/v1\/bonus/,
  /^\/api\/v1\/auth\/login/,
  /^\/api\/v1\/auth\/refresh/,
  /^\/api\/v1\/auth\/logout/,
  /^\/api\/v1\/sessions/,
  /^\/api\/v1\/environment/,
  /^\/api\/v1\/meta/,
  /^\/api\/v1\/flags/,
  /^\/api\/v1\/health/,
  /^\/api\/v1\/openapi/,
];

export function sandboxWriteGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.isSandbox) {
    return next();
  }
  
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }
  
  const path = req.path;
  const isAllowed = SANDBOX_ALLOWED_WRITE_ENDPOINTS.some(pattern => pattern.test(path));
  
  if (isAllowed) {
    return next();
  }
  
  return sendError(res, 403, L.sandbox.write_not_allowed);
}
