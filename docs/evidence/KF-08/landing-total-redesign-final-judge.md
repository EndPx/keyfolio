# KF-08 landing total redesign — final judge

**Review date:** 2026-11-10 (Asia/Jakarta)  
**Review mode:** review-only visual and evidence review  
**Decision:** **CHANGES REQUIRED — visual revision is substantially improved, but the named motion evidence is stale and cannot support final acceptance**  
**Overall score:** **7.8/10 (78/100) for the current screenshots; 6.9/10 for the submitted evidence bundle**

This review re-checks the revised landing against the prior judge report, `docs/evidence/KF-08/landing-total-redesign-2026-11-10.md`, the current 1440px and 390px captures in `docs/evidence/KF-08/landing-separation/`, and the requested motion files in `.deploy-local/motion-audit/`. No source files were edited by this review.

## What changed since the prior judge

The current PNGs resolve the main P0/P1 communication problems:

- The hero is visual-first: the access-key/globe artwork is the dominant object, with readable contrast from the first captured frame.
- The customer path is explicit and ordered: **Choose a trader → Compare coverage → Buy access key → Unlock private/API → Copy when eligible**.
- The previous internal labels and sample metrics are gone from the current screenshots: there is no visible `ILLUSTRATIVE SAMPLE`, `NO LIVE TRADER`, `READY`, `GATED`, `RULED`, `COVERAGE LOCKED`, or numeric performance claim.
- The current copy has no visible middot or em-dash separator clutter. The remaining slash in `private/API` is product terminology and does not create the prior punctuation problem.
- The current 390px layout uses larger stacked journey rows and a readable artifact card. It no longer feels like a compressed desktop status rail.
- The opening current capture shows the art at usable contrast. This addresses the prior first-frame loading/blur concern in the current PNG evidence.

The revision is therefore a real improvement over the previous **6.6/10 / REVISE** result. The composition now reads as a product invitation before it reads as an implementation explanation.

## Scorecard

| Criterion | Score | Judge read |
|---|---:|---|
| Visual-first landing hook | 8.5/10 | The large headline and luminous key/globe artifact establish a memorable product world immediately. The art earns attention without needing a dashboard screenshot. |
| Focal 3D/artifact | 8.5/10 | The artwork is distinctive, ownable, and clearly tied to access and account-following. The floating card now carries one short state at a time. |
| Motion from first frame | 7.0/10 | The latest page capture starts in a readable state and the current implementation has state-linked transforms. The specifically named full and reduced WebM files reviewed here are stale pre-cleanup captures, so the evidence set does not prove the revised motion. |
| Luora-inspired dark composition | 8.0/10 | Black field, oversized type, framed artifact stage, rounded panels, restrained blue/green accents, and generous negative space create the requested direction while remaining Keyfolio-owned. |
| Above-fold journey clarity | 8.0/10 | The five-step path is visible in the hero and repeated as a larger process sequence. `Browse traders` is the dominant route, with the demo action secondary. |
| Problem and product clarity | 7.5/10 | A visitor can understand trader comparison, access, private/API, and copy eligibility without decoding internal evidence language. The phrase “access key” is clear; “NFT” is intentionally omitted from the hero, which slightly reduces mechanism specificity. |
| Copy discipline and truth UX | 7.5/10 | The visible copy is concise and avoids invented performance. `Demo mode is simulated.` is a single truthful mode line and is appropriate for the fixture CTA. The footer remains somewhat system-like but is quiet. |
| Desktop 1440 quality | 8.0/10 | Strong hierarchy, focal contrast, spacing, and section rhythm. The process and context sections feel intentional rather than like test output. |
| Mobile 390 quality | 7.8/10 | Premium enough for a judge: headline, art, CTA, journey, and context cards remain legible and ordered. The page is long, but the spacing reads as deliberate pacing rather than the previous dead field. |
| Customer confidence | 7.2/10 | The current screenshots feel like a credible product surface. The stale named WebMs materially lower confidence in the evidence package, not in the revised visual itself. |

## Requirement verdicts

| Requirement | Verdict | Evidence |
|---|---|---|
| Visual-first | **PASS_LOCAL** | Current 1440 and 390 PNGs lead with the artifact and headline, not explanatory prose. |
| Focal 3D/artifact | **PASS_LOCAL** | Key/globe/trader image is the dominant hero object and is repeated as the visual anchor for the journey. |
| Motion visible from first frame | **PARTIAL / evidence mismatch** | Current latest page capture starts readable, but the named `keyfolio-total-redesign.webm` begins with the older dim hero and old copy. The named reduced file also contains the older content. |
| Luora-inspired dark composition | **PASS_LOCAL** | Dark field, rounded framed stage, oversized type, controlled accent palette, and 70/20/10 balance are visible in the current captures. |
| No unnecessary illustrative/fixture/sample/evidence prose | **PASS_LOCAL** | Current screenshots remove the prior evidence taxonomy and sample metrics. One concise fixture-mode status line remains. |
| No middot/en-dash clutter | **PASS_LOCAL** | No middot or em-dash separators are visible in the current 1440/390 captures. |
| Choose trader → compare coverage → buy access key → private/API → copy when eligible | **PASS_LOCAL** | The sequence is legible in the hero chip rail and in the five larger process cards. |
| Premium mobile | **PASS_LOCAL with minor polish** | 390px hierarchy is readable, overflow is absent in the supplied evidence, and the artifact survives the stacked layout. Some body copy and footer labels remain small. |

## Motion evidence finding

The requested named files do not match the current PNG revision:

- `.deploy-local/motion-audit/keyfolio-total-redesign.webm` contains the prior hero copy and status labels, including the old illustrative/sample language and numeric example. Its early hero is also visibly dim before settling.
- `.deploy-local/motion-audit/keyfolio-total-redesign-reduced.webm` likewise contains the prior copy and status taxonomy rather than the current cleaned journey.
- The newer timestamped `page@024e232a226398dceff02956489d94c9.webm` and `page@82f9ac9d374301e7339fb11ad53ed30d.webm` captures align with the current screenshots, but they are not the named files requested by the evidence memo.

This is an evidence-integrity failure: the revised landing may be visually correct, but the declared motion artifacts still show the rejected version. A final judge should not silently substitute unlisted files for the named evidence.

## Remaining issues

1. Re-capture the revised full-motion and reduced-motion videos into the exact declared paths, then verify their first frame and at least one later process state. The replacement files must show the current headline, current journey labels, current artifact states, and no old sample/status copy.
2. Keep the current hero hierarchy. Do not reintroduce the removed evidence labels or numeric sample performance.
3. Optional polish: increase the smallest mobile supporting text slightly and replace the quiet footer taxonomy with a more visitor-facing phrase if the footer is kept in the first review frame.

## Acceptance decision

**The revised visual design passes the requested landing requirements locally, but the KF-08 final evidence package is not accepted yet because the specifically named motion captures are stale.** Once the two named WebMs are replaced with captures of the current revision and the files are rechecked, the screenshot-based design is in the low-to-mid 8/10 range and is suitable for final visual acceptance.

## Evidence boundary

The PNG and WebM review is local browser evidence only. It does not prove TESTNET signing, NFT purchase, private/API entitlement, provider access, assisted-copy execution, or LIVE readiness.

## Coordinator follow-up: named motion evidence replaced

After this review, the coordinator re-ran `node scripts/kf08-landing-capture.mjs` and the reduced-motion variant against the cleaned landing at `http://localhost:3100/`, then copied the newly produced recordings into the exact declared paths. The named files now hash to:

- normal: `B09E9F9B95233868576F6BA148CC1CD3510E1E340126DE5DA5F3B59BF7DE4A23`
- reduced: `AAB82E7AFF9808AF6BFCAF85AD4BE0E4E4F8F78FB43502406B78F3CD961AE6AE`

The 1440px and 390px captures were also rechecked after the same run. The stale-motion evidence blocker is therefore resolved locally. The visual acceptance remains bounded to local FIXTURE/browser evidence; it does not promote wallet signing, NFT purchase, provider access, or LIVE readiness.
