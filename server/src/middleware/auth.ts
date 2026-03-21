import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret";

// Middleware to protect admin routes via JWT
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Check cookie first, then fallback to Authorization header
  let token = req.cookies?.admin_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    console.warn(
      "Invalid token attempt:",
      err instanceof Error ? err.message : "unknown",
    );
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
