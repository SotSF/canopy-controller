export const enum EventType {
  Update = 1,
  ChangeColor,
  Press,
  Gyro,
  Rotate,
  CalibrationStatus,
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
  | {
      event: EventType.Rotate;
      angle: number;
    }
  | {
      event: EventType.CalibrationStatus;
      calibrated: boolean;
    };

const hexStringToIntArray = (hexString: string) =>
  Uint8Array.from(
    hexString.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

const { REACT_APP_WEBSOCKET_PORT } = process.env;
const websocketUrl = `ws://${window.location.hostname}:${REACT_APP_WEBSOCKET_PORT}`;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

export type ConnectionStatus = "connected" | "disconnected";

const statusListeners = new Set<(status: ConnectionStatus) => void>();
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

  EventType.Rotate:
    0x00                < Event type
    0x00 0x00 0x00 0x00 < float data 0 (angle increment in radians)

  EventType.CalibrationStatus:
    0x00                < Event type
    0x00                < calibration done flag (0 = calibrating, 1 = done)
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
  }

  if (websocket.readyState === WebSocket.OPEN) {
    websocket.send(byteBuffer.buffer);
  }
};
