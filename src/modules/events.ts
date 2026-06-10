export const enum EventType {
  Update = 1,
  ChangeColor,
  Press,
  Gyro,
  /** @deprecated No longer sent. Pad rotation is a client-side-only concern. */
  Rotate,
  /** @deprecated No longer used. */
  CalibrationStatus,
  ShipPosition,
  TouchPosition,
  GameDataUpdate,
}

export const enum Button {
  L = 1,
  R,
}

export type PlayerEvent =
  | {
      event: EventType.Update;
      lx: number;
      ly: number;
      rx: number;
      ry: number;
    }
  | {
      event: EventType.ChangeColor;
      color: string;
    }
  | {
      event: EventType.Press;
      button: Button;
    }
  | {
      event: EventType.Gyro;
      alpha: number;
      beta: number;
      gamma: number;
    }
  /** @deprecated EventType.Rotate is no longer sent by the client. */
  | {
      event: EventType.Rotate;
      angle: number;
    }
  /** @deprecated EventType.CalibrationStatus is no longer used. */
  | {
      event: EventType.CalibrationStatus;
      calibrated: boolean;
    }
  | {
      event: EventType.TouchPosition;
      r: number;
      theta: number;
    };

export type ServerEvent =
  | {
      event: EventType.ShipPosition;
      r: number;
      theta: number;
    }
  | {
      event: EventType.GameDataUpdate;
      displayMessageId: number;
      gameId: number;
      info: Uint8Array;
    };

export type GameData = {
  displayMessageId: number;
  gameId: number;
  info: Uint8Array;
};

const hexStringToIntArray = (hexString: string) =>
  Uint8Array.from(
    hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

const websocketUrl = `ws://${window.location.hostname}:${import.meta.env.VITE_WEBSOCKET_PORT}`;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

export type ConnectionStatus = "connected" | "disconnected";

const statusListeners = new Set<(status: ConnectionStatus) => void>();
const shipPositionListeners = new Set<
  (position: { r: number; theta: number }) => void
>();
const gameDataListeners = new Set<(gameData: GameData) => void>();
let currentStatus: ConnectionStatus = "disconnected";
let websocket: WebSocket;
let retryCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const setStatus = (status: ConnectionStatus) => {
  if (status === currentStatus) return;
  currentStatus = status;
  statusListeners.forEach((listener) => listener(status));
};

const scheduleReconnect = () => {
  if (retryTimer !== null) return;
  if (retryCount >= MAX_RETRIES) return;
  const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
  retryCount++;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, delay);
};

const connect = () => {
  const ws = new WebSocket(websocketUrl);
  ws.binaryType = "arraybuffer";
  websocket = ws;

  ws.addEventListener("open", () => {
    if (ws !== websocket) return;
    retryCount = 0;
    setStatus("connected");
  });
  ws.addEventListener("close", () => {
    if (ws !== websocket) return;
    setStatus("disconnected");
    scheduleReconnect();
  });
  ws.addEventListener("error", () => {
    if (ws !== websocket) return;
    setStatus("disconnected");
  });
  ws.addEventListener("message", (event) => {
    if (ws !== websocket) return;
    if (!(event.data instanceof ArrayBuffer)) return;

    const view = new DataView(event.data);
    if (event.data.byteLength < 1) return;

    switch (view.getUint8(0)) {
      case EventType.ShipPosition: {
        if (event.data.byteLength < 9) return;
        const position = {
          r: view.getFloat32(1, true),
          theta: view.getFloat32(5, true),
        };
        shipPositionListeners.forEach((listener) => listener(position));
        break;
      }
      case EventType.GameDataUpdate: {
        if (event.data.byteLength < 17) return;
        const gameData: GameData = {
          displayMessageId: view.getUint16(1, true),
          gameId: view.getUint16(3, true),
          info: new Uint8Array(event.data.slice(5, 17)),
        };
        gameDataListeners.forEach((listener) => listener(gameData));
        break;
      }
    }
  });
};

export const reconnect = () => {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryCount = 0;
  const oldWs = websocket;
  connect();
  if (oldWs && oldWs.readyState !== WebSocket.CLOSED) {
    oldWs.close();
  }
};

connect();

export const subscribeConnectionStatus = (
  listener: (status: ConnectionStatus) => void,
) => {
  statusListeners.add(listener);
  listener(currentStatus);
  return () => {
    statusListeners.delete(listener);
  };
};

export const subscribeShipPosition = (
  listener: (position: { r: number; theta: number }) => void,
) => {
  shipPositionListeners.add(listener);
  return () => {
    shipPositionListeners.delete(listener);
  };
};

export const subscribeGameData = (listener: (gameData: GameData) => void) => {
  gameDataListeners.add(listener);
  return () => {
    gameDataListeners.delete(listener);
  };
};

/*
  Binary format

  EventType.Press:
    0x00                < Event type
    0x00                < Button id

  EventType.ChangeColor:
    0x00                < Event type
    0x00 0x00 0x00      < Player hex color

  EventType.Update:
    0x00                < Event type
    0x00 0x00 0x00 0x00 < float data 0 (lx)
    0x00 0x00 0x00 0x00 < float data 1 (ly)
    0x00 0x00 0x00 0x00 < float data 2 (rx)
    0x00 0x00 0x00 0x00 < float data 3 (ry)

  EventType.Gyro:
    0x00                < Event type
    0x00 0x00 0x00 0x00 < float data 0 (alpha)
    0x00 0x00 0x00 0x00 < float data 1 (beta)
    0x00 0x00 0x00 0x00 < float data 2 (gamma)

  EventType.Rotate (deprecated — no longer sent):
    0x00                < Event type
    0x00 0x00 0x00 0x00 < float data 0 (angle increment in radians)

  EventType.CalibrationStatus (deprecated — no longer used):
    0x00                < Event type
    0x00                < calibration done flag (0 = calibrating, 1 = done)

  EventType.ShipPosition (server -> client):
    0x00                < Event type
    0x00 0x00 0x00 0x00 < float data 0 (r)
    0x00 0x00 0x00 0x00 < float data 1 (theta, radians)

  EventType.TouchPosition (client -> server):
    0x00                < Event type
    0x00 0x00 0x00 0x00 < float data 0 (r)
    0x00 0x00 0x00 0x00 < float data 1 (theta, radians)

  EventType.GameDataUpdate (server -> client):
    0x00                < Event type
    0x00 0x00            < uint16 DisplayMessageId (little-endian)
    0x00 0x00            < uint16 GameID (little-endian)
    0x00 x12             < 12 bytes unstructured game info (health, ammo, shields, snake length, etc)
*/
export const sendEvent = async (playerEvent: PlayerEvent) => {
  const byteBuffer = new Uint8Array(17);
  byteBuffer[0] = playerEvent.event;

  let floatData: Uint8Array;
  switch (playerEvent.event) {
    case EventType.ChangeColor:
      const colorBytes = hexStringToIntArray(
        playerEvent.color.replace("#", ""),
      );
      byteBuffer[1] = colorBytes[0];
      byteBuffer[2] = colorBytes[1];
      byteBuffer[3] = colorBytes[2];
      break;
    case EventType.Update:
      const { lx, ly, rx, ry } = playerEvent;
      floatData = new Uint8Array(new Float32Array([lx, ly, rx, ry]).buffer);
      for (let i = 0; i < 16; i++) {
        byteBuffer[i + 1] = floatData[i];
      }
      break;
    case EventType.Press:
      byteBuffer[1] = playerEvent.button;
      break;
    case EventType.Gyro:
      const { alpha, beta, gamma } = playerEvent;
      floatData = new Uint8Array(new Float32Array([alpha, beta, gamma]).buffer);
      for (let i = 0; i < 12; i++) {
        byteBuffer[i + 1] = floatData[i];
      }
      break;
    case EventType.Rotate:
      floatData = new Uint8Array(new Float32Array([playerEvent.angle]).buffer);
      for (let i = 0; i < 4; i++) {
        byteBuffer[i + 1] = floatData[i];
      }
      break;
    case EventType.CalibrationStatus:
      byteBuffer[1] = playerEvent.calibrated ? 1 : 0;
      break;
    case EventType.TouchPosition:
      floatData = new Uint8Array(
        new Float32Array([playerEvent.r, playerEvent.theta]).buffer,
      );
      for (let i = 0; i < 8; i++) {
        byteBuffer[i + 1] = floatData[i];
      }
      break;
  }

  if (websocket.readyState === WebSocket.OPEN) {
    websocket.send(byteBuffer.buffer);
  }
};
