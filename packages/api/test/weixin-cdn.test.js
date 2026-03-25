import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decryptAesEcb, encryptAesEcb } from '../dist/infrastructure/connectors/adapters/weixin-cdn.js';

describe('weixin-cdn AES-128-ECB', () => {
  it('encrypts and decrypts round-trip', () => {
    const key = Buffer.alloc(16, 0xab);
    const plaintext = Buffer.from('Hello, WeChat CDN!');
    const ciphertext = encryptAesEcb(plaintext, key);

    assert.ok(ciphertext.length > 0);
    assert.ok(ciphertext.length % 16 === 0, 'Ciphertext must be 16-byte aligned (PKCS7)');
    assert.notDeepEqual(ciphertext, plaintext);

    const decrypted = decryptAesEcb(ciphertext, key);
    assert.deepEqual(decrypted, plaintext);
  });

  it('handles empty plaintext', () => {
    const key = Buffer.alloc(16, 0xcd);
    const plaintext = Buffer.alloc(0);
    const ciphertext = encryptAesEcb(plaintext, key);
    assert.equal(ciphertext.length, 16, 'Empty plaintext → one padding block');
    const decrypted = decryptAesEcb(ciphertext, key);
    assert.equal(decrypted.length, 0);
  });

  it('produces different ciphertext with different keys', () => {
    const plaintext = Buffer.from('same content');
    const key1 = Buffer.alloc(16, 0x11);
    const key2 = Buffer.alloc(16, 0x22);
    const c1 = encryptAesEcb(plaintext, key1);
    const c2 = encryptAesEcb(plaintext, key2);
    assert.notDeepEqual(c1, c2);
  });
});
