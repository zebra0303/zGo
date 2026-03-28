import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/entities/match/model/store";

const BoardWidget = lazy(() => import("@/widgets/BoardWidget"));
const SidebarWidget = lazy(() => import("@/widgets/SidebarWidget"));
const OnlineSidebarWidget = lazy(() => import("@/widgets/OnlineSidebarWidget"));
const TeacherAdviceWidget = lazy(() => import("@/widgets/TeacherAdviceWidget"));
import { ConfirmModal } from "@zebra/core/client";
import { useShallow } from "zustand/react/shallow";
import { useTranslation } from "react-i18next";

const SIDEBAR_WIDTH_EXPANDED = 320; // md:w-80 = 20rem
const SIDEBAR_WIDTH_COLLAPSED = 16; // w-4 = 1rem
const ADVICE_WIDTH = 288; // w-72 = 18rem
const LAYOUT_GAP = 48;

const useCanShowAdviceSide = (sidebarCollapsed: boolean) => {
  const { boardSize, boardScale } = useGameStore();
  const boardPixelSize =
    30 * boardScale * (boardSize - 1) + 20 * boardScale * 2;
  const sidebarWidth = sidebarCollapsed
    ? SIDEBAR_WIDTH_COLLAPSED
    : SIDEBAR_WIDTH_EXPANDED;

  const calc = useCallback(() => {
    const available = window.innerWidth - sidebarWidth;
    return available >= boardPixelSize + ADVICE_WIDTH + LAYOUT_GAP;
  }, [boardPixelSize, sidebarWidth]);

  const [canShow, setCanShow] = useState(() =>
    typeof window !== "undefined" ? calc() : false,
  );

  useEffect(() => {
    const onResize = () => setCanShow(calc());
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [calc]);

  return canShow;
};

export const GameLayout = () => {
  const { t } = useTranslation();
  const { gameMode, isReviewMode, confirmDialog, closeConfirm } = useGameStore(
    useShallow((s) => ({
      gameMode: s.gameMode,
      isReviewMode: s.isReviewMode,
      confirmDialog: s.confirmDialog,
      closeConfirm: s.closeConfirm,
    })),
  );
  const isOnline = gameMode === "Online";

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return sessionStorage.getItem("sidebarCollapsed") === "true";
  });
  const toggleSidebar = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
    sessionStorage.setItem("sidebarCollapsed", String(collapsed));
  }, []);
  const canShowAdviceSide = useCanShowAdviceSide(sidebarCollapsed);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full">
      <main className="flex-1 flex flex-col items-center bg-gray-50 dark:bg-gray-800 p-2 md:p-4 pt-4 md:pt-10 overflow-auto min-h-0">
        <div
          className={`flex w-full max-w-5xl mx-auto justify-center ${
            canShowAdviceSide && (!isOnline || isReviewMode)
              ? "flex-row items-start gap-4"
              : "flex-col items-center gap-2"
          }`}
        >
          <div className="flex flex-col items-center shrink-0 max-w-full">
            <Suspense
              fallback={
                <div className="animate-pulse text-gray-400">
                  Loading Board...
                </div>
              }
            >
              <BoardWidget sidebarCollapsed={sidebarCollapsed} />
            </Suspense>
          </div>
          {/* Show teacher advice: always in offline mode, only in review for online */}
          {(!isOnline || isReviewMode) && (
            <Suspense fallback={null}>
              <TeacherAdviceWidget sideBySide={canShowAdviceSide} />
            </Suspense>
          )}
        </div>
      </main>

      {/* Sidebar: bottom sheet on mobile, side panel on md+ */}
      <aside
        className={`border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0 transition-all duration-300 z-30 ${
          sidebarCollapsed
            ? "h-10 md:h-auto md:w-4"
            : "h-[85vh] md:h-auto md:w-80"
        }`}
      >
        {sidebarCollapsed ? (
          <div className="h-full flex flex-row md:flex-col items-center justify-center md:justify-start md:pt-3">
            <button
              onClick={() => toggleSidebar(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 w-full md:w-auto flex justify-center"
              aria-label="Expand sidebar"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="md:block hidden"
              >
                <path d="M13 4L7 10L13 16" />
              </svg>
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="md:hidden"
              >
                <path d="M4 13L10 7L16 13" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="h-full relative overflow-hidden">
            <button
              onClick={() => toggleSidebar(true)}
              className="flex absolute top-2 left-1 z-10 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Collapse sidebar"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="md:block hidden"
              >
                <path d="M7 4L13 10L7 16" />
              </svg>
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="md:hidden"
              >
                <path d="M4 7L10 13L16 7" />
              </svg>
            </button>
            <Suspense
              fallback={
                <div className="animate-pulse p-4 text-center text-gray-400 dark:text-gray-500">
                  Loading Menu...
                </div>
              }
            >
              {isOnline ? <OnlineSidebarWidget /> : <SidebarWidget />}
            </Suspense>
          </div>
        )}
      </aside>

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.title ||
          (confirmDialog.type === "alert" ? t("alert") : t("confirm"))
        }
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
        variant={confirmDialog.type === "alert" ? "info" : "warning"}
        showCancel={confirmDialog.type === "confirm"}
        confirmLabel={t("ok")}
        cancelLabel={t("cancel")}
      />
    </div>
  );
};
