import { useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL, fetchWithAuth } from "@/shared/api/gameApi";
import { createMaskedError } from "@zebra/core";

interface AuthPageProps {
  isSetup: boolean;
  onAuthenticated: (token: string) => void;
}

const AuthPage = ({ isSetup, onAuthenticated }: AuthPageProps) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [setupDone, setSetupDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const endpoint =
      isSetup || setupDone
        ? `${API_BASE_URL}/settings/login`
        : `${API_BASE_URL}/settings/setup`;

    try {
      const res = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      if (isSetup || setupDone) {
        // Login successful (token is now an HttpOnly cookie set by server)
        onAuthenticated("cookie_set");
      } else {
        // Setup successful → switch to login mode
        setSetupDone(true);
        setPassword("");
        setError(t("auth.setupComplete"));
      }
    } catch (e: unknown) {
      const maskedErr = createMaskedError(e, "Authentication failed");
      setError(maskedErr.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showLoginMode = isSetup || setupDone;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-sm w-full">
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/zgo_logo.png"
            alt="zGo"
            className="w-16 h-16 rounded-full object-cover shadow-md mb-4"
          />
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {showLoginMode ? t("auth.loginTitle") : t("auth.setupTitle")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {showLoginMode ? t("auth.loginDesc") : t("auth.setupDesc")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 ring-accent"
          />
          {error && (
            <p
              className={`text-sm ${
                error === t("auth.setupComplete")
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-500 dark:text-red-400"
              }`}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-accent bg-accent-hover disabled:opacity-50 text-accent-foreground font-bold rounded-lg transition-colors"
          >
            {isSubmitting
              ? "..."
              : showLoginMode
                ? t("auth.login")
                : t("auth.setup")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
