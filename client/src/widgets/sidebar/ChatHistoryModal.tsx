import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CHARACTERS } from "@/entities/online/model/types";

interface ChatMessage {
  sender: string;
  message: string;
  createdAt: string;
}

interface ChatHistoryModalProps {
  chat: ChatMessage[];
  hostNickname?: string;
  hostCharacter?: string;
  guestNickname?: string;
  guestCharacter?: string;
  onClose: () => void;
}

const PAGE_SIZE = 30;

const getCharacterEmoji = (id: string | undefined): string => {
  if (!id) return "👤";
  return CHARACTERS.find((c) => c.id === id)?.emoji || "👤";
};

const ChatHistoryModal = ({
  chat,
  hostNickname,
  hostCharacter,
  guestNickname,
  guestCharacter,
  onClose,
}: ChatHistoryModalProps) => {
  const { t } = useTranslation();
  const backdropRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Lazy loading: start from the latest messages
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const totalCount = chat.length;

  // Messages displayed in chronological order (oldest first)
  // We slice from the end to show the latest PAGE_SIZE messages initially
  const startIndex = Math.max(0, totalCount - visibleCount);
  const visibleMessages = chat.slice(startIndex);
  const hasMore = startIndex > 0;

  const prevScrollHeightRef = useRef<number>(0);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    // Save scroll position before loading more
    if (scrollContainerRef.current) {
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    }
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, totalCount));
  }, [hasMore, totalCount]);

  // Restore scroll position after loading older messages
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && scrollContainerRef.current) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop =
        newScrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [visibleCount]);

  // Auto-scroll to bottom on initial render
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, []);

  // Handle scroll to top for lazy loading
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMore) return;
    if (scrollContainerRef.current.scrollTop < 40) {
      loadMore();
    }
  }, [hasMore, loadMore]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {t("online.chatHistory")}
            <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500">
              ({totalCount})
            </span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Player info bar */}
        <div className="flex items-center justify-center gap-6 px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
          <div className="flex items-center gap-1.5">
            <span>{getCharacterEmoji(hostCharacter)}</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {hostNickname || t("online.host")}
            </span>
          </div>
          <span className="text-gray-300 dark:text-gray-600 text-xs">vs</span>
          <div className="flex items-center gap-1.5">
            <span>{getCharacterEmoji(guestCharacter)}</span>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
              {guestNickname || t("online.guest")}
            </span>
          </div>
        </div>

        {/* Chat messages */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700"
        >
          {/* Load more indicator */}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full text-center text-[10px] text-accent font-bold py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              {t("online.loadMoreChat")}
            </button>
          )}

          {visibleMessages.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center py-8">
              {t("online.noChat")}
            </p>
          ) : (
            visibleMessages.map((msg, idx) => {
              const isHost = msg.sender === "host";
              const nickname = isHost ? hostNickname : guestNickname;
              const emoji = getCharacterEmoji(
                isHost ? hostCharacter : guestCharacter,
              );

              return (
                <div key={startIndex + idx} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{emoji}</span>
                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">
                      {nickname || msg.sender}
                    </span>
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 ml-auto">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2 break-words leading-relaxed">
                    {msg.message}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChatHistoryModal);
