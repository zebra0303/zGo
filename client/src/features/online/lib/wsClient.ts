type MessageHandler = (msg: {
  type: string;
  payload?: Record<string, unknown>;
}) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let messageHandler: MessageHandler | null = null;
let statusHandler:
  | ((status: "disconnected" | "connecting" | "connected") => void)
  | null = null;

// Connection params for reconnection
let currentUrl: string | null = null;
let currentToken: string | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function getWsBaseUrl(): string {
  // Derive WS URL from API base URL (handles dev proxy vs production)
  const apiBase = import.meta.env.VITE_API_BASE_URL || "";
  if (apiBase.startsWith("http")) {
    // Absolute URL: convert http(s) to ws(s)
    return apiBase.replace(/^http/, "ws").replace(/\/api$/, "");
  }
  // Relative URL: use current host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

export function connect(roomId: string, roomToken: string): void {
  disconnect();

  currentUrl = `${getWsBaseUrl()}/ws/online/${roomId}`;
  currentToken = roomToken;
  reconnectAttempts = 0;

  doConnect();
}

function doConnect(): void {
  if (!currentUrl || !currentToken) return;

  statusHandler?.("connecting");
  ws = new WebSocket(currentUrl);

  ws.onopen = () => {
    reconnectAttempts = 0;
    // Send auth immediately
    ws?.send(
      JSON.stringify({ type: "auth", payload: { roomToken: currentToken } }),
    );
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      // On successful room_state, mark as connected
      if (msg.type === "room_state") {
        statusHandler?.("connected");
      }

      messageHandler?.(msg);
    } catch {
      // Ignore invalid JSON
    }
  };

  ws.onclose = () => {
    statusHandler?.("disconnected");
    attemptReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function attemptReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  if (!currentUrl || !currentToken) return;

  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);

  reconnectTimer = setTimeout(() => {
    doConnect();
  }, delay);
}

export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  currentUrl = null;
  currentToken = null;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect

  if (ws) {
    ws.onclose = null; // Prevent reconnect trigger
    ws.close();
    ws = null;
  }
  statusHandler?.("disconnected");
}

export function send(type: string, payload?: Record<string, unknown>): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

export function onMessage(handler: MessageHandler): void {
  messageHandler = handler;
}

export function onStatusChange(
  handler: (status: "disconnected" | "connecting" | "connected") => void,
): void {
  statusHandler = handler;
}
