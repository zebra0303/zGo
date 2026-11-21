import type { Request } from "express";
import type { CorsOptionsDelegate } from "cors";
import { AppError } from "@zebra/core/server";

/**
 * Determine whether an incoming Origin header matches the request's own host
 * (same-origin browser requests behind a reverse proxy or direct localhost)
 * or is explicitly listed in the allowedOrigins allowlist.
 */
export function isCorsOriginAllowed(
  origin: string | undefined,
  requestHostHeader: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
    return true;
  }

  if (!requestHostHeader) return false;

  try {
    const parsedOrigin = new URL(origin);
    if (
      parsedOrigin.protocol !== "http:" &&
      parsedOrigin.protocol !== "https:"
    ) {
      return false;
    }
    // Reverse proxies may pass a comma-separated X-Forwarded-Host; use the first external host
    const requestHost = requestHostHeader.split(",")[0]?.trim().toLowerCase();
    return Boolean(
      requestHost && parsedOrigin.host.toLowerCase() === requestHost,
    );
  } catch {
    return false;
  }
}

/**
 * Create a per-request CORS options delegate that always permits same-origin
 * requests while enforcing the explicit allowlist for cross-origin requests.
 */
export function createCorsDelegate(
  allowedOrigins: string[],
): CorsOptionsDelegate<Request> {
  return (req, callback) => {
    const origin = req.header("Origin");
    const requestHost = req.header("X-Forwarded-Host") || req.header("Host");

    if (isCorsOriginAllowed(origin, requestHost, allowedOrigins)) {
      return callback(null, { origin: true, credentials: true });
    }

    return callback(new AppError("Not allowed by CORS", 403, "CORS_FORBIDDEN"));
  };
}
