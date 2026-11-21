import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { resolveJwtSecret } from "@zebra/core/server";

// Centralized secret resolution prevents hardcoded production fallbacks
export const JWT_SECRET = resolveJwtSecret(
  process.env.JWT_SECRET,
  process.env.NODE_ENV,
);

export interface AdminTokenPayload {
  type: "admin";
  role: "admin";
}

export interface RoomTokenPayload {
  type: "online_room";
  roomId: string;
  role: "host" | "guest";
}

export function signAdminToken(): string {
  return jwt.sign(
    { type: "admin", role: "admin" } satisfies AdminTokenPayload,
    JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
}

export function signRoomToken(roomId: string, role: "host" | "guest"): string {
  return jwt.sign(
    { type: "online_room", roomId, role } satisfies RoomTokenPayload,
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}

export function verifyRoomToken(token: string): RoomTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as Partial<RoomTokenPayload>;
  if (
    decoded.type !== "online_room" ||
    typeof decoded.roomId !== "string" ||
    (decoded.role !== "host" && decoded.role !== "guest")
  ) {
    throw new Error("Invalid room token");
  }
  return decoded as RoomTokenPayload;
}

function extractRequestToken(req: Request): string | undefined {
  if (req.cookies?.admin_token) {
    return req.cookies.admin_token as string;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return undefined;
}

/**
 * Middleware to protect admin routes via JWT.
 * Explicitly verifies role === "admin" so online roomTokens cannot bypass admin auth.
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = extractRequestToken(req);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Partial<AdminTokenPayload>;
    // Enforce explicit admin role claim to block online roomToken privilege escalation
    if (
      decoded.role !== "admin" ||
      (decoded.type && decoded.type !== "admin")
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden: Admin privileges required" });
    }
    next();
  } catch (err) {
    console.warn(
      "Invalid token attempt:",
      err instanceof Error ? err.message : "unknown",
    );
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Allow either an authenticated admin OR a valid online roomToken (for post-game scoring/review).
 */
export const requireAdminOrRoomToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = extractRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    if (
      decoded.role === "admin" &&
      (decoded.type === undefined || decoded.type === "admin")
    ) {
      return next();
    }
    if (
      decoded.type === "online_room" &&
      typeof decoded.roomId === "string" &&
      (decoded.role === "host" || decoded.role === "guest")
    ) {
      return next();
    }
    return res.status(403).json({ error: "Forbidden" });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
