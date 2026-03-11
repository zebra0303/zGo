export const playStoneSound = (enabled: boolean) => {
  if (!enabled) return;

  try {
    const audio = new Audio("/assets/sounds/put.mp3");
    audio.volume = 0.6;
    audio.play().catch((e) => {
      // Browsers often block audio until first user interaction
      console.log("Audio play blocked or failed:", e);
    });
  } catch (e) {
    console.error("Sound play failed:", e);
  }
};
