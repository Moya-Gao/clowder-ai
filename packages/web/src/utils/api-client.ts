/**
 * Unified API client for Cat Cafe frontend.
 *
 * - Auto-prepends NEXT_PUBLIC_API_URL
 * - Auto-injects X-Cat-Cafe-User identity header on every request
 * - Replaces scattered raw fetch() calls across hooks/components
 */

import { getUserId } from './userId';

function resolveApiUrl(): string {
  // Cloudflare Tunnel: 外部设备通过 cafe.clowder-ai.com 访问时，API 走 api.clowder-ai.com
  if (typeof window !== 'undefined' && window.location.hostname === 'cafe.clowder-ai.com') {
    return 'https://api.clowder-ai.com';
  }
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:3002';
  // 使用当前页面的 hostname，适配 Tailscale / 局域网等任意网络
  return `${window.location.protocol}//${window.location.hostname}:3002`;
}
export const API_URL = resolveApiUrl();

/**
 * Fetch wrapper that injects identity header.
 * @param path - API path starting with '/' (e.g. '/api/messages')
 * @param init - Standard RequestInit options
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-Cat-Cafe-User', getUserId());
  return fetch(`${API_URL}${path}`, { ...init, headers });
}
