import chroma from "chroma-js";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactSwitch from "react-switch";
import Wheel from "@uiw/react-color-wheel";
import {
  Button,
  ConnectionStatus,
  EventType,
  reconnect,
  sendEvent,
  subscribeConnectionStatus,
  subscribeShipPosition,
} from "./modules/events";
import { joyL, joyR, drawJoys, recolorJoys } from "./modules/joystick";
import { cartesianToPolar, polarToPercent, Polar } from "./modules/polar";
import { useDeviceOrientation } from "./modules/deviceOrientation";
import { throttle } from "lodash";
import "./App.css";

type HSVA = { h: number; s: number; v: number; a: number };

const numberOfColors = 8;
const colorScale = chroma
  .scale([
    "#ff0000",
    "#ffa500",
    "#ffff00",
    "#008000",
    "#0000ff",
    "#4b0082",
    "#ee82ee",
  ])
  .mode("hcl")
  .colors(numberOfColors);

const defaultColorIndex = Math.floor(Math.random() * colorScale.length);
const defaultColor = colorScale[defaultColorIndex];
const initialHsva: HSVA = { h: 0, s: 0, v: 68, a: 1 };
const initialCustomColor = chroma
  .hsv(initialHsva.h, initialHsva.s / 100, initialHsva.v / 100)
  .hex();

const eventThrottleMs = 50;
const rotationIncrementRad = Math.PI / 6; // 30 degrees

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

const sendRotateEvent = (angle: number) =>
  sendEvent({
    event: EventType.Rotate,
    angle,
  });

const sendCalibrationStatusEvent = (calibrated: boolean) =>
  sendEvent({
    event: EventType.CalibrationStatus,
    calibrated,
  });

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

  const supported = typeof document.documentElement.requestFullscreen === "function";
  return { isFullscreen, toggle, supported };
};

// Fullscreen API requires a user gesture, so we can't auto-enter on mount.
// On touch devices, enter fullscreen on the user's first tap instead.
const useAutoFullscreenOnTouch = (supported: boolean) => {
  useEffect(() => {
    if (!supported) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (document.fullscreenElement) return;

    const enter = () => {
      document.documentElement.requestFullscreen().catch(() => {});
    };
    document.addEventListener("touchstart", enter, { once: true, passive: true });
    return () => document.removeEventListener("touchstart", enter);
  }, [supported]);
};

function App() {
  const [color, setColor] = useState(defaultColor);
  const [hsva, setHsva] = useState<HSVA>(initialHsva);
  const [customColor, setCustomColor] = useState(initialCustomColor);
  const [selection, setSelection] = useState<number | "custom">(
    defaultColorIndex,
  );
  const [gyroMode, setGyroMode] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const rotationRef = useRef(0);
  const colorRef = useRef(color);
  colorRef.current = color;
  const connectionStatus = useConnectionStatus();
  const shipPositionFromServer = useShipPosition();
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } =
    useFullscreen();
  useAutoFullscreenOnTouch(fullscreenSupported);

  const { requestAccess, revokeAccess } = useDeviceOrientation();

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
      const cos = Math.cos(rotationRef.current);
      const sin = Math.sin(rotationRef.current);
      sendEvent({
        event: EventType.Update,
        lx: lx * cos - ly * sin,
        ly: lx * sin + ly * cos,
        rx: rx * cos - ry * sin,
        ry: rx * sin + ry * cos,
      });
    }, eventThrottleMs);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("calibrating", !calibrated);
    // Draw joysticks only after their container is visible. Reading
    // clientWidth in the JoyStick constructor returns 0 for a display:none
    // container, which produces a negative internalRadius and corrupts the
    // instance permanently.
    if (calibrated) drawJoys(colorRef.current);
    return () => document.body.classList.remove("calibrating");
  }, [calibrated]);

  useEffect(() => {
    if (connectionStatus !== "connected") return;
    sendCalibrationStatusEvent(calibrated);
  }, [connectionStatus, calibrated]);

  useEffect(() => {
    if (connectionStatus !== "connected") return;
    sendChangeColorEvent(colorRef.current);
  }, [connectionStatus]);

  useEffect(() => {
    let pointerDown = false;

    const onPointerDown = (event: PointerEvent) => {
      pointerDown = true;
      const { r, theta } = cartesianToPolar(event.clientX, event.clientY);
      sendTouchPositionEvent(r, theta);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointerDown) return;
      const { r, theta } = cartesianToPolar(event.clientX, event.clientY);
      sendTouchPositionEvent(r, theta);
    };
    const onPointerUp = () => {
      pointerDown = false;
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

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

  const onRotate = () => {
    rotationRef.current += rotationIncrementRad;
    sendRotateEvent(rotationIncrementRad);
  };

  return (
    <div className="App">
      {shipPositionFromServer && (
        <div
          className="ship-position"
          style={polarToPercent(shipPositionFromServer)}
          aria-hidden
        />
      )}
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
      {calibrated && (
        <label className="gyro-toggle-container">
          <ReactSwitch
            onChange={(sensorModeEnabled) => {
              setGyroMode(sensorModeEnabled);
              if (sensorModeEnabled) requestAccess();
              else revokeAccess();
            }}
            checked={gyroMode}
            className="gyro-toggle"
          />
          <span>Gyro mode</span>
        </label>
      )}
      <Wheel width={175} height={175} color={hsva} onChange={onHsvaChange} />
      <div className="color-container">
        {colorScale.map((value, index) => (
          <div
            key={index}
            className={`color ${selection === index ? "selected" : ""}`}
            tabIndex={0}
            style={{
              backgroundColor: value,
              boxShadow: `0 0 15px 2px ${value}`,
            }}
            // Use onTouchStart for snappy controls and to handle multitouch situations
            onTouchStart={() => onPresetSelect(value, index)}
            // On mobile, to avoid sending to events, ignore onClick
            onClick={() =>
              !("ontouchstart" in document.documentElement) &&
              onPresetSelect(value, index)
            }
          />
        ))}
        <div
          className={`color ${selection === "custom" ? "selected" : ""}`}
          tabIndex={0}
          style={{
            backgroundColor: customColor,
            boxShadow: `0 0 15px 2px ${customColor}`,
          }}
          onTouchStart={onCustomSelect}
          onClick={() =>
            !("ontouchstart" in document.documentElement) && onCustomSelect()
          }
        />
      </div>
      {!calibrated ? (
        <div className="calibration-container">
          <button
            type="button"
            className="calibration-button"
            onTouchStart={onRotate}
            onClick={() =>
              !("ontouchstart" in document.documentElement) && onRotate()
            }
            aria-label="Rotate starting position"
          >
            🔄️
          </button>
          <button
            type="button"
            className="calibration-button calibration-done"
            onClick={() => setCalibrated(true)}
            aria-label="Done calibrating"
          >
            ✓
          </button>
        </div>
      ) : (
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
      )}
    </div>
  );
}

export default App;
