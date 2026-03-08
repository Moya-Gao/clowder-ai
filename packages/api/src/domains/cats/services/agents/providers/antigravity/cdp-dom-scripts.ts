/**
 * Inline JavaScript strings evaluated inside the Antigravity page via CDP Runtime.evaluate.
 *
 * Extracted from AntigravityCdpClient to keep the main file under the 350-line limit.
 * These are raw JS strings (not TypeScript) — they run in the Electron renderer process.
 */

/** Extract assistant response state from the DOM after a user message.
 *  Returns JSON: { userMsgCount, responseText, hasInlineLoading } */
export const POLL_RESPONSE_JS = `(() => {
  const userMsgs = [...document.querySelectorAll('.whitespace-pre-wrap')];
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  const extractBlockText = (block) => {
    const structured = [...block.querySelectorAll('p, li, pre, code, h1, h2, h3, h4, h5, h6')]
      .map((el) => el.textContent?.trim()).filter(Boolean);
    if (structured.length > 0) return structured.join('\\n');
    const clone = block.cloneNode(true);
    clone.querySelectorAll('style, script, button, [aria-hidden="true"]').forEach((el) => el.remove());
    return clone.textContent?.trim() || '';
  };
  const assistantBlocks = (() => {
    if (!lastUserMsg) return [];
    const thread = lastUserMsg.closest('.relative.flex.flex-col.gap-y-3.px-4');
    if (thread) {
      const wrapper = [...thread.children].find((c) => c.contains(lastUserMsg)) || thread.firstElementChild;
      if (wrapper) {
        const blocks = [...wrapper.children].filter((c) => {
          return (c.textContent?.trim() || '').length > 0 && !c.classList.contains('hidden');
        });
        const idx = blocks.findIndex((c) => c.contains(lastUserMsg));
        if (idx >= 0) return blocks.slice(idx + 1).filter((c) => !c.contains(lastUserMsg));
      }
    }
    const userGroup = lastUserMsg.closest('.group') || lastUserMsg.parentElement;
    if (!userGroup) return [];
    const blocks = [];
    let sib = userGroup.nextElementSibling;
    while (sib) { blocks.push(sib); sib = sib.nextElementSibling; }
    return blocks;
  })();
  const responseParts = assistantBlocks.map((b) => extractBlockText(b)).map((t) => t.trim()).filter(Boolean);
  const responseText = responseParts.join('\\n').trim();
  const hasInlineLoading = assistantBlocks.some((b) => !!b.querySelector('.codicon-loading, [aria-busy="true"]'));
  return JSON.stringify({ userMsgCount: userMsgs.length, responseText, hasInlineLoading });
})()`;

/** Find the "new conversation" button via multiple DOM strategies.
 *  Returns JSON: { x, y } or null. */
export const NEW_CONVERSATION_JS = `(() => {
  const candidates = document.querySelectorAll('a, button');
  for (const el of candidates) {
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
    if (label.includes('new') && (label.includes('chat') || label.includes('conversation'))) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
    }
  }
  const icons = document.querySelectorAll('.codicon-add, [class*="plus"]');
  for (const icon of icons) {
    const clickable = icon.closest('a, button');
    if (clickable) {
      const r = clickable.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y < 80) return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
    }
  }
  const links = document.querySelectorAll('a.group.relative');
  for (const a of links) {
    const r = a.getBoundingClientRect();
    if (r.y > 20 && r.y < 80 && r.width < 50 && r.width > 0)
      return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
  }
  return null;
})()`;
