import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useOnlineStore } from "@/entities/online/model/store";
import { CHARACTERS, RoomInfo } from "@/entities/online/model/types";
import { navigateTo } from "@/shared/lib/router";
import { API_BASE_URL } from "@/shared/api/gameApi";

interface WaitingRoomProps {
  roomId: string;
  onGameStart: () => void;
}

const WaitingRoom = ({ roomId, onGameStart }: WaitingRoomProps) => {
  const { t } = useTranslation();
  const { myRole, myNickname, myCharacter, roomToken, connectWs } =
    useOnlineStore();

  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/#/online/room/${roomId}`;

  const fetchRoom = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`${API_BASE_URL}/online/rooms/${roomId}`, {
          signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as RoomInfo;
        if (signal?.aborted) return;
        setRoomInfo(data);

        // If guest has joined, start the game
        if (data.status === "playing") {
          useOnlineStore.getState().setRoomInfo(data);
          if (roomToken) {
            connectWs(roomId, roomToken);
          }
          onGameStart();
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Ignore
        }
      }
    },
    [roomId, roomToken, connectWs, onGameStart],
  );

  // Poll for room status while waiting
  useEffect(() => {
    const abortController = new AbortController();
    fetchRoom(abortController.signal);
    const interval = setInterval(() => fetchRoom(abortController.signal), 2000);
    return () => {
      clearInterval(interval);
      abortController.abort();
    };
  }, [fetchRoom]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  const myChar = CHARACTERS.find((c) => c.id === myCharacter);

  return (
    <div className="space-y-6 text-center">
      {/* My info */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-4xl">{myChar?.emoji}</span>
        <div className="text-left">
          <div className="font-bold text-gray-800 dark:text-gray-100">
            {myNickname}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {myRole === "host"
              ? t("online.host", { defaultValue: "Host" })
              : t("online.guest", { defaultValue: "Guest" })}
            {" · "}
            {roomInfo?.hostColor === "BLACK" ? t("black") : t("white")}
          </div>
        </div>
      </div>

      {/* Room settings */}
      {roomInfo && (
        <div className="flex justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {roomInfo.boardSize}×{roomInfo.boardSize}
          </span>
          {roomInfo.handicap > 0 && (
            <span>
              {t("handicap")}: {roomInfo.handicap}
            </span>
          )}
        </div>
      )}

      {/* Waiting animation */}
      <div className="py-6">
        <div className="flex items-center justify-center gap-1 mb-3">
          <div
            className="w-2 h-2 rounded-full bg-accent animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-accent animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-accent animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {t("online.waitingForOpponent", {
            defaultValue: "Waiting for opponent...",
          })}
        </p>
      </div>

      {/* Share URL */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {t("online.shareLink", { defaultValue: "Share this link" })}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-600 dark:text-gray-300 font-mono"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-accent text-accent-foreground font-bold rounded-lg text-xs shrink-0 transition-all"
          >
            {copied
              ? t("online.copied", { defaultValue: "Copied!" })
              : t("online.copy", { defaultValue: "Copy" })}
          </button>
        </div>
      </div>

      {/* Cancel */}
      <button
        onClick={() => {
          useOnlineStore.getState().reset();
          navigateTo({ page: "main" });
        }}
        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        {t("online.cancel", { defaultValue: "Cancel" })}
      </button>
    </div>
  );
};

export default WaitingRoom;
