# KF-08 landing FigCraft sync

Date: 2026-11-10 (Asia/Jakarta)

Updated only the editable landing frames in `design/mockups/keyfolio-screens-v1.figcraft`. The application source, dashboard, API, contracts, and `docs/status.md` were not edited for this sync.

## Frames

- `Screen / 00 Landing Luora-inspired 1440` (FigCraft node `1032`)
- `Screen / 00 Landing Luora-inspired mobile 390` (FigCraft node `1064`)

## Render artifacts

- Desktop: `.deploy-local/figcraft-render/landing-desktop-1440.png`
- Mobile: `.deploy-local/figcraft-render/landing-mobile-390.png`

Both PNGs were exported from the saved FigCraft document and visually inspected after the final layout adjustment.

## Exact parity checks

- Dark Luora-inspired canvas and rounded framed artifact stage are present in both frames.
- Existing generated key/globe artwork remains in place: desktop image layer `1046` and mobile image layer `1075`, both retaining the existing FigCraft image asset.
- Headline is exactly `Follow the account.` followed by `Keep the decision yours.`
- Lede is exactly `Compare a trader's tracked account, then unlock the access you choose. Copy stays in your hands.`
- CTA order is exact: primary `Browse traders`; secondary `Open the demo`.
- All five journey steps are readable in both frames, in this exact order: `Choose a trader` -> `Compare coverage` -> `Buy access key` -> `Unlock private/API` -> `Copy when eligible`.
- Artifact copy uses the current first-state implementation language: `A public profile is ready to explore.` and `Keyfolio keeps the next step clear`.
- No illustrative, sample, fixture, or status taxonomy copy is visible in either updated frame.
- No numeric sample performance metrics are present; the only numerals are journey indexes `01` through `05`.
- No middot or em dash is present in the updated frame copy.
- Desktop and mobile renders contain no horizontal overflow within their frame bounds.

Classification: `PASS_LOCAL` for editable FigCraft parity and render inspection. This is a design artifact check only; it does not establish wallet signing, purchase, entitlement, provider access, or live readiness.

## Final desktop art fix (2026-11-10, Asia/Jakarta)

- Saved FigCraft change: desktop layer 1046 (Keyfolio generated hero art) now uses x=800, y=214, width=520, height=294 in desktop frame 1032 (Screen / 00 Landing Luora-inspired 1440). The existing embedded image asset was preserved byte-for-byte; only its desktop bounds changed.
- Stage geometry: 1042 is x=760, y=82, width=600, height=690; the final art bounds are fully inside that stage (x=800..1320, y=214..508) and clear the proof card beginning at y=556. Layer 1046 is visible with scale_mode=fit, opacity 1.0, and no clipping observed in the final export.
- Desktop final render: .deploy-local/figcraft-render/landing-desktop-1440.png, SHA-256 CAC24C0D8BC516E78981CB998A24C428F92E8D91F6D6CA34948D378139023711. Visual inspection shows the key/globe artwork clearly readable inside the framed stage; the stage is no longer visually blank.
- Mobile final render: .deploy-local/figcraft-render/landing-mobile-390.png, SHA-256 6101A08EDF42AC5C65927D29D2C274BEAE0341FC4466DC0F8C30C04DA47430EC. Visual inspection shows the existing mobile artwork and layout unchanged after the desktop-only adjustment.
- Saved design SHA-256: E40F60732224EF6095F799D2E56296A657DA5C01F77AF45F74043B60FB95A293.
- The headline, lede, CTA order, five journey steps, artifact copy, and banned-copy checks remain as recorded above. No app source, dashboard, API, contracts, or docs/status.md changes were made by this review-only fix. No commit or push was performed.

Classification remains PASS_LOCAL: editable FigCraft geometry and local render inspection only; this does not establish wallet signing, purchase, entitlement, provider access, or live readiness.
