# Secret Fire Canopy JS Controller

Web app that interfaces with the Servants of the Secret Fire LED Canopy.

<img src="./docs/landscape.png" alt="landscape" width="500"></img>

<img src="./docs/portrait.png" alt="portrait" width="250"></img>

## Overview

A Vite + React TypeScript app renders a frontend, which connects to the Unity app's
websocket server and sends events (client -> server). A simple Node websocket server can be used
to log the output from the React app.

## Development

### Setup

Ensure you have a recent version of Node (18+ recommended).

Install dependencies:

`npm install`

### Run

Run the dev server:

`npm start`

Either run the canopy app, or run the local websocket server:

`npm run websocket`

Visit: http://localhost:5173/

### Tips

The React app connects to a websocket server on the same host that served the page. The port is
configured via an environment variable:

```
VITE_WEBSOCKET_PORT=9431
```

This value gets a default in `.env`. To override it, create a file `.env.local` and assign the
override as desired. Restart the dev server after changing env values.

## To do

- size joystick smartly
- smartly reconnect to websocket server
