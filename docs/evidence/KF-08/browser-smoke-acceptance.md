# KF-08 hydrated TESTNET browser smoke — accepted PASS_LOCAL read-only

Date:2026-11-09. Reviewer:Codex. Terra worker used real headless Chrome at1440px and390px against a dedicated synthetic TESTNET server. No wallet connect, signing, transaction, faucet or deployment was performed.

Observed:

- `/checkout/carla` mounted the TESTNET client and, with slow/unavailable public RPC, rendered the bounded error `NEAR testnet preflight timed out; retry when RPC is available.` plus an enabled Retry button. It did not remain indefinitely in loading state.
- `/keys` and `/studio` rendered Connect wallet. No signing action was invoked.
- Page overflow was false at both viewport widths for checkout/keys/studio.
- Synthetic RPC blocked scenario rendered the same fail-closed checkout error and did not enable purchase.
- Screenshots and observations are in `docs/evidence/KF-08/browser-smoke/`.

Verification: web build and typecheck exit0; script records a cosmetic favicon404 on one desktop checkout page only. No private fixture values were rendered in TESTNET. This proves hydrated browser gating/read-only degradation, not wallet signing, private entitlement, purchase, FT deployment, or account-following. FT/G02 and source/G01 remain blocked.
