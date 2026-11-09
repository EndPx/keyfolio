# KF-08 landing hero cleanup

Date: 2026-11-10 (Asia/Jakarta)

Classification: `PASS_LOCAL` for the bounded landing visual slice. No commit or push was performed.

## Source changes

- `apps/landing/src/components/LandingClient.tsx` removes the visible hero demo status line, five-chip scenario rail, hero kicker, and duplicate stage labels. The mode message remains in a visually hidden `role="status"` live region. FIXTURE, TESTNET, and LIVE wallet state logic is unchanged, including LIVE fail-closed behavior.
- `apps/landing/src/app/globals.css` adds the shared visually hidden utility and gives the below-fold process cards larger readable type, spacing, and content width. No hero checklist replacement was added.
- `apps/landing/test/landing.test.ts` asserts the hidden status and sparse-hero structure.
- `design/mockups/keyfolio-screens-v1.figcraft` updates editable frames 1032 and 1064: the hero kicker, journey rail, and tiny journey footer are removed; key/globe artwork and artifact card remain visible.

## Evidence

- FigCraft desktop render: `.deploy-local/figcraft-render-clean/desktop.png` (SHA-256 `DF8FE3DA08637E1452CF46B82620CB2E558DFD293F462A948F406062AD3A16C3`).
- FigCraft mobile render: `.deploy-local/figcraft-render-clean/mobile.png` (SHA-256 `0C3B9F725AEBB87611771A149DCF88DC1175E1DD38EDE511DAE8FF08447D4E60`).
- Saved FigCraft: `design/mockups/keyfolio-screens-v1.figcraft` (SHA-256 `71ECED587754DF489F4A0173FECA818E270386517FE1E7C3E546D7AA3314E458`).
- Normal browser video: `.deploy-local/motion-audit-cleanup/keyfolio-landing-cleanup-final.png` and WebM under the same directory.
- Reduced-motion browser video: `.deploy-local/motion-audit-cleanup/keyfolio-landing-cleanup-reduced-final.png` and WebM under the same directory.

The browser evidence script reported `heroScenario: 0`, `visibleStatus: false`, `bannedCopy: false`, `heroImage: true`, and zero horizontal overflow at 375, 390, 768, 1280, and 1440 widths. It also captured normal and reduced-motion runs. The hidden status remains present for assistive technology; banned-copy checks inspect visible hero leaves so the accessible message is not treated as visual copy.

## Validation

- `pnpm --filter @keyfolio/landing typecheck` — PASS.
- `pnpm --filter @keyfolio/landing build` — PASS.
- `node --import tsx --test --test-force-exit apps/landing/test/**/*.test.ts` — 3/3 PASS.
- `node scripts/kf08-landing-evidence.mjs` — PASS for desktop/mobile/reduced captures and widths through 1280; the 1440 overflow check was independently rerun and PASS (`responsive-1440 {"overflow":false}`).
- `node scripts/kf08-landing-capture.mjs` plus `ONLY_REDUCED=1` — PASS, normal and reduced WebM captures written.

Banned-copy/layout checks: no visible `Demo mode is simulated.` or `Demo mode is open.`, no `.hero-scenario` nodes, no visible status box, no replacement arrows/middots/en-dashes/checklist rail, and the framed key/globe artifact is present on desktop and mobile. The full below-fold process still contains the five explanatory steps.

Full workspace `pnpm check` - PASS (156/156 tests) in the shared checkout. The unrelated `apps/web` worker changes remain present and were not edited by this slice. Wallet signing, purchase, private entitlement, provider access, and LIVE readiness remain outside this visual task.


