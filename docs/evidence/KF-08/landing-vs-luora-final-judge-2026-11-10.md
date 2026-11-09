# Keyfolio vs Luora final judge

**Review date:** 2026-11-10 (Asia/Jakarta)  
**Review mode:** review-only visual comparison; no source edits, commit, or push  
**Decision:** **CHANGES REQUIRED — materially closer, but not genuinely comparable to Luora yet**  
**Parity score:** **7.3/10**

## Evidence reviewed

- Current Keyfolio captures in `docs/evidence/KF-08/landing-cleanup/`:
  `landing-1440.png`, `landing-390.png`, and `landing-390-reduced.png`.
- Cleanup motion captures in `.deploy-local/motion-audit-cleanup/`, including the
  latest normal recording `page@6b18612b523da93a18e40b6c8825a783.webm` and the
  parity-pass recording `page@16b85d75f34404b8305d4bd898c59b90.webm`.
- Editable FigCraft parity renders:
  `.deploy-local/figcraft-render/landing-parity-desktop-1440.png` and
  `.deploy-local/figcraft-render/landing-parity-mobile-390.png`.
- Luora reference image `.deploy-local/luorasec-1440.png` and motion reference
  `.deploy-local/motion-audit/luora-motion.webm`.
- The parity-pass record `docs/evidence/KF-08/landing-luora-parity-pass-2026-11-10.md`.

## What now reaches Luora quality

The parity pass fixes the largest structural gap from the previous judge. Keyfolio
now has a scene-level sticky stage rather than a normal hero followed by a dense
process list. The desktop FigCraft render clearly shows the relationship treatment
(`TRADER ACCOUNT ↔ ACCESS KEY`), a large framed stage, a shared artifact, and a
five-beat narrative. The mobile FigCraft render preserves that relationship and
keeps the stage legible at 390px.

The current composition also uses real negative space. The black field and the
long scene pacing feel intentionally quiet, and the artifact owns a large portion
of the viewport. The headline, primary CTA, and key/globe image establish a
strong first frame. Rounded surfaces, restrained blue/green accents, and the
single dominant stage are visually close to Luora's language while remaining
Keyfolio-specific.

The relationship map is now product-specific rather than decorative. In the
normal-motion recording's opening state, the trader node and access-key node are
visible in the artwork and the state card explains the account path. This is a
substantial improvement over the earlier symbolic-only hero.

## Normal-motion WebM inspection

I watched the normal-motion WebM as rendered video and checked visible frames at
multiple playback times. The latest file is approximately 18.3 seconds long.

Three visibly distinct page states are present:

1. **Opening hero (~2 seconds):** headline, relationship artwork, CTAs, and the
   framed artifact card are all visible.
2. **Sticky scene (~5 seconds):** the page has moved to `The path stays visible as
   the access changes`; the framed stage is dominant and the active card reads
   `01 / Choose a trader`.
3. **Context/CTA section (~15 seconds):** the scene has given way to `Every number
   carries its context` and the large final `Make the next trade a more informed
   one` CTA.

That satisfies three distinct **page** states, but it does not satisfy the stronger
parity bar of three distinct **artifact** states. At roughly 10 seconds the video
shows almost entirely black space with only a faint step index (`03`); the stage
and artifact are not visibly presenting a usable `Compare coverage`, `Unlock
private/API`, or `Copy when eligible` state. The recording therefore proves the
sticky pacing and the first scene, but it does not visibly prove the claimed
five-state artifact progression.

Luora's motion reference is stronger on this point. Its captured sequence moves
from a dark grid into a populated contract graph and later into a different
four-layer/test graph with changed nodes, cards, and relationships. Each scene is
visibly authored as a new product explanation. Keyfolio's middle recording instead
contains a long empty interval, so the viewer must infer that the scene index
changed.

## Capture consistency finding

The evidence bundle is not internally aligned yet. The FigCraft parity renders
show the explicit relationship header and the five-beat framing. The supplied
`docs/evidence/KF-08/landing-cleanup/landing-1440.png` and `landing-390.png`
captures show the sparse hero and staged artwork, but do not visibly show the same
relationship header in the first stage and read closer to the earlier cleanup
capture. The normal WebM does contain the relationship treatment in its opening
frame. A judge can therefore see the intended parity in the editable renders and
video, but cannot treat the PNG set as a synchronized production snapshot of that
same state.

## Scorecard

| Criterion | Score | Finding |
|---|---:|---|
| Scene-level sticky stage | 8.5/10 | Clear viewport-owned scene and large staged artifact; the first active scene is convincing. |
| Sparse negative space | 8.3/10 | The page now allows long, intentional pauses and has much closer Luora pacing. |
| Relationship map | 8.0/10 | Trader/account and access-key relationship is explicit in the FigCraft render and normal WebM hero. |
| Artifact transitions | 5.8/10 | The first state and later page sections are visible, but the middle artifact states are not visibly rendered in the normal WebM. |
| Motion choreography | 6.4/10 | Scroll-led scene ownership is present, but Luora has more reliable object entrances, handoffs, and changed graph compositions. |
| Composition and surface language | 8.0/10 | Dark field, rounded stage, restrained glow, and type hierarchy are closely aligned while retaining Keyfolio identity. |
| Mobile parity | 7.6/10 | FigCraft mobile is clean and readable; the supplied production mobile capture is older-looking and does not prove the same relationship treatment. |
| Evidence integrity | 5.8/10 | PNGs, FigCraft renders, and WebM are not one synchronized capture set; the WebM has a blank middle interval. |

## Exact remaining differences

1. **Luora changes the product scene itself.** Its graph nodes, cards, and
   connections visibly recompose between scenes. Keyfolio mostly keeps one raster
   key/globe image and changes the surrounding card/position treatment; the
   intermediate states are not visible in the declared WebM.
2. **Keyfolio's declared normal-motion evidence has an unusable middle.** The
   `03` interval is nearly black, so a viewer cannot see what the artifact is doing
   at that point or verify the five-beat progression without source knowledge.
3. **The capture bundle is stale or mixed.** The current FigCraft parity render and
   opening WebM hero include the explicit relationship map, while the supplied
   landing PNGs do not show the same first-stage treatment.
4. **Luora's sparse space is functional staging.** Luora uses the empty field to
   reveal a new graph scene. Keyfolio now has comparable emptiness, but part of it
   currently reads as an absent or unrendered scene rather than a deliberate reveal.
5. **The page remains more explanatory at the end.** The context cards and large
   final CTA are polished, but they are conventional landing sections rather than
   Luora's continued product-graph demonstration.

## Final decision

Keyfolio is now a strong, Luora-informed landing with a credible sticky-stage
direction. The parity pass closes the previous structural criticism: sparse pacing,
relationship framing, and a scene-owned artifact are all present. It is **not yet
genuinely comparable to Luora** because the normal-motion evidence does not show
three distinct artifact states and the PNG evidence is not synchronized with the
FigCraft parity render.

For a genuine parity claim, re-record the declared normal-motion WebM and the 1440px
and 390px PNGs from the same current build, then make at least three artifact
states visibly distinct in playback: the relationship/trace state, a coverage or
access-key transition, and a private/API or copy-eligible state. The middle scene
must remain visibly occupied by the stage rather than collapsing to an index on a
black field.

This is local visual evidence only. It does not establish wallet signing,
access-key purchase, private/API entitlement, provider access, assisted-copy
execution, or LIVE readiness.
