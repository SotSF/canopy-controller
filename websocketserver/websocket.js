import { WebSocketServer, WebSocket } from "ws";

const DEBUG = true;

const PORT = Number(process.env.WEBSOCKET_PORT || 9431);
const HOST = "0.0.0.0";

// Rotate and CalibrationStatus are deprecated — kept for protocol/debug parsing only.
const EventType = {
  Update: 1,
  ChangeColor: 2,
  Press: 3,
  Gyro: 4,
  Rotate: 5, // deprecated: pad rotation is client-side only
  CalibrationStatus: 6, // deprecated
  ShipPosition: 7,
  TouchPosition: 8,
  GameDataUpdate: 9,
};

const eventTypeNames = Object.fromEntries(
  Object.entries(EventType).map(([name, id]) => [id, name]),
);

const Button = { L: 1, R: 2 };
const buttonNames = Object.fromEntries(
  Object.entries(Button).map(([name, id]) => [id, name]),
);

const readFloat = (view, offset) => view.getFloat32(offset, true);

const formatEvent = (buffer) => {
  if (buffer.length === 0) return "empty";

  const type = buffer[0];
  const name = eventTypeNames[type] ?? `Unknown(${type})`;
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );

  let payload;
  switch (type) {
    case EventType.Update:
      if (buffer.length >= 17) {
        payload = {
          lx: readFloat(view, 1),
          ly: readFloat(view, 5),
          rx: readFloat(view, 9),
          ry: readFloat(view, 13),
        };
      }
      break;
    case EventType.ChangeColor:
      if (buffer.length >= 4) {
        payload = `#${buffer.slice(1, 4).toString("hex").padStart(6, "0")}`;
      }
      break;
    case EventType.Press:
      if (buffer.length >= 2) {
        payload = { button: buttonNames[buffer[1]] ?? buffer[1] };
      }
      break;
    case EventType.Gyro:
      if (buffer.length >= 13) {
        payload = {
          alpha: readFloat(view, 1),
          beta: readFloat(view, 5),
          gamma: readFloat(view, 9),
        };
      }
      break;
    case EventType.Rotate:
      if (buffer.length >= 5) {
        payload = { angle: readFloat(view, 1) };
      }
      break;
    case EventType.CalibrationStatus:
      if (buffer.length >= 2) {
        payload = { calibrated: buffer[1] === 1 };
      }
      break;
    case EventType.ShipPosition:
    case EventType.TouchPosition:
      if (buffer.length >= 9) {
        payload = {
          r: readFloat(view, 1),
          theta: readFloat(view, 5),
        };
      }
      break;
    case EventType.GameDataUpdate:
      if (buffer.length >= 17) {
        payload = {
          displayMessageId: view.getUint16(1, true),
          gameId: view.getUint16(3, true),
          info: buffer.slice(5, 17).toString("hex"),
        };
      }
      break;
  }

  const hex = buffer.toString("hex");
  if (payload !== undefined) {
    return `${name} ${JSON.stringify(payload)} (${hex})`;
  }
  return `${name} (${hex})`;
};

const encodeShipPosition = (r, theta) => {
  const buffer = Buffer.alloc(9);
  buffer[0] = EventType.ShipPosition;
  buffer.writeFloatLE(r, 1);
  buffer.writeFloatLE(theta, 5);
  return buffer;
};

const encodeGameDataUpdate = (
  displayMessageId,
  gameId,
  info = Buffer.alloc(12),
) => {
  const buffer = Buffer.alloc(17);
  buffer[0] = EventType.GameDataUpdate;
  buffer.writeUInt16LE(displayMessageId & 0xffff, 1);
  buffer.writeUInt16LE(gameId & 0xffff, 3);
  info.copy(buffer, 5, 0, 12);
  return buffer;
};

const wss = new WebSocketServer({ host: HOST, port: PORT });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Connection opened");

  ws.on("message", (data) => {
    if (Buffer.isBuffer(data)) {
      console.log("> Received", formatEvent(data));
      return;
    }
    console.log("> Received", data);
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Connection closed");
  });
});

const broadcast = (message) => {
  console.log("< Sent", formatEvent(message));
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
};

const GAME_DATA_MIN_DELAY_MS = 3_000;
const GAME_DATA_MAX_DELAY_MS = 8_000;

const scheduleGameDataUpdate = () => {
  const delay =
    GAME_DATA_MIN_DELAY_MS +
    Math.random() * (GAME_DATA_MAX_DELAY_MS - GAME_DATA_MIN_DELAY_MS);
  setTimeout(() => {
    if (clients.size > 0) {
      const displayMessageId = 0;
      const gameId = Math.floor(Math.random() * 10);
      broadcast(encodeGameDataUpdate(displayMessageId, gameId));
    }
    scheduleGameDataUpdate();
  }, delay);
};

if (DEBUG) {
  scheduleGameDataUpdate();
  setInterval(() => {
    const r = Math.random();
    const theta = Math.random() * Math.PI * 2 - Math.PI;
    broadcast(encodeShipPosition(r, theta));
  }, 30_000);
}

console.log(`WebSocket server listening on ws://${HOST}:${PORT}`);
console.log(
  `Sending GameDataUpdate every ${GAME_DATA_MIN_DELAY_MS / 1000}-${GAME_DATA_MAX_DELAY_MS / 1000}s`,
);
if (DEBUG) {
  console.log("Debug mode: sending ShipPosition every 30s");
}
