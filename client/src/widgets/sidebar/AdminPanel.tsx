import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGameStore } from "@/entities/match/model/store";
import { API_BASE_URL, fetchWithAuth } from "@/shared/api/gameApi";
import { createMaskedError } from "@/shared/lib/errors/AppError";
import {
  applyPrimaryColor,
  applyFontFamily,
  applyThemeMode,
} from "@/shared/lib/themeUtils";

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
  const { t, i18n } = useTranslation();
  const token = localStorage.getItem("admin_token") || "";

  // Settings state
  const [language, setLanguage] = useState(i18n.language || "ko");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [primaryColor, setPrimaryColor] = useState(
    localStorage.getItem("primary_color") || "#3b82f6",
  );
  const [fontFamily, setFontFamily] = useState(
    localStorage.getItem("font_family") || FONTS[0].value,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

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
        if (abortController.signal.aborted) return;
        if (data.language) setLanguage(data.language);
        if (data.theme) setTheme(data.theme);
        if (data.primary_color) setPrimaryColor(data.primary_color);
        if (data.font_family) setFontFamily(data.font_family);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch config", err);
        }
      });
    return () => abortController.abort();
  }, []);

  const applyTheme = useCallback(
    (newTheme: string, newColor: string, newFont: string) => {
      applyThemeMode(newTheme as "dark" | "light");
      localStorage.setItem("theme", newTheme);

      applyPrimaryColor(newColor);
      localStorage.setItem("primary_color", newColor);

      applyFontFamily(newFont);
      localStorage.setItem("font_family", newFont);
    },
    [],
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/settings/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language,
          theme,
          primary_color: primaryColor,
          font_family: fontFamily,
        }),
      });

      if (res.ok) {
        // Sync language to both i18n and Zustand store to prevent App.tsx effect from reverting
        i18n.changeLanguage(language);
        useGameStore
          .getState()
          .setGameConfig({ language: language as "ko" | "en" });
        applyTheme(theme, primaryColor, fontFamily);
        setSaveMessage(t("admin.saved"));
      } else {
        const data = await res.json();
        setSaveMessage(data.error || "Save failed");
      }
    } catch (e: unknown) {
      const maskedErr = createMaskedError(e, "Save failed");
      setSaveMessage(maskedErr.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(""), 3000);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage("");
    setPasswordError(false);

    if (!currentPassword || !newPassword) {
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPasswordMessage(data.error || "Failed");
        setPasswordError(true);
        return;
      }

      if (data.token) {
        localStorage.setItem("admin_token", data.token);
      }

      setPasswordMessage(t("admin.passwordChanged", "Password changed."));
      setPasswordError(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: unknown) {
      const maskedErr = createMaskedError(e, "Password change failed");
      setPasswordMessage(maskedErr.message);
      setPasswordError(true);
    }
  };

  const selectClass =
    "bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1 text-xs text-gray-900 dark:text-gray-100";
  const inputClass =
    "w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 ring-accent";
  const labelClass = "font-medium text-gray-600 dark:text-gray-300";

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-3">
      <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-2">
        <span className="text-xl">🔧</span> {t("admin.title")}
      </h2>

      {/* Language */}
      <div className="flex items-center justify-between text-sm">
        <span className={labelClass}>{t("admin.langTitle")}</span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
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
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
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
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-gray-300 dark:border-gray-600 bg-transparent"
          />
          <span className="text-[10px] font-mono text-gray-400 uppercase">
            {primaryColor}
          </span>
        </div>
      </div>

      {/* Font */}
      <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50 dark:border-gray-700">
        <span className={labelClass}>{t("admin.fontTitle")}</span>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
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
