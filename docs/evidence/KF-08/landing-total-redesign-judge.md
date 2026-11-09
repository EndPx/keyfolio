# KF-08 landing total redesign — blind visual judge

**Review date:** 2026-11-10  
**Review mode:** review-only, blind senior product/landing judge  
**Verdict:** **REVISE BEFORE ACCEPTANCE**  
**Overall score:** **6.6/10 (66/100)**

This verdict is based on the current `apps/landing` source, `docs/evidence/KF-08/landing-total-redesign-2026-11-10.md`, the checked 1440 and 390 captures under `docs/evidence/KF-08/landing-separation/`, the final motion capture `.deploy-local/motion-audit/keyfolio-total-redesign.webm`, and the matching final PNG. The local build and responsive evidence establish that the page renders and avoids horizontal overflow; they do not make the visual story or copy hierarchy accepted.

## Scorecard

| Criterion | Score | Judge read |
|---|---:|---|
| First-viewport hook | 7.5/10 | “Follow the account. Keep the decision yours.” is memorable and the left/right split lands immediately. The supporting paragraph is still too long for a first read and the opening UI begins to feel like product documentation. |
| Problem clarity | 6.5/10 | Account-following, tracked coverage, private/API access, and follower signing are present. The actual buyer problem is diluted by implementation vocabulary before the visitor has chosen a trader. |
| Focal 3D/artifact | 8.0/10 | The key/globe/trader visual is distinctive, ownable, and much stronger than a generic dashboard screenshot. It gives the page a reason to continue. The overlaid artifact card currently competes with the art through too many labels and metrics. |
| Motion as story | 6.0/10 | The recording has a readable hero, then a scroll-led process sequence and evidence modules. The motion changes page position and active process state, but the focal artifact does not visibly transform through the product journey; the opening art also begins dim/soft before settling. Motion supports the story, but does not yet carry it. |
| Luora-inspired composition | 7.5/10 | The 70/20/10 balance, oversized type, dark field, rounded framed artifact, and controlled blue/green accent create a coherent Luora-adjacent composition. Keyfolio’s own artwork keeps it from reading as a copy, though the structure is still recognizably reference-derived. |
| Above-fold journey clarity | 5.5/10 | The intended sequence is technically present, but “choose trader” is only implied by `Browse traders`, “buy NFT key” is buried in the lede, and the five-step rail compresses compare, purchase, entitlement, and copy into tiny status-like text. A visitor can understand the promise without understanding the next action. |
| Copy and truth UX | 4.5/10 | The page is honest about fixture/sample status, but honesty is expressed as internal evidence prose: `ILLUSTRATIVE SAMPLE · NO LIVE TRADER`, `FIXTURE / READY`, `FIXTURE preview — simulated state only`, `ACCESS KEY READY / PRIVATE API GATED`, and `READY / GATED / RULED`. This directly conflicts with the latest feedback to remove explanatory clutter. |
| 1440 visual quality | 7.0/10 | Strong hierarchy, focal contrast, and spacing in the supplied 1440 capture. The hero is premium at a glance. The scenario rail, wallet-state line, artifact eyebrow, state row, and example metric stack create too many small reading tasks below the headline. |
| 390 mobile quality | 6.5/10 | The order is sensible and there is no horizontal overflow. The headline and key visual survive the width. The rail and artifact card become tiny, high-density text blocks; the relationship between trader, key, private/API, and copy is harder to scan than on desktop. The large empty lower field makes the capture feel unfinished rather than intentionally paced. |
| Product confidence / premium feel | 6.5/10 | The art and typography create a credible premium shell. The visible fixture language, status taxonomy, and sample performance figure make the page feel like a test harness at the exact point where it should feel like a product invitation. |

## Direct answers to the requested questions

### Does the focal 3D/artifact carry the story visually?

**Partly.** The generated access-key relationship is the strongest asset on the page and communicates “a key unlocks a relationship” faster than the prose does. It is visually distinctive and keeps the product world ownable. It does not yet carry the full story because the image remains a largely static illustration while the page later explains state transitions in separate text cards. The artifact card also asks the visitor to decode a sample return, coverage duration, source health, key readiness, and API gating at once. Reduce the card to one clear state transition or let the visual itself change between observation, coverage, access, and copy eligibility.

### Is the Luora-inspired composition distinctive enough?

**Yes, with a qualification.** The dark field, oversized two-line headline, framed focal panel, restrained accent color, and large-radius surfaces form a strong composition. The Keyfolio artwork and account-following wording make it recognizable as Keyfolio. The composition will feel more distinctive after the internal status copy is removed; currently the labels make the page resemble a polished demo instrument panel rather than a confident product landing.

### Is “choose trader → compare coverage → buy NFT key → private/API → assisted copy” clear above the fold?

**No, not clearly enough for a landing judge.** The current hero contains all five ideas in the lede and compressed rail, but the visual order is not actionable:

- **Choose trader:** only implied by `Browse traders`.
- **Compare coverage:** stated in body copy, absent as a visible comparison action or object.
- **Buy NFT key:** described as “use a wallet-owned NFT key,” which reads as mechanism language rather than the next customer action.
- **Private/API:** visible, but as a gate/status phrase.
- **Assisted copy:** present as a long eligibility caveat rather than a later capability.

The hero should show a short, human-readable four- or five-step path with one dominant next action. The current rail is legible only after zooming and reads like an internal checklist.

### Does mobile remain premium?

**Mostly, but it drops one tier.** The 390 capture preserves the headline, CTA, artifact, and section ordering and passes the recorded overflow check. At phone width, the scenario rail and artifact metadata are too small and too compressed to feel premium. The tiny fixture/status rows compete with the artwork, and the proof section begins with another set of labels before the visitor has fully understood the first action. The mobile layout needs fewer words and larger state objects, not a scaled-down desktop explanation.

### What does the motion recording prove?

The recording is useful local visual evidence, not product-flow proof. It shows:

- a visible hero at the start rather than a blank hydration frame;
- a readable transition into the process section around the middle of the 17-second capture;
- an active process card and later evidence modules;
- coherent transform/opacity-style entrance behavior.

It also shows the remaining weakness: the art begins dim/soft and settles into place, then the recording mostly demonstrates scroll position and active-row changes. The focal key does not visibly move from observed account to verified coverage to unlocked access to eligible copy. That makes the motion feel like a guided page tour rather than a visual explanation of the product.

## P0 revisions — required before acceptance

1. **Remove internal evidence labels from the hero surface.** Delete or replace the visible `ILLUSTRATIVE SAMPLE · NO LIVE TRADER`, `FIXTURE / READY`, `FIXTURE preview — simulated state only`, `ACCESS KEY READY / PRIVATE API GATED`, and example performance line. The latest feedback explicitly asks for no illustrative, fixture, sample, middot, en-dash, or internal status prose. Preserve truth by removing unsupported numbers and using one concise environment/state affordance in the CTA or header; do not move the same paragraph into a smaller font.
2. **Make the first action and journey explicit.** Put “Choose a trader” or “Browse traders” in the primary narrative, then show `Compare coverage` → `Buy access key` → `Unlock private/API` → `Copy when eligible` as four or five large, plain-language steps. The hero must communicate the sequence without requiring the visitor to parse the lede plus a tiny rail.
3. **Stop presenting internal state vocabulary as customer copy.** Replace `READY`, `GATED`, `RULED`, `source health readable`, and `coverage locked` with concise visual states or plain-language outcomes. State must remain truthful, but it should read as product behavior rather than verifier output.
4. **Remove or neutralize unsupported sample metrics.** `+18.42%` and `142 settled swaps` are visually prominent enough to be read as a trader claim. Either omit metrics from this landing hero or show a non-numeric structural example whose status is self-evident without a disclaimer block.

## P1 revisions — next pass

1. **Give the artifact one job per state.** Use the same focal object to show a small, legible progression: observed account, coverage comparison, access key, private/API unlocked, copy available only after a fresh signed action. The motion should change the object/card relationship, not only scroll the page.
2. **Shorten the hero lede.** Keep the promise to one or two sentences. Move trusted execution time, entitlement, and follower-signature detail into the process section or an expandable “How it stays safe” explanation.
3. **Increase mobile state scale.** On 390px, make the journey a stacked set of large chips/cards with one phrase each. Remove the tiny subline under the rail and reduce the number of simultaneous labels inside the artifact card.
4. **Make `Browse traders` the obvious first route.** The current `Open the demo` CTA is appropriate for fixture evidence but is not the strongest product story. Keep mode behavior accurate while making the customer route visually primary and the demo state quiet.
5. **Tighten the motion opening.** Start with the artifact at readable contrast, then use a short settle or state transition. Avoid a dim/soft first frame that can read as a loading failure in a judge’s first second.

## P2 refinements

1. Remove punctuation separators in display rails and footer copy where they read as system notation; use spacing, line breaks, or simple labels.
2. Reduce the number of eyebrow labels and reserve accent green for a meaningful eligibility or positive-performance state.
3. Rebalance the mobile vertical rhythm so the next section arrives sooner after the hero without creating a dead black field.
4. Keep the footer and proof-module copy, but make it quieter than the primary journey and remove repeated “evidence” framing from the visitor path.

## Acceptance decision

**Not accepted as the final landing redesign.** The visual foundation is credible and the focal artwork is a real strength. The blocker is communication discipline: the page currently solves truth by exposing internal evidence language, while the latest feedback requires concise UX and visual states. After the P0 copy/state cleanup and a clearer above-fold journey, this could move into the 8/10 range without changing the core art direction.

## Evidence boundary

- `landing-1440.png` and `landing-390.png` are the decisive production captures for this review.
- `.deploy-local/motion-audit/keyfolio-total-redesign.webm` is local browser motion evidence only.
- The evidence does not prove wallet signing, NFT purchase, private/API entitlement, provider access, assisted-copy execution, or LIVE readiness.
