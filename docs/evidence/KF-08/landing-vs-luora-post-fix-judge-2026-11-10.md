# Keyfolio vs Luora post-fix judge

**Review date:** 2026-11-10 (Asia/Jakarta)  
**Review mode:** review-only visual comparison after commit `5af3b8b`; no source edits, commit, or push  
**Decision:** **PASS — genuinely comparable to Luora at the landing visual/parity bar, with residual craft differences**  
**Parity score:** **8.5/10**

## Evidence reviewed

- Post-fix production captures:
  - `docs/evidence/KF-08/landing-cleanup/landing-1440.png`
  - `docs/evidence/KF-08/landing-cleanup/landing-390.png`
- Stable post-fix motion captures:
  - `.deploy-local/motion-audit-cleanup/landing-normal.webm`
  - `.deploy-local/motion-audit-cleanup/landing-reduced.webm`
- Editable FigCraft parity renders:
  - `.deploy-local/figcraft-render/landing-parity-desktop-1440.png`
  - `.deploy-local/figcraft-render/landing-parity-mobile-390.png`
- Luora references:
  - `.deploy-local/luorasec-1440.png`
  - `.deploy-local/motion-audit/luora-motion.webm`
- Probe and capture record:
  - `docs/evidence/KF-08/landing-luora-parity-fix-2026-11-10.md`

The current checkout is at `5af3b8b fix(landing): keep Luora scene stages visible`. The post-fix evidence hashes are the hashes recorded in the probe note; the production source itself was not changed by this review.

## Five visible journey states

**Verified: all five states are visibly rendered.** The post-fix probe sampled the calculated journey positions in all three declared modes: 1440 normal motion, 390 normal motion, and 390 reduced motion. At every position it observed a visible stage, artifact, relationship path, and readable state card:

| Step | State shown | Visible copy | Result |
|---:|---|---|---|
| 0 | `trace` | `01 / TRACE` — `Choose a trader` | **PASS**: stage, art, relationship, card visible |
| 1 | `trace` | `02 / TRACE` — `Compare coverage` | **PASS**: stage, art, relationship, card visible |
| 2 | `key` | `03 / ACCESS KEY` — `Buy access key` | **PASS**: stage, art, relationship, card visible |
| 3 | `private` | `04 / PRIVATE API` — `Unlock private/API` | **PASS**: stage, art, relationship, card visible |
| 4 | `eligible` | `05 / COPY ELIGIBLE` — `Copy when eligible` | **PASS**: stage, art, relationship, card visible |

The capture script then recorded the same journey positions with a 1450 ms dwell per position for both stable WebM files. This is materially different from the prior evidence, where the middle of the normal recording collapsed to an almost empty black field and only the first scene could be judged directly.

## Middle black interval

**The middle black playback interval is gone as a failure mode.** The prior failure came from the landing root's vertical `overflow: hidden`, which prevented the sticky stage from remaining viewport-owned after the first beat. The post-fix record states that the root clips only the x axis, and the five-position probes confirm that the stage and its contents remain in the viewport through steps 0–4. The stable normal and reduced captures were regenerated after that fix, with each active position held for 1450 ms.

The full-page PNGs still contain large areas of near-black page background between the hero and the sticky-scene positions. That is expected from a full-document screenshot and is not evidence of a blank interval in the recorded viewport sequence. It should not be confused with the old WebM defect: the post-fix probe checks the actual viewport at each journey position, and all five positions pass.

## Comparison with Luora

Keyfolio now reaches Luora's central visual behavior:

- A dark, quiet canvas creates deliberate negative space.
- The journey is owned by a sticky scene rather than a dense process rail.
- The artifact remains the visual anchor while the state card and relationship path explain what changes.
- The five beats are legible and paced as a single product story.
- Desktop and mobile FigCraft renders preserve the same relationship, stage, and key/globe artwork.
- Reduced motion preserves the scene and state visibility rather than removing the product explanation.

The post-fix composition is therefore genuinely comparable to Luora as a landing experience. It is comparable in scene ownership, pacing, negative-space use, and product-story clarity; it is not a claim of pixel identity or identical scene machinery.

## Remaining differences and deductions from the score

1. **Luora has richer scene recomposition.** Luora's reference visibly changes graph topology, cards, and connections between scenes. Keyfolio keeps one generated key/globe artwork and varies bounded transforms, path treatment, and state-card treatment. The states are now visible and distinct enough to judge, but the visual change is less structural than Luora's.
2. **Production and FigCraft first frames are not perfectly identical.** The FigCraft desktop render shows a large `TRADER ACCOUNT ↔ ACCESS KEY` relationship header above the artwork. The supplied production PNG expresses the same relationship in the hero artwork/card treatment, but its first-frame geometry is not a byte-for-byte reproduction of the FigCraft render. This is a parity polish gap, not a missing journey state.
3. **The PNG set is a full-page evidence view.** It is useful for responsive composition and overflow review, but it cannot by itself prove the five active sticky positions. That proof comes from the post-fix probe and the stable WebM capture procedure.
4. **The ending remains more conventional.** Luora sustains product-graph demonstration deeper into the page; Keyfolio eventually returns to explanatory copy and CTA surfaces. This lowers the craft score without overturning the parity decision.

## Scorecard

| Criterion | Score | Finding |
|---|---:|---|
| Five-state visibility | 9.2/10 | All five declared states pass the rendered viewport probe in normal desktop, normal mobile, and reduced mobile. |
| Sticky-scene reliability | 9.0/10 | The ancestor overflow failure is fixed; stage, art, relationship, and card remain visible at every sampled beat. |
| Middle-interval integrity | 8.8/10 | The old black failure is gone in the regenerated position-based capture; full-page PNG black space is background, not a playback gap. |
| Sparse pacing / negative space | 8.8/10 | Quiet dark field and long scene pacing now serve the product explanation. |
| Relationship map | 8.4/10 | Trader-to-access-key path is clear and product-specific, though less graphically recomposed than Luora. |
| Artifact transitions | 8.0/10 | TRACE, ACCESS KEY, PRIVATE API, and COPY ELIGIBLE are visibly distinct; transitions are bounded rather than new graph compositions. |
| Motion choreography | 8.0/10 | The scroll-led five-beat sequence is reliable; Luora still has more varied entrances and graph handoffs. |
| FigCraft / production parity | 7.8/10 | Both are coherent and readable, but the first-frame geometry is not perfectly identical. |
| Mobile parity | 8.5/10 | The 390 render keeps the relationship, artwork, state card, and five-step story readable. |
| Evidence integrity | 8.4/10 | Stable named WebMs, synchronized PNGs, explicit probes, and hashes are present; PNGs remain full-page rather than per-state stills. |

## Verdict

The post-fix result is **genuinely comparable to Luora** for the intended landing-level visual bar. The decisive change is evidence-backed: all five journey states are visible in the viewport at their sampled positions, and the middle black interval that previously undermined the motion proof is no longer present in the regenerated normal/reduced capture path.

The result should be described as **PASS_LOCAL visual parity**, not as production or live readiness. Wallet signing, access-key purchase, private/API entitlement, provider access, assisted-copy execution, deployment, and LIVE behavior remain outside this verdict.
