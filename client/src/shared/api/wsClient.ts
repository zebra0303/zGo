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

function detachSocket(socket: WebSocket): void {
  socket.onopen = null;
  socket.onmessage = null;
  socket.onclose = null;
  socket.onerror = null;
}

function doConnect(): void {
  if (!currentUrl || !currentToken) return;

  // Clean up any previous socket handlers before creating a new socket
  if (ws) {
    detachSocket(ws);
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }
    ws = null;
  }

  statusHandler?.("connecting");
  const socket = new WebSocket(currentUrl);
  ws = socket;

  socket.onopen = () => {
    reconnectAttempts = 0;
    // Send auth immediately
    socket.send(
      JSON.stringify({ type: "auth", payload: { roomToken: currentToken } }),
    );
  };

  socket.onmessage = (event) => {
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

  socket.onclose = (event) => {
    statusHandler?.("disconnected");
    // Do not retry on application-level fatal close codes (4xxx)
    if (event && event.code >= 4000 && event.code < 5000) {
      reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
      return;
    }
    attemptReconnect();
  };

  socket.onerror = () => {
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

export function disconnect(delayCloseMs = 0): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  currentUrl = null;
  currentToken = null;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect

  if (ws) {
    const oldSocket = ws;
    ws = null;
    detachSocket(oldSocket);
    // Optional brief delay lets an outbound "leave" frame flush cleanly before closing
    if (delayCloseMs > 0 && oldSocket.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        if (oldSocket.readyState === WebSocket.OPEN) {
          oldSocket.close();
        }
      }, delayCloseMs);
    } else {
      oldSocket.close();
    }
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
