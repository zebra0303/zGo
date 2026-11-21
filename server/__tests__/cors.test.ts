import { describe, it, expect } from "vitest";
import { isCorsOriginAllowed } from "../src/middleware/cors";

describe("zGo CORS origin validation", () => {
  const defaultAllowed = ["http://localhost:5550", "http://localhost:3333"];

  it("allows requests without an Origin header", () => {
    expect(
      isCorsOriginAllowed(undefined, "zgo.zlog.pe.kr", defaultAllowed),
    ).toBe(true);
  });

  it("allows same-origin requests behind a reverse proxy without CORS_ORIGIN configured", () => {
    expect(
      isCorsOriginAllowed(
        "https://zgo.zlog.pe.kr",
        "zgo.zlog.pe.kr",
        defaultAllowed,
      ),
    ).toBe(true);
    expect(
      isCorsOriginAllowed(
        "https://zgo.zlog.pe.kr",
        "zgo.zlog.pe.kr, internal-proxy:3333",
        defaultAllowed,
      ),
    ).toBe(true);
  });

  it("allows explicitly allowlisted cross-origin URLs", () => {
    expect(
      isCorsOriginAllowed(
        "http://localhost:5550",
        "localhost:3333",
        defaultAllowed,
      ),
    ).toBe(true);
  });

  it("blocks untrusted cross-origin requests", () => {
    expect(
      isCorsOriginAllowed(
        "https://evil.example.com",
        "zgo.zlog.pe.kr",
        defaultAllowed,
      ),
    ).toBe(false);
    expect(
      isCorsOriginAllowed(
        "https://zgo.zlog.pe.kr.evil.com",
        "zgo.zlog.pe.kr",
        defaultAllowed,
      ),
    ).toBe(false);
    expect(
      isCorsOriginAllowed(
        "javascript:alert(1)",
        "zgo.zlog.pe.kr",
        defaultAllowed,
      ),
    ).toBe(false);
  });
});
