export type GameModeId = number;

const STORAGE_KEY = "canopy-game-mode";

/** GameID values from GameDataUpdate. */
export const gameModeLabels: Record<GameModeId, string> = {
  0: "Spaceship Game",
};

export const gameModeIds = Object.keys(gameModeLabels).map(
  Number,
) as GameModeId[];

export const defaultGameModeId: GameModeId = 0;

export const loadGameMode = (): GameModeId => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return defaultGameModeId;
    const id = Number(raw);
    if (id in gameModeLabels) return id;
  } catch {
    /* ignore */
  }
  return defaultGameModeId;
};

export const saveGameMode = (gameMode: GameModeId) => {
  localStorage.setItem(STORAGE_KEY, String(gameMode));
};
