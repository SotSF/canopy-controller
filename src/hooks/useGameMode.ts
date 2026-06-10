import { useCallback, useState } from "react";
import {
  GameModeId,
  loadGameMode,
  saveGameMode,
} from "../modules/gameModes";

export const useGameMode = () => {
  const [gameMode, setGameMode] = useState<GameModeId>(loadGameMode);

  const selectGameMode = useCallback((next: GameModeId) => {
    setGameMode(next);
    saveGameMode(next);
  }, []);

  return { gameMode, selectGameMode };
};
