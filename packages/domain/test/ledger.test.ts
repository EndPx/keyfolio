import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NORMALIZATION_VERSION,
  applyLedgerEvents,
  eventKey,
  reconcileBalances,
  resolveStatusTransition,
  sumExternalFlows,
  validateMovement,
  type AssetBalance,
  type LedgerEventInput,
  type Movement,
} from '../src/ledger.js';

const NEAR = 'testnet:near';
const SWAP = (delta: string): Movement => ({ assetId: NEAR, movementIndex: 0, kind: 'TRADE_LEG', signedDelta: delta });

const confirmed = (sourceEventId: string, movements: Movement[], revision = 1): LedgerEventInput => ({
  provider: 'confidential-intents',
  sourceAccountId: 'trader.testnet',
  sourceEventId,
  revision,
  type: 'SWAP',
  status: 'CONFIRMED',
  movements,
});

test('NORMALIZATION_VERSION is stable and event keys collide on all four parts', () => {
  assert.equal(NORMALIZATION_VERSION, 'kf-ledger-v1');
  assert.equal(
    eventKey('p', 'a', 'e', 1),
    eventKey('p', 'a', 'e', 1),
  );
  assert.notEqual(eventKey('p', 'a', 'e', 1), eventKey('p', 'a', 'e', 2));
  assert.notEqual(eventKey('p', 'a', 'e', 1), eventKey('p', 'a', 'e2', 1));
  assert.notEqual(eventKey('p', 'a', 'e', 1), eventKey('p2', 'a', 'e', 1));
  assert.throws(() => eventKey('', 'a', 'e', 1), /provider/);
  assert.throws(() => eventKey('p', 'a', 'e', 0), /revision/);
});

test('L01: replaying the same events twice yields identical balances and no new applications', () => {
  const opening: AssetBalance[] = [{ assetId: NEAR, balanceAtomic: '1000' }];
  const events = [
    confirmed('ev1', [SWAP('-300')]),
    confirmed('ev2', [SWAP('75')]),
    { ...confirmed('ev3', [SWAP('10')]), status: 'PENDING' as const }, // never posts
  ];
  const first = applyLedgerEvents(opening, events);
  assert.equal(first.complete, true);
  if (!first.complete) return;
  assert.equal(first.appliedCount, 2);
  assert.deepEqual(first.balances, [{ assetId: NEAR, balanceAtomic: '775' }]);

  const second = applyLedgerEvents(opening, events);
  assert.equal(second.complete, true);
  if (!second.complete) return;
  assert.equal(second.appliedCount, 2, 'replay of the same set applies exactly the same effects');
  assert.deepEqual(second.balances, first.balances);
  // Cross-batch replay protection is the persistence layer's atomic unique key
  // (provider, account, source_event, revision) committed transactionally with
  // the cursor (database.md); this pure function dedupes within its input.
});

test('L03: correction reverses the original effect once and posts corrected truth once', () => {
  const opening: AssetBalance[] = [{ assetId: NEAR, balanceAtomic: '1000' }];
  const original = confirmed('ev1', [SWAP('500')]);
  const correction: LedgerEventInput = {
    provider: 'confidential-intents',
    sourceAccountId: 'trader.testnet',
    sourceEventId: 'corr-1',
    revision: 1,
    type: 'CORRECTION',
    status: 'CONFIRMED',
    movements: [SWAP('400')], // corrected truth: the swap was 400, not 500
    supersedes: eventKey('confidential-intents', 'trader.testnet', 'ev1', 1),
  };
  const r = applyLedgerEvents(opening, [original, correction]);
  assert.equal(r.complete, true);
  if (!r.complete) return;
  // 1000 + 500 - 500 + 400 = 1400
  assert.deepEqual(r.balances, [{ assetId: NEAR, balanceAtomic: '1400' }]);
  assert.equal(r.appliedCount, 2);

  // A duplicate correction row (same key) must not reverse or post again.
  const replayed = applyLedgerEvents(opening, [original, correction, correction]);
  assert.equal(replayed.complete, true);
  if (!replayed.complete) return;
  assert.deepEqual(replayed.balances, r.balances);

  // A second correction targeting the SAME original (different key) is a
  // policy conflict: already reversed once, so it must not apply again.
  const secondCorrection = { ...correction, sourceEventId: 'corr-2' };
  const twice = applyLedgerEvents(opening, [original, correction, secondCorrection]);
  assert.equal(twice.complete, true);
  if (!twice.complete) return;
  assert.deepEqual(twice.balances, r.balances, 'original effects are reversed exactly once');
});

test('L03: cross-batch correction uses caller-supplied original movements', () => {
  // Original applied in an earlier batch; only its movements are known now.
  const opening: AssetBalance[] = [{ assetId: NEAR, balanceAtomic: '1500' }]; // 1000 + 500 already applied
  const correction: LedgerEventInput = {
    provider: 'confidential-intents',
    sourceAccountId: 'trader.testnet',
    sourceEventId: 'corr-9',
    revision: 1,
    type: 'CORRECTION',
    status: 'CONFIRMED',
    movements: [SWAP('450')],
    supersedes: eventKey('confidential-intents', 'trader.testnet', 'ev1', 1),
  };
  const r = applyLedgerEvents(opening, [correction], {
    supersededOriginals: {
      [eventKey('confidential-intents', 'trader.testnet', 'ev1', 1)]: [SWAP('500')],
    },
  });
  assert.equal(r.complete, true);
  if (!r.complete) return;
  // 1500 - 500 + 450 = 1450
  assert.deepEqual(r.balances, [{ assetId: NEAR, balanceAtomic: '1450' }]);
});

test('L03: correction with an unknown target quarantines instead of guessing', () => {
  const opening: AssetBalance[] = [{ assetId: NEAR, balanceAtomic: '1000' }];
  const orphan: LedgerEventInput = {
    provider: 'confidential-intents',
    sourceAccountId: 'trader.testnet',
    sourceEventId: 'corr-x',
    revision: 1,
    type: 'CORRECTION',
    status: 'CONFIRMED',
    movements: [SWAP('1')],
    supersedes: eventKey('confidential-intents', 'trader.testnet', 'missing', 1),
  };
  const r = applyLedgerEvents(opening, [orphan]);
  assert.equal(r.complete, true);
  if (!r.complete) return;
  assert.deepEqual(r.balances, [{ assetId: NEAR, balanceAtomic: '1000' }], 'no effect posted');
  assert.equal(r.quarantined.length, 1);
  assert.match(r.quarantined[0].reason, /reconciliation required/);
});

test('L04: unknown movement kind quarantines the event and posts nothing', () => {
  const opening: AssetBalance[] = [{ assetId: NEAR, balanceAtomic: '1000' }];
  const event = confirmed('ev1', [
    SWAP('100'),
    { assetId: NEAR, movementIndex: 1, kind: 'MYSTERY_AIRDROP', signedDelta: '999' },
  ]);
  const r = applyLedgerEvents(opening, [event]);
  assert.equal(r.complete, true);
  if (!r.complete) return;
  assert.deepEqual(r.balances, [{ assetId: NEAR, balanceAtomic: '1000' }], 'unknown kind never becomes profit');
  assert.equal(r.quarantined.length, 1);
  assert.match(r.quarantined[0].reason, /MYSTERY_AIRDROP/);
  assert.equal(r.appliedCount, 0);
});

test('a resulting negative balance fails closed as incomplete', () => {
  const opening: AssetBalance[] = [{ assetId: NEAR, balanceAtomic: '100' }];
  const r = applyLedgerEvents(opening, [confirmed('ev1', [SWAP('-200')])]);
  assert.equal(r.complete, false);
  if (!r.complete) assert.match(r.reason, /negative/);
});

test('L05: aligned opening + confirmed movements equal the observed closing balance', () => {
  const deltas = [
    { assetId: NEAR, delta: 500n },
    { assetId: NEAR, delta: -300n },
    { assetId: 'testnet:usdc', delta: 25_000_000n },
  ];
  const ok = reconcileBalances({
    opening: [
      { assetId: NEAR, balanceAtomic: '1000' },
      { assetId: 'testnet:usdc', balanceAtomic: '0' },
    ],
    closing: [
      { assetId: NEAR, balanceAtomic: '1200' },
      { assetId: 'testnet:usdc', balanceAtomic: '25000000' },
    ],
    confirmedDeltas: deltas,
  });
  assert.deepEqual(ok, { complete: true, balanced: true });

  const mismatch = reconcileBalances({
    opening: [{ assetId: NEAR, balanceAtomic: '1000' }],
    closing: [{ assetId: NEAR, balanceAtomic: '1201' }],
    confirmedDeltas: deltas.filter((d) => d.assetId === NEAR),
  });
  assert.equal(mismatch.complete, true);
  if (mismatch.complete && !mismatch.balanced) {
    assert.deepEqual(mismatch.mismatches, [
      { assetId: NEAR, expectedAtomic: '1200', observedAtomic: '1201', differenceAtomic: '1' },
    ]);
  }

  // Asset only on the closing side is compared against an implicit zero opening.
  const extra = reconcileBalances({
    opening: [],
    closing: [{ assetId: 'x', balanceAtomic: '7' }],
    confirmedDeltas: [],
  });
  assert.equal(extra.complete, true);
  if (extra.complete && !extra.balanced) {
    assert.equal(extra.mismatches[0].differenceAtomic, '7');
  }
});

test('L07: internal wrapper transfers never enter external flow totals', () => {
  const movements = [
    validateMovement({ assetId: NEAR, movementIndex: 0, kind: 'EXTERNAL_DEPOSIT', signedDelta: '500' }),
    validateMovement({ assetId: NEAR, movementIndex: 1, kind: 'INTERNAL_TRANSFER', signedDelta: '500' }),
    validateMovement({ assetId: NEAR, movementIndex: 2, kind: 'INTERNAL_TRANSFER', signedDelta: '-500' }),
    validateMovement({ assetId: NEAR, movementIndex: 3, kind: 'EXTERNAL_WITHDRAWAL', signedDelta: '-200' }),
    validateMovement({ assetId: NEAR, movementIndex: 4, kind: 'FEE', signedDelta: '-1' }),
    validateMovement({ assetId: NEAR, movementIndex: 5, kind: 'MYSTERY', signedDelta: '-7' }),
  ];
  const flows = sumExternalFlows(movements, NEAR);
  // Only the external pair counts: the internal round-trip and fee/mystery do not.
  assert.deepEqual(flows, { deposit: 500n, withdrawal: 200n });
});

test('status lifecycle: forward transitions pass, regressions require reconciliation', () => {
  assert.deepEqual(resolveStatusTransition('OBSERVED', 'PENDING'), { ok: true, status: 'PENDING' });
  assert.deepEqual(resolveStatusTransition('PENDING', 'CONFIRMED'), { ok: true, status: 'CONFIRMED' });
  assert.deepEqual(resolveStatusTransition('PENDING', 'FAILED'), { ok: true, status: 'FAILED' });
  assert.deepEqual(resolveStatusTransition('PENDING', 'REFUNDED'), { ok: true, status: 'REFUNDED' });
  assert.deepEqual(resolveStatusTransition('OBSERVED', 'CONFIRMED'), { ok: true, status: 'CONFIRMED' });
  assert.deepEqual(resolveStatusTransition('CONFIRMED', 'CONFIRMED'), { ok: true, status: 'CONFIRMED' });

  for (const [from, to] of [
    ['CONFIRMED', 'PENDING'],
    ['CONFIRMED', 'OBSERVED'],
    ['CONFIRMED', 'FAILED'],
    ['FAILED', 'CONFIRMED'],
    ['REFUNDED', 'PENDING'],
    ['RECONCILIATION_REQUIRED', 'CONFIRMED'],
  ] as const) {
    const r = resolveStatusTransition(from, to);
    assert.equal(r.ok, false, `${from} -> ${to} is a regression`);
    if (!r.ok) {
      assert.equal(r.status, 'RECONCILIATION_REQUIRED');
      assert.match(r.reason, /regression/);
    }
  }
  const unknown = resolveStatusTransition('CONFIRMED', 'TELEPORTED' as never);
  assert.equal(unknown.ok, false);
});

test('movement validation rejects non-canonical deltas and empty assets', () => {
  assert.equal(validateMovement({ assetId: '', movementIndex: 0, kind: 'FEE', signedDelta: '1' }).ok, false);
  assert.equal(validateMovement({ assetId: 'a', movementIndex: -1, kind: 'FEE', signedDelta: '1' }).ok, false);
  const bad = validateMovement({ assetId: 'a', movementIndex: 0, kind: 'FEE', signedDelta: '1.5' });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.reason, /canonical signed/);
  const okUnknown = validateMovement({ assetId: 'a', movementIndex: 0, kind: 'WEIRD', signedDelta: '-5' });
  assert.equal(okUnknown.ok, true);
  if (okUnknown.ok) assert.equal(okUnknown.knownKind, false, 'unknown kinds validate but must quarantine in apply');
});
