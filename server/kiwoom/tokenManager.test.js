import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKiwoomExpiresDt, shouldReuseToken } from './tokenManager.js';

test('parseKiwoomExpiresDt parses YYYYMMDDHHmmss format', () => {
  const parsed = parseKiwoomExpiresDt('20270102030405');
  assert.ok(Number.isFinite(parsed));
  assert.equal(new Date(parsed).toISOString(), '2027-01-01T18:04:05.000Z');
});

test('parseKiwoomExpiresDt returns 0 for invalid value', () => {
  assert.equal(parseKiwoomExpiresDt('invalid'), 0);
});

test('shouldReuseToken returns true when token is not near expiry', () => {
  const now = 1_700_000_000_000;
  const cache = { token: 'abc', expiresAtMs: now + 120_000 };
  assert.equal(shouldReuseToken(cache, now, 60_000), true);
});

test('shouldReuseToken returns false near expiry', () => {
  const now = 1_700_000_000_000;
  const cache = { token: 'abc', expiresAtMs: now + 40_000 };
  assert.equal(shouldReuseToken(cache, now, 60_000), false);
});
