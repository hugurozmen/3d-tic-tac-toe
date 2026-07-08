# Vercel Production Release

This repo is ready to deploy the web game as a Vite static app on Vercel.

## Vercel Project Settings

- Framework preset: `Vite`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: `22.x`

These settings are also captured in `vercel.json`.

## Online Mode

The Vercel deployment serves the web client. Online rooms require a separate
WebSocket room server unless the server is intentionally rebuilt for Vercel
Functions with external room state.

For the current room server, deploy `server/online-server.mjs` on a host that
supports long-lived WebSocket processes, then set this Vercel environment
variable before building:

```bash
VITE_ONLINE_SERVER_URL=wss://your-online-server.example
```

If the variable is omitted, the client falls back to `wss://<site-host>:8787`
on HTTPS pages. That is useful for self-hosted deployments, but it is not a
complete Vercel online-room setup by itself.

## Release Gate

Run before promoting a deployment:

```bash
npm ci
npm run test
npm run product:final-pass
```

The standard gate covers build, unit tests, online protocol checks, and
Playwright browser flows. The product final pass adds scripted smoke coverage
for the main play modes, online rooms, mobile viewport, themes, and 3D board
rendering.

## Vercel Smoke Checklist

After deployment, verify:

- The home URL loads without console errors.
- Scanner is playable on a mobile viewport.
- Cube and Floors render nonblank canvases after hard refresh.
- Theme switching works.
- Daily and Progress modals open centered.
- If `VITE_ONLINE_SERVER_URL` is configured, host and guest can create a Lines
  room and a Classic room, settings lock, moves relay, and reconnect works.
- If `VITE_ONLINE_SERVER_URL` is not configured, do not market Online mode as
  production-ready for the Vercel deployment.
