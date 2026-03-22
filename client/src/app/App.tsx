import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useGameStore } from "@/entities/match/model/store";
import { useTranslation } from "react-i18next";
import { API_BASE_URL, fetchWithAuth } from "@/shared/api/gameApi";
import { useShallow } from "zustand/react/shallow";
import {
  applyPrimaryColor,
  applyFontFamily,
  applyThemeMode,
} from "@/shared/lib/themeUtils";
import { useRoute } from "@/shared/lib/router";

const MainPage = lazy(() => import("@/pages/MainPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const OnlinePage = lazy(() => import("@/pages/OnlinePage"));

import { GameState } from "@/entities/match/model/types";

// Fetch and apply server config (theme, color, font, language)
const fetchAndApplyServerConfig = async (
  i18n: { changeLanguage: (lang: string) => void },
  signal?: AbortSignal,
) => {
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/settings/config`, {
      signal,
    });
    if (!res.ok) return;
    const config = await res.json();
    if (signal?.aborted) return;

    const gameStore = useGameStore.getState();
    const updates: Partial<GameState> = {};

    if (config.theme) updates.theme = config.theme;
    if (config.primary_color) updates.primaryColor = config.primary_color;
    if (config.font_family) updates.fontFamily = config.font_family;
    if (config.language) {
      updates.language = config.language;
      i18n.changeLanguage(config.language);
    }

    if (Object.keys(updates).length > 0) {
      gameStore.setGameConfig(updates);
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      // Silently ignore config fetch errors
    }
  }
};

function App() {
  const { language, theme, primaryColor, fontFamily } = useGameStore(
    useShallow((state) => ({
      language: state.language,
      theme: state.theme,
      primaryColor: state.primaryColor,
      fontFamily: state.fontFamily,
    })),
  );
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

  // Reactive theme application
  useEffect(() => {
    applyThemeMode(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Reactive color application
  useEffect(() => {
    applyPrimaryColor(primaryColor);
    localStorage.setItem("primary_color", primaryColor);
  }, [primaryColor]);

  // Reactive font application
  useEffect(() => {
    applyFontFamily(fontFamily);
    localStorage.setItem("font_family", fontFamily);
  }, [fontFamily]);

  // Auth gate: check status + try token refresh + apply server config
  useEffect(() => {
    const abortController = new AbortController();

    const init = async () => {
      await fetchAndApplyServerConfig(i18n, abortController.signal);
      if (abortController.signal.aborted) return;

      try {
        const statusRes = await fetchWithAuth(
          `${API_BASE_URL}/settings/status`,
          {
            signal: abortController.signal,
          },
        );
        const statusData = await statusRes.json();
        if (abortController.signal.aborted) return;
        const isSetup = statusData.isSetup;

        // Try to refresh token (relies on HttpOnly cookie)
        try {
          const refreshRes = await fetchWithAuth(
            `${API_BASE_URL}/settings/refresh`,
            {
              method: "POST",
              signal: abortController.signal,
            },
          );
          if (refreshRes.ok) {
            if (abortController.signal.aborted) return;
            setAuthState("authenticated");
            return;
          }
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            // Token expired, missing, or invalid
          }
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

  const handleAuthenticated = useCallback(async () => {
    // using HttpOnly cookies, no token param needed
    await fetchAndApplyServerConfig(i18n);
    setAuthState("authenticated");
  }, [i18n]);

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
