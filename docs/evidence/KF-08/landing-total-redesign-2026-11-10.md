# KF-08 landing total redesign revision - 2026-11-10

## Scope

This revision applies the accepted P0 and P1 findings from `landing-total-redesign-judge.md` to `apps/landing`. The editable design contract remains `design/mockups/keyfolio-screens-v1.figcraft`, with the desktop and 390px landing frames. The dark Luora-inspired composition, generated key and globe artwork, rounded stage, wallet modes, and reduced-motion behavior remain in place.

## Exact hero clutter removed

The rendered customer surface no longer contains:

- `ILLUSTRATIVE SAMPLE` or `NO LIVE TRADER`
- `FIXTURE / READY`, `FIXTURE preview`, or `simulated state only` evidence prose
- `SOURCE HEALTH READABLE` or `COVERAGE LOCKED`
- `ACCESS KEY READY / PRIVATE API GATED`
- `READY`, `GATED`, or `RULED` status taxonomy
- middle-dot or em-dash separators in the landing copy
- numeric sample performance such as `+18.42%` or `142 settled swaps`

Truth is retained as one quiet accessible status line. FIXTURE says that demo mode is simulated; TESTNET continues to use the existing NEAR wallet selector and remains wallet-ready; LIVE remains fail-closed through `landingContract`.

## Journey and motion changes

The first viewport now makes the customer path explicit with large readable states:

`Choose a trader` -> `Compare coverage` -> `Buy access key` -> `Unlock private/API` -> `Copy when eligible`

`Browse traders` is the primary route. `Open the demo` remains a secondary FIXTURE action. The hero lede is two short sentences. The artifact card carries one readable state at a time, and scroll progression changes both the state copy and the artwork/card relationship. The first frame is at readable contrast with a short settle rather than a dim loading reveal. On 390px the journey is a stacked set of larger chips with fewer simultaneous labels.

## Verification

Evidence was captured against the local landing app in FIXTURE mode:

```text
landing-1440          overflow=false marketingNav=true appShell=false cta=1 scenario=5
landing-390           overflow=false marketingNav=true appShell=false cta=1 scenario=5
landing-390-reduced   overflow=false marketingNav=true appShell=false cta=1 scenario=5
responsive-375        overflow=false
responsive-390        overflow=false
responsive-768        overflow=false
responsive-1280       overflow=false
responsive-1440       overflow=false
```

Checks:

- `pnpm --filter @keyfolio/landing typecheck` - PASS_LOCAL
- `pnpm --filter @keyfolio/landing build` - PASS_LOCAL
- `node scripts/kf08-landing-evidence.mjs` - PASS_LOCAL
- `node scripts/kf08-landing-capture.mjs` - PASS_LOCAL
- `$env:ONLY_REDUCED='1'; node scripts/kf08-landing-capture.mjs` - PASS_LOCAL

Updated captures:

- `docs/evidence/KF-08/landing-separation/landing-1440.png`
- `docs/evidence/KF-08/landing-separation/landing-390.png`
- `docs/evidence/KF-08/landing-separation/landing-390-reduced.png`
- `.deploy-local/motion-audit/keyfolio-total-redesign.webm`
- `.deploy-local/motion-audit/keyfolio-total-redesign-reduced.webm`
- Named WebM SHA-256: normal `B09E9F9B95233868576F6BA148CC1CD3510E1E340126DE5DA5F3B59BF7DE4A23`; reduced `AAB82E7AFF9808AF6BFCAF85AD4BE0E4E4F8F78FB43502406B78F3CD961AE6AE`.
- `.deploy-local/motion-audit/keyfolio-total-redesign-final.png`
- `.deploy-local/motion-audit/keyfolio-total-redesign-reduced-final.png`

## Evidence boundary

These are local browser and fixture-mode visual checks. They do not establish TESTNET signing, NFT purchase, private/API entitlement, provider access, assisted-copy execution, or LIVE readiness. No wallet selector or external source permission was invoked during capture. Local video and runtime artifacts remain uncommitted.
