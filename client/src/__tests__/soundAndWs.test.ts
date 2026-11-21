import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { playStoneSound } from "@/shared/lib/sound";
import * as wsClient from "@/shared/api/wsClient";

describe("playStoneSound edge cases", () => {
  it("does not throw RangeError when volume is 0 or negative", () => {
    expect(() => playStoneSound(true, 0)).not.toThrow();
    expect(() => playStoneSound(true, -0.5)).not.toThrow();
    expect(() => playStoneSound(false, 0)).not.toThrow();
  });
});

describe("wsClient reconnect guards", () => {
  let instances: FakeWebSocket[] = [];

  class FakeWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSED = 3;
    readyState = FakeWebSocket.OPEN;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    onerror: (() => void) | null = null;
    sent: string[] = [];
    close = vi.fn(() => {
      this.readyState = FakeWebSocket.CLOSED;
    });
    send = vi.fn((data: string) => {
      this.sent.push(data);
    });
    constructor(public url: string) {
      instances.push(this);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    wsClient.disconnect();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not reconnect on fatal 4xxx close codes", () => {
    wsClient.connect("room-1", "token-1");
    expect(instances).toHaveLength(1);

    instances[0].onclose?.({ code: 4001 });
    vi.advanceTimersByTime(15000);

    // No second WebSocket should have been created after fatal 4001 close
    expect(instances).toHaveLength(1);
  });

  it("retries with backoff on non-fatal 1006 close codes", () => {
    wsClient.connect("room-2", "token-2");
    expect(instances).toHaveLength(1);

    instances[0].onclose?.({ code: 1006 });
    vi.advanceTimersByTime(1500);

    expect(instances).toHaveLength(2);
  });
});
