import { useRef, useEffect } from "react";

/**
 * Dev-only hook that logs slow renders (>16ms) for a named component.
 * Automatically disabled in production builds via import.meta.env.DEV.
 *
 * Usage: useRenderProfile("BoardCore") at the top of a component.
 */
export const useRenderProfile = (componentName: string) => {
  const renderStart = useRef(performance.now());
  renderStart.current = performance.now();

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const duration = performance.now() - renderStart.current;
    // Only log renders slower than one frame (~16ms)
    if (duration > 16) {
      console.warn(`[Perf] ${componentName} render: ${duration.toFixed(1)}ms`);
    }
  });
};
