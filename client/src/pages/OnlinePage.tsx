import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useRoute, navigateTo } from "@/shared/lib/router";
import { useOnlineStore } from "@/entities/online/model/store";
import { useGameStore } from "@/entities/match/model/store";
import { RoomInfo } from "@/entities/online/model/types";
import { API_BASE_URL } from "@/shared/api/gameApi";
import CreateRoomForm from "@/features/online/ui/CreateRoomForm";
import JoinRoomForm from "@/features/online/ui/JoinRoomForm";
import WaitingRoom from "@/features/online/ui/WaitingRoom";

const MainPage = lazy(() => import("@/pages/MainPage"));

type RoomView = "loading" | "join" | "waiting" | "playing" | "error";

const FloatingLanguageToggle = () => {
  const { i18n } = useTranslation();
  const language = useGameStore((s) => s.language);
  const setGameConfig = useGameStore((s) => s.setGameConfig);

  return (
    <div className="absolute top-4 right-4 z-50">
      <select
        value={language}
        onChange={(e) => {
          const lang = e.target.value as "ko" | "en";
          i18n.changeLanguage(lang);
          setGameConfig({ language: lang });
        }}
        className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
      </select>
    </div>
  );
};

const OnlinePage = () => {
  const { t } = useTranslation();
  const route = useRoute();

  // Create room page
  if (route.page === "online-create") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <FloatingLanguageToggle />
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 max-w-sm w-full">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              🌐{" "}
              {t("online.createRoom", { defaultValue: "Create Online Game" })}
            </h1>
            <button
              onClick={() => navigateTo({ page: "main" })}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
            >
              ✕
            </button>
          </div>
          <CreateRoomForm />
        </div>
      </div>
    );
  }

  // Farewell page for guests after leaving
  if (route.page === "online-farewell") {
    return <FarewellPage />;
  }

  // Room page (join / waiting / playing)
  if (route.page === "online-room") {
    return <RoomPage roomId={route.roomId} />;
  }

  return null;
};

const FarewellPage = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 relative">
      <FloatingLanguageToggle />
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <img
          src="/zgo_logo.png"
          alt="zGo"
          className="w-24 h-24 mx-auto mb-6 rounded-2xl shadow-md"
        />
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          {t("online.farewellTitle")}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          {t("online.farewellMessage")}
        </p>
        <p className="text-2xl mb-6">👋</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          zGo — {t("subtitle")}
        </p>
      </div>
    </div>
  );
};

const RoomPage = ({ roomId }: { roomId: string }) => {
  const { t } = useTranslation();
  const { connectWs, setRoomInfo } = useOnlineStore();
  const [view, setView] = useState<RoomView>("loading");
  const [roomInfo, setLocalRoomInfo] = useState<RoomInfo | null>(null);

  // Fetch room info on mount (restore session if needed)
  useEffect(() => {
    const abortController = new AbortController();

    const fetchRoom = async () => {
      try {
        // Restore session from sessionStorage if store is empty (e.g. after page refresh)
        const onlineState = useOnlineStore.getState();
        if (!onlineState.myRole || onlineState.roomId !== roomId) {
          useOnlineStore.getState().restoreSession();
        }

        const res = await fetch(`${API_BASE_URL}/online/rooms/${roomId}`, {
          signal: abortController.signal,
        });
        if (!res.ok) {
          if (!abortController.signal.aborted) setView("error");
          return;
        }
        const data = (await res.json()) as RoomInfo;
        if (abortController.signal.aborted) return;
        setLocalRoomInfo(data);

        // Re-read state after restore
        const currentState = useOnlineStore.getState();
        if (currentState.myRole && currentState.roomId === roomId) {
          // Already joined/created this room
          if (data.status === "waiting") {
            setView("waiting");
          } else if (data.status === "playing" || data.status === "finished") {
            setRoomInfo(data);
            if (currentState.roomToken) {
              connectWs(roomId, currentState.roomToken);
            }
            startGame(data);
            setView("playing");
          }
        } else if (data.status === "waiting") {
          // New visitor — show join form
          setView("join");
        } else if (data.status === "playing") {
          // Game already in progress, can't join
          setView("error");
        } else {
          setView("error");
        }
      } catch (err) {
        const error = err as Error;
        if (error.name !== "AbortError") {
          setView("error");
        }
      }
    };
    fetchRoom();
    return () => abortController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const startGame = useCallback((info: RoomInfo) => {
    const gameStore = useGameStore.getState();
    // Configure game for online mode
    gameStore.setGameConfig({
      gameMode: "Online",
      boardSize: info.boardSize,
      handicap: info.handicap,
    });
    gameStore.resetGame();

    // Replay existing moves if any
    for (const move of info.moves) {
      if (move === null) {
        gameStore.passTurn();
      } else {
        gameStore.placeStone(move.x, move.y);
      }
    }
  }, []);

  const handleJoined = useCallback(() => {
    // After joining, fetch room info and start
    const fetchAndStart = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/online/rooms/${roomId}`);
        if (!res.ok) return;
        const data = (await res.json()) as RoomInfo;
        setRoomInfo(data);
        const state = useOnlineStore.getState();
        if (state.roomToken) {
          connectWs(roomId, state.roomToken);
        }
        startGame(data);
        setView("playing");
      } catch {
        setView("error");
      }
    };
    fetchAndStart();
  }, [roomId, connectWs, setRoomInfo, startGame]);

  const handleGameStart = useCallback(() => {
    const info = useOnlineStore.getState().roomInfo;
    if (info) {
      startGame(info);
      setView("playing");
    }
  }, [startGame]);

  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <FloatingLanguageToggle />
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">😔</div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
            {t("online.roomNotFound", { defaultValue: "Room not found" })}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t("online.roomNotFoundDesc", {
              defaultValue:
                "This room may have expired or the game is already in progress.",
            })}
          </p>
          <button
            onClick={() => navigateTo({ page: "main" })}
            className="px-6 py-2 bg-accent text-accent-foreground font-bold rounded-lg text-sm"
          >
            {t("online.backToMain", { defaultValue: "Back" })}
          </button>
        </div>
      </div>
    );
  }

  if (view === "join") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <FloatingLanguageToggle />
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 max-w-sm w-full">
          {/* Room info header */}
          {roomInfo && (
            <div className="mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
              <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                🌐 {t("online.joinGame", { defaultValue: "Join Game" })}
              </h1>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p>
                  {t("online.host", { defaultValue: "Host" })}:{" "}
                  <span className="font-bold text-gray-700 dark:text-gray-200">
                    {roomInfo.hostNickname}
                  </span>
                </p>
                <p>
                  {roomInfo.boardSize}×{roomInfo.boardSize}
                  {roomInfo.handicap > 0 &&
                    ` · ${t("handicap")}: ${roomInfo.handicap}`}
                </p>
              </div>
            </div>
          )}
          <JoinRoomForm
            roomId={roomId}
            onJoined={handleJoined}
            hostCharacter={roomInfo?.hostCharacter ?? null}
          />
        </div>
      </div>
    );
  }

  if (view === "waiting") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <FloatingLanguageToggle />
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 max-w-sm w-full">
          <WaitingRoom roomId={roomId} onGameStart={handleGameStart} />
        </div>
      </div>
    );
  }

  // Playing — render the game board
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      <MainPage />
    </Suspense>
  );
};

export default OnlinePage;
