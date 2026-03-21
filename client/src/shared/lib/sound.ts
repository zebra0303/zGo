declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

// Audio context for synthesized sounds (initialized lazily)
let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const SelectedContext = window.AudioContext || window.webkitAudioContext;
    if (SelectedContext) {
      audioCtx = new SelectedContext();
    }
  }
  return audioCtx;
};

// Audio object pool for file-based sounds
const audioPool = new Map<string, HTMLAudioElement>();

export const playSound = (
  path: string,
  enabled: boolean,
  volume: number = 0.6,
) => {
  if (!enabled) return;

  try {
    let audio = audioPool.get(path);
    if (!audio) {
      audio = new Audio(path);
      audioPool.set(path, audio);
    }
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    audio.play().catch((e) => {
      // Browsers often block audio until first user interaction
      console.log(`Audio play blocked or failed (${path}):`, e);
    });
  } catch (e) {
    console.error(`Sound play failed (${path}):`, e);
  }
};

/**
 * Synthesized "tak!" sound for stone placement using Web Audio API.
 */
export const playStoneSound = (enabled: boolean, volume: number = 0.6) => {
  if (!enabled) return;

  const ctx = getAudioContext();
  if (!ctx) {
    // Fallback to file-based sound if Web Audio API is not supported
    playSound("/assets/sounds/put.mp3", enabled, volume);
    return;
  }

  // Resume context if suspended (browser security policy)
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  // Short, sharp strike feel: rapidly drop frequency
  osc.type = "triangle";
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);

  // Rapidly decay volume to zero for a crisp "click"
  gainNode.gain.setValueAtTime(volume, t);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  osc.start(t);
  osc.stop(t + 0.1);
};

export const playPassSound = (enabled: boolean, volume: number = 0.6) => {
  playSound("/assets/sounds/pass.mp3", enabled, volume);
};

export const playNewGameSound = (enabled: boolean, volume: number = 0.6) => {
  playSound("/assets/sounds/new.mp3", enabled, volume);
};

export const playWinSound = (enabled: boolean, volume: number = 0.6) => {
  playSound("/assets/sounds/win.mp3", enabled, volume);
};

export const playLoseSound = (enabled: boolean, volume: number = 0.6) => {
  playSound("/assets/sounds/lose.mp3", enabled, volume);
};

export const playChatSendSound = (enabled: boolean, volume: number = 0.6) => {
  playSound("/assets/sounds/chat_send.mp3", enabled, volume);
};

export const playChatReceiveSound = (
  enabled: boolean,
  volume: number = 0.6,
) => {
  playSound("/assets/sounds/chat_receive.mp3", enabled, volume);
};
