// Linear vesting with the simplest overflow-safe arithmetic (F-VEST).
//
// earned(t) = floor(gross * clamp(t - start, 0, end - start) / (end - start))
//
// Naively gross*elapsed overflows u128, but splitting the division FIRST
// removes any need for widened math:
//   gross = q*d + r  (q = gross/d, r = gross%d, r < d)
//   earned = floor((q*d + r) * e / d) = q*e + floor(r*e/d)
// Safety bounds, given the enforced precondition d <= MAX_TERM_MS:
//   * q*e <= q*d = gross - r <= gross          (e <= d)  -> never overflows u128
//   * r*e < d*d <= 10^24                       (r < d)   -> far below u128 max
// The result is floored once per part and never exceeds the exact value
// gross*e/d <= gross. No floats, no rounding beyond the documented floor.

/// Maximum tranche duration accepted anywhere: 10^12 ms (~31.7 years).
/// Enforced here as a precondition and enforced at plan creation (KF-05b).
pub const MAX_TERM_MS: u128 = 1_000_000_000_000;

/// Vested amount of one tranche at `at_ms` (all values in milliseconds).
/// Panics on `end_ms <= start_ms` or duration > MAX_TERM_MS (callers must
/// validate plan terms before storing them; these are hard preconditions,
/// not silent clamps).
pub fn earned_atomic(gross: u128, start_ms: u128, end_ms: u128, at_ms: u128) -> u128 {
    assert!(end_ms > start_ms, "vesting: end must be after start");
    let duration = end_ms - start_ms;
    assert!(
        duration <= MAX_TERM_MS,
        "vesting: duration exceeds MAX_TERM_MS"
    );
    if at_ms >= end_ms {
        return gross;
    }
    if at_ms <= start_ms {
        return 0;
    }
    let elapsed = at_ms - start_ms; // 0 < elapsed < duration
    let (q, r) = (gross / duration, gross % duration);
    q * elapsed + (r * elapsed) / duration
}

#[cfg(test)]
mod tests {
    use super::*;

    const MAX: u128 = u128::MAX;

    // F-VEST: price 101 atomic; duration 10s; at 5s earned 50, unvested 51.
    #[test]
    fn f_vest_fixture_exact_values() {
        let gross = 101u128;
        let (start, end) = (0u128, 10_000u128);
        assert_eq!(earned_atomic(gross, start, end, 0), 0);
        assert_eq!(earned_atomic(gross, start, end, 1), 0, "floor(101*1/10000) = 0");
        assert_eq!(earned_atomic(gross, start, end, 5_000), 50, "floor(101*5/10)");
        assert_eq!(earned_atomic(gross, start, end, 5_001), 50);
        assert_eq!(earned_atomic(gross, start, end, 5_099), 51, "floor(101*5099/10000)");
        assert_eq!(earned_atomic(gross, start, end, end), 101);
        assert_eq!(earned_atomic(gross, start, end, end + 1_000), 101);
        // Termination at 5s: trader entitlement 50, refundable remainder 51.
        assert_eq!(gross - earned_atomic(gross, start, end, 5_000), 51);
    }

    // Hand-computed floor cases with an awkward duration (independent of the
    // implementation's internal order of operations).
    #[test]
    fn floor_division_hand_computed() {
        // gross=1000, d=3: q=333 r=1. e=1 -> 333 + 0 = 333; e=2 -> 666 + 0 = 666.
        assert_eq!(earned_atomic(1000, 0, 3, 1), 333);
        assert_eq!(earned_atomic(1000, 0, 3, 2), 666);
        assert_eq!(earned_atomic(1000, 0, 3, 3), 1000);
        // gross=7, d=3: q=2 r=1. e=1 -> 2 + 0 = 2; e=2 -> 4 + 0 = 4; e=3 -> 7.
        assert_eq!(earned_atomic(7, 0, 3, 1), 2);
        assert_eq!(earned_atomic(7, 0, 3, 2), 4);
        // Offset start: elapsed is measured from start, not from zero.
        assert_eq!(earned_atomic(101, 1_000, 11_000, 1_000), 0);
        assert_eq!(earned_atomic(101, 1_000, 11_000, 6_000), 50);
        assert_eq!(earned_atomic(101, 1_000, 11_000, 10_999), 100, "floor(101*9999/10000)");
    }

    // u128 boundary: the maximum gross must survive the full duration exactly
    // and halve exactly; partial durations floor consistently.
    #[test]
    fn u128_max_gross_boundaries() {
        let gross = MAX;
        let d = MAX_TERM_MS;
        assert_eq!(earned_atomic(gross, 0, d, d), MAX, "full term vests fully");
        assert_eq!(earned_atomic(gross, 0, d, d / 2), MAX / 2, "half term floors to MAX/2");
        assert_eq!(earned_atomic(gross, 0, d, 1), MAX / d, "floor(MAX/10^12)");
        // At e = d-1: earned = gross - ceil(gross/d), computed independently.
        let q = gross / d;
        let r = gross % d;
        let ceil = q + if r > 0 { 1 } else { 0 };
        assert_eq!(earned_atomic(gross, 0, d, d - 1), gross - ceil);
        // Zero gross stays zero everywhere.
        assert_eq!(earned_atomic(0, 0, d, d / 3), 0);
    }

    // Duration bounds: the cap is a hard precondition, not a clamp.
    #[test]
    fn duration_precondition_enforced() {
        // d = MAX_TERM_MS is accepted.
        assert_eq!(earned_atomic(5, 0, MAX_TERM_MS, MAX_TERM_MS), 5);
        // d = MAX_TERM_MS + 1 panics.
        assert!(
            std::panic::catch_unwind(|| earned_atomic(5, 0, MAX_TERM_MS + 1, 1)).is_err(),
            "duration above the cap must be rejected"
        );
        // end == start and end < start panic.
        assert!(std::panic::catch_unwind(|| earned_atomic(5, 5_000, 5_000, 6_000)).is_err());
        assert!(std::panic::catch_unwind(|| earned_atomic(5, 6_000, 5_000, 6_000)).is_err());
    }

    // Result bounds and monotonicity over a fixed sweep (deterministic; no RNG).
    #[test]
    fn results_never_exceed_gross_and_are_monotonic() {
        for gross in [1u128, 999, 10_000_007, MAX / 7, MAX] {
            for d in [1u128, 2, 60_000, 2_592_000, MAX_TERM_MS] {
                let mut prev = 0u128;
                for step in 0..=20u128 {
                    let at = d * step / 20;
                    let e = earned_atomic(gross, 0, d, at);
                    assert!(e <= gross, "earned must never exceed gross");
                    assert!(e >= prev, "earned must be non-decreasing in time");
                    prev = e;
                }
                assert_eq!(prev, gross, "at term end the full gross is vested");
            }
        }
    }
}
