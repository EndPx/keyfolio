# KF-08 bounded visual patch

Date: 2026-11-09 (Asia/Jakarta)

This patch preserves the KF-D016 dark trading direction and the existing route,
mode-banner, accessibility, and account-following contracts. The token intent is
kept at roughly 70/20/10 across the product surface: dark background/surfaces
carry the majority of the screen, white ink carries hierarchy and controls, and
the accent colors are reserved for semantic states (green/red for P&L; amber for
attention and blocked prerequisites). This is a visual balance guideline, not a
new product rule or a measured runtime ratio.

Verified local changes:

- Added the existing `assets/brand/keyfolio-symbol-v1.png` unchanged at
  `apps/web/public/brand/keyfolio-symbol-v1.png` and rendered it with explicit
  30x30 dimensions, decorative empty alt text, and no layout-shifting intrinsic
  size change.
- Reused the same byte-identical master as `apps/web/src/app/icon.png`, removing
  the browser favicon 404 observed during the first visual pass.
- Defined the previously referenced `--ink38` token and the missing `dot-live`
  status color.
- Removed one verbatim duplicate purchase-gate CSS block.
- Kept the existing mobile top-bar behavior and desktop 232px navigation; no
  route or business-logic files were changed.

Validation evidence is recorded in the task response: `pnpm --filter
@keyfolio/web typecheck` and `pnpm --filter @keyfolio/web build`. The repository
check also passed with **133/133 tests**, and `node scripts/verify-web-modes.mjs`
passed all 8 routes across FIXTURE, valid TESTNET, valid LIVE and invalid config
with no fixture leakage outside FIXTURE.

Visual verification after the patch:

- 16 screenshot renders (8 routes at 1440px and 390px): HTTP 200, zero browser
  errors after the favicon fix, zero horizontal overflow.
- 40 breakpoint checks (8 routes at 375px, 390px, 768px, 1280px and 1440px):
  zero overflow and zero page/console errors.
- Hydrated TESTNET smoke (`scripts/kf08-browser-smoke.mjs`): checkout, keys and
  studio at 1440px/390px plus blocked-RPC recovery; zero overflow, retry state
  visible, no wallet signing invoked.
- Color audit: black/dark canvas and surfaces remain the dominant 89–93% of
  sampled pixels, with semantic accents below 2%; this supports the 70/20/10
  hierarchy as a role-based visual guideline rather than a hard pixel quota.
