# KF-08 Landing Judge Review

**Review type:** blind senior hackathon landing-page judge review  
**Decision:** **REVISE** before demo submission  
**Review date:** 2026-11-10 (Asia/Jakarta)  
**Scope:** `apps/landing`, extracted frames from the three supplied WebM recordings, the Xorr direct-capture PNGs in `docs/evidence/KF-08/`, `DESIGN.md`, and `docs/decisions.md`.

## Judge verdict

Keyfolio has a credible visual direction and a strong focal hero asset, but the landing currently sells the *feeling* of a tracked-performance product before it explains the complete product decision. A judge can see that it is polished, dark, and finance-oriented; they cannot reliably infer in the first five seconds that this is account-following with a wallet-owned access key, private/API entitlement, and optional follower-signed assisted copy. The hero is also held back by a measurable capture defect: the supplied motion recording is blank for roughly the first two seconds and blurred around the third second before the fully readable hero arrives.

This is a **revision blocker**, not a visual-quality failure. The page should be kept and tightened rather than rejected outright.

## Evidence and decoding

All three supplied recordings decoded locally with a temporary FFmpeg binary obtained through `imageio-ffmpeg`; no source files were changed by that setup.

| Recording | SHA-256 | Decoded stream | Duration | Frame observations |
|---|---|---|---:|---|
| `.deploy-local/motion-audit/keyfolio-motion.webm` | `478C9E13199A6AB94300082C51AA51235908AA33966204F7764BF88C5A972297` | VP9, 1440×900, 25 fps | 15.16 s | 0.0–2.0 s extracted frames are blank white; ~3.0 s is blurred hero; ~4.0–7.0 s is readable hero; ~10.0 s is the context section; ~14.0 s returns to the hero in the capture. |
| `.deploy-local/motion-audit/keyfolio-reduced.webm` | `3D236AF5CA12A482916BA0A479F8E334BBF86B220382FB145D2E3BF0358E7AC6` | VP9, 1440×900, 25 fps | 12.00 s | Hero is readable from the earliest usable frame; at ~8.0 s the context cards and the beginning of the permission section are visible; the nonessential hero movement is absent. |
| `.deploy-local/motion-audit/luora-motion.webm` | `D8C7511496F5821BDC14DBD7D654976D274CFBE9C03328FEF2B9A4436378C21C` | VP9, 1440×900, 25 fps | 14.92 s | ~3.0 s is a dark grid transition; ~6.0 s shows the contract graph; ~9.0 s presents the one-click scenario; ~12.0 s presents the CLI evidence section. |

The first extracted frame of Luora is also blank white, so the blank opening may be capture/page-readiness behavior rather than intended page design. It is nevertheless part of the supplied demo evidence and must be treated as a judge-visible risk until eliminated or replaced with a ready-state capture.

No video was undecodable. The shell did not have `ffmpeg`/`ffprobe` preinstalled; the equivalent local decode and frame extraction succeeded with the temporary FFmpeg binary. The requested `docs/DESIGN.md` path does not exist in this checkout; the root `DESIGN.md` was used. No separate screenshot file for the user reference was present beyond the checked-in Xorr captures, so comparison to that context is limited to those captures and the supplied Luora recording.

## Scorecard

Scores are out of 10 for a hackathon judge watching the landing without repository context.

| Criterion | Score | Judge observation |
|---|---:|---|
| First-five-second hook | **5** | The final hero is memorable, but the motion capture spends ~0–2 s blank and ~3 s blurred. The initial headline is poetic and only indirectly says what the product does. |
| Problem clarity | **6** | “See the signal. Keep the keys.” is strong brand copy, but the problem (opaque trader activity and custody anxiety) is not explicit enough above the fold. |
| Curiosity / retention | **7** | The key/globe artwork and floating card create a reason to continue. Retention falls when the page holds the same hero for several seconds without a meaningful state change. |
| Scenario explanation | **4** | The five-step flow exists, but it appears after the hero and context section. The buyer journey is not understood during the first screen. |
| Visual hierarchy | **8** | Clear 70/20/10 composition, strong type scale, one focal card, and good dark/cobalt contrast. The card and artwork compete slightly with the headline on mobile. |
| Focal 3D / illustrative asset | **8** | The generated key/trader/globe artwork is distinctive and ownable. It reads as a product world rather than a generic dashboard screenshot. |
| Motion cadence / meaning | **4** | The hero card/aura loops are attractive but decorative; the supplied capture does not show motion that explains navigation, focus, loading, or data state. The return to the hero around 14 s reads as capture looping rather than narrative closure. |
| CTA / wallet clarity | **6** | There are two clear buttons and a fixture status line. “Preview wallet” in the captured fixture state is less decisive than a judge-facing “Open demo” or “Connect NEAR wallet”; the actual wallet mode is not self-evident from the hero alone. |
| Mobile composition | **6** | The checked-in 390 px capture has no horizontal overflow, readable copy, and a first-viewport CTA. The large image/card occupies most of the next viewport and pushes the scenario below the fold. |
| Reduced-motion fallback | **7** | The reduced capture keeps the hero and copy legible and removes the nonessential animated feel. The fallback still relies on long scroll progression, so the product story is not faster for a motion-sensitive judge. |
| Honesty of sample metrics | **6** | “Illustrative sample” and the footer disclaimer are present. The dominant `+18.42%`, `99.8%`, and `142` still look like a live success claim at a glance, especially in a fast demo. |
| Hackathon judge impact | **6** | Visually above average and memorable, but the product proof and demo path are under-explained. A judge may remember the artwork while misclassifying Keyfolio as a generic trading dashboard. |

**Indicative mean: 6.1/10.** The recommendation is **REVISE**, with the first-five-second readiness and story placement treated as blockers.

## Timestamped review notes

### Keyfolio normal-motion recording

- **0.0–2.0 s:** extracted frames are all-white/blank. This is the largest concrete demo risk. Whether it comes from browser readiness, capture timing, or the page's initial state, the judge experiences an empty opening.
- **~3.0 s:** the navigation is present and the hero copy is visible but heavily blurred. The blur makes the first impression feel like a loading transition without a loading explanation.
- **~4.0 s:** the hero becomes readable. The headline, key/globe artwork, equity ribbon, and tracked card form a strong single composition.
- **~5.0–7.0 s:** the hero remains essentially the same. The card is legible, but the movement shown in the recording does not communicate what is changing in the tracked data or which user action is being demonstrated.
- **~10.0 s:** “Performance is only useful when its context is visible” and the three cards (Coverage, Source health, Tracked performance) appear. This is the clearest explanation of the product's trust proposition, but it arrives too late to repair an ambiguous opening.
- **~11.0–12.0 s:** “Permission follows the decision” and the five-step access flow are visible. This is the missing scenario explanation a judge needs, but the text is small at capture scale and the flow is below the first narrative beat.
- **~13.0 s:** the final “Make the next trade a more informed one” CTA is visible. It is a good close, but the capture then returns to the hero by ~14 s, which weakens the sense of a completed story.

### Reduced-motion recording

- **~2.0–5.0 s:** the full hero is stable and readable. This is better for immediate comprehension than the normal-motion capture because the initial visual is not animated into place.
- **~8.0 s:** the context cards and permission heading are visible. The page remains usable, but reduced motion does not change the information order; it only removes movement.
- The fallback honors the design contract's reduced-motion requirement. It does not yet provide a condensed, faster story for someone who prefers reduced motion.

### Luora comparison

- **~3.0 s:** Luora uses a dark spatial transition before showing the product surface; the transition has a clear visual destination.
- **~6.0 s:** the contract graph is the product, not merely decoration. It answers “what do I get?” through the artifact itself.
- **~9.0 s:** “You can Run a scenario with one click” gives a concrete action and a visible result model. This is a stronger scenario beat than Keyfolio's abstract “See the signal.”
- **~12.0 s:** the CLI section turns the visual into evidence. Luora repeatedly moves from promise to inspectable artifact; Keyfolio currently moves from promise to another explanatory section.

### Xorr comparison

The local Xorr captures establish a high bar for information density and state honesty. The marketplace visibly labels `FIXTURE`, “illustrative sample data,” coverage states, unavailable metrics, and sales-paused conditions. The profile makes period, coverage start, update time, package contents, privacy boundary, and “assisted-copy eligibility” concrete. The checkout shows exact term, price, token, network, storage, and simulated-signing state.

Keyfolio's landing matches Xorr's dark language and rounded containment, and it is visually more distinctive. It does not yet carry the same level of immediate state specificity. The landing card's small disclaimer is technically present, but the visual emphasis is on a positive performance number rather than on the conditions that make that number trustworthy.

## Concrete blockers

1. **Blank/blurred opening in the normal-motion evidence.** A judge can see two empty seconds and one soft-focus second before the product appears.
2. **Product category is under-specified above the fold.** “Account-following with proof” is present as a kicker, but the headline and lede do not explicitly state trader account activity, NFT access, private/API views, or follower-owned signing.
3. **The core scenario is below the hero.** Choose trader → compare coverage → buy access key → unlock private/API → assisted copy is only explicit after scrolling.
4. **Motion does not prove a product action.** Aura breathing, card float, and parallax create polish but do not show tracking, entitlement, or a wallet decision. This conflicts with the design contract's requirement that motion map to navigation, focus, loading, or data state.
5. **Positive sample metrics dominate the honesty label.** `+18.42%`, `99.8%`, and `142` are the first things the eye reads. “Illustrative sample” is small and does not fully counter the implied claim in a fast judge pass.
6. **Fixture CTA language is demo-ambiguous.** “Preview wallet” and “Explore traders” are understandable after reading the status line, but a live hackathon judge needs one obvious action and one obvious environment label.
7. **Mobile makes the artwork the second hero.** The 390 px capture is technically clean, but the card dominates the first scroll and delays the scenario explanation.

## Revision tickets

### KF-08-LJ-01 — Make the first frame ready and readable

**Priority:** blocker  
**Exact change:** Ensure the captured/served first frame renders the final hero immediately. Remove the initial multi-second blank/blur reveal from the landing entry path; keep any reveal below 300 ms and use a dark ready-state placeholder with the headline and CTA already present while `hero-keyfolio.png` decodes. Preload the hero asset and capture only after the first contentful hero frame is present.  
**Acceptance observation:** At 0.0–0.5 s, the judge sees the headline, one CTA, the environment label, and the focal artwork; no all-white frame; no multi-second blur.

### KF-08-LJ-02 — Replace abstract hero copy with a two-line product promise

**Priority:** blocker  
**Exact copy proposal:**

> **Follow a trader's account activity. Keep custody of your funds.**  
> Compare tracked coverage and performance, buy a wallet-owned access key, and unlock private/API views before you choose to copy.

Retain “See the signal. Keep the keys.” as the visual sub-line or section signature after the explicit promise.  
**Acceptance observation:** A cold judge can answer “what is this?” and “who signs?” from the first viewport without scrolling.

### KF-08-LJ-03 — Pull the five-step scenario into the hero

**Priority:** blocker  
**Layout change:** Add a compact four-step rail directly under the hero CTA or as a bottom strip in the hero: `Choose trader → Compare coverage → Buy NFT key → Unlock private/API`. Put `Assisted copy, when eligible` as a final muted note with “your wallet signs.” Keep the detailed five-card section below for the scroll narrative.  
**Motion change:** On scroll into the strip, illuminate one step at a time with opacity/transform only; each transition must correspond to the step entering the viewport.

### KF-08-LJ-04 — Turn motion into product evidence

**Priority:** high  
**Exact motion change:** Replace or supplement the idle card float/aura loop with a short 4–5 s sequence: source-health dot changes from `observing` to `complete`, the coverage label locks to `30D`, then the access-key badge appears and points to `Unlock private/API`. Keep parallax as optional cursor response, but it should not be the only visible motion. Stop the sequence after one pass; do not loop back to the hero in the judge capture.

### KF-08-LJ-05 — Make sample honesty impossible to miss

**Priority:** high  
**Copy/layout change:** Move `ILLUSTRATIVE SAMPLE · NO LIVE TRADER` into the card title row at the same visual weight as “Tracked performance.” Change the main card number to `Example: +18.42%` or pair it with a large `SAMPLE` badge. Keep the calculation/source footnote, but move the positive number one step below the explanatory label. Do not imply that the current page has live trader performance.

### KF-08-LJ-06 — Clarify the demo CTA by environment

**Priority:** high  
**FIXTURE copy:** `Open the demo` (primary) and `Browse traders` (secondary), with a visible `FIXTURE · simulated wallet · no signature` status.  
**TESTNET copy:** `Connect NEAR wallet` (primary) and `Browse traders` (secondary).  
**LIVE behavior:** preserve fail-closed behavior, but explain it in the adjacent status text.  
**Acceptance observation:** A judge knows exactly which click starts the demo and whether a signature or funds are involved.

### KF-08-LJ-07 — Reduce mobile hero dominance

**Priority:** medium  
**Layout change at 375/390 px:** Keep the headline, lede, CTA, and a compact 2–3 line scenario rail in the first viewport. Reduce the hero art/card height by roughly 20–25%; move the large metric card below the first scenario strip or collapse it to a single “sample” preview that expands on tap. Preserve the no-overflow result already shown by the local 390 px evidence.

### KF-08-LJ-08 — Create a judge-capture mode

**Priority:** medium  
**Exact change:** Add a deterministic 12–15 s demo capture path that starts on the ready hero, progresses once through the scenario, and ends on the CTA. It must not depend on a white browser loading frame, an accidental scroll loop, pointer position, or an external wallet. Keep the production page behavior unchanged; this is capture determinism and evidence hygiene.

## Recommended acceptance bar before submission

- Normal-motion capture begins on a fully rendered hero at 0.0–0.5 s.
- The first viewport states account-following, custody boundary, access key, and the next action.
- At least one motion beat demonstrates a product state or decision, not only breathing/glow/float.
- Sample metrics are unmistakably labeled before the eye reaches the number.
- Fixture, TESTNET, and LIVE CTA language is visible and mode-accurate.
- 390 px and reduced-motion captures preserve the same story order, with no horizontal overflow.
- The deterministic judge capture ends on the marketplace/demo CTA without looping back to the hero.

**Final recommendation: REVISE.** The page is visually strong enough to keep, but the current evidence is not ready to present as the primary hackathon landing because the opening readiness defect and the delayed scenario explanation can cost comprehension before a judge reaches the strongest parts.

## Revision pass after judge review (Codex coordinator)

The next implementation pass applied the judge blockers to the production landing:

- first viewport copy now states account-following and custody explicitly;
- CTA is `Open the demo` in FIXTURE, `Connect NEAR wallet` in TESTNET, and
  fail-closed in LIVE;
- a compact first-viewport rail now states `Choose trader → Compare coverage →
  Buy NFT key → Unlock private/API`, with assisted-copy eligibility and wallet
  signing called out;
- the proof card now carries `ILLUSTRATIVE SAMPLE · NO LIVE TRADER` and a visible
  `SAMPLE` badge before the example number;
- the proof card includes a single 4.5-second state sequence: source observing →
  coverage locked → access key/private API unlocked; the sequence does not loop;
- the hero remains fail-open before hydration, and reduced-motion keeps the static
  art/scenario readable;
- mobile uses the compact scenario rail and keeps the hero art/card within the
  viewport without horizontal overflow.

Re-check evidence after the revision: the landing evidence script reports
`marketingNav=true`, `appShell=false`, `cta=1`, `scenario=1`, and `overflow=false`
at 375/390/768/1280/1440px. The full workspace check remains **152/152 tests
PASS**. A new motion recording is required for the final judge pass; the previous
recordings remain retained as before-state evidence.
