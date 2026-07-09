# Online Mode Production

Online mode uses `server/online-server.mjs`, a lightweight WebSocket room
server. The Vercel app serves the static game client; the room server should be
deployed to a host that supports long-lived WebSocket processes.

## Client Configuration

Set this environment variable in Vercel before promoting Online mode:

```bash
VITE_ONLINE_SERVER_URL=wss://your-online-server.example
```

On local hosts, the client still falls back to `ws://127.0.0.1:8787` or
`ws://localhost:8787`. On hosted domains, Online mode is disabled with a clear
setup message until `VITE_ONLINE_SERVER_URL` is configured.

## Server Configuration

Use `.env.online.example` as the production server template.

Important variables:

- `ONLINE_ALLOWED_ORIGINS`: comma-separated allowed browser origins, for
  example `https://your-game.vercel.app,https://your-custom-domain.com`.
- `MAX_CLIENTS`: maximum concurrent WebSocket clients.
- `MAX_ROOMS`: maximum in-memory rooms.
- `MAX_MESSAGE_BYTES`: maximum accepted WebSocket message payload.
- `ROOM_TTL_MS`: idle/waiting room lifetime.
- `REJOIN_GRACE_MS`: time to preserve an empty room for reconnect.
- `HEARTBEAT_MS`: WebSocket ping interval.

If `ONLINE_ALLOWED_ORIGINS` is omitted, the server accepts any origin. That is
convenient for local development, but production should set the allowlist.

## Container Build

The server includes `server/Dockerfile`:

```bash
docker build -f server/Dockerfile -t 3d-xox-online .
docker run --env-file .env.online -p 8787:8787 3d-xox-online
```

Deploy the container on a WebSocket-capable host such as Fly.io, Render,
Railway, a VPS, or another long-running Node host. Put it behind TLS and expose
a `wss://` URL to the Vercel client.

## Health Checks

The room server exposes:

- `GET /health`
- `GET /ready`

Both return JSON with room/client counts and service metadata.

## Verification

Before promoting Online mode:

```bash
npm run online:test
npm run test:e2e
```

After deployment:

- Open the Vercel app and switch to Online mode.
- Confirm the Online card says the server is configured.
- Host and join a Lines room.
- Host and join a Classic room.
- Verify rules lock, moves relay, reset works, and reconnect restores room
  settings.
