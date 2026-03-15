/**
 * Applies the primary accent color to CSS variable and computes foreground color.
 */
export function applyPrimaryColor(hexColor: string): void {
  document.documentElement.style.setProperty("--primary", hexColor);

  // Compute foreground color based on perceived brightness
  const hex = hexColor.replace("#", "");
  if (hex.length < 6) return;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  document.documentElement.style.setProperty(
    "--primary-foreground",
    brightness > 155 ? "#000000" : "#ffffff",
  );
}

/**
 * Applies font family directly to document root so all elements inherit it.
 */
export function applyFontFamily(fontFamily: string): void {
  document.documentElement.style.setProperty("--font-family", fontFamily);
  document.documentElement.style.fontFamily = fontFamily;
}

/**
 * Applies dark/light theme class and updates PWA theme-color meta tag.
 */
export function applyThemeMode(mode: "dark" | "light"): void {
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      mode === "dark" ? "#111827" : "#f3f4f6",
    );
  }
}
