const WebSocket = require("ws");

const PORT = Number(process.env.WEBSOCKET_PORT || 9431);
const HOST = "0.0.0.0";

const wss = new WebSocket.Server({ host: HOST, port: PORT });

wss.on("connection", (ws) => {
  console.log("Connection opened");

  ws.on("message", (data) => {
    if (Buffer.isBuffer(data)) {
      console.log("> Received", data.toString("hex"));
      return;
    }
    console.log("> Received", data);
  });

  ws.on("close", () => {
    console.log("Connection closed");
  });
});

console.log(`WebSocket server listening on ws://${HOST}:${PORT}`);
