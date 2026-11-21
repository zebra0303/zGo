import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  requireAdmin,
  requireAdminOrRoomToken,
  signAdminToken,
  signRoomToken,
  verifyRoomToken,
} from "../src/middleware/auth";

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("zGo auth middleware privilege separation", () => {
  it("allows valid admin token on requireAdmin", () => {
    const token = signAdminToken();
    const req = {
      cookies: { admin_token: token },
      headers: {},
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks online roomToken from accessing admin routes via requireAdmin", () => {
    const roomToken = signRoomToken("room-123", "guest");
    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${roomToken}` },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows online roomToken on requireAdminOrRoomToken", () => {
    const roomToken = signRoomToken("room-123", "host");
    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${roomToken}` },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdminOrRoomToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects missing token with 401", () => {
    const req = { cookies: {}, headers: {} } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("verifies valid roomToken and rejects admin token in verifyRoomToken", () => {
    const roomToken = signRoomToken("room-abc", "guest");
    expect(verifyRoomToken(roomToken)).toMatchObject({
      type: "online_room",
      roomId: "room-abc",
      role: "guest",
    });

    const adminToken = signAdminToken();
    expect(() => verifyRoomToken(adminToken)).toThrow("Invalid room token");
  });
});
