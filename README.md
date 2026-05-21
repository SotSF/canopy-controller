# Secret Fire Canopy JS Controller

Web app that interfaces with the Servants of the Secret Fire LED Canopy.

<img src="./docs/landscape.png" alt="landscape" width="500"></img>

<img src="./docs/portrait.png" alt="portrait" width="250"></img>

## Overview

A Create React App (CRA) Typescript app renders a React frontend, which connects to the Unity app's
websocket server and sends events (client -> server). A simple Node websocket server can be used
to log the output from the React app.

## Development

### Setup

Ensure you have a recent version of Node (10 doesn't work, 16 does).

Install dependencies:

`npm install`

### Run

Run the React server:

`npm start`

Either run the canopy app, or run the local websocket server:

`npm run websocket`

Visit: http://localhost:3000/

### Tips

The React app connects to a websocket server on the same host that served the page. The port is
configured via an environment variable:

```
REACT_APP_WEBSOCKET_PORT=9431
```

This value gets a default in `.env`. To override it, create a file `.env.local` and assign the
override as desired. Re-run `npm start` to rebuild with the changed value.

## To do

- size joystick smartly
- smartly reconnect to websocket server
