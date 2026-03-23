import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { t } from "../src/shared/lib/i18n";

// Mock the entire fs module
vi.mock("fs");

describe("Server i18n Utility", () => {
  const mockKo = JSON.stringify({
    test: {
      hello: "안녕하세요",
      withParam: "안녕 {{name}}!",
    },
  });

  const mockEn = JSON.stringify({
    test: {
      hello: "Hello",
      withParam: "Hello {{name}}!",
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the internal cache of the i18n module if needed
    // Since it's a singleton in memory, we might need to be careful
  });

  it("should return translated text for a given key", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(mockKo as any);

    const result = t("ko", "test.hello");
    expect(result).toBe("안녕하세요");
  });

  it("should replace parameters correctly", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(mockKo as any);

    const result = t("ko", "test.withParam", { name: "zGo" });
    expect(result).toBe("안녕 zGo!");
  });

  it("should fallback to Korean if key is missing in English", () => {
    const mockEnMissing = JSON.stringify({ test: {} });

    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockImplementation((p: any) => {
      if (p.toString().includes("en")) return mockEnMissing;
      return mockKo;
    });

    const result = t("en", "test.hello");
    expect(result).toBe("안녕하세요");
  });

  it("should return the key if translation is not found in any language", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const result = t("ko", "non.existent.key");
    expect(result).toBe("non.existent.key");
  });
});
