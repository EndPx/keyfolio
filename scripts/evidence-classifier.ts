// Honest evidence classifiers for the atomic_u128 / signed_atomic_delta TEXT
// domain (KF-D009). A row's `actual` outcome is derived from what actually
// happened (success => 'OK', throw => 'ERROR'), never from what was expected,
// so a contradiction can never be relabelled as correct. `expected` is reported
// separately and `passed` is true only when actual, expected and (for ERROR
// rows) the observed SQLSTATE all agree.

export type ExpectedOutcome = 'OK' | 'ERROR';

/** Every expected-ERROR row in this evidence set is this CHECK violation. */
export const DOMAIN_CHECK_SQLSTATE = '23514';

export interface EvidenceCheck {
  statement: string;
  expected: ExpectedOutcome;
  /** SQLSTATE an expected-ERROR row must produce (defaults to 23514). */
  expectedSqlstate?: string;
}

export interface EvidenceResult {
  statement: string;
  expected: ExpectedOutcome;
  /** What actually happened, independent of the expectation. */
  actual: ExpectedOutcome;
  passed: boolean;
  sqlstate?: string;
  detail?: string;
}

/**
 * Classify one already-executed statement against its expectation (pure).
 * `actual` is never derived from `expected`; `passed` is false on any outcome
 * mismatch or, for ERROR rows, an unexpected SQLSTATE.
 */
export function classifyEvidenceResult(
  check: EvidenceCheck,
  actual: ExpectedOutcome,
  sqlstate?: string,
  detail?: string,
): EvidenceResult {
  let passed = actual === check.expected;
  // Only an ERROR execution carries a SQLSTATE; verify it matches exactly.
  if (passed && actual === 'ERROR' && sqlstate !== (check.expectedSqlstate ?? DOMAIN_CHECK_SQLSTATE)) {
    passed = false;
  }
  return { statement: check.statement, expected: check.expected, actual, passed, sqlstate, detail };
}

/** A query seam: resolves on success and rejects on failure (like db.query). */
export type EvidenceQuery = (sql: string) => Promise<unknown>;

/** Run every check through an injected query seam and classify honestly. */
export async function runEvidenceChecks(
  query: EvidenceQuery,
  checks: readonly EvidenceCheck[],
): Promise<{ results: EvidenceResult[]; anyFailed: boolean }> {
  const results: EvidenceResult[] = [];
  let anyFailed = false;
  for (const check of checks) {
    try {
      await query(check.statement);
      const r = classifyEvidenceResult(check, 'OK');
      if (!r.passed) anyFailed = true;
      results.push(r);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      const r = classifyEvidenceResult(check, 'ERROR', code, (err as Error).message);
      if (!r.passed) anyFailed = true;
      results.push(r);
    }
  }
  return { results, anyFailed };
}