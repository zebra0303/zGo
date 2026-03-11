import BoardWidget from "@/widgets/BoardWidget";
import SidebarWidget from "@/widgets/SidebarWidget";

const MainPage = () => {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full">
      <main className="flex-1 flex items-center justify-center bg-gray-50 p-4 relative">
        <BoardWidget />
      </main>
      <aside className="w-full md:w-80 border-l border-gray-200 bg-white">
        <SidebarWidget />
      </aside>
    </div>
  );
};

export default MainPage;
