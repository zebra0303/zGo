import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret";

// Middleware to protect admin routes via JWT in Authorization header
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

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
