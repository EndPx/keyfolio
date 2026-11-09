# KF-08 landing/app separation — implementation evidence

Date: 2026-11-10. Owner: implementation writer. This is worker evidence for Codex review; it is not acceptance of wallet signing, purchase, entitlement, provider access or LIVE execution.

## Scope

- `apps/landing` is a standalone Next.js workspace app with its own package, config, layout, page, global CSS, brand asset and browser evidence script.
- The landing surface has its own marketing navigation/footer and no app sidebar or environment banner.
- `apps/web` root renders the Marketplace dashboard; `/marketplace` remains the explicit alias.
- Landing wallet CTA is mode-aware: FIXTURE is an explicit simulated preview, TESTNET initializes the existing NEAR Wallet Selector/MyNearWallet seam without holding keys, and LIVE is fail-closed.
- The narrative states choose trader → compare tracked coverage/performance → buy transferable NFT access key → unlock private read/API → assisted copy only when trusted source time, entitlement and follower signature allow it.

## Validation command

Run the landing app with `KEYFOLIO_MODE=FIXTURE pnpm --filter @keyfolio/landing dev -p 3100`, then run:

```text
node scripts/kf08-landing-evidence.mjs
```

The script captures 1440px, 390px and reduced-motion 390px screenshots, checks the absence of `.sidebar`/`.banner`, and checks overflow at 375/390/768/1280/1440px. Metrics in the hero remain labeled illustrative sample data.

## Limitations

This slice is PASS_LOCAL only. TESTNET wallet connection, signing, purchase, private entitlement/API authorization and live performance remain unproven; no provider, contract, migration, deployment, secret or paid-service surface was changed.
