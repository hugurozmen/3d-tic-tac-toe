import { describe, expect, it } from 'vitest';
import { resolveOnlineServerConfig } from './useOnlineGame';

describe('resolveOnlineServerConfig', () => {
  it('uses the local fallback only for local hosts', () => {
    expect(
      resolveOnlineServerConfig({
        hostname: '127.0.0.1',
        protocol: 'http:',
      }),
    ).toEqual({
      error: null,
      isConfigured: true,
      source: 'local',
      url: 'ws://127.0.0.1:8787',
    });
  });

  it('requires explicit server config on hosted domains', () => {
    const config = resolveOnlineServerConfig({
      hostname: '3d-xox.vercel.app',
      protocol: 'https:',
    });

    expect(config.isConfigured).toBe(false);
    expect(config.source).toBe('missing');
    expect(config.error).toContain('VITE_ONLINE_SERVER_URL');
  });

  it('accepts a production wss server URL', () => {
    expect(
      resolveOnlineServerConfig({
        configured: 'wss://rooms.example.com/socket',
        hostname: '3d-xox.vercel.app',
        protocol: 'https:',
      }),
    ).toEqual({
      error: null,
      isConfigured: true,
      source: 'env',
      url: 'wss://rooms.example.com/socket',
    });
  });

  it('rejects non-WebSocket URLs', () => {
    const config = resolveOnlineServerConfig({
      configured: 'https://rooms.example.com',
      hostname: '3d-xox.vercel.app',
      protocol: 'https:',
    });

    expect(config.isConfigured).toBe(false);
    expect(config.source).toBe('invalid');
    expect(config.error).toContain('ws:// or wss://');
  });

  it('rejects insecure remote ws on HTTPS pages', () => {
    const config = resolveOnlineServerConfig({
      configured: 'ws://rooms.example.com',
      hostname: '3d-xox.vercel.app',
      protocol: 'https:',
    });

    expect(config.isConfigured).toBe(false);
    expect(config.source).toBe('invalid');
    expect(config.error).toContain('wss://');
  });
});
