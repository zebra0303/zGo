import { useEffect } from "react";
import MainPage from "@/pages/MainPage";
import { useGameStore } from "@/entities/match/model/store";
import { useTranslation } from "react-i18next";

function App() {
  const language = useGameStore((state) => state.language);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      <MainPage />
    </div>
  );
}

export default App;
