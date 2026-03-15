import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  useOnlineStore,
  getOnlineMyColor,
} from "@/entities/online/model/store";
import { useGameStore, getPathToNode } from "@/entities/match/model/store";
import { navigateTo } from "@/shared/lib/router";
import { CHARACTERS } from "@/entities/online/model/types";
import { playPassSound } from "@/shared/lib/sound";
import { fetchAIScore } from "@/shared/api/gameApi";
import CustomDialog from "@/shared/ui/CustomDialog";

// Quick emoji panel — lightweight, no external library needed
const QUICK_EMOJIS = [
  "👍",
  "👏",
  "😊",
  "😂",
  "🤔",
  "😮",
  "😢",
  "😤",
  "🔥",
  "💪",
  "🎉",
  "❤️",
  "👀",
  "🙏",
  "😎",
  "🤗",
  "😱",
  "👎",
];

// Check if message is emoji-only (for larger display)
const EMOJI_REGEX =
  /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200d|\ufe0f|\s)+$/u;
const isEmojiOnly = (text: string) =>
  EMOJI_REGEX.test(text.trim()) && text.trim().length <= 8;

const OnlineSidebarWidget = () => {
  const { t } = useTranslation();

  const {
    roomInfo,
    myRole,
    myNickname,
    myCharacter,
    connectionStatus,
    chatMessages,
    pendingUndoRequest,
    notification,
    sendPass,
    sendResign,
    sendLeave,
    sendChat,
    requestUndo,
  } = useOnlineStore();

  const {
    currentPlayer,
    currentNode,
    isGameOver,
    isReviewMode,
    isTeacherMode,
    winner,
    soundEnabled,
    soundVolume,
    boardScale,
    boardSize,
    handicap,
    gameTree,
    setGameConfig,
    passTurn,
    toggleTeacherMode,
    setDeadStones,
  } = useGameStore();

  const myColor = getOnlineMyColor();
  const isMyTurn = currentPlayer === myColor;

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Dialog state
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm";
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: "alert",
    message: "",
    onConfirm: () => {},
  });

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      sendChat(chatInput.trim());
      setChatInput("");
      setShowEmoji(false);
    },
    [chatInput, sendChat],
  );

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      // Send emoji directly as a chat message
      sendChat(emoji);
      setShowEmoji(false);
    },
    [sendChat],
  );

  const handlePass = useCallback(() => {
    sendPass();
    passTurn();
    playPassSound(soundEnabled, soundVolume);
  }, [sendPass, passTurn, soundEnabled, soundVolume]);

  const handleResign = useCallback(() => {
    setDialog({
      isOpen: true,
      type: "confirm",
      title: t("doResign"),
      message: t("askResign"),
      onConfirm: () => {
        sendResign();
        setDialog((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  }, [t, sendResign]);

  const handleUndo = useCallback(() => {
    const undoUsed =
      myRole === "host" ? roomInfo?.undoHostUsed : roomInfo?.undoGuestUsed;
    if (undoUsed) return;

    setDialog({
      isOpen: true,
      type: "confirm",
      title: t("doUndo"),
      message: t("askUndo"),
      onConfirm: () => {
        requestUndo();
        setDialog((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  }, [myRole, roomInfo, t, requestUndo]);

  const handleLeave = useCallback(() => {
    setDialog({
      isOpen: true,
      type: "confirm",
      title: t("online.leave", { defaultValue: "Leave Game" }),
      message: t("online.leaveConfirm", {
        defaultValue: "Are you sure? Both players will be disconnected.",
      }),
      onConfirm: () => {
        const store = useOnlineStore.getState();
        const wasGuest = store.myRole === "guest";
        // Send leave to server, then clean up locally
        sendLeave();
        store.reset();
        useGameStore.getState().setGameConfig({ gameMode: "PvAI" });
        navigateTo(wasGuest ? { page: "online-farewell" } : { page: "main" });
        setDialog((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  }, [t, sendLeave]);

  // Fetch dead stones when at end of branch in review mode
  const scoringNodeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isReviewMode) {
      scoringNodeRef.current = null;
      return;
    }
    const isEndOfBranch =
      currentNode.children.length === 0 && currentNode.id !== "root";
    if (!isEndOfBranch) {
      scoringNodeRef.current = null;
      return;
    }
    if (scoringNodeRef.current === currentNode.id) return;
    scoringNodeRef.current = currentNode.id;

    const abortController = new AbortController();
    const path = getPathToNode(gameTree, currentNode.id) || [currentNode];
    const moveHistory: ({ x: number; y: number } | null)[] = [];
    for (let i = 1; i < path.length; i++) {
      const node = path[i];
      moveHistory.push(
        node.x !== null && node.y !== null ? { x: node.x, y: node.y } : null,
      );
    }

    fetchAIScore(moveHistory, boardSize, handicap, abortController.signal)
      .then((data) => {
        if (data.deadStones) setDeadStones(data.deadStones);
      })
      .catch(() => {});

    return () => abortController.abort();
  }, [isReviewMode, currentNode, gameTree, boardSize, handicap, setDeadStones]);

  // Get opponent info
  const opponentNickname =
    myRole === "host" ? roomInfo?.guestNickname : roomInfo?.hostNickname;
  const opponentCharacter =
    myRole === "host" ? roomInfo?.guestCharacter : roomInfo?.hostCharacter;
  const opponentChar = CHARACTERS.find((c) => c.id === opponentCharacter);
  const myChar = CHARACTERS.find((c) => c.id === myCharacter);

  const opponentColor = myColor === "BLACK" ? t("white") : t("black");
  const myColorLabel = myColor === "BLACK" ? t("black") : t("white");

  const undoUsed =
    myRole === "host" ? roomInfo?.undoHostUsed : roomInfo?.undoGuestUsed;

  // Captured stones from game store
  const capturedByBlack = currentNode.capturedByBlack;
  const capturedByWhite = currentNode.capturedByWhite;

  // Opponent has left — hide chat input
  const opponentGone =
    notification === "opponent_left" || notification === "opponent_left_win";

  return (
    <div className="h-full flex flex-col p-4 md:p-6 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="mb-3 text-center shrink-0">
        <h1 className="text-lg font-extrabold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-2">
          {t("online.title", { defaultValue: "🌐 Online Game" })}
        </h1>
        <div className="flex items-center justify-center gap-1 mt-1">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
            }`}
          />
          <span className="text-[10px] text-gray-400">{connectionStatus}</span>
        </div>
      </div>

      {/* Players info */}
      <div className="space-y-2 mb-3 shrink-0">
        {/* Me */}
        <div
          className={`flex items-center gap-2 p-2 rounded-lg border ${
            isMyTurn && !isGameOver
              ? "border-accent bg-accent/5"
              : "border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="relative">
            <span className="text-2xl">{myChar?.emoji}</span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border ${myColor === "BLACK" ? "bg-gray-900 border-gray-600" : "bg-white border-gray-300"}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">
              {myNickname}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              {myColorLabel} ·{" "}
              {myRole === "host" ? t("online.host") : t("online.guest")}
            </div>
          </div>
          {isMyTurn && !isGameOver && !isReviewMode && (
            <span className="text-[10px] font-bold text-accent animate-pulse">
              {t("currentTurn", { defaultValue: "Your turn" })}
            </span>
          )}
          {isReviewMode && winner && winner !== "DRAW" && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                myColor === winner
                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                  : "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
              }`}
            >
              {myColor === winner ? t("win") : t("lose")}
            </span>
          )}
          {isReviewMode && winner === "DRAW" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {t("draw")}
            </span>
          )}
        </div>

        {/* Opponent */}
        <div
          className={`flex items-center gap-2 p-2 rounded-lg border ${
            !isMyTurn && !isGameOver && !isReviewMode
              ? "border-accent bg-accent/5"
              : "border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="relative">
            <span className="text-2xl">{opponentChar?.emoji || "❓"}</span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border ${myColor === "BLACK" ? "bg-white border-gray-300" : "bg-gray-900 border-gray-600"}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">
              {opponentNickname || "..."}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              {opponentColor}
            </div>
          </div>
          {!isMyTurn && !isGameOver && !isReviewMode && (
            <span className="text-[10px] text-gray-400 animate-pulse">⏳</span>
          )}
          {isReviewMode && winner && winner !== "DRAW" && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                myColor !== winner
                  ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                  : "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
              }`}
            >
              {myColor !== winner ? t("win") : t("lose")}
            </span>
          )}
          {isReviewMode && winner === "DRAW" && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {t("draw")}
            </span>
          )}
        </div>
      </div>

      {/* Game info + Captured stones */}
      <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 mb-3 shrink-0 px-1">
        <div className="flex gap-3">
          {roomInfo && (
            <span>
              {roomInfo.boardSize}×{roomInfo.boardSize}
            </span>
          )}
          {roomInfo && roomInfo.handicap > 0 && (
            <span>
              {t("handicap")}: {roomInfo.handicap}
            </span>
          )}
        </div>
        <div className="flex gap-3 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-black inline-block" />
            {capturedByBlack}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white border border-gray-300 inline-block" />
            {capturedByWhite}
          </span>
        </div>
      </div>

      {/* Board scale + Sound controls */}
      <div className="space-y-2 mb-3 shrink-0">
        <div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-600 dark:text-gray-400">
              {t("boardZoom")}
            </span>
            <span className="font-bold text-accent">
              {Math.round(boardScale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={boardScale}
            onChange={(e) =>
              setGameConfig({ boardScale: Number(e.target.value) })
            }
            className="w-full accent-[var(--primary)] h-1"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-600 dark:text-gray-400 shrink-0">
            {t("sound")}
          </span>
          {soundEnabled && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={soundVolume}
              onChange={(e) =>
                setGameConfig({ soundVolume: parseFloat(e.target.value) })
              }
              className="flex-1 accent-[var(--primary)] h-1"
            />
          )}
          {!soundEnabled && <div className="flex-1" />}
          <button
            onClick={() => setGameConfig({ soundEnabled: !soundEnabled })}
            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0 ${soundEnabled ? "toggle-accent" : "bg-gray-300 dark:bg-gray-600"}`}
            aria-label={t("sound")}
            aria-pressed={soundEnabled}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${soundEnabled ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        {/* Teacher mode toggle — only in review mode */}
        {isReviewMode && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-600 dark:text-gray-400 shrink-0">
              {t("teacherMode")}
            </span>
            <button
              onClick={toggleTeacherMode}
              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0 ${isTeacherMode ? "toggle-accent" : "bg-gray-300 dark:bg-gray-600"}`}
              aria-label={t("teacherMode")}
              aria-pressed={isTeacherMode}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isTeacherMode ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-h-0 mb-3">
        <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          {t("online.chat", { defaultValue: "Chat" })}
        </div>
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-2 space-y-1 min-h-[60px]">
          {chatMessages.map((msg, idx) => {
            const isMe =
              (myRole === "host" && msg.sender === "host") ||
              (myRole === "guest" && msg.sender === "guest");
            const emojiOnly = isEmojiOnly(msg.message);
            return (
              <div
                key={idx}
                className={`${emojiOnly ? "text-2xl" : "text-xs"} ${isMe ? "text-right" : "text-left"}`}
              >
                <span
                  className={`inline-block rounded-lg max-w-[85%] break-words ${
                    emojiOnly
                      ? "px-1 py-0.5"
                      : `px-2 py-1 ${
                          isMe
                            ? "bg-accent/10 text-accent"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        }`
                  }`}
                >
                  {msg.message}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input — hidden when opponent has left */}
        {!opponentGone && (
          <>
            {showEmoji && (
              <div className="grid grid-cols-6 gap-1 p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mt-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-lg hover:bg-gray-200 dark:hover:bg-gray-600 rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSendChat} className="flex gap-1 mt-1">
              <button
                type="button"
                onClick={() => setShowEmoji(!showEmoji)}
                className={`px-1.5 py-1.5 rounded text-sm shrink-0 transition-colors ${
                  showEmoji
                    ? "bg-accent/10 text-accent"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
                aria-label="Emoji"
              >
                😊
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={200}
                placeholder={t("online.chatPlaceholder", {
                  defaultValue: "Type a message...",
                })}
                className="flex-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 ring-accent min-w-0"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 bg-accent text-accent-foreground font-bold rounded text-xs shrink-0"
              >
                {t("online.send", { defaultValue: "Send" })}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Action buttons — hidden in review mode */}
      {!isGameOver && !isReviewMode && (
        <div className="flex gap-2 shrink-0 mb-2">
          <button
            onClick={handlePass}
            disabled={!isMyTurn}
            className="flex-1 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-lg text-[10px] border border-gray-300 dark:border-gray-600 uppercase tracking-tighter disabled:opacity-40"
          >
            {t("pass")}
          </button>
          <button
            onClick={handleResign}
            disabled={currentNode.moveIndex < 1}
            className={`flex-1 py-2 font-bold rounded-lg text-[10px] border uppercase tracking-tighter ${
              currentNode.moveIndex < 1
                ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                : "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
            }`}
          >
            {t("resign")}
          </button>
          <button
            onClick={handleUndo}
            disabled={
              !!undoUsed ||
              !isMyTurn ||
              pendingUndoRequest !== null ||
              currentNode.moveIndex < 1
            }
            className={`flex-1 py-2 font-bold rounded-lg text-[10px] border uppercase tracking-tighter ${
              undoUsed ||
              !isMyTurn ||
              pendingUndoRequest !== null ||
              currentNode.moveIndex < 1
                ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                : "bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
            }`}
          >
            {t("undo")}
          </button>
        </div>
      )}

      {/* Leave button — always visible */}
      <button
        onClick={handleLeave}
        className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
      >
        {t("online.leave", { defaultValue: "Leave Game" })}
      </button>

      <CustomDialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
    </div>
  );
};

export default OnlineSidebarWidget;
