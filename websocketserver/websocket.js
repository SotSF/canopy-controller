import { WebSocketServer } from "ws";

const PORT = Number(process.env.WEBSOCKET_PORT || 9431);
const HOST = "0.0.0.0";

const EventType = {
  Update: 1,
  ChangeColor: 2,
  Press: 3,
  Gyro: 4,
  Rotate: 5,
  CalibrationStatus: 6,
  ShipPosition: 7,
  TouchPosition: 8,
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
        payload = `#${buffer
          .slice(1, 4)
          .toString("hex")
          .padStart(6, "0")}`;
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
  }

  const hex = buffer.toString("hex");
  if (payload !== undefined) {
    return `${name} ${JSON.stringify(payload)} (${hex})`;
  }
  return `${name} (${hex})`;
};

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on("connection", (ws) => {
  console.log("Connection opened");

  ws.on("message", (data) => {
    if (Buffer.isBuffer(data)) {
      console.log("> Received", formatEvent(data));
      return;
    }
    console.log("> Received", data);
  });

  ws.on("close", () => {
    console.log("Connection closed");
  });
});

console.log(`WebSocket server listening on ws://${HOST}:${PORT}`);
