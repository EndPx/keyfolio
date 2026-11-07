// Local check for the smoke helper's resolver-value decoding using synthetic
// outcomes only — no wallet, no signing, no transactions (review milestone 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertSpentAmount, parseResolverValue } from './resolver-value.mjs';

test('spent "101" is accepted and returned as a string', () => {
  assert.equal(assertSpentAmount('"101"', '101', 'purchase tn-ord-1'), '101');
  assert.equal(parseResolverValue('"101"'), '101');
});

test('spent "0" (full refund) is rejected loudly', () => {
  assert.throws(() => assertSpentAmount('"0"', '101', 'purchase x'), /spent 0, expected 101/);
});

test('empty, null and missing values are rejected', () => {
  for (const raw of [null, undefined, '']) {
    assert.throws(() => parseResolverValue(raw), /no value/);
  }
});

test('malformed JSON and non-string U128 forms are rejected', () => {
  for (const raw of ['garbage', '101', '1.5', '{}', '"abc"', '"01"']) {
    assert.throws(() => parseResolverValue(raw), /malformed|canonical/);
  }
});

test('other canonical amounts decode but mismatched expectations throw', () => {
  assert.equal(parseResolverValue('"40"'), '40');
  assert.throws(() => assertSpentAmount('"40"', '101', 'partial'), /spent 40, expected 101/);
});
