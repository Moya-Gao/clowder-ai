import { useEffect, useState } from 'react';

export type HmrStatus = 'idle' | 'connected' | 'disconnected';

export function useHmrStatus(gatewayPort: number, targetPort: number): HmrStatus {
  const [status, setStatus] = useState<HmrStatus>('idle');

  useEffect(() => {
    if (!gatewayPort || !targetPort) return;
    setStatus('idle');

    const wsUrl = `ws://localhost:${gatewayPort}/?__preview_port=${targetPort}`;
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setStatus('connected');
        ws.onclose = () => {
          setStatus('disconnected');
          if (!closed) setTimeout(connect, 3000);
        };
        ws.onerror = () => ws?.close();
      } catch {
        setStatus('disconnected');
      }
    };
    connect();

    return () => {
      closed = true;
      ws?.close();
    };
  }, [gatewayPort, targetPort]);

  return status;
}
