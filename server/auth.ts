import jwt from "jsonwebtoken";
import type { IStorage } from "./repositories";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const JWT_SECRET: string = process.env.SESSION_SECRET;

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

interface TokenPayload {
  userId: string;
  type: "access" | "refresh";
}

export function generateTokens(userId: string): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(
    { userId, type: "access" },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY, issuer: "waste-collection-api" }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: "refresh" },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY, issuer: "waste-collection-api" }
  );
  
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: "waste-collection-api" }) as unknown as TokenPayload;
    if (payload.type !== "access") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
  storage: IStorage
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET, { issuer: "waste-collection-api" }) as unknown as TokenPayload;
    if (payload.type !== "refresh") return null;
    
    const session = await storage.getSession(refreshToken);
    if (!session) return null;
    
    await storage.deleteSession(session.id);
    
    const tokens = generateTokens(payload.userId);
    
    await storage.createSession(
      payload.userId,
      tokens.refreshToken,
      session.deviceId,
      session.platform,
      session.userAgent || null,
      session.clientId || undefined,
      session.clientType as "mobile_client" | "courier_app" | "erp" | "partner" | "web" | undefined
    );
    
    return tokens;
  } catch {
    return null;
  }
}

export async function revokeUserTokens(userId: string, storage: IStorage): Promise<void> {
  await storage.deleteUserSessions(userId);
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}
