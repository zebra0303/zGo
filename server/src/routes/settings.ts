import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import db from "../db";
import { requireAdmin } from "../middleware/auth";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret";
if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not set. Using fallback secret.");
}

// Rate limit for auth endpoints (10 attempts per 15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

// Account-level lockout after consecutive failures
const LOGIN_MAX_FAILURES = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

function getLoginFailureState(): { count: number; lockedUntil: number } {
  try {
    const row = db
      .prepare(
        "SELECT value FROM system_settings WHERE key = 'login_failure_state'",
      )
      .get() as { value: string } | undefined;
    if (row) return JSON.parse(row.value);
  } catch {
    /* ignore parse errors */
  }
  return { count: 0, lockedUntil: 0 };
}

function setLoginFailureState(count: number, lockedUntil: number): void {
  const value = JSON.stringify({ count, lockedUntil });
  db.prepare(
    `INSERT INTO system_settings (key, value) VALUES ('login_failure_state', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(value);
}

function resetLoginFailureState(): void {
  setLoginFailureState(0, 0);
}

function recordLoginFailure(): { locked: boolean; remainingMs: number } {
  const state = getLoginFailureState();
  const newCount = state.count + 1;
  if (newCount >= LOGIN_MAX_FAILURES) {
    const lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    setLoginFailureState(newCount, lockedUntil);
    return { locked: true, remainingMs: LOGIN_LOCKOUT_MS };
  }
  setLoginFailureState(newCount, 0);
  return { locked: false, remainingMs: 0 };
}

function checkAccountLocked(): { locked: boolean; remainingMs: number } {
  const state = getLoginFailureState();
  if (state.lockedUntil > 0) {
    const remaining = state.lockedUntil - Date.now();
    if (remaining > 0) {
      return { locked: true, remainingMs: remaining };
    }
    resetLoginFailureState();
  }
  return { locked: false, remainingMs: 0 };
}

// 1. Check if admin password is set up
router.get("/status", (_req: Request, res: Response) => {
  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'admin_password'")
      .get() as { value: string } | undefined;
    res.json({ isSetup: !!row });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 2. Initial password setup
router.post("/setup", authLimiter, async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password is required" });

  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'admin_password'")
      .get() as { value: string } | undefined;
    if (row) return res.status(400).json({ error: "Admin already set up" });

    const hash = await bcrypt.hash(password, 10);
    db.prepare(
      "INSERT INTO system_settings (key, value) VALUES ('admin_password', ?)",
    ).run(hash);

    // Default language
    db.prepare(
      "INSERT OR IGNORE INTO system_settings (key, value) VALUES ('language', 'ko')",
    ).run();

    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "7d" });

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ message: "Admin setup successful" });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 3. Login
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const { password } = req.body;

  try {
    const lockStatus = checkAccountLocked();
    if (lockStatus.locked) {
      const remainingMin = Math.ceil(lockStatus.remainingMs / 60000);
      return res.status(429).json({
        error: `Account locked due to too many failed attempts. Try again in ${remainingMin} minute(s).`,
      });
    }

    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = 'admin_password'")
      .get() as { value: string } | undefined;
    if (!row) return res.status(400).json({ error: "Admin not set up yet" });

    const match = await bcrypt.compare(password, row.value);
    if (!match) {
      const failState = getLoginFailureState();
      const result = recordLoginFailure();
      if (result.locked) {
        const remainingMin = Math.ceil(result.remainingMs / 60000);
        return res.status(429).json({
          error: `Account locked after ${LOGIN_MAX_FAILURES} failed attempts. Try again in ${remainingMin} minute(s).`,
        });
      }
      const attemptsLeft = LOGIN_MAX_FAILURES - (failState.count + 1);
      return res.status(401).json({
        error: `Incorrect password. ${attemptsLeft} attempt(s) remaining before lockout.`,
      });
    }

    resetLoginFailureState();
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "7d" });

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ message: "Login successful" });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 4. Refresh token (extends session for active users)
router.post("/refresh", requireAdmin, (_req: Request, res: Response) => {
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "7d" });

  res.cookie("admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ message: "Token refreshed successfully" });
});

// 5. Change password
router.put(
  "/password",
  requireAdmin,
  authLimiter,
  async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }
    if (newPassword.length < 4) {
      return res
        .status(400)
        .json({ error: "New password must be at least 4 characters" });
    }

    try {
      const row = db
        .prepare(
          "SELECT value FROM system_settings WHERE key = 'admin_password'",
        )
        .get() as { value: string } | undefined;
      if (!row) return res.status(400).json({ error: "Admin not set up yet" });

      const match = await bcrypt.compare(currentPassword, row.value);
      if (!match) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      db.prepare(
        "UPDATE system_settings SET value = ? WHERE key = 'admin_password'",
      ).run(hash);

      const token = jwt.sign({ role: "admin" }, JWT_SECRET, {
        expiresIn: "7d",
      });

      res.cookie("admin_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        message: "Password changed successfully",
      });
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  },
);

// 5-2. Logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logged out" });
});

// Internal keys excluded from public config endpoint
const INTERNAL_KEYS = ["admin_password", "login_failure_state"];

// 6. Get public config (theme, language, font, color)
router.get("/config", (_req: Request, res: Response) => {
  try {
    const placeholders = INTERNAL_KEYS.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT key, value FROM system_settings WHERE key NOT IN (${placeholders})`,
      )
      .all(...INTERNAL_KEYS) as { key: string; value: string }[];

    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    if (!config.language) config.language = "ko";

    res.json(config);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 7. Update config (admin only)
router.put("/config", requireAdmin, (req: Request, res: Response) => {
  const updates = req.body as Record<string, unknown>;

  if (Object.keys(updates).length === 0)
    return res.json({ message: "No updates provided" });

  try {
    const stmt = db.prepare(`
      INSERT INTO system_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const upsertMany = db.transaction((entries: [string, unknown][]) => {
      for (const [key, value] of entries) {
        // Prevent overriding password via config route
        if (key !== "admin_password") {
          stmt.run(key, String(value));
        }
      }
    });
    upsertMany(Object.entries(updates));

    res.json({ message: "Settings updated successfully" });
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
