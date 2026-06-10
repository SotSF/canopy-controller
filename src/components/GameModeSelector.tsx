import { gameModeIds, gameModeLabels, GameModeId } from "../modules/gameModes";

type GameModeSelectorProps = {
  gameMode: GameModeId;
  onSelect: (gameMode: GameModeId) => void;
};

export const GameModeSelector = ({
  gameMode,
  onSelect,
}: GameModeSelectorProps) => (
  <div className="game-mode-selector">
    <p className="game-mode-label">Game mode</p>
    <div className="game-mode-options" role="radiogroup" aria-label="Game mode">
      {gameModeIds.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={gameMode === id}
          className={`game-mode-option${gameMode === id ? " game-mode-option--active" : ""}`}
          onClick={() => onSelect(id)}
        >
          {gameModeLabels[id]}
        </button>
      ))}
    </div>
  </div>
);
