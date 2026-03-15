import http from 'node:http';
// @ts-ignore — optional dep, may or may not be installed
import httpProxy from 'http-proxy';
import { validatePort } from './port-validator.js';

export interface PreviewGatewayOptions {
  /** 0 = random port */
  port: number;
  host?: string;
  /** Runtime-configured ports to exclude */
  runtimePorts?: number[];
}

/**
 * Preview Gateway — 独立端口的反向代理。
 * iframe 永远只打开 gateway URL，不直接连 localhost:xxxx。
 *
 * 请求：GET http://gateway:PORT/path?__preview_port=3847
 *   → proxy to http://localhost:3847/path
 *
 * 安全：loopback-only + 端口白名单 + 剥离 X-Frame-Options/CSP frame-ancestors
 * WebSocket upgrade 代理（HMR）
 */
export class PreviewGateway {
  private server: http.Server;
  private proxy: httpProxy;
  private port: number;
  private host: string;
  private runtimePorts: number[];
  actualPort = 0;

  constructor(opts: PreviewGatewayOptions) {
    this.port = opts.port;
    this.host = opts.host ?? '127.0.0.1';
    this.runtimePorts = opts.runtimePorts ?? [];

    this.proxy = httpProxy.createProxyServer({
      ws: true,
      xfwd: false,
      changeOrigin: true,
    });

    // Strip iframe-blocking headers from proxied responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.proxy.on('proxyRes', (proxyRes: any) => {
      delete proxyRes.headers['x-frame-options'];
      const csp = proxyRes.headers['content-security-policy'];
      if (typeof csp === 'string') {
        const cleaned = csp
          .split(';')
          .filter((d) => !d.trim().startsWith('frame-ancestors'))
          .join(';')
          .trim();
        if (cleaned) {
          proxyRes.headers['content-security-policy'] = cleaned;
        } else {
          delete proxyRes.headers['content-security-policy'];
        }
      }
    });

    this.server = http.createServer((req, res) => {
      const parsed = this.parseTarget(req);
      if (!parsed) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing __preview_port query parameter' }));
        return;
      }

      const validation = validatePort(parsed.port, {
        host: parsed.host,
        gatewaySelfPort: this.actualPort,
        runtimePorts: this.runtimePorts,
      });
      if (!validation.allowed) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validation.reason }));
        return;
      }

      // Strip preview params from forwarded URL
      const url = new URL(req.url!, `http://${req.headers.host}`);
      url.searchParams.delete('__preview_port');
      url.searchParams.delete('__preview_host');
      req.url = url.pathname + (url.search === '?' ? '' : url.search);

      const target = `http://${parsed.host}:${parsed.port}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.proxy.web(req, res, { target }, (err: any) => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
        }
      });
    });

    // WebSocket upgrade handler (HMR)
    this.server.on('upgrade', (req, socket, head) => {
      const parsed = this.parseTarget(req);
      if (!parsed) {
        socket.destroy();
        return;
      }
      const validation = validatePort(parsed.port, {
        host: parsed.host,
        gatewaySelfPort: this.actualPort,
        runtimePorts: this.runtimePorts,
      });
      if (!validation.allowed) {
        socket.destroy();
        return;
      }
      const target = `http://${parsed.host}:${parsed.port}`;
      this.proxy.ws(req, socket, head, { target });
    });
  }

  private parseTarget(req: http.IncomingMessage): { port: number; host: string } | null {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const portStr = url.searchParams.get('__preview_port');
    if (!portStr) return null;
    const port = Number.parseInt(portStr, 10);
    if (Number.isNaN(port)) return null;
    const host = url.searchParams.get('__preview_host') ?? 'localhost';
    return { port, host };
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => {
        const addr = this.server.address() as { port: number };
        this.actualPort = addr.port;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.proxy.close();
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
