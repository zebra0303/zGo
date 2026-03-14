import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { useGameStore } from "@/entities/match/model/store";

const BoardWidget = lazy(() => import("@/widgets/BoardWidget"));
const SidebarWidget = lazy(() => import("@/widgets/SidebarWidget"));
const TeacherAdviceWidget = lazy(() => import("@/widgets/TeacherAdviceWidget"));

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

const MainPage = () => {
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
      <main className="flex-1 flex items-center justify-center bg-gray-50 p-4 overflow-auto">
        <div
          className={`flex w-full max-w-5xl mx-auto justify-center ${
            canShowAdviceSide
              ? "flex-row items-start gap-4"
              : "flex-col items-center"
          }`}
        >
          <div className="flex flex-col items-center shrink-0">
            <Suspense
              fallback={
                <div className="animate-pulse text-gray-400">
                  Loading Board...
                </div>
              }
            >
              <BoardWidget />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <TeacherAdviceWidget sideBySide={canShowAdviceSide} />
          </Suspense>
        </div>
      </main>

      {/* Sidebar: collapsible on md+ */}
      <aside
        className={`border-l border-gray-200 bg-white shrink-0 transition-all duration-300 ${
          sidebarCollapsed ? "hidden md:block md:w-4" : "w-full md:w-80"
        }`}
      >
        {sidebarCollapsed ? (
          <div className="h-full flex flex-col items-center pt-3">
            <button
              onClick={() => toggleSidebar(false)}
              className="p-1 rounded-l-md hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 -ml-2"
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
              >
                <path d="M13 4L7 10L13 16" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="h-full relative">
            <button
              onClick={() => toggleSidebar(true)}
              className="hidden md:flex absolute top-3 left-1 z-10 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              aria-label="Collapse sidebar"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M7 4L13 10L7 16" />
              </svg>
            </button>
            <Suspense
              fallback={
                <div className="animate-pulse p-4 text-center text-gray-400">
                  Loading Menu...
                </div>
              }
            >
              <SidebarWidget />
            </Suspense>
          </div>
        )}
      </aside>
    </div>
  );
};

export default MainPage;
