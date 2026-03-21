import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { GameState } from "@/entities/match/model/types";
import { useShallow } from "zustand/react/shallow";
import { API_BASE_URL, fetchWithAuth } from "@/shared/api/gameApi";
import { createMaskedError } from "@/shared/lib/errors/AppError";

interface AdminPanelProps {
  onLogout: () => void;
}

const FONTS = [
  {
    label: "System Default",
    value:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  { label: "Pretendard", value: "'Pretendard', sans-serif" },
  { label: "NanumSquare Neo", value: "'NanumSquareNeo', sans-serif" },
  { label: "Noto Sans KR", value: "'Noto Sans KR', sans-serif" },
  { label: "Nanum Myeongjo", value: "'Nanum Myeongjo', serif" },
];

const AdminPanel = ({ onLogout }: AdminPanelProps) => {
  const { t } = useTranslation();
  const {
    language: storeLanguage,
    theme: storeTheme,
    primaryColor: storePrimaryColor,
    fontFamily: storeFontFamily,
    setGameConfig,
  } = useGameStore(
    useShallow((s) => ({
      language: s.language,
      theme: s.theme,
      primaryColor: s.primaryColor,
      fontFamily: s.fontFamily,
      setGameConfig: s.setGameConfig,
    })),
  );

  // Local state for settings (not applied to store until 'Save' is clicked)
  const [localLanguage, setLocalLanguage] = useState(storeLanguage);
  const [localTheme, setLocalTheme] = useState(storeTheme);
  const [localPrimaryColor, setLocalPrimaryColor] = useState(storePrimaryColor);
  const [localFontFamily, setLocalFontFamily] = useState(storeFontFamily);

  const [visitsMultiplier, setVisitsMultiplier] = useState(1.0);
  const [tempMultiplier, setTempMultiplier] = useState(1.0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Sync local state when store changes (e.g. from another part of the app or on mount)
  useEffect(() => {
    setLocalLanguage(storeLanguage);
    setLocalTheme(storeTheme);
    setLocalPrimaryColor(storePrimaryColor);
    setLocalFontFamily(storeFontFamily);
  }, [storeLanguage, storeTheme, storePrimaryColor, storeFontFamily]);

  // refactor: track mount status to prevent state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Fetch current config from server on mount
  useEffect(() => {
    const abortController = new AbortController();
    fetchWithAuth(`${API_BASE_URL}/settings/config`, {
      signal: abortController.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted.current || abortController.signal.aborted) return;

        // Update store with server values (this triggers reactive effects in App.tsx)
        const updates: Partial<GameState> = {};
        if (data.language) updates.language = data.language;
        if (data.theme) updates.theme = data.theme;
        if (data.primary_color) updates.primaryColor = data.primary_color;
        if (data.font_family) updates.fontFamily = data.font_family;

        if (Object.keys(updates).length > 0) {
          setGameConfig(updates);
        }

        if (data.ai_visits_multiplier)
          setVisitsMultiplier(parseFloat(data.ai_visits_multiplier));
        if (data.ai_temp_multiplier)
          setTempMultiplier(parseFloat(data.ai_temp_multiplier));
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch config", err);
        }
      });
    return () => abortController.abort();
  }, [setGameConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/settings/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: localLanguage,
          theme: localTheme,
          primary_color: localPrimaryColor,
          font_family: localFontFamily,
          ai_visits_multiplier: visitsMultiplier.toString(),
          ai_temp_multiplier: tempMultiplier.toString(),
        }),
      });

      if (res.ok) {
        if (!isMounted.current) return;

        // Update global store only after successful save
        setGameConfig({
          language: localLanguage,
          theme: localTheme,
          primaryColor: localPrimaryColor,
          fontFamily: localFontFamily,
        });

        setSaveMessage(t("admin.saved"));
      } else {
        if (!isMounted.current) return;
        const data = await res.json();
        setSaveMessage(data.error || "Save failed");
      }
    } catch (e: unknown) {
      if (isMounted.current) {
        const maskedErr = createMaskedError(e, "Save failed");
        setSaveMessage(maskedErr.message);
      }
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
        setTimeout(() => {
          if (isMounted.current) setSaveMessage("");
        }, 3000);
      }
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage("");
    setPasswordError(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage(t("admin.fieldsRequired", "All fields are required."));
      setPasswordError(true);
      return;
    }
    if (newPassword.length < 4) {
      setPasswordMessage(
        t("admin.passwordMinLength", "Password must be at least 4 characters."),
      );
      setPasswordError(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(
        t("admin.passwordMismatch", "Passwords do not match."),
      );
      setPasswordError(true);
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/settings/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        if (!isMounted.current) return;
        const data = await res.json();
        setPasswordMessage(data.error || "Failed");
        setPasswordError(true);
        return;
      }

      if (isMounted.current) {
        setPasswordMessage(t("admin.passwordChanged", "Password changed."));
        setPasswordError(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          if (isMounted.current) setPasswordMessage("");
        }, 3000);
      }
    } catch (e: unknown) {
      if (isMounted.current) {
        const maskedErr = createMaskedError(e, "Password change failed");
        setPasswordMessage(maskedErr.message);
        setPasswordError(true);
      }
    }
  };

  const selectClass =
    "bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1 text-xs text-gray-900 dark:text-gray-100";
  const inputClass =
    "w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 ring-accent";
  const labelClass = "font-medium text-gray-600 dark:text-gray-300";
  const dividerClass = "border-t border-gray-50 dark:border-gray-700";

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-3">
      <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-2">
        <span className="text-xl">🔧</span> {t("admin.title")}
      </h2>

      {/* Language */}
      <div className="flex items-center justify-between text-sm">
        <span className={labelClass}>{t("admin.langTitle")}</span>
        <select
          value={localLanguage}
          onChange={(e) => setLocalLanguage(e.target.value as "ko" | "en")}
          className={selectClass}
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </div>

      {/* Theme */}
      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50 dark:border-gray-700">
        <span className={labelClass}>{t("admin.themeTitle")}</span>
        <select
          value={localTheme}
          onChange={(e) => setLocalTheme(e.target.value as "light" | "dark")}
          className={selectClass}
        >
          <option value="light">{t("admin.themeLight")}</option>
          <option value="dark">{t("admin.themeDark")}</option>
        </select>
      </div>

      {/* Primary Color */}
      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50 dark:border-gray-700">
        <span className={labelClass}>{t("admin.colorTitle")}</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={localPrimaryColor}
            onChange={(e) => setLocalPrimaryColor(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent"
          />
          <span className="text-[10px] font-mono text-gray-400 uppercase">
            {localPrimaryColor}
          </span>
        </div>
      </div>

      {/* Font */}
      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50 dark:border-gray-700">
        <span className={labelClass}>{t("admin.fontTitle")}</span>
        <select
          value={localFontFamily}
          onChange={(e) => setLocalFontFamily(e.target.value)}
          className={`${selectClass} max-w-[140px]`}
        >
          {FONTS.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label === "System Default"
                ? t("admin.fontSystem")
                : font.label}
            </option>
          ))}
        </select>
      </div>

      {/* AI Performance Tuning */}
      <div className={`space-y-2 pt-2 ${dividerClass}`}>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
          {t("admin.aiPerformanceTitle")}
        </h3>

        {/* Visits Multiplier */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className={labelClass}>{t("admin.visitsMultiplier")}</span>
            <span className="font-bold text-accent">
              {Math.round(visitsMultiplier * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="10.0"
            step="0.1"
            value={visitsMultiplier}
            onChange={(e) => setVisitsMultiplier(parseFloat(e.target.value))}
            className="w-full accent-[var(--primary)] h-1"
          />
        </div>

        {/* Temperature Multiplier */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className={labelClass}>{t("admin.tempMultiplier")}</span>
            <span className="font-bold text-accent">
              {tempMultiplier.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={tempMultiplier}
            onChange={(e) => setTempMultiplier(parseFloat(e.target.value))}
            className="w-full accent-[var(--primary)] h-1"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2 border-t border-gray-50 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-2 bg-accent bg-accent-hover disabled:opacity-50 text-accent-foreground font-bold rounded-lg text-xs transition-colors"
        >
          {isSaving ? "..." : t("admin.saveSettings")}
        </button>
        {saveMessage && (
          <p className="text-xs text-center mt-1 text-green-600 dark:text-green-400">
            {saveMessage}
          </p>
        )}
      </div>

      {/* Password Change */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-2">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t("admin.changePassword")}
        </h3>
        <input
          type="password"
          placeholder={t("admin.currentPassword")}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder={t("admin.newPassword")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          placeholder={t("admin.confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
        {passwordMessage && (
          <p
            className={`text-xs ${
              passwordError
                ? "text-red-500 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}
          >
            {passwordMessage}
          </p>
        )}
        <button
          onClick={handleChangePassword}
          className="w-full py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-lg text-xs border border-gray-200 dark:border-gray-600 transition-colors"
        >
          {t("admin.changePassword")}
        </button>
      </div>

      {/* Logout */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onLogout}
          className="w-full py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold rounded-lg text-xs border border-red-200 dark:border-red-800 transition-colors"
        >
          {t("admin.logout")}
        </button>
      </div>
    </div>
  );
};

export default React.memo(AdminPanel);
