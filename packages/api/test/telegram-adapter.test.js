import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TelegramAdapter } from '../dist/infrastructure/connectors/adapters/TelegramAdapter.js';

function noopLog() {
  const noop = () => {};
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: () => noopLog(),
  };
}

function recordingLog() {
  const entries = { info: [], warn: [], error: [] };
  const log = {
    info: (...args) => entries.info.push(args),
    warn: (...args) => entries.warn.push(args),
    error: (...args) => entries.error.push(args),
    debug: () => {},
    trace: () => {},
    fatal: () => {},
    child: () => log,
  };
  return { entries, log };
}

async function flushPollingLoop() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('TelegramAdapter', () => {
  describe('parseUpdate()', () => {
    it('extracts text message from update', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: false, first_name: 'Test' },
          chat: { id: 1001, type: 'private' },
          date: 1710000000,
          text: 'Hello cat!',
        },
      };
      const result = adapter.parseUpdate(update);
      assert.ok(result);
      assert.equal(result.chatId, '1001');
      assert.equal(result.text, 'Hello cat!');
      assert.equal(result.messageId, '456');
      assert.equal(result.senderId, '789');
    });

    it('returns null for unsupported message type (e.g. sticker)', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: false, first_name: 'Test' },
          chat: { id: 1001, type: 'private' },
          date: 1710000000,
          sticker: { file_id: 'stk_abc', width: 512, height: 512, is_animated: false },
        },
      };
      const result = adapter.parseUpdate(update);
      assert.equal(result, null);
    });

    it('returns null for group message (MVP = DM only)', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: false, first_name: 'Test' },
          chat: { id: -1001, type: 'group' },
          date: 1710000000,
          text: 'Hello from group!',
        },
      };
      const result = adapter.parseUpdate(update);
      assert.equal(result, null);
    });

    it('returns null for bot messages', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: true, first_name: 'Bot' },
          chat: { id: 1001, type: 'private' },
          date: 1710000000,
          text: 'Bot echo',
        },
      };
      const result = adapter.parseUpdate(update);
      assert.equal(result, null);
    });

    it('returns null for missing message', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const result = adapter.parseUpdate({ update_id: 123 });
      assert.equal(result, null);
    });
  });

  describe('sendReply()', () => {
    it('calls bot.api.sendMessage with correct params', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];

      // Inject mock for bot.api.sendMessage
      adapter._injectSendMessage(async (chatId, text, opts) => {
        sendCalls.push({ chatId, text, opts });
      });

      await adapter.sendReply('1001', 'Hello from cat!');
      assert.equal(sendCalls.length, 1);
      assert.equal(sendCalls[0].chatId, '1001');
      assert.equal(sendCalls[0].text, 'Hello from cat!');
    });

    it('truncates messages over 4096 chars', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text, _opts) => {
        sendCalls.push({ chatId, text });
      });

      const longMsg = 'a'.repeat(5000);
      await adapter.sendReply('1001', longMsg);
      assert.equal(sendCalls.length, 1);
      assert.ok(sendCalls[0].text.length <= 4096);
      assert.ok(sendCalls[0].text.endsWith('…'));
    });
  });

  describe('sendRichMessage()', () => {
    it('sends HTML-formatted message with parse_mode', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => {
        sendCalls.push({ chatId, text, opts });
      });

      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
      await adapter.sendRichMessage('1001', 'text', blocks, '布偶猫');

      assert.equal(sendCalls.length, 1);
      assert.equal(sendCalls[0].chatId, '1001');
      assert.deepEqual(sendCalls[0].opts, { parse_mode: 'HTML' });
      assert.ok(sendCalls[0].text.includes('<b>'));
      assert.ok(sendCalls[0].text.includes('布偶猫'));
      assert.ok(sendCalls[0].text.includes('Review'));
    });

    it('formats checklist blocks as HTML', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => {
        sendCalls.push({ chatId, text, opts });
      });

      const blocks = [
        {
          id: 'b2',
          kind: 'checklist',
          v: 1,
          items: [
            { id: 'i1', text: 'Done', checked: true },
            { id: 'i2', text: 'Pending' },
          ],
        },
      ];
      await adapter.sendRichMessage('1001', 'text', blocks, '布偶猫');

      assert.ok(sendCalls[0].text.includes('✅ Done'));
      assert.ok(sendCalls[0].text.includes('☐ Pending'));
    });
  });

  describe('startPolling()', () => {
    it('releases the Telegram session and retries after a 409 polling conflict', async () => {
      const { entries, log } = recordingLog();
      const adapter = new TelegramAdapter('test-token', log);
      let startCalls = 0;
      let closeCalls = 0;
      const sleeps = [];

      adapter._injectPollingControls({
        start: async (options) => {
          startCalls += 1;
          if (startCalls === 1) {
            throw { error_code: 409, description: 'Conflict: terminated by other getUpdates request' };
          }
          options?.onStart?.();
        },
        close: async () => {
          closeCalls += 1;
        },
        sleep: async (ms) => {
          sleeps.push(ms);
        },
        backoffMs: [5],
        maxConflictRetries: 2,
      });

      adapter.startPolling(async () => {});
      await flushPollingLoop();

      assert.equal(startCalls, 2);
      assert.equal(closeCalls, 1);
      assert.deepEqual(sleeps, [5]);
      assert.ok(
        entries.warn.some((entry) => String(entry.at(-1)).includes('409 conflict')),
        '409 conflict should be logged as a retryable warning',
      );
      assert.equal(entries.error.length, 0);
    });

    it('logs non-409 polling startup failures without retrying', async () => {
      const { entries, log } = recordingLog();
      const adapter = new TelegramAdapter('test-token', log);
      let startCalls = 0;
      let closeCalls = 0;

      adapter._injectPollingControls({
        start: async () => {
          startCalls += 1;
          throw { error_code: 404, description: 'Not Found' };
        },
        close: async () => {
          closeCalls += 1;
        },
        sleep: async () => {
          throw new Error('non-409 errors must not sleep');
        },
      });

      adapter.startPolling(async () => {});
      await flushPollingLoop();

      assert.equal(startCalls, 1);
      assert.equal(closeCalls, 0);
      assert.ok(
        entries.error.some((entry) => String(entry.at(-1)).includes('Long polling failed')),
        'non-409 polling failures should be logged',
      );
    });
  });

  // ── Phase 5: Media message parsing ──
  describe('parseUpdate() with media types', () => {
    it('extracts photo message with file_id', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: false },
          chat: { id: 1001, type: 'private' },
          date: 1710000000,
          photo: [
            { file_id: 'small_id', width: 100, height: 100, file_size: 1000 },
            { file_id: 'large_id', width: 800, height: 600, file_size: 50000 },
          ],
        },
      };
      const result = adapter.parseUpdate(update);
      assert.ok(result);
      assert.equal(result.text, '[图片]');
      // Should pick the largest photo
      assert.deepEqual(result.attachments, [{ type: 'image', telegramFileId: 'large_id' }]);
    });

    it('extracts photo with caption as text', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: false },
          chat: { id: 1001, type: 'private' },
          date: 1710000000,
          photo: [{ file_id: 'photo_id', width: 800, height: 600, file_size: 50000 }],
          caption: 'Check this out!',
        },
      };
      const result = adapter.parseUpdate(update);
      assert.ok(result);
      assert.equal(result.text, 'Check this out!');
      assert.deepEqual(result.attachments, [{ type: 'image', telegramFileId: 'photo_id' }]);
    });

    it('extracts document message with file_id', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: false },
          chat: { id: 1001, type: 'private' },
          date: 1710000000,
          document: { file_id: 'doc_id', file_name: 'report.pdf', file_size: 100000 },
        },
      };
      const result = adapter.parseUpdate(update);
      assert.ok(result);
      assert.equal(result.text, '[文件] report.pdf');
      assert.deepEqual(result.attachments, [{ type: 'file', telegramFileId: 'doc_id', fileName: 'report.pdf' }]);
    });

    it('extracts voice message with file_id', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const update = {
        update_id: 123,
        message: {
          message_id: 456,
          from: { id: 789, is_bot: false },
          chat: { id: 1001, type: 'private' },
          date: 1710000000,
          voice: { file_id: 'voice_id', duration: 5, file_size: 10000 },
        },
      };
      const result = adapter.parseUpdate(update);
      assert.ok(result);
      assert.equal(result.text, '[语音]');
      assert.deepEqual(result.attachments, [{ type: 'audio', telegramFileId: 'voice_id', duration: 5 }]);
    });
  });

  describe('connectorId', () => {
    it('is telegram', () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      assert.equal(adapter.connectorId, 'telegram');
    });
  });

  // K1: Telegram duplicate fix — placeholder chatId tracking + deleteMessage
  describe('sendPlaceholder() and deleteMessage()', () => {
    it('sendPlaceholder stores chatId mapping for later deletion', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      const deleteCalls = [];

      adapter._injectBotApiSendMessage(async (chatId, _text) => {
        sendCalls.push(chatId);
        return { message_id: 42 };
      });
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => {
        deleteCalls.push({ chatId, msgId });
      });

      const msgId = await adapter.sendPlaceholder('1001', '猫猫思考中…');
      assert.equal(msgId, '42');
      assert.deepEqual(sendCalls, [1001]);

      await adapter.deleteMessage(msgId);
      assert.equal(deleteCalls.length, 1);
      assert.equal(deleteCalls[0].chatId, 1001);
      assert.equal(deleteCalls[0].msgId, 42);
    });

    it('deleteMessage is no-op for unknown platformMessageId', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const deleteCalls = [];
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => {
        deleteCalls.push({ chatId, msgId });
      });

      await assert.doesNotReject(() => adapter.deleteMessage('9999'));
      assert.equal(deleteCalls.length, 0);
    });

    it('deleteMessage cleans up mapping after deletion (no double-delete)', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const deleteCalls = [];

      adapter._injectBotApiSendMessage(async (_chatId, _text) => ({ message_id: 77 }));
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => {
        deleteCalls.push({ chatId, msgId });
      });

      const msgId = await adapter.sendPlaceholder('2002', 'placeholder');
      await adapter.deleteMessage(msgId);
      await adapter.deleteMessage(msgId); // second call must be no-op

      assert.equal(deleteCalls.length, 1, 'should only delete once');
    });

    it('deleteMessage uses explicit externalChatId over map when provided (multi-chat same message_id)', async () => {
      // Telegram message_id is only unique within a single chat.
      // When two chats produce the same message_id, the Map alone is unreliable.
      // The caller (StreamingOutboundHook) must pass externalChatId explicitly.
      const adapter = new TelegramAdapter('test-token', noopLog());
      const deleteCalls = [];
      let callCount = 0;

      adapter._injectBotApiSendMessage(async (_chatId, _text) => {
        callCount++;
        return { message_id: 42 }; // both chats return same message_id
      });
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => {
        deleteCalls.push({ chatId, msgId });
      });

      const msgId1 = await adapter.sendPlaceholder('1001', 'placeholder chat 1');
      const msgId2 = await adapter.sendPlaceholder('2002', 'placeholder chat 2');
      assert.equal(msgId1, '42');
      assert.equal(msgId2, '42');

      // Caller provides externalChatId explicitly — must delete from correct chat
      await adapter.deleteMessage(msgId1, '1001');
      assert.equal(deleteCalls.length, 1);
      assert.equal(deleteCalls[0].chatId, 1001, 'must delete from chat 1001, not 2002');

      await adapter.deleteMessage(msgId2, '2002');
      assert.equal(deleteCalls.length, 2);
      assert.equal(deleteCalls[1].chatId, 2002, 'must delete from chat 2002');
    });
  });

  // P1-2: textContent must not be discarded when both text and blocks present
  describe('sendRichMessage() text preservation', () => {
    it('includes textContent in HTML output alongside blocks', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => {
        sendCalls.push({ chatId, text, opts });
      });

      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Review', bodyMarkdown: 'LGTM' }];
      await adapter.sendRichMessage('1001', 'Cat reply text here', blocks, '布偶猫');

      assert.equal(sendCalls.length, 1);
      assert.ok(sendCalls[0].text.includes('Cat reply text here'), 'textContent must appear in output');
      assert.ok(sendCalls[0].text.includes('Review'), 'block content must also appear');
    });
  });

  // K2: inline final streaming — edit placeholder instead of sending new message
  describe('registerInlinePlaceholder() + inline final (K2)', () => {
    it('sendReply edits placeholder instead of sending new message when inline pending', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      const editCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => sendCalls.push({ chatId, text, opts }));
      adapter.editMessage = async (chatId, msgId, text) => editCalls.push({ chatId, msgId, text });

      adapter.registerInlinePlaceholder('1001', '42');
      await adapter.sendReply('1001', 'Final answer');

      assert.equal(sendCalls.length, 0, 'must NOT send a new message when inline pending');
      assert.equal(editCalls.length, 1, 'must edit the placeholder');
      assert.equal(editCalls[0].chatId, '1001');
      assert.equal(editCalls[0].msgId, '42');
      assert.equal(editCalls[0].text, 'Final answer');
    });

    it('sendReply sends new message normally when no inline pending', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));

      await adapter.sendReply('1001', 'Normal reply');

      assert.equal(sendCalls.length, 1, 'must send normally when no inline pending');
      assert.equal(sendCalls[0].chatId, '1001');
    });

    it('inline placeholder is consumed after sendReply (second call sends new message)', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      const editCalls = [];
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));
      adapter.editMessage = async (chatId, msgId, text) => editCalls.push({ chatId, msgId, text });

      adapter.registerInlinePlaceholder('1001', '42');
      await adapter.sendReply('1001', 'Final answer'); // consumes inline
      await adapter.sendReply('1001', 'Another reply'); // should send normally

      assert.equal(editCalls.length, 1, 'only first sendReply should edit');
      assert.equal(sendCalls.length, 1, 'second sendReply should send a new message');
      assert.equal(sendCalls[0].text, 'Another reply');
    });

    it('sendRichMessage edits placeholder with HTML when inline pending', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      const editCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => sendCalls.push({ chatId, text, opts }));
      adapter.editMessage = async (chatId, msgId, text, opts) => editCalls.push({ chatId, msgId, text, opts });

      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Done', bodyMarkdown: 'All good' }];
      adapter.registerInlinePlaceholder('1001', '55');
      await adapter.sendRichMessage('1001', 'Cat reply', blocks, '布偶猫');

      assert.equal(sendCalls.length, 0, 'must NOT send new message when inline pending');
      assert.equal(editCalls.length, 1, 'must edit the placeholder');
      assert.equal(editCalls[0].chatId, '1001');
      assert.equal(editCalls[0].msgId, '55');
      assert.ok(
        editCalls[0].text.includes('Done') || editCalls[0].text.includes('All good'),
        'HTML must contain block content',
      );
    });

    it('sendRichMessage sends normally when no inline pending', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => sendCalls.push({ chatId, text, opts }));

      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Done', bodyMarkdown: 'OK' }];
      await adapter.sendRichMessage('1001', 'Reply', blocks, '布偶猫');

      assert.equal(sendCalls.length, 1, 'must send normally when no inline pending');
    });

    it('inline from one chatId does not affect another chatId', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      const editCalls = [];
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));
      adapter.editMessage = async (chatId, msgId, text) => editCalls.push({ chatId, msgId, text });

      adapter.registerInlinePlaceholder('1001', '42');
      await adapter.sendReply('2002', 'Message to different chat');

      assert.equal(editCalls.length, 0, 'chatId 2002 has no inline pending — must not edit');
      assert.equal(sendCalls.length, 1, 'chatId 2002 must send normally');
      assert.equal(sendCalls[0].chatId, '2002');
    });

    // K2 P1 #2: preserve delivery when editMessage throws
    it('sendReply falls back to send when editMessage throws', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));
      adapter.editMessage = async () => {
        throw new Error('Telegram edit failed');
      };

      adapter.registerInlinePlaceholder('1001', '42');
      await adapter.sendReply('1001', 'Fallback content');

      assert.equal(sendCalls.length, 1, 'must fall back to send when edit throws');
      assert.equal(sendCalls[0].chatId, '1001');
      assert.equal(sendCalls[0].text, 'Fallback content');
    });

    // K2 P1 #1: clearInlinePlaceholder cleans up stale entry
    it('clearInlinePlaceholder removes pending entry (delivery skipped)', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const deleteCalls = [];
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => deleteCalls.push({ chatId, msgId }));

      adapter.registerInlinePlaceholder('1001', '42');
      await adapter.clearInlinePlaceholder('1001', '42');

      // After clear, sendReply should send normally (not edit a stale entry)
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));
      await adapter.sendReply('1001', 'New reply');

      assert.equal(deleteCalls.length, 1, 'must delete stale streaming card');
      assert.equal(sendCalls.length, 1, 'must send new reply normally (no stale inline)');
    });

    it('clearInlinePlaceholder is no-op when entry was already consumed', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const deleteCalls = [];
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => deleteCalls.push({ chatId, msgId }));
      adapter.editMessage = async () => {};

      adapter.registerInlinePlaceholder('1001', '42');
      await adapter.sendReply('1001', 'Content delivered'); // consumes entry
      await adapter.clearInlinePlaceholder('1001', '42'); // should be no-op

      assert.equal(deleteCalls.length, 0, 'no delete when entry already consumed by delivery');
    });

    // K2 P1 (3rd review): clearInlinePlaceholder must guard by platformMessageId to avoid erasing newer registrations
    it('clearInlinePlaceholder: late cleanup for invocation A does not erase invocation B registration', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const editCalls = [];
      adapter.editMessage = async (chatId, msgId, text) => editCalls.push({ chatId, msgId, text });
      adapter._injectBotApiDeleteMessage(async () => {});

      // Invocation A registers ph-A but delivery is skipped (timeout)
      adapter.registerInlinePlaceholder('1001', 'ph-A');
      // Invocation B registers ph-B before A's cleanup runs (B overwrites A in the map)
      adapter.registerInlinePlaceholder('1001', 'ph-B');

      // Late cleanup for A: must not erase B's registration
      await adapter.clearInlinePlaceholder('1001', 'ph-A');

      // B's delivery must still be able to use ph-B
      await adapter.sendReply('1001', 'Inv B reply');
      assert.equal(editCalls.length, 1, 'invocation B must still find and use its placeholder');
      assert.equal(editCalls[0].msgId, 'ph-B', 'must edit ph-B, not miss it because A cleanup erased it');
    });

    // cloud-R10 P1: clearInlinePlaceholder must NOT delete ph-A when a newer placeholder is stored
    // AND ph-A is not tracked as a raw placeholder (it may already be the finalized reply)
    it('clearInlinePlaceholder: late cleanup for A must NOT delete ph-A when B is stored and ph-A not in placeholderChats', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      let deleteCallCount = 0;
      adapter._injectBotApiDeleteMessage(async () => {
        deleteCallCount++;
      });

      // A registers via registerInlinePlaceholder only (no sendPlaceholder → placeholderChats has no entry for ph-A)
      adapter.registerInlinePlaceholder('1001', '42');
      adapter.registerInlinePlaceholder('1001', '99');

      // Late cleanup for A (ph=42): ph=99 is now stored.
      // ph-42 is NOT in placeholderChats (not tracked as a raw card) → may be finalized reply → must NOT delete.
      await adapter.clearInlinePlaceholder('1001', '42');

      assert.equal(
        deleteCallCount,
        0,
        'must NOT delete ph-42 when ph-99 is stored and ph-42 is not tracked in placeholderChats (may be finalized reply)',
      );
    });

    // cloud-R11 P2: clearInlinePlaceholder MUST delete orphaned ph-A when ph-B is stored
    // AND ph-A is still tracked in placeholderChats (it is a raw placeholder, not a finalized reply)
    it('clearInlinePlaceholder: deletes orphaned ph-A when ph-B is stored and ph-A is still in placeholderChats', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      let deleteCallCount = 0;
      adapter._injectBotApiDeleteMessage(async () => {
        deleteCallCount++;
      });
      adapter._injectBotApiSendMessage(async () => ({ message_id: 42 }));

      // ph-A was sent as a placeholder (tracked in placeholderChats via sendPlaceholder)
      await adapter.sendPlaceholder('1001', 'Thinking...');

      // Invocation B registers ph-B (overwrites ph-A in pendingInlineFinal)
      adapter.registerInlinePlaceholder('1001', '99');

      // Cleanup for A (ph=42): stored=99, but ph-42 is still in placeholderChats → it is an orphaned card → delete
      await adapter.clearInlinePlaceholder('1001', '42');

      assert.equal(
        deleteCallCount,
        1,
        'must delete orphaned ph-42 when ph-99 is stored and ph-42 is still tracked in placeholderChats',
      );
    });

    // K2 P1 (3rd review): compare-and-delete after editMessage to protect concurrent registration
    it('sendReply: compare-and-delete after edit protects newer registration registered during await', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const editCalls = [];
      const sendCalls = [];
      // During editMessage for ph-A, simulate ph-B being registered
      adapter.editMessage = async (chatId, msgId, text) => {
        editCalls.push({ chatId, msgId, text });
        adapter.registerInlinePlaceholder('1001', 'ph-B'); // concurrent registration
      };
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));

      adapter.registerInlinePlaceholder('1001', 'ph-A');
      await adapter.sendReply('1001', 'Inv A reply'); // edits ph-A, then ph-B registered concurrently

      // After A's edit: ph-B must still be in map (compare-and-delete: current value ≠ ph-A, so skip delete)
      const editCalls2 = [];
      adapter.editMessage = async (chatId, msgId, text) => editCalls2.push({ chatId, msgId, text });
      await adapter.sendReply('1001', 'Inv B reply');
      assert.equal(editCalls2.length, 1, 'ph-B must still be reachable after A delivered via compare-and-delete');
      assert.equal(editCalls2[0].msgId, 'ph-B', 'must edit ph-B not send normally');
      assert.equal(sendCalls.length, 0, 'A reply was inline edit, no fallback send');
    });

    // K2 P1 same: compare-and-delete in sendRichMessage
    it('sendRichMessage: compare-and-delete after edit protects newer registration', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const editCalls = [];
      adapter.editMessage = async (chatId, msgId, text, opts) => {
        editCalls.push({ chatId, msgId, text, opts });
        adapter.registerInlinePlaceholder('1001', 'ph-B'); // concurrent registration during await
      };
      adapter._injectSendMessage(async () => {});

      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'T', bodyMarkdown: 'B' }];
      adapter.registerInlinePlaceholder('1001', 'ph-A');
      await adapter.sendRichMessage('1001', 'text', blocks, '猫猫'); // edits ph-A, then ph-B registered

      // ph-B must still be in map
      const editCalls2 = [];
      adapter.editMessage = async (chatId, msgId, text, opts) => editCalls2.push({ chatId, msgId, text, opts });
      await adapter.sendReply('1001', 'Inv B reply');
      assert.equal(editCalls2.length, 1, 'ph-B must survive A rich message delivery');
      assert.equal(editCalls2[0].msgId, 'ph-B');
    });

    // cloud-R12 P1: placeholderChats must be cleaned even when concurrent B registration skips compare-and-delete
    it('sendReply: placeholderChats cleared after edit even when concurrent B registration prevents pendingInlineFinal delete', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      let deleteCalls = 0;
      // During editMessage for ph-A, register ph-B (overwriting ph-A in pendingInlineFinal)
      adapter.editMessage = async () => {
        adapter.registerInlinePlaceholder('1001', 'ph-B');
      };
      adapter._injectBotApiDeleteMessage(async () => {
        deleteCalls++;
      });
      adapter._injectBotApiSendMessage(async () => ({ message_id: 42 }));

      // ph-A tracked in placeholderChats via sendPlaceholder
      await adapter.sendPlaceholder('1001', 'Thinking...');
      adapter.registerInlinePlaceholder('1001', '42'); // ph-42 is ph-A
      await adapter.sendReply('1001', 'A reply'); // edits ph-42, concurrent ph-B registered

      // Cleanup for A: ph-42 must NOT be deleted (it is the finalized reply, not a raw card)
      await adapter.clearInlinePlaceholder('1001', '42');
      assert.equal(deleteCalls, 0, 'finalized reply (ph-42) must not be deleted when B is registered concurrently');
    });

    // cloud-R12 P1: same for sendRichMessage
    it('sendRichMessage: placeholderChats cleared after edit even when concurrent B registration occurs', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      let deleteCalls = 0;
      adapter.editMessage = async () => {
        adapter.registerInlinePlaceholder('1001', 'ph-B');
      };
      adapter._injectBotApiDeleteMessage(async () => {
        deleteCalls++;
      });
      adapter._injectBotApiSendMessage(async () => ({ message_id: 42 }));

      await adapter.sendPlaceholder('1001', 'Thinking...');
      adapter.registerInlinePlaceholder('1001', '42');
      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'T', bodyMarkdown: 'B' }];
      await adapter.sendRichMessage('1001', 'text', blocks, '猫猫');

      await adapter.clearInlinePlaceholder('1001', '42');
      assert.equal(
        deleteCalls,
        0,
        'finalized rich reply (ph-42) must not be deleted when B is registered concurrently',
      );
    });

    // K2 P2: placeholder key must survive edit failure so clearInlinePlaceholder can clean up
    it('sendReply: stale placeholder deleted by clearInlinePlaceholder after editMessage fails', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      const deleteCalls = [];
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => deleteCalls.push({ chatId, msgId }));
      adapter.editMessage = async () => {
        throw new Error('Telegram edit failed');
      };

      adapter.registerInlinePlaceholder('1001', '42');
      await adapter.sendReply('1001', 'Fallback content'); // edit fails, fallback sends
      await adapter.clearInlinePlaceholder('1001', '42'); // must still find key and delete stale card

      assert.equal(sendCalls.length, 1, 'fallback send happened');
      assert.equal(deleteCalls.length, 1, 'stale streaming placeholder deleted by clearInlinePlaceholder');
    });

    // K2 P1 (new): sendRichMessage must fall back to send when inline edit fails
    it('sendRichMessage falls back to send when editMessage throws', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => sendCalls.push({ chatId, text, opts }));
      adapter.editMessage = async () => {
        throw new Error('Telegram edit failed');
      };

      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Done', bodyMarkdown: 'All good' }];
      adapter.registerInlinePlaceholder('1001', '55');
      await adapter.sendRichMessage('1001', 'text', blocks, '布偶猫');

      assert.equal(sendCalls.length, 1, 'must fall back to send when rich edit throws');
      assert.equal(sendCalls[0].chatId, '1001');
    });

    // K2 P1 (new) + P2: sendRichMessage key must survive failure for clearInlinePlaceholder
    it('sendRichMessage: stale placeholder deleted by clearInlinePlaceholder after editMessage fails', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const sendCalls = [];
      const deleteCalls = [];
      adapter._injectSendMessage(async (chatId, text, opts) => sendCalls.push({ chatId, text, opts }));
      adapter._injectBotApiDeleteMessage(async (chatId, msgId) => deleteCalls.push({ chatId, msgId }));
      adapter.editMessage = async () => {
        throw new Error('edit failed');
      };

      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'Done', bodyMarkdown: 'OK' }];
      adapter.registerInlinePlaceholder('1001', '55');
      await adapter.sendRichMessage('1001', 'text', blocks, '布偶猫');
      await adapter.clearInlinePlaceholder('1001', '55');

      assert.equal(sendCalls.length, 1, 'fallback send happened');
      assert.equal(deleteCalls.length, 1, 'stale streaming placeholder deleted');
    });

    // K2 round-4 P2: placeholderChats must be cleaned up after successful inline edit
    it('sendReply: placeholderChats entry removed after successful inline edit', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      let msgId;
      adapter._injectBotApiSendMessage(async (_chatId, _text) => ({ message_id: 77 }));
      adapter._injectBotApiDeleteMessage(async () => {});
      const deleteCalls = [];
      adapter._injectBotApiDeleteMessage(async (chatId, id) => deleteCalls.push({ chatId, id }));
      msgId = await adapter.sendPlaceholder('1001', 'typing...');
      assert.equal(msgId, '77', 'sendPlaceholder returns string message_id');
      const editCalls = [];
      adapter.editMessage = async (chatId, id, text) => editCalls.push({ chatId, id, text });
      adapter.registerInlinePlaceholder('1001', msgId);
      await adapter.sendReply('1001', 'Final reply');
      assert.equal(editCalls.length, 1, 'inline edit was used');
      // After successful inline edit, deleteMessage(msgId) without chatId must be a no-op
      // because placeholderChats should have been cleaned up.
      await adapter.deleteMessage(msgId /* no chatId */);
      assert.equal(deleteCalls.length, 0, 'no Telegram delete called: placeholderChats already cleaned on success');
    });

    // K2 round-4 P2: same for sendRichMessage
    it('sendRichMessage: placeholderChats entry removed after successful inline edit', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      adapter._injectBotApiSendMessage(async () => ({ message_id: 88 }));
      const msgId = await adapter.sendPlaceholder('1001', 'typing...');
      const editCalls = [];
      adapter.editMessage = async (chatId, id, _text, opts) => editCalls.push({ chatId, id, opts });
      const deleteCalls = [];
      adapter._injectBotApiDeleteMessage(async (chatId, id) => deleteCalls.push({ chatId, id }));
      const blocks = [{ id: 'b1', kind: 'card', v: 1, title: 'T', bodyMarkdown: 'B' }];
      adapter.registerInlinePlaceholder('1001', msgId);
      await adapter.sendRichMessage('1001', 'text', blocks, '布偶猫');
      assert.equal(editCalls.length, 1, 'inline rich edit was used');
      await adapter.deleteMessage(msgId /* no chatId */);
      assert.equal(deleteCalls.length, 0, 'no Telegram delete: placeholderChats cleaned on rich edit success');
    });

    // K2 round-4 P1: stale inline placeholder (beyond TTL) must be skipped and cleaned up
    it('sendReply: skips stale inline placeholder (beyond TTL) and sends normally', async () => {
      const adapter = new TelegramAdapter('test-token', noopLog());
      const TTL = 5 * 60 * 1000; // 5 minutes — must match INLINE_PLACEHOLDER_MAX_AGE_MS
      let now = 0;
      adapter._injectNowFn(() => now);
      const editCalls = [];
      adapter.editMessage = async (chatId, id, text) => editCalls.push({ chatId, id, text });
      const sendCalls = [];
      adapter._injectSendMessage(async (chatId, text) => sendCalls.push({ chatId, text }));
      const deleteCalls = [];
      adapter._injectBotApiDeleteMessage(async (chatId, id) => deleteCalls.push({ chatId, id }));
      adapter._injectBotApiSendMessage(async () => ({ message_id: 99 }));
      const msgId = await adapter.sendPlaceholder('1001', 'typing...');
      adapter.registerInlinePlaceholder('1001', msgId); // registered at t=0
      now = TTL + 1; // advance past TTL
      await adapter.sendReply('1001', 'Late reply');
      assert.equal(editCalls.length, 0, 'stale placeholder must not be edited');
      assert.equal(sendCalls.length, 1, 'late reply sent as new message');
      assert.equal(deleteCalls.length, 1, 'stale streaming card deleted during TTL cleanup');
    });
  });
});
