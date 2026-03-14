import { lazy, Suspense } from "react";

const BoardWidget = lazy(() => import("@/widgets/BoardWidget"));
const SidebarWidget = lazy(() => import("@/widgets/SidebarWidget"));

const MainPage = () => {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full">
      <main className="flex-1 flex items-center justify-center bg-gray-50 p-4 relative">
        <Suspense
          fallback={
            <div className="animate-pulse text-gray-400">Loading Board...</div>
          }
        >
          <BoardWidget />
        </Suspense>
      </main>
      <aside className="w-full md:w-80 border-l border-gray-200 bg-white">
        <Suspense
          fallback={
            <div className="animate-pulse p-4 text-center text-gray-400">
              Loading Menu...
            </div>
          }
        >
          <SidebarWidget />
        </Suspense>
      </aside>
    </div>
  );
};

export default MainPage;
