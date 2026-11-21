import React, { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@zebra/core/client";
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

// Reuses @zebra/core Modal for native dialog focus trapping, backdrop click, and Escape handling
const ChatHistoryModal = ({
  chat,
  hostNickname,
  hostCharacter,
  guestNickname,
  guestCharacter,
  onClose,
}: ChatHistoryModalProps) => {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Lazy loading: start from the latest messages
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const totalCount = chat.length;

  const startIndex = Math.max(0, totalCount - visibleCount);
  const visibleMessages = chat.slice(startIndex);
  const hasMore = startIndex > 0;

  const prevScrollHeightRef = useRef<number>(0);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
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

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !hasMore) return;
    if (scrollContainerRef.current.scrollTop < 40) {
      loadMore();
    }
  }, [hasMore, loadMore]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${t("online.chatHistory")} (${totalCount})`}
      className="max-w-md"
    >
      <div className="flex flex-col max-h-[65vh] -mx-2">
        {/* Player info bar */}
        <div className="flex items-center justify-center gap-6 px-4 py-2 mb-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
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
          className="flex-1 overflow-y-auto px-2 py-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700"
        >
          {hasMore && (
            <button
              type="button"
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
    </Modal>
  );
};

export default React.memo(ChatHistoryModal);
