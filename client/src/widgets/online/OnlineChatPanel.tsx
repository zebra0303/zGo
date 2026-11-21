import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChatMessage } from "@/entities/online/model/types";

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

interface OnlineChatPanelProps {
  chatMessages: ChatMessage[];
  myRole: "host" | "guest" | null;
  opponentGone: boolean;
  onSendChat: (message: string) => void;
}

// Extracted from OnlineSidebarWidget to isolate chat input/emoji state and reduce widget size
const OnlineChatPanel = ({
  chatMessages,
  myRole,
  opponentGone,
  onSendChat,
}: OnlineChatPanelProps) => {
  const { t } = useTranslation();
  const [chatInput, setChatInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim()) return;
      onSendChat(chatInput.trim());
      setChatInput("");
      setShowEmoji(false);
    },
    [chatInput, onSendChat],
  );

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSendChat(emoji);
      setShowEmoji(false);
    },
    [onSendChat],
  );

  return (
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
              aria-expanded={showEmoji}
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
              aria-label={t("online.chat", { defaultValue: "Chat" })}
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
  );
};

export default OnlineChatPanel;
