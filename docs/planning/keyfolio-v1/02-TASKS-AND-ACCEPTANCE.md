# Keyfolio execution graph and acceptance matrix

Authority: behavior is defined in file 01. Test IDs below are mandatory where applicable. Tests listed as live cannot be satisfied by fixtures. Use files in docs/evidence/<task-id>/ for sanitized results, commands, environment, commit, timestamps, observed outputs, and limits.

## Task states

TODO -> READY -> RUNNING -> IMPLEMENTED -> REVIEW -> ACCEPTED.
REVIEW -> CHANGES_REQUIRED -> RUNNING.
Any dependent task may be BLOCKED_EXTERNAL with exact dependency and independent work remaining.
Only Codex changes REVIEW to ACCEPTED after evidence review. Worker completion means IMPLEMENTED, not accepted release. Failing required checks keep task unaccepted.

## Dependency graph

KF-00 -> KF-01, KF-02.
KF-01 -> KF-03 -> KF-04.
KF-02 -> KF-05, KF-06.
KF-05 + KF-06 -> KF-07.
KF-04 + KF-07 -> KF-08.
KF-01 + KF-04 + KF-07 -> KF-09.
KF-08 + KF-09 -> KF-10 -> KF-11.

KF-05/06 may use explicitly marked fixtures while KF-01 is blocked. They cannot make KF-08/09 live acceptance pass. UI shell may start after KF-02, but live integration acceptance still depends on KF-04/07.

## Task cards

### KF-00 — Workspace and executor readiness (Codex owner)
Inputs: packet, actual project directory, installed Orca guides.
Output: repository inventory, tool versions, DeepSeek dispatch/result/review proof, decisions/status scaffolding.
Scope: docs and one disposable nonfinancial worker fixture. Do not bootstrap unrelated repositories.
Accept: C00; record actual DeepSeek agent/provider/model identity without credentials. If unavailable, expose exact missing configuration; do not substitute a different executor silently.

### KF-01 — Confidential source feasibility (DeepSeek implementation, Codex review)
Depends: KF-00. Own packages/provider-adapter prototype and docs/evidence/KF-01.
Implement source capability probes, sanitized account mapping, pagination, outside-Keyfolio controlled activity capture, and session lifecycle checks. Read current official endpoint schemas. Provide deterministic test fixtures captured/sanitized from permitted responses or clearly synthetic fixtures.
Accept: S01-S08. Outcome may legitimately be BLOCKED_EXTERNAL. Deliver a field-by-field capability report even when live calls are blocked. Absence of credentials does not justify guessed endpoints.
Gate decision: full intended account coverage -> proceed; limited app-only coverage -> user decision; no read access -> blocked live integration.

### KF-02 — Foundation and interface freeze
Depends: KF-00. Own root configs, API schemas, initial SQL migrations, CI skeleton.
Create minimal runnable web/API/worker/contract test layout; exact-amount types; environment schema; endpoint OpenAPI contract matching file 01; seeded fixture environment; health checks. Freeze canonical data schemas before parallel implementation.
Accept: F01-F03; clean checkout setup succeeds with documented commands; missing production secrets fail clearly and fixtures cannot silently activate in live mode.

### KF-03 — Ingestion and reconciliation
Depends: KF-01, KF-02. Own worker ingestion, ledger domain, assigned migrations.
Implement atomic event/cursor persistence, duplicate handling, corrections, partial failure recovery, coverage labels, connection state machine, and asset reconciliation.
Accept: L01-L07 with independent arithmetic fixtures and at least one permitted live account reconciliation for live classification.

### KF-04 — Performance and public projection
Depends: KF-03. Own valuation/performance domain, public read model/API.
Implement pricing adapter after G03 decision, equity, net PnL, valid TWR/drawdown, daily public snapshots, coverage and stale labels. Do not expose private payloads through public routes.
Accept: P01-P06. Include exact expected-value cases below; compare snapshot reproducibility after ledger replay.

### KF-05 — NEAR license/payment contract
Depends: KF-02. Own contracts/access and contract sandbox tests.
Implement plans, storage registration, exact FT payment, receipt idempotency, NFT standard behavior, renewal, epoch transfer, revenue vesting, service termination/refund, asynchronous payout recovery, events and views. Publish ABI/method schema for consumers.
Accept: N01-N12. Codex must independently review funds, authorization and callback paths. Do not deploy until sandbox evidence passes and deployment route is authorized.

### KF-06 — Wallet auth and credential security
Depends: KF-02. Own auth/API credential modules.
Implement account-bound challenge verification, nonce consumption, browser sessions, CSRF, credential hashing, credential limits/revoke, and rate limits. No confidential provider token in application browser session.
Accept: A01-A06. Inject test signature verifier only in test configuration; real environment must use selected wallet standard.

### KF-07 — Entitlement and lifecycle integration
Depends: KF-05, KF-06. Own NFT projection worker and API authorization policy.
Implement contract/network binding, owner/epoch/expiry checks, pending transfer denial, freshness failure, source disclosure state, per-license quotas, transfer invalidation and renewal behavior.
Accept: E01-E08. Test A->C->A and contract-call transfer rollback, not only ordinary transfer. Measure finality-to-denial latency.

### KF-08 — Trader/follower product interface
Depends: KF-04, KF-07. Own apps/web and browser tests.
Deliver all screens in spec section 14, responsive layouts, exact state handling, two-wallet flows and API credential example. Use existing applicable frontend skills during implementation, not mock screenshots as integration evidence.
Accept: U01-U06. Visual review at 1440px and 390px; keyboard focus, form labels, contrast, error recovery, no unauthorized flash or cached private data.

### KF-09 — Assisted copy execution
Depends: KF-01, KF-04, KF-07. Own copy quote/order modules and provider execution adapter.
Implement user amount, fresh quote, destination ownership, preview, signature, submission, idempotent status recovery, deadline/slippage limits, independent follower results.
Accept: X01-X07. Live case requires separately authorized follower funds; no credentials from trader and no backend trading key. Keep old submitted orders visible after license expiry.

### KF-10 — Integration, recovery and release audit
Depends: KF-08, KF-09. Codex integration owner; DeepSeek fixes bounded issues.
Run full acceptance suite; database restore, worker interruption, callback failure, source outage/termination, secret/log leakage review, and real flow evidence. Resolve defects before broad polish.
Accept: R01-R06. Required failed tests block final release even if local unit suite passes.

### KF-11 — Release package
Depends: KF-10. Own docs/release, README, evidence manifest and demo guide.
Prepare precise setup, version pins, env names, networks/addresses, known limits, acceptance report, runtime trust model, API example, demo script, rollback steps, and code-baseline disclosure if relevant.
Accept: R07. No public push/deploy/submission without applicable authorization. Final report includes all open tasks and an honest result class.

## Acceptance cases

| ID | Required observation |
|---|---|
| C00 | Actual DeepSeek worker receives a bounded task, returns result, and Codex verifies it; CLI discovery alone fails this check |
| F01 | Clean checkout installs/builds/runs tests from documented commands |
| F02 | All env modes explicit; live mode cannot use fixture source or fake signing |
| F03 | Amount schemas reject floats, negative/overflow amounts, unknown network IDs |
| S01 | B authentication maps to B source; A credentials cannot read B source directly |
| S02 | Provider token scope/expiry/refresh/revoke characterized; no guessed read-only guarantee |
| S03 | Balance IDs and atomic quantities match actual authorized account |
| S04 | Multi-page history repeats consistently with dedupe under new arriving data |
| S05 | Controlled trade outside Keyfolio appears in observed source history |
| S06 | Deposit/withdraw/refund/failure effects match independently recorded account actions |
| S07 | Provider outage and expired token produce correct degraded/reauth states, no successful empty history |
| S08 | Source authorization and data redistribution permissions recorded; gated access still labeled blocked if missing |
| L01 | Replay same events twice yields exactly same balances and event count |
| L02 | Crash after fetch/before commit and after commit/before acknowledgment loses no events |
| L03 | Correction applies once and supersedes old economic effect |
| L04 | Unknown movement quarantines rather than becoming PnL |
| L05 | Source aligned opening + confirmed movements = closing for each asset |
| L06 | Concurrent workers cannot advance same cursor inconsistently |
| L07 | Public/private wrapper transfers inside portfolio are not external deposits twice |
| P01 | Deposit/withdrawal example below yields exactly $50 PnL |
| P02 | Cash-flow-adjusted example below yields exactly 10% TWR |
| P03 | Missing historical price or unpriced asset returns null/incomplete, never zero value |
| P04 | Duplicate fees or net/gross ambiguity cannot double-deduct costs |
| P05 | Source outage freezes last valid snapshot with stale flag; no invented history |
| P06 | Public response contains no private activity IDs, precise positions, secrets or source token |
| N01 | Exact correct FT payment + storage produces one NFT and billing tranche |
| N02 | Wrong FT/amount/plan/receiver/replayed purchase returns unused funds and no new NFT |
| N03 | Renewal appends exact period and leaves old purchased terms intact |
| N04 | Ordinary and call transfers update owner/epoch; failed call rollback invalidates old credentials |
| N05 | Expiry boundary now==expires_at denies access without a scheduled transaction |
| N06 | Vesting at start/mid/end uses exact integer floor; no overflow at supported limits |
| N07 | Termination caps earnings, creates funded unvested refund for current owner |
| N08 | Payout failure restores reserved credit once; callback requires self and correct action ID |
| N09 | Parallel withdrawal/refund/transfer cannot pay old and new owners twice |
| N10 | Total FT balance covers unpaid obligations and pending operations under random action sequences |
| N11 | Emergency pause preserves recoverability; monitor/admin cannot redirect funds |
| N12 | Bounded tranche processing and failed-transfer callback recovery tested, no permanent silent lock |
| A01 | Wrong domain/account/network, expired challenge, replay and simultaneous nonce reuse rejected |
| A02 | Valid signature binds to controlled account keys, not merely a claimed account string |
| A03 | CSRF/session/logout behavior tested; no secret in browser-readable cookie |
| A04 | API secret shown once and never stored plaintext or logged |
| A05 | Revoke immediately blocks credential; renewal cannot resurrect it |
| A06 | Parallel requests enforce shared license quota and credential-count cap |
| E01 | No NFT, wrong contract/network/trader/scope each denied |
| E02 | Active owner allowed; expired or disabled license denied |
| E03 | Finalized transfer invalidates old owner within <=30 seconds |
| E04 | A->C->A leaves A original credential invalid |
| E05 | Stale/unavailable RPC >30-second observation age fails closed |
| E06 | Pending transfer resolution denies all API access until authoritative state settles |
| E07 | Marketplace NFT approval does not grant reading rights |
| E08 | Private cache/URL/credential for B cannot leak data for another trader |
| U01 | Public visitor -> purchase -> mint -> private view succeeds with accurate pending states |
| U02 | Reload during pending purchase does not pay/mint twice |
| U03 | Key creation/revoke/renew/transfer have usable success and failure feedback |
| U04 | Stale, denied, expired, reauth and source termination states remain distinguishable |
| U05 | Two widths, keyboard navigation, accessible controls, no private data flash |
| U06 | Testnet/fixture/live labels visible and accurate; no fabricated leaderboard performance |
| X01 | Copy quote bound to follower and eligible confirmed trade with fresh amounts/fee/min output |
| X02 | Changed recipient/amount/assets/deadline or excessive slippage requires rejection/new quote |
| X03 | Only follower signs; read credential and trader credential cannot authorize execution |
| X04 | Submission timeout triggers lookup, not repeat spend |
| X05 | Same idempotency key/different payload rejected; duplicate observations do not duplicate orders |
| X06 | Expired license blocks new execution; already submitted order remains recoverable |
| X07 | Actual approved copy reaches settled/refunded outcome with follower balance reconciliation |
| R01 | Full authorized two-wallet source->purchase->API->copy flow recorded in one declared environment |
| R02 | Backup restore and worker restart preserve receipt/credential/order state |
| R03 | 24-hour synthetic-clock outage triggers termination once; recovery does not revive cancelled licenses |
| R04 | Repo/log/build artifacts scanned for secrets and private payload leakage |
| R05 | No unexplained balance difference, unresolved critical authorization bug, or required failed test |
| R06 | Codex reviews financial and authorization diffs; remaining risks documented |
| R07 | New reader can follow README do-X/observe-Y steps; evidence matches final commit |

## Independent expected-value fixtures

F-PNL: opening equity 1000 USD; deposit 500; withdrawal 100; ending 1450. Expected net PnL=50. A deposit-only case opening1000/deposit500/ending1500 yields zero PnL.
F-TWR: start1000 ->1100 before external deposit; deposit900 ->2000; end2000. Expected compounded return10%, net PnL100. Dividing100 by cumulative capital1900 is not the TWR.
F-DD: wealth index1.00 ->1.20 ->0.90 ->1.10. Expected maximum drawdown25% (1 - .90/1.20).
F-VEST: price101 atomic units; duration10 seconds; at5 seconds earned50, unvested51. Terminate at5: trader entitlement50, current NFT owner's refund51. At uninterrupted end earned101. Tests must include widened multiplication limits.
F-TIME: expiry T. T-1ms active; T expired. Renewal at T+1000ms starts at now, not old T. Renewal before T starts at T.

## Schedule and scope control

Dates are Asia/Jakarta; target internal completion 14 November 23:59. This is a planning allocation, not fabricated progress.

| Date | Target |
|---|---|
| Nov 6 | KF-00, initial KF-01/KF-02; capability questions surfaced |
| Nov 7 | KF-01 result and integration gate decision; KF-02 accepted |
| Nov 8 | KF-03/KF-04 initial evidence; KF-05 independent contract progress |
| Nov 9 | KF-05 sandbox evidence; KF-06 auth accepted |
| Nov 10 | KF-07 full entitlement tests |
| Nov 11 | KF-08 complete UI flow |
| Nov 12 | KF-09 assisted copy and remaining contract edge cases |
| Nov 13 | KF-10 end-to-end audit and corrections |
| Nov 14 | KF-11 reproducibility, final evidence and release stabilization |

If source history access is absent on Nov7, record a decision request immediately; continue independent local work. If a required deliverable slips, propose explicit reduced scope to the user; no silent deletion of tests/features. Do not claim ShowStake can share this full capacity without a separate resource allocation. Only one DeepSeek writer per shared checkout; parallel workers require disjoint ownership/isolated Orca workspaces.

## Evidence record template

Task/Test ID:
Commit + branch:
Environment/network/account labels:
Source version/API capability:
Command or steps:
Expected result:
Observed result:
Sanitized artifact paths / public receipt references:
Classification (PASS_LOCAL/PASS_TESTNET/PASS_LIVE/BLOCKED_EXTERNAL/FAILED/NOT_RUN):
Reviewer and review date:
Remaining limits:

Never put raw viewing/session tokens, key material, private account payloads, or real subscriber data in public evidence.

## Final deliverables

Runnable repo + lockfiles; migration/setup commands; contract source/ABI/tests; API schema/examples; web flows; source capability report; acceptance table with per-test evidence; deployment/network manifest; demo script; privacy/custody/refund trust model; rollback/recovery guide; final scope vs original requirement report.

Full completion requires intended account coverage, secure NFT gate, financial invariants, and real flow evidence. Local implementation complete with blocked provider access must be reported exactly that way. Publication is a separate action from preparing these deliverables.
