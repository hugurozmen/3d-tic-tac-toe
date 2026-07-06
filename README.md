# 3D XOX

A polished first pass at a true `3x3x3` XOX game for web, with mobile app packaging hooks ready for Capacitor.

## Modes

- Local 2-player
- Player vs AI with four difficulty tiers
- Online multiplayer with a lightweight WebSocket room server

## Run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

For online mode, run the room server in a second terminal:

```bash
npm run online:server
```

The web client defaults to `ws://<current-host>:8787`. For deployed web or native mobile builds, set `VITE_ONLINE_SERVER_URL` before building:

```bash
VITE_ONLINE_SERVER_URL=wss://your-server.example npm run build
```

## Build

```bash
npm run build
```

## Online Protocol Test

```bash
npm run online:test
```

This verifies room creation/join, move relays, reset relays, player spoof
rejection, host rejoin, and abandoned-room cleanup.

## Browser Interaction Tests

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright suite covers the mobile playable area, Scanner move/win flow,
mobile view switching into the 3D board, and an online host/guest move.

Run all verification with:

```bash
npm test
```

## Online Deployment Notes

The room server exposes a WebSocket endpoint and `GET /health` on the same port.
For production, run it behind a TLS-capable reverse proxy and build the client
with a secure WebSocket URL:

```bash
VITE_ONLINE_SERVER_URL=wss://your-server.example npm run build
```

Useful server environment variables:

- `HOST`: bind host, default `0.0.0.0`
- `PORT`: bind port, default `8787`
- `ROOM_TTL_MS`: idle/waiting room lifetime, default `1800000`
- `REJOIN_GRACE_MS`: time to preserve an empty room for reconnect, default `45000`
- `HEARTBEAT_MS`: WebSocket ping interval, default `30000`

The protocol assigns private session IDs to each side so a dropped host or guest
can rejoin the same room. Moves are validated server-side against the connected
player side before relay.

## Mobile

The app is installable as a PWA and has Capacitor config for native iOS/Android packaging.

```bash
npm run mobile:add:ios
npm run mobile:add:android
npm run mobile:sync
```

Native iOS/Android platform folders are included. Use `npm run mobile:sync`
after web changes, then open the platform project for device QA.
