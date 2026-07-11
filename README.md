# TicTacube

A mobile-friendly `3x3x3` XOX strategy game for web, with online rooms,
AI opponents, release QA tooling, and Capacitor packaging hooks for native
iOS/Android builds.

## Game Modes

### Lines Mode

Lines Mode is the default ruleset. The board fills over the whole round, and
players score every completed 3-cell line instead of ending the round on the
first line. Multi-line moves, blocked threats, final line totals, and result
chips are surfaced in the UI so the round reads as a score race.

### Classic

Classic is the familiar variant: the first completed line wins the round. Local
Classic games can use the Pie Rule opening flow. Online Classic currently keeps
Pie off until a synchronized side-swap action is added to the room protocol.

### Best-of-5 Match

Rounds sit inside a Best-of-5 match. The match ends when one side reaches 3
round wins. Draws are shown but do not count toward the match win target.
Match score, current round, current opener, next opener, and match result stay
separate from local lifetime stats.

### Coach

Coach highlights useful scoring and blocking cells. Scanner labels include
score/block/both hints with non-color cues, and the 3D views show related
threat context without making Coach louder than the board.

### Daily Puzzle And Local Progress

The Daily Puzzle card gives a small daily challenge and stores the local result
in browser storage. Local progress tracks streaks, total Lines scoring,
best Lines margin, Master wins, and theme accent unlock progress on the device.

### Online Rooms

Online mode uses a lightweight WebSocket room server. The host defines the
ruleset; guests receive it and ruleset controls lock after connection. Classic
rooms explicitly advertise Pie off, and the server rejects unsupported Pie-on
settings rather than letting clients silently diverge. Resets preserve agreed
settings, and reconnects restore the room state.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

For online mode, run the room server in a second terminal:

```bash
npm run online:server
```

The web client falls back to `ws://127.0.0.1:8787` only on local hosts. For
deployed web or native mobile builds, set `VITE_ONLINE_SERVER_URL` before
building:

```bash
VITE_ONLINE_SERVER_URL=wss://your-server.example npm run build
```

## Commands

Install dependencies:

```bash
npm install
```

Build the web app:

```bash
npm run build
```

Deploy the web app on Vercel:

```bash
npm run build
```

Vercel uses the settings in `vercel.json`: Vite framework, `npm ci`, `npm run
build`, and `dist` output. See [Vercel Production Release](docs/vercel-production.md)
for the release gate, smoke checklist, and online-server requirements.

Run the online room server:

```bash
npm run online:server
```

Run deterministic online protocol checks:

```bash
npm run online:test
```

Run AI self-play balance checks:

```bash
npm run ai:selfplay
```

Validate and summarize completed human playtest responses:

```bash
npm run playtest:test
npm run playtest:analyze -- path/to/responses.csv
```

Start with `docs/human-playtest-responses.csv` and follow
`docs/human-playtest-protocol.md`.

Run the product final pass:

```bash
npm run product:final-pass
```

## Test Command List

Install reproducible dependencies in CI:

```bash
npm ci
```

Install Playwright Chromium before browser tests on a fresh machine:

```bash
npx playwright install chromium
```

Run the build gate:

```bash
npm run build
```

Run unit tests:

```bash
npm run test:unit
```

Run online protocol tests:

```bash
npm run online:test
```

Run human playtest analyzer tests:

```bash
npm run playtest:test
```

Run browser interaction tests:

```bash
npm run test:e2e
```

Run AI self-play balance checks:

```bash
npm run ai:selfplay
```

Run the product final pass:

```bash
npm run product:final-pass
```

Run the full standard gate:

```bash
npm run test
```

`npm run test` runs `npm run build`, `npm run test:unit`,
`npm run playtest:test`, `npm run online:test`, and `npm run test:e2e`.

The optional deeper manual release gate is:

```bash
npm run test
npm run product:final-pass
```

## Online Deployment Notes

The room server exposes a WebSocket endpoint and `GET /health` on the same port.
For production, run it behind a TLS-capable reverse proxy or a host that
supports long-lived WebSocket processes, then build the client with a secure
WebSocket URL:

```bash
VITE_ONLINE_SERVER_URL=wss://your-server.example npm run build
```

The Vercel deployment serves the static Vite client. Do not assume the current
in-memory room server is deployed with Vercel unless it is intentionally rebuilt
for Vercel Functions and backed by external room state.

See [Online Mode Production](docs/online-production.md) for the WebSocket server
container, health checks, capacity/origin guardrails, and deploy checklist.

Useful server environment variables:

- `HOST`: bind host, default `0.0.0.0`
- `PORT`: bind port, default `8787`
- `ONLINE_ALLOWED_ORIGINS`: comma-separated browser origins allowed to connect
- `MAX_CLIENTS`: maximum concurrent WebSocket clients, default `200`
- `MAX_ROOMS`: maximum in-memory rooms, default `100`
- `MAX_MESSAGE_BYTES`: maximum WebSocket message payload, default `4096`
- `ROOM_TTL_MS`: idle/waiting room lifetime, default `1800000`
- `REJOIN_GRACE_MS`: time to preserve an empty room for reconnect, default
  `45000`
- `HEARTBEAT_MS`: WebSocket ping interval, default `30000`

The protocol assigns private session IDs to each side so a dropped host or
guest can rejoin the same room. Moves are validated server-side against the
connected player side before relay.

## Mobile

The app is installable as a PWA and has Capacitor config for native iOS/Android
packaging.

```bash
npm run mobile:add:ios
npm run mobile:add:android
npm run mobile:sync
```

Native iOS/Android platform folders are included. Use `npm run mobile:sync`
after web changes, then open the platform project for device QA.

## Release QA

- Desktop: run `npm run test`, then manually smoke Chrome or a Safari-like
  browser across Scanner, Cube, Floors, Lines, Classic, Coach, and theme
  switching.
- Mobile viewport: verify Scanner remains playable, touch selection is clear,
  Cube/Floors can be entered, and no horizontal overflow appears.
- Online server: run `npm run online:server`, check `GET /health`, create and
  join both Lines and Classic rooms, verify settings lock and reconnect.
- Capacitor sync: run `npm run mobile:sync` after a production build, then open
  the native platform project for device-specific packaging checks.
