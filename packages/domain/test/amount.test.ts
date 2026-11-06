import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_SIGNED_RE,
  CANONICAL_UINT_RE,
  UINT128_MAX,
  UINT128_MAX_STR,
  parseAtomicAmount,
  parsePlanPrice,
  parseSignedAtomicDelta,
} from '../src/amount.js';

const MAX = UINT128_MAX_STR;
const MAX_PLUS_ONE = '340282366920938463463374607431768211456';
const NINETEN_NINES = '999999999999999999999999999999999999999'; // 39 nines: overflow
const THIRTY_EIGHT_NINES = '99999999999999999999999999999999999999'; // 38 nines: within range

test('canonical regex accepts only unsigned canonical digits', () => {
  for (const ok of ['0', '1', '9', '10', MAX, THIRTY_EIGHT_NINES]) {
    assert.equal(CANONICAL_UINT_RE.test(ok), true, `expected ${ok} to be canonical`);
  }
  for (const bad of ['', '01', '1.5', '-1', '+1', '1e3', ' 1', '1 ', '0x10', '-0']) {
    assert.equal(CANONICAL_UINT_RE.test(bad), false, `expected ${bad} to be non-canonical`);
  }
});

test('signed canonical regex rejects -0 and non-canonical forms', () => {
  for (const ok of ['0', '1', '-1', '-9', MAX, `-${MAX}`]) {
    assert.equal(CANONICAL_SIGNED_RE.test(ok), true, `expected ${ok} to be canonical signed`);
  }
  for (const bad of ['-0', '00', '01', '+1', '1.5', '-1.5', '1e3', ' 1']) {
    assert.equal(CANONICAL_SIGNED_RE.test(bad), false, `expected ${bad} to be rejected`);
  }
});

test('parseAtomicAmount accepts canonical strings through the u128 maximum', () => {
  const accepted = ['0', '1', '9', '10', '100', THIRTY_EIGHT_NINES, MAX];
  for (const value of accepted) {
    const r = parseAtomicAmount(value);
    assert.deepEqual(r, { ok: true, value }, `expected "${value}" to be accepted unchanged`);
  }
});

test('parseAtomicAmount rejects float, negative, overflow and non-canonical inputs', () => {
  const rejected: unknown[] = [
    // JSON numbers (float and integer): the API boundary only accepts strings.
    1.5,
    1,
    0,
    -1,
    1.0,
    // strings that must never round/coerce/truncate
    '1.5',
    '1.0',
    '0.0',
    '-1',
    '-0',
    '+1',
    '01',
    '001',
    '00',
    '1e3',
    '1E3',
    '0x10',
    ' 1',
    '1 ',
    '\t1',
    '',
    ' ',
    // overflow
    MAX_PLUS_ONE,
    NINETEN_NINES,
    '1000000000000000000000000000000000000000', // 40 digits
    // non-string types
    null,
    undefined,
    true,
    [],
    {},
  ];
  for (const value of rejected) {
    const r = parseAtomicAmount(value);
    assert.equal(r.ok, false, `expected rejection of ${JSON.stringify(value)}`);
    if (r.ok === false) {
      assert.ok(r.reason.length > 0, `rejection reason must be non-empty for ${JSON.stringify(value)}`);
    }
  }
});

test('parseAtomicAmount never rewrites the value (no coercion/rounding)', () => {
  // Round-trips the exact canonical string; a leading-zero string is rejected,
  // never normalized to its numeric value.
  const maxResult = parseAtomicAmount('340282366920938463463374607431768211455');
  assert.equal(maxResult.ok, true);
  if (maxResult.ok) assert.equal(maxResult.value, MAX);
  assert.equal((parseAtomicAmount('01') as { ok: false }).ok, false);
  assert.equal((parseAtomicAmount('1.50') as { ok: false }).ok, false);
  assert.equal(UINT128_MAX, 340282366920938463463374607431768211455n);
});

test('plan price must be a positive canonical amount', () => {
  assert.deepEqual(parsePlanPrice('1'), { ok: true, value: '1' });
  assert.equal(parsePlanPrice('0').ok, false);
  assert.equal(parsePlanPrice(0).ok, false);
  assert.equal(parsePlanPrice(5).ok, false);
  assert.equal(parsePlanPrice('1.5').ok, false);
  assert.equal(parsePlanPrice('0001').ok, false);
  assert.equal(parsePlanPrice('-1').ok, false);
});

test('signed atomic delta accepts canonical magnitudes and rejects -0/overflow', () => {
  for (const ok of ['0', '1', '-1', MAX, `-${MAX}`, THIRTY_EIGHT_NINES, `-${THIRTY_EIGHT_NINES}`]) {
    assert.deepEqual(parseSignedAtomicDelta(ok), { ok: true, value: ok }, `expected "${ok}" accepted`);
  }
  for (const bad of ['-0', '00', '-00', '01', '+1', '1.5', '-1.5', '-1e3', `-${MAX_PLUS_ONE}`, 1.5, -1, null]) {
    assert.equal(parseSignedAtomicDelta(bad).ok, false, `expected rejection of ${JSON.stringify(bad)}`);
  }
});