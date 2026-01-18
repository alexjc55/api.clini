import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

interface TokenPayload {
  userId: string;
  type: "access" | "refresh";
}

const refreshTokens = new Map<string, { userId: string; exp: number }>();

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
  
  const decoded = jwt.decode(refreshToken) as { exp: number };
  refreshTokens.set(refreshToken, { userId, exp: decoded.exp * 1000 });
  
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: "waste-collection-api" }) as TokenPayload;
    if (payload.type !== "access") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function refreshAccessToken(refreshToken: string): { accessToken: string; refreshToken: string } | null {
  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET, { issuer: "waste-collection-api" }) as TokenPayload;
    if (payload.type !== "refresh") return null;
    
    const stored = refreshTokens.get(refreshToken);
    if (!stored) return null;
    
    refreshTokens.delete(refreshToken);
    return generateTokens(payload.userId);
  } catch {
    refreshTokens.delete(refreshToken);
    return null;
  }
}

export function revokeUserTokens(userId: string): void {
  for (const [token, data] of refreshTokens.entries()) {
    if (data.userId === userId) {
      refreshTokens.delete(token);
    }
  }
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}
