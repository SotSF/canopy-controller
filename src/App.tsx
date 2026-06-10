import chroma from "chroma-js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  ConnectionStatus,
  EventType,
  GameData,
  reconnect,
  sendEvent,
  subscribeConnectionStatus,
  subscribeGameData,
  subscribeShipPosition,
} from "./modules/events";
import { joyL, joyR, drawJoys, recolorJoys } from "./modules/joystick";
import { normalizeRadians, Polar } from "./modules/polar";
import { ColorPickerPanel } from "./components/ColorPickerPanel";
import { GameModeSelector } from "./components/GameModeSelector";
import { DisplayMessageBox } from "./components/DisplayMessageBox";
import { TouchPositionPad } from "./components/TouchPositionPad";
import { controlSchemeLabels, ControlScheme } from "./modules/controlScheme";
import { getGameDataMessage } from "./modules/gameDataMessages";
import { loadPadRotation, savePadRotation } from "./modules/padCalibration";
import { useControlScheme } from "./hooks/useControlScheme";
import { useGameMode } from "./hooks/useGameMode";
import { throttle } from "lodash";
import "./App.css";

type HSVA = { h: number; s: number; v: number; a: number };

const numberOfColors = 9;
const colorScale = chroma
  .scale([
    "#ff0000",
    "#ffa500",
    "#ffff00",
    "#008000",
    "#0000ff",
    "#4b0082",
    "#ee82ee",
    "#00ffff",
  ])
  .mode("hcl")
  .colors(numberOfColors);

const defaultColorIndex = Math.floor(Math.random() * colorScale.length);
const defaultColor = colorScale[defaultColorIndex];
const initialHsva: HSVA = { h: 0, s: 0, v: 68, a: 1 };
const initialCustomColor = chroma
  .hsv(initialHsva.h, initialHsva.s / 100, initialHsva.v / 100)
  .hex();

const eventThrottleMs = 15;

const sendChangeColorEvent = throttle(
  (color: string) =>
    sendEvent({
      event: EventType.ChangeColor,
      color,
    }),
  eventThrottleMs,
);

const sendButtonPressEvent = throttle(
  (button: Button) =>
    sendEvent({
      event: EventType.Press,
      button,
    }),
  eventThrottleMs,
);

const sendTouchPositionEvent = throttle(
  (r: number, theta: number) =>
    sendEvent({
      event: EventType.TouchPosition,
      r,
      theta,
    }),
  eventThrottleMs,
);

const WifiIcon = ({ connected }: { connected: boolean }) => (
  <svg
    className={`status-icon ${connected ? "connected" : "disconnected"}`}
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-label={connected ? "Websocket connected" : "Websocket disconnected"}
  >
    <path
      fill="currentColor"
      d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
    />
    {!connected && (
      <line
        x1="3"
        y1="3"
        x2="21"
        y2="21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    )}
  </svg>
);

const FullscreenIcon = ({ active }: { active: boolean }) => (
  <svg
    className="status-icon"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-label={active ? "Exit fullscreen" : "Enter fullscreen"}
  >
    <path
      fill="currentColor"
      d={
        active
          ? "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
          : "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
      }
    />
  </svg>
);

const useConnectionStatus = () => {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  useEffect(() => subscribeConnectionStatus(setStatus), []);
  return status;
};

const useShipPosition = () => {
  const [position, setPosition] = useState<Polar | null>(null);
  useEffect(() => subscribeShipPosition(setPosition), []);
  return position;
};

const useGameData = () => {
  const [gameData, setGameData] = useState<GameData | null>(null);
  useEffect(() => subscribeGameData(setGameData), []);
  return gameData;
};

const DISPLAY_MESSAGE_MS = 5000;

const useTimedDisplayMessage = (gameData: GameData | null) => {
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!gameData) return;

    const text = getGameDataMessage(gameData.displayMessageId);
    if (!text) return;

    setMessage(text);
    const id = setTimeout(() => setMessage(undefined), DISPLAY_MESSAGE_MS);
    return () => clearTimeout(id);
  }, [gameData]);

  return message;
};

const useFullscreen = () => {
  const [isFullscreen, setIsFullscreen] = useState(
    () => document.fullscreenElement !== null,
  );

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  const supported =
    typeof document.documentElement.requestFullscreen === "function";

  return { isFullscreen, toggle, supported };
};

function App() {
  const [color, setColor] = useState(defaultColor);
  const [hsva, setHsva] = useState<HSVA>(initialHsva);
  const [customColor, setCustomColor] = useState(initialCustomColor);
  const [selection, setSelection] = useState<number | "custom">(
    defaultColorIndex,
  );
  const [calibrated, setCalibrated] = useState(false);
  const [padRotation, setPadRotation] = useState(loadPadRotation);
  const [padCalibrating, setPadCalibrating] = useState(false);
  const colorRef = useRef(color);
  colorRef.current = color;
  const connectionStatus = useConnectionStatus();
  const shipPositionFromServer = useShipPosition();
  const gameData = useGameData();
  const {
    isFullscreen,
    toggle: toggleFullscreen,
    supported: fullscreenSupported,
  } = useFullscreen();
  const { scheme, selectScheme } = useControlScheme();
  const { gameMode, selectGameMode } = useGameMode();

  useEffect(() => {
    const id = setInterval(() => {
      const l = joyL;
      const r = joyR;
      if (!l || !r) return;
      const lx = l.GetX();
      const ly = l.GetY();
      const rx = r.GetX();
      const ry = r.GetY();
      if (![lx, ly, rx, ry].some((n) => n > 0.00001 || n < -0.00001)) return;
      sendEvent({
        event: EventType.Update,
        lx,
        ly,
        rx,
        ry,
      });
    }, eventThrottleMs);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("calibrating", !calibrated);
    return () => document.body.classList.remove("calibrating");
  }, [calibrated]);

  useEffect(() => {
    const showJoysticks = calibrated && scheme === "joysticks";
    document.body.classList.toggle("joysticks-hidden", !showJoysticks);
    if (showJoysticks) {
      drawJoys(colorRef.current);
    }
  }, [calibrated, scheme]);

  useEffect(() => {
    if (connectionStatus !== "connected") return;
    sendChangeColorEvent(colorRef.current);
  }, [connectionStatus]);

  const onColorChange = (newColor: string) => {
    sendChangeColorEvent(newColor);
    recolorJoys(newColor);
    setColor(newColor);
  };

  const onPresetSelect = (value: string, index: number) => {
    setSelection(index);
    onColorChange(value);
  };

  const onCustomSelect = () => {
    setSelection("custom");
    onColorChange(customColor);
  };

  const onHsvaChange = (newColor: { hex: string; hsva: HSVA }) => {
    setHsva({ ...hsva, ...newColor.hsva });
    setCustomColor(newColor.hex);
    setSelection("custom");
    onColorChange(newColor.hex);
  };

  const onPadRotationCommit = (rotation: number) => {
    const next = normalizeRadians(rotation);
    setPadRotation(next);
    savePadRotation(next);
    // Rotation is client-side only; not sent to the server.
  };

  const controlSchemes = Object.keys(controlSchemeLabels) as ControlScheme[];
  const gameDataMessage = useTimedDisplayMessage(gameData);

  return (
    <div
      className={[
        "App",
        calibrated && !isFullscreen && "App--status-bar-visible",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="status-bar">
        {fullscreenSupported && (
          <button
            type="button"
            className="status-button"
            onClick={toggleFullscreen}
          >
            <FullscreenIcon active={isFullscreen} />
          </button>
        )}
        {connectionStatus === "connected" ? (
          <WifiIcon connected />
        ) : (
          <button
            type="button"
            className="status-button"
            onClick={reconnect}
            title="Retry websocket connection"
          >
            <WifiIcon connected={false} />
          </button>
        )}
      </div>

      {!calibrated ? (
        <div className="control-panel control-panel--initial">
          <p className="landing-color-label">
            To start playing, choose your color!
          </p>
          <ColorPickerPanel
            hsva={hsva}
            colorScale={colorScale}
            selection={selection}
            customColor={customColor}
            onHsvaChange={onHsvaChange}
            onPresetSelect={onPresetSelect}
            onCustomSelect={onCustomSelect}
          />
          <div className="calibration-container">
            <button
              type="button"
              className="calibration-ready-button"
              onClick={() => setCalibrated(true)}
            >
              I'm ready
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="control-scheme-tabs"
            role="tablist"
            aria-label="Control scheme"
          >
            {controlSchemes.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={scheme === key}
                className={`control-scheme-tab${scheme === key ? " control-scheme-tab--active" : ""}`}
                onClick={() => selectScheme(key)}
              >
                {controlSchemeLabels[key]}
              </button>
            ))}
          </div>

          {scheme === "colorPicker" && (
            <div className="control-panel control-panel--color-picker">
              <GameModeSelector gameMode={gameMode} onSelect={selectGameMode} />
              <ColorPickerPanel
                hsva={hsva}
                colorScale={colorScale}
                selection={selection}
                customColor={customColor}
                onHsvaChange={onHsvaChange}
                onPresetSelect={onPresetSelect}
                onCustomSelect={onCustomSelect}
              />
            </div>
          )}

          {scheme === "globalPosition" && (
            <div className="control-panel control-panel--global-position">
              <div className="global-position-layout">
                <div className="global-position-toolbar">
                  {padCalibrating ? (
                    <button
                      type="button"
                      className="touch-position-pad-toolbar-button touch-position-pad-toolbar-button--done"
                      onClick={() => setPadCalibrating(false)}
                    >
                      Done
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="touch-position-pad-toolbar-button"
                      onClick={() => setPadCalibrating(true)}
                    >
                      Calibrate
                    </button>
                  )}
                  <DisplayMessageBox message={gameDataMessage} />
                </div>
                <button
                  className="button global-position-button global-position-button--l"
                  onTouchStart={() => sendButtonPressEvent(Button.L)}
                  onClick={() =>
                    !("ontouchstart" in document.documentElement) &&
                    sendButtonPressEvent(Button.L)
                  }
                >
                  L
                </button>
                <div className="global-position-pad">
                  <TouchPositionPad
                    color={color}
                    padRotation={padRotation}
                    shipPosition={shipPositionFromServer}
                    onPosition={({ r, theta }) =>
                      sendTouchPositionEvent(r, theta)
                    }
                    onRotationCommit={onPadRotationCommit}
                    showToolbar={false}
                    isCalibrating={padCalibrating}
                    onIsCalibratingChange={setPadCalibrating}
                  />
                </div>
                <button
                  className="button global-position-button global-position-button--r"
                  onTouchStart={() => sendButtonPressEvent(Button.R)}
                  onClick={() =>
                    !("ontouchstart" in document.documentElement) &&
                    sendButtonPressEvent(Button.R)
                  }
                >
                  R
                </button>
              </div>
            </div>
          )}

          {scheme === "joysticks" && (
            <div className="control-panel control-panel--joysticks">
              <div className="joysticks-toolbar">
                <DisplayMessageBox message={gameDataMessage} />
              </div>
              <div className="button-wrapper">
                <div className="button-container">
                  <button
                    className="button"
                    onTouchStart={() => sendButtonPressEvent(Button.L)}
                    onClick={() =>
                      !("ontouchstart" in document.documentElement) &&
                      sendButtonPressEvent(Button.L)
                    }
                  >
                    L
                  </button>
                  <button
                    className="button"
                    onTouchStart={() => sendButtonPressEvent(Button.R)}
                    onClick={() =>
                      !("ontouchstart" in document.documentElement) &&
                      sendButtonPressEvent(Button.R)
                    }
                  >
                    R
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
