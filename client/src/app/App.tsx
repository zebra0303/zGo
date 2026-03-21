import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useGameStore } from "@/entities/match/model/store";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "@/shared/api/gameApi";
import {
  applyPrimaryColor,
  applyFontFamily,
  applyThemeMode,
} from "@/shared/lib/themeUtils";
import { useRoute } from "@/shared/lib/router";

const MainPage = lazy(() => import("@/pages/MainPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const OnlinePage = lazy(() => import("@/pages/OnlinePage"));

// Fetch and apply server config (theme, color, font, language)
const fetchAndApplyServerConfig = async (
  i18n: { changeLanguage: (lang: string) => void },
  signal?: AbortSignal,
) => {
  try {
    const res = await fetch(`${API_BASE_URL}/settings/config`, { signal });
    if (!res.ok) return;
    const config = await res.json();
    if (signal?.aborted) return;

    if (config.theme) {
      applyThemeMode(config.theme as "dark" | "light");
      localStorage.setItem("theme", config.theme);
    }
    if (config.primary_color) {
      applyPrimaryColor(config.primary_color);
      localStorage.setItem("primary_color", config.primary_color);
    }
    if (config.font_family) {
      applyFontFamily(config.font_family);
      localStorage.setItem("font_family", config.font_family);
    }
    if (config.language) {
      i18n.changeLanguage(config.language);
      useGameStore
        .getState()
        .setGameConfig({ language: config.language as "ko" | "en" });
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      // Silently ignore config fetch errors
    }
  }
};

function App() {
  const language = useGameStore((state) => state.language);
  const { i18n } = useTranslation();
  const route = useRoute();
  const [authState, setAuthState] = useState<
    "loading" | "setup" | "login" | "authenticated"
  >("loading");

  // Sync language from Zustand store to i18n
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Apply theme from localStorage immediately to prevent FOUC
  useEffect(() => {
    const theme = localStorage.getItem("theme");
    if (theme) applyThemeMode(theme as "dark" | "light");

    const primaryColor = localStorage.getItem("primary_color");
    if (primaryColor) applyPrimaryColor(primaryColor);

    const fontFamily = localStorage.getItem("font_family");
    if (fontFamily) applyFontFamily(fontFamily);
  }, []);

  // Auth gate: check status + try token refresh + apply server config
  useEffect(() => {
    const abortController = new AbortController();

    const init = async () => {
      await fetchAndApplyServerConfig(i18n, abortController.signal);
      if (abortController.signal.aborted) return;

      try {
        const statusRes = await fetch(`${API_BASE_URL}/settings/status`, {
          signal: abortController.signal,
        });
        const statusData = await statusRes.json();
        if (abortController.signal.aborted) return;
        const isSetup = statusData.isSetup;

        const token = localStorage.getItem("admin_token");
        if (token) {
          try {
            const refreshRes = await fetch(`${API_BASE_URL}/settings/refresh`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              signal: abortController.signal,
            });
            if (refreshRes.ok) {
              const { token: newToken } = await refreshRes.json();
              if (abortController.signal.aborted) return;
              localStorage.setItem("admin_token", newToken);
              setAuthState("authenticated");
              return;
            }
          } catch (err) {
            if ((err as Error).name !== "AbortError") {
              // Token expired or invalid
            }
          }
          localStorage.removeItem("admin_token");
        }

        setAuthState(isSetup ? "login" : "setup");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Server unreachable — show login
          setAuthState("login");
        }
      }
    };
    init();
    return () => abortController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleAuthenticated = useCallback(
    async (token: string) => {
      localStorage.setItem("admin_token", token);
      await fetchAndApplyServerConfig(i18n);
      setAuthState("authenticated");
    },
    [i18n],
  );

  // Online pages bypass auth gate (anyone with the URL can access)
  if (route.page === "online-room" || route.page === "online-farewell") {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
          }
        >
          <OnlinePage />
        </Suspense>
      </div>
    );
  }

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="animate-pulse text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (authState === "setup" || authState === "login") {
    return (
      <Suspense fallback={null}>
        <AuthPage
          isSetup={authState === "login"}
          onAuthenticated={handleAuthenticated}
        />
      </Suspense>
    );
  }

  // Authenticated — show main page or online create page
  if (route.page === "online-create") {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-pulse text-gray-400">Loading...</div>
            </div>
          }
        >
          <OnlinePage />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        }
      >
        <MainPage />
      </Suspense>
    </div>
  );
}

export default App;
