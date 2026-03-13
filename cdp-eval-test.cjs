const { WebSocket } = require('ws');

(async () => {
  const resp = await fetch('http://localhost:9000/json', { signal: AbortSignal.timeout(3000) });
  const targets = await resp.json();
  const page = targets.find((t) => t.type === 'page' && t.title.indexOf('Launchpad') === -1 && t.webSocketDebuggerUrl);
  if (page === undefined) {
    console.log('No viable target');
    process.exit(1);
  }
  console.log('Connecting to:', page.title);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    setTimeout(() => reject(new Error('timeout')), 5000);
  });
  console.log('WS connected');

  let idCounter = 0;
  function cdp(method, params) {
    params = params || {};
    return new Promise((resolve, reject) => {
      const id = ++idCounter;
      const timer = setTimeout(() => reject(new Error(`CDP timeout ${method}`)), 5000);
      ws.on('message', function handler(data) {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          clearTimeout(timer);
          ws.removeListener('message', handler);
          msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  try {
    await cdp('Runtime.enable');
    console.log('Runtime.enable ✓');

    const r = await cdp('Runtime.evaluate', { expression: '1 + 1' });
    console.log("evaluate('1+1') =", r.result.value, '✓');

    const tb = await cdp('Runtime.evaluate', {
      expression:
        '(() => { const tb = document.querySelector(\'[role="textbox"][contenteditable="true"]\'); return tb ? "FOUND" : "NOT_FOUND"; })()',
    });
    console.log('Textbox:', tb.result.value);

    if (tb.result.value === 'FOUND') {
      const btn = await cdp('Runtime.evaluate', {
        expression:
          '(() => { for (const b of document.querySelectorAll("button")) { const l = (b.getAttribute("aria-label") || b.getAttribute("title") || "").toLowerCase(); if (l.includes("send") || l.includes("submit")) return "FOUND: " + l; } return "NOT_FOUND"; })()',
      });
      console.log('Send button:', btn.result.value);
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  } finally {
    ws.close();
  }
})();
