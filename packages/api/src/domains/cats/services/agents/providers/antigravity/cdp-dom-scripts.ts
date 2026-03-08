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
  const thinkingParts = [];
  const responseParts = [];
  for (const b of assistantBlocks) {
    const thinkEls = b.querySelectorAll('details, [class*="thinking"], [class*="thought"]');
    if (thinkEls.length > 0) {
      for (const el of thinkEls) thinkingParts.push((el.textContent || '').trim());
      const clone = b.cloneNode(true);
      clone.querySelectorAll('details, [class*="thinking"], [class*="thought"]').forEach((el) => el.remove());
      const remaining = extractBlockText(clone).trim();
      if (remaining) responseParts.push(remaining);
    } else {
      const txt = extractBlockText(b).trim();
      if (txt) responseParts.push(txt);
    }
  }
  const responseText = responseParts.join('\\n').trim();
  const thinkingText = thinkingParts.filter(Boolean).join('\\n').trim();
  const hasInlineLoading = assistantBlocks.some((b) => !!b.querySelector('.codicon-loading, [aria-busy="true"]'));
  return JSON.stringify({ userMsgCount: userMsgs.length, responseText, thinkingText, hasInlineLoading });
})()`;

/** Find the "new conversation" button via multiple DOM strategies.
 *  Returns JSON: { x, y } or null. */
/** Find the send/submit button near the chat input.
 *  Returns JSON: { x, y } or null. */
export const FIND_SEND_BUTTON_JS = `(() => {
  // Strategy 1: button with send/submit aria-label or title
  for (const btn of document.querySelectorAll('button')) {
    if (btn.disabled) continue;
    const label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
    if (label.includes('send') || label.includes('submit')) {
      const r = btn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
    }
  }
  // Strategy 2: codicon-send icon inside a button
  const sendIcon = document.querySelector('.codicon-send');
  if (sendIcon) {
    const btn = sendIcon.closest('button, a') || sendIcon;
    const r = btn.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
  }
  // Strategy 3: SVG arrow-up icon (common send icon) inside button near input
  const textbox = document.querySelector('[role="textbox"][contenteditable="true"]');
  if (textbox) {
    const inputArea = textbox.closest('form, [class*="input"], [class*="chat"]') || textbox.parentElement;
    if (inputArea) {
      for (const btn of inputArea.querySelectorAll('button')) {
        if (btn.disabled) continue;
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.width < 80) {
          return JSON.stringify({ x: r.x + r.width/2, y: r.y + r.height/2 });
        }
      }
    }
  }
  return null;
})()`;

/** Dispatch Enter key via JS KeyboardEvent on the active element.
 *  More reliable than CDP Input.dispatchKeyEvent for Lexical editors. */
export const DISPATCH_ENTER_JS = `(() => {
  const el = document.activeElement;
  if (!el) return false;
  const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
  el.dispatchEvent(new KeyboardEvent('keydown', opts));
  el.dispatchEvent(new KeyboardEvent('keypress', opts));
  el.dispatchEvent(new KeyboardEvent('keyup', opts));
  return true;
})()`;

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
