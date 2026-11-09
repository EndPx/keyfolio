# KF-08 landing Luora parity evidence fix — 2026-11-10

Classification: `PASS_LOCAL` for the bounded landing visual and capture slice. No commit or push was performed. Scope is limited to `apps/landing`, landing capture/evidence scripts, the editable landing FigCraft frames, and this evidence note.

## Fix delivered

- The sticky scene now remains viewport-owned through the full five-beat section. The previous ancestor `overflow:hidden` prevented `position: sticky` from holding after the first beat; the landing now clips only the x axis and keeps vertical sticky behavior.
- Every active journey state keeps the stage, relationship path, artifact image, and readable state card visible. Reduced motion keeps the same sticky scene and state probes.
- Artifact transitions are intentionally distinct but bounded: TRACE, ACCESS KEY, PRIVATE API, and COPY ELIGIBLE use different path direction/length, orbit rotation/scale, card border state, and state word while keeping the artifact in frame.
- The capture script now calculates five journey positions from the current scene section, dwells 1450ms at each, records stable `landing-normal.webm` and `landing-reduced.webm` names, and writes the synchronized 1440/390 PNG set.
- FigCraft frames `1032` and `1064` retain the first-stage relationship header/art and now use the current `01 / TRACE` state copy; the saved document and fresh parity renders were exported after the source change.

## Visible-state probe

`node scripts/kf08-landing-evidence.mjs` passed at 1440, 390, and 390 reduced motion. At each calculated journey position, the probe observed:

| Step | State | Card | Stage | Art | Relationship | Card |
|---:|---|---|---|---|---|---|
| 0 | `trace` | `01 / TRACE` / Choose a trader | visible | visible | visible | visible |
| 1 | `trace` | `02 / TRACE` / Compare coverage | visible | visible | visible | visible |
| 2 | `key` | `03 / ACCESS KEY` / Buy access key | visible | visible | visible | visible |
| 3 | `private` | `04 / PRIVATE API` / Unlock private/API | visible | visible | visible | visible |
| 4 | `eligible` | `05 / COPY ELIGIBLE` / Copy when eligible | visible | visible | visible | visible |

The same probe also reported no horizontal overflow at widths 375, 390, 768, 1280, and 1440, no app-shell leakage, no visible status region, and no banned hero copy.

## Validation

- `pnpm --filter @keyfolio/landing typecheck` — PASS_LOCAL
- `pnpm --filter @keyfolio/landing build` — PASS_LOCAL
- `node --import tsx --test apps/landing/test/**/*.test.ts` — 4/4 PASS_LOCAL
- `node scripts/kf08-landing-evidence.mjs` — PASS_LOCAL
- `node scripts/kf08-landing-capture.mjs` — PASS_LOCAL; five active journey positions, 1450ms dwell each
- `$env:ONLY_REDUCED='1'; node scripts/kf08-landing-capture.mjs` — PASS_LOCAL; same five active positions in reduced motion
- FigCraft save/export — PASS_LOCAL; frames 1032 and 1064 inspected after export

## Stable artifact hashes

- `docs/evidence/KF-08/landing-cleanup/landing-1440.png` — `084C3BF6C320B8238483D8DA7D2DCEF5DB2549358FAEF879C31DCA421F54EF29`
- `docs/evidence/KF-08/landing-cleanup/landing-390.png` — `7DE965CD380D4A8A1F8A8C79F5F78EC2FEB32DB82AB7CF2C74447FED03D47331`
- `docs/evidence/KF-08/landing-cleanup/landing-390-reduced.png` — `5D14ABBB33486BD3DD2F6990901AEB27CE96D0AAB56EB5EAC51736B3A885486C`
- `.deploy-local/motion-audit-cleanup/landing-normal.webm` — `F69AF500373713F934434A881538DDCB0FA12E0CBD42489DE7F8B38B66E64C8F`
- `.deploy-local/motion-audit-cleanup/landing-reduced.webm` — `E75B62BEE0DEBF7D7B9C55F0A9E82A18135DE91E7E4BC598FD8EDBF860B0A006`
- `.deploy-local/figcraft-render/landing-parity-desktop-1440.png` — `87E9D8E1E50B9797FDA74B08DD22EA739F12A3B8BBD66AEA562691C6047BD880`
- `.deploy-local/figcraft-render/landing-parity-mobile-390.png` — `88BD7B41E01F1E36CC20C30253DD8688C861D520EC8714A5F1260FA58294ADD8`
- `design/mockups/keyfolio-screens-v1.figcraft` — `B2AB29BE5443BDBDC4E580304A009379B01C15DAA99B30A43EB33EF98E03D160`

## Evidence boundary

This is local visual/capture evidence only. It does not establish wallet signing, access-key purchase, private/API entitlement, provider access, assisted-copy execution, deployment, or LIVE readiness.
