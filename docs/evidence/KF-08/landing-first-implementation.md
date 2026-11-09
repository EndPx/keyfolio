# KF-08 landing-first implementation evidence

Status: PASS_LOCAL implementation and browser visual slice. Codex coordinator acceptance remains pending.

## Changed surface

- `/` is now the Keyfolio landing page. It uses the existing brand symbol, true-black Xorr-inspired visual language, cobalt orb, equity ribbon, rounded tracked-performance card, coverage/source-health/performance explanation, consent-to-access flow, and final marketplace CTA.
- Existing marketplace UI moved intact to `/marketplace`; existing detail, checkout, keys, private, API, studio, and activity routes remain in place.
- Sidebar navigation now exposes Home and `/marketplace` separately.
- Wallet CTA is mode-aware through the existing `WalletContext`: FIXTURE is explicitly simulated, TESTNET calls the existing selector `signIn` and exposes account/sign-out/error states, and LIVE is disabled/fail-closed.
- Motion is restricted to transform/opacity/filter transitions and keyframes. Sections use IntersectionObserver-driven scroll reveal; `prefers-reduced-motion: reduce` removes nonessential motion and transitions.
- Motion is fail-open: content is visible before hydration and only enters the hidden/reveal state after the client marks the landing shell as motion-ready. A JS-disabled or hydration-failed page does not render blank sections.
- Marketplace copy was re-encoded after browser review caught mojibake in the moved route.

## Focused validation

- `pnpm --filter @keyfolio/web typecheck` — PASS_LOCAL.
- `node --import tsx --test apps/web/test/landing.test.ts` — 2 tests passed (mode contract and route preservation).
- `pnpm --filter @keyfolio/web build` — PASS_LOCAL.
- Browser run used the installed Microsoft Edge executable through Playwright because the Playwright-managed Chromium binary was not installed.

## Browser evidence

The browser evidence script checked the rendered page at 1440×900, 390×844, and 390×844 with reduced motion, plus `/marketplace` at 1440px.

- `landing-1440.png` — landing hierarchy, hero CTA, floating card, ribbon, rounded sections.
- `landing-390.png` — mobile stack, CTA in first viewport, readable card, no horizontal overflow.
- `landing-390-reduced.png` — reduced-motion rendering, readable static fallback, no horizontal overflow.
- `marketplace-1440.png` — marketplace remains reachable and renders its heading.

Automated browser observations after the final motion/encoding fix: `overflow=false` at all three landing sizes; FIXTURE CTA present at all sizes; marketplace heading present at `/marketplace`. The final workspace check is **140/140 tests PASS**.

These are local browser/render checks only. They do not establish TESTNET wallet signing, private entitlement, live performance, deployment, or production readiness.

