const { WebSocket } = require('ws');
(async () => {
  const resp = await fetch('http://localhost:9000/json', { signal: AbortSignal.timeout(3000) });
  const targets = await resp.json();
  const page = targets.find((t) => t.type === 'page' && !t.title.includes('Launchpad') && t.webSocketDebuggerUrl);
  if (!page) {
    console.log('No target');
    process.exit(1);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => {
    ws.onopen = r;
    setTimeout(() => {
      throw new Error('timeout');
    }, 5000);
  });
  let idCounter = 0;
  function cdp(method, params) {
    params = params || {};
    return new Promise((resolve, reject) => {
      const id = ++idCounter;
      const timer = setTimeout(() => reject(new Error('CDP timeout')), 10000);
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
  await cdp('Runtime.enable');

  const diagJS = `(() => {
    const textbox = document.querySelector('[role="textbox"][contenteditable="true"]');
    const tbParent = textbox?.parentElement;
    const tbGrandparent = tbParent?.parentElement;
    const tbGreatGP = tbGrandparent?.parentElement;

    const sendBtns = [...document.querySelectorAll('button')].filter(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return t === 'send' || t === 'submit' || t.includes('send');
    }).map(b => ({
      text: b.textContent?.trim()?.substring(0, 50),
      cls: (typeof b.className === 'string' ? b.className : '').substring(0, 200),
      parentCls: (typeof b.parentElement?.className === 'string' ? b.parentElement.className : '').substring(0, 200),
      grandparentCls: (typeof b.parentElement?.parentElement?.className === 'string' ? b.parentElement.parentElement.className : '').substring(0, 200),
      ariaLabel: b.getAttribute('aria-label'),
      disabled: b.disabled,
      visible: b.offsetParent !== null,
      rect: (() => { const r = b.getBoundingClientRect(); return {x:r.x|0, y:r.y|0, w:r.width|0, h:r.height|0}; })(),
    }));

    return JSON.stringify({
      textboxFound: !!textbox,
      tbParentCls: (typeof tbParent?.className === 'string' ? tbParent.className : '').substring(0, 200),
      tbGrandparentCls: (typeof tbGrandparent?.className === 'string' ? tbGrandparent.className : '').substring(0, 200),
      tbGreatGPCls: (typeof tbGreatGP?.className === 'string' ? tbGreatGP.className : '').substring(0, 200),
      sendBtns,
    }, null, 2);
  })()`;

  const result = await cdp('Runtime.evaluate', { expression: diagJS, returnByValue: true });
  console.log(result.result?.value || JSON.stringify(result, null, 2));
  ws.close();
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
