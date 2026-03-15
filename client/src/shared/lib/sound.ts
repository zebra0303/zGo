// Audio object pool: reuse instead of creating new instances per play
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

export const playStoneSound = (enabled: boolean, volume: number = 0.6) => {
  playSound("/assets/sounds/put.mp3", enabled, volume);
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
