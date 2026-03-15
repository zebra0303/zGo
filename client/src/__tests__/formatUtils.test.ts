import { describe, it, expect } from "vitest";
import { formatGameResultText } from "@/shared/lib/formatUtils";

// Minimal mock for i18next TFunction
const t = ((key: string, opts?: Record<string, string>) => {
  const translations: Record<string, string> = {
    draw: "무승부",
    black: "흑",
    white: "백",
  };

  if (key === "winByScore" && opts) {
    return `${opts.winner} ${opts.diff}집승`;
  }
  if (key === "resignWin" && opts) {
    return `${opts.loser} 기권패 (${opts.winner} 승)`;
  }

  return translations[key] || key;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

describe("formatGameResultText", () => {
  it("should return null for null input", () => {
    expect(formatGameResultText(null, t)).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(formatGameResultText("", t)).toBeNull();
  });

  it("should format draw", () => {
    expect(formatGameResultText("Draw", t)).toBe("무승부");
  });

  it("should format score result (Black wins)", () => {
    const result = formatGameResultText("Black +3.5", t);
    expect(result).toBe("흑 3.5집승");
  });

  it("should format score result (White wins)", () => {
    const result = formatGameResultText("White +12.5", t);
    expect(result).toBe("백 12.5집승");
  });

  it("should format score result (uppercase)", () => {
    const result = formatGameResultText("BLACK +7.5", t);
    expect(result).toBe("흑 7.5집승");
  });

  it("should format resignation result", () => {
    const result = formatGameResultText("BLACK wins (WHITE resigned)", t);
    expect(result).toBe("백 기권패 (흑 승)");
  });

  it("should format resignation (lowercase)", () => {
    const result = formatGameResultText("White wins (Black resigned)", t);
    expect(result).toBe("흑 기권패 (백 승)");
  });

  it("should return unmatched text as-is", () => {
    const custom = "Custom result text";
    expect(formatGameResultText(custom, t)).toBe(custom);
  });

  it("should handle score with whole number", () => {
    const result = formatGameResultText("Black +15", t);
    expect(result).toBe("흑 15집승");
  });
});
