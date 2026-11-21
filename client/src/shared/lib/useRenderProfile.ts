import { useEffect } from "react";

/**
 * Dev-only hook that logs slow renders (>16ms) for a named component.
 * Automatically disabled in production builds via import.meta.env.DEV.
 *
 * Usage: useRenderProfile("BoardCore") at the top of a component.
 */
export const useRenderProfile = (componentName: string) => {
  // Capture render start timestamp locally instead of mutating a ref during render
  const renderStart = import.meta.env.DEV ? performance.now() : 0;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const duration = performance.now() - renderStart;
    // Only log renders slower than one frame (~16ms)
    if (duration > 16) {
      console.warn(`[Perf] ${componentName} render: ${duration.toFixed(1)}ms`);
    }
  });
};
