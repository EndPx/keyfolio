# KF-08 landing Luora parity pass — 2026-11-10

Classification: `PASS_LOCAL` for the bounded landing visual slice. No commit or push was performed. This note covers only `apps/landing`, the editable landing FigCraft frames, landing captures, and focused landing tests.

## Before / after judge findings

The supplied review `landing-vs-luora-judge-2026-11-10.md` scored the prior landing 6.4/10 because the five-step rail and proof cards made the page dense, motion changed the artifact only by small transforms, and the first visual did not show the trader-account → tracked-path → access-key relationship.

The parity pass changes the composition to a sparse hero plus a five-beat sticky scene stage. The process is no longer the primary dense card list. One active scene owns the viewport while scroll progress changes the shared key/globe artifact, relationship path, orbit, scene card docking, scale and state word. The first visual now includes the relationship map and the explicit `TRADER ACCOUNT ↔ ACCESS KEY` artifact treatment. Context remains as three quiet notes after the scene; unsupported sample metrics and internal evidence prose are absent.

Mobile 390 keeps the same scene order with stacked rhythm and no horizontal overflow. Reduced motion keeps the relationship, scene state, and readable layout while suppressing nonessential animation.

## Source changes

- `apps/landing/src/components/LandingClient.tsx`: five scene model, sticky scene stage, relationship-map cue, shared artifact state and product-specific first visual.
- `apps/landing/src/app/globals.css`: 500vh scene pacing, sticky stage, sparse negative space, large artifact state transitions, responsive 390 layout and reduced-motion fallback.
- `apps/landing/test/landing.test.ts`: focused assertions for scene composition, five-step journey, relationship cue, CTA hierarchy and reduced clutter.
- `design/mockups/keyfolio-screens-v1.figcraft`: editable frames `1032` (`Screen / 00 Landing Luora parity desktop 1440`) and `1064` (`Screen / 00 Landing Luora parity mobile 390`) now show the relationship artifact and five-beat journey text with visible key/globe artwork.

## Evidence

Reference inputs reviewed directly:

- `.deploy-local/luorasec-1440.png`
- `.deploy-local/motion-audit/luora-motion.webm`
- `docs/evidence/KF-08/landing-vs-luora-judge-2026-11-10.md`

Production captures from the updated landing:

- Desktop full page: `docs/evidence/KF-08/landing-cleanup/landing-1440.png` — SHA-256 `E1CC61381C5536E9422165C866FB71DCA3089C24162292EABB9AE8F8E3A828FD`
- Mobile full page: `docs/evidence/KF-08/landing-cleanup/landing-390.png` — SHA-256 `BED9B9FA66A22F44E970C44AE0A18CA9ACC0EBC9D499B748427E94E7C5E79EA3`
- Reduced-motion mobile: `docs/evidence/KF-08/landing-cleanup/landing-390-reduced.png`
- Normal-motion WebM: `.deploy-local/motion-audit-cleanup/page@16b85d75f34404b8305d4bd898c59b90.webm` — SHA-256 `9AC5740776C59A3BFB4F81EAA6DB5D6B785B4DFBBCEA9DDD125CCFB4DDD9B38C`
- Reduced-motion WebM: `.deploy-local/motion-audit-cleanup/page@d1ea3b6e500ec80c5362d59b1ea6b6a1.webm` — SHA-256 `FA9FB24E902B69F6AC66E2A66D8D6C53B847427EFFB606FD1C4D22E104CE2EAF`

FigCraft renders inspected after save:

- `.deploy-local/figcraft-render/landing-parity-desktop-1440.png` — SHA-256 `5C56C543CECB618833F4474A85A914CB268F7ABD7F422E0E3DFE0B01A7C719DE`
- `.deploy-local/figcraft-render/landing-parity-mobile-390.png` — SHA-256 `A9B70F7B5A9CFADF69C218EBDB173C48D8DCDBCDC2FFDFB73A445F3DFCED11B9`

## Validation

- `pnpm --filter @keyfolio/landing typecheck` — PASS_LOCAL
- `pnpm --filter @keyfolio/landing build` — PASS_LOCAL
- `node --import tsx --test apps/landing/test/**/*.test.ts` — 4/4 PASS_LOCAL
- `node scripts/kf08-landing-evidence.mjs` — PASS_LOCAL; overflow false at 375, 390, 768, 1280 and 1440; hero image present; no visible status or banned hero copy
- `node scripts/kf08-landing-capture.mjs` — PASS_LOCAL normal-motion WebM
- `$env:ONLY_REDUCED='1'; node scripts/kf08-landing-capture.mjs` — PASS_LOCAL reduced-motion WebM
- FigCraft `inspect_document` confirmed saved frames 1032 and 1064; exported renders were visually inspected.

## Evidence boundary

This is local visual and interaction evidence only. It does not establish wallet signing, access-key purchase, private/API entitlement, provider access, assisted-copy execution, or LIVE readiness.

- Saved FigCraft document: design/mockups/keyfolio-screens-v1.figcraft — SHA-256 59E2DF121B0105608814F2E376E540AB52FE6C08AAB6F209747A47FCF18225AE

Normal-motion scroll probe at 1440 showed distinct active states: 0.00 Choose a trader / TRACE, 0.38 Compare coverage / TRACE, 0.58 Unlock private/API / PRIVATE, 0.78 Copy when eligible / ELIGIBLE.
