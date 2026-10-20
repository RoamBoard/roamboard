# UX craft tracker

Living implementation status. Research: [original audit](UX_CRAFT_AUDIT.md) and
[reassessment](UX_CRAFT_AUDIT_REFRESH.md). Historical reports and evidence remain unchanged.

| Issue                                        | Status    | Implementation reference         |
| -------------------------------------------- | --------- | -------------------------------- |
| CRAFT-01 — Accented destination navigation   | Completed | [01](CRAFT_IMPLEMENTATION_01.md) |
| REFRESH-01 — Board search state preservation | Completed | [01](CRAFT_IMPLEMENTATION_01.md) |
| CRAFT-04 — Short-mobile introduction         | Completed | [02](CRAFT_IMPLEMENTATION_02.md) |
| CRAFT-05 — Destination scroll ownership      | Completed | [02](CRAFT_IMPLEMENTATION_02.md) |
| CRAFT-02 — Destination typography            | Completed | [03](CRAFT_IMPLEMENTATION_03.md) |
| CRAFT-03 — Gallery composition               | Completed | Implementation 04 below          |

## Implementation 04 — Approved destination fan composition

- **Status:** Completed and visually approved by the user, together with Improvements 01–03.
- **Changed:** destination cards now share one `galleryCover` composition in every selection state:
  the original 6.5cqw left inset, 10cqw title scale, full-card text width and flowing author beneath the title.
  The exposed-area inset/width, smaller background lettering and narrow-screen text hiding were removed.
  Occlusion by the foreground card is intentional. Visibility controls retain the shared cover positioning.
- **Glyphs:** destination cover titles retain two-line truncation with 1.12 line-height instead of 1.0;
  the clamp now has sufficient line-box height for descenders, without added padding. Other card placements
  retain their existing presentation. The selected cover retains its title scale/inset; its author follows
  the final title line rather than a fixed vertical offset.
- **Watermark:** the destination-only `labelOffset` remains 35% in all selection states, including after
  canonical enrichment. Chrome measured about 70% of the final **E** visible against each card's own boundary.
  Overlapping cards and the existing outer stage crop can obscure more of the background covers.
- **Preserved:** selected-only canonical enrichment, permission-gated View/Edit, confirmed save/unsave and
  pending/error state, photo fallback, Details, inner tilt, parent dragging and click suppression, gallery
  arrows/Home/End, focus and announcements. No additional requests or stored-data changes.
- **Validation:** 775/775 frontend tests pass; TypeScript, root format/check, frontend/backend lint and
  production build pass. Chrome inspection covered first/middle/final selections at 1440×900, tablet
  768×1024 and mobile 390×844/320×568. A temporary production-component fixture checked one-line,
  two-line/truncated and repeated `g/p/q/y` titles with flowing authors; descenders render completely.
  The fixture was removed. Tests were updated alongside implementation; independent test review remains
  outstanding. Screenshots are temporary and outside Git; historical audit evidence is unchanged.
- **Scope:** the approved CRAFT-03 correction is in `DestinationStories`; `SpatialGallery` and
  `BoardSelectionGallery` have different geometry and were not changed. Future work must preserve the approved
  physical-cover composition: content is positioned against the full card, and overlap may obscure it.

### Final integration

The latest `origin/main` country-destination work was integrated with a normal merge. Its backend,
country lookup/cache, country-scope URLs, city list/details/navigation, map labels/zoom and Board copy
were retained alongside the Craft readiness serializer and responsive scroll ownership. The approved
gallery presenter is unchanged. Integration verification: 781 frontend tests, 219 backend tests,
both TypeScript checks/builds, root formatting and frontend/backend lint pass. The frontend build ran
in a temporary copy to preserve the running development server. Chrome verified the Sweden country
guide, its city list/map selection and navigation to Stockholm. Existing historical evidence and the
development-only typography review were retained; no new screenshot collection or experimental route remains.

The final PR review exposed a zero-sized heading at 667×375. Short mobile artwork now keeps a 10rem
minimum row and a 3rem minimum heading frame, preventing navigation/attribution collisions while allowing
the information panel to scroll. An unusable measurement retains the readable CSS fallback instead of
applying `font-size: 0`. A lifecycle regression covers fallback/recovery; Chrome checks at 667×375 and
568×320 verify the correction. Portrait/tablet/desktop composition and the approved gallery remain unchanged.

### Reference composition refinements — awaiting visual approval

Reviewed against current `main` (`1d13a84`), preserving its newer Board and profile functionality.
The gallery retains complete-cover typography, flowing authors, visibility controls and the approved
country-code crop. Follow-up review found taller stages cropped the outer edges of neighbouring covers;
the horizontal spread now contracts only when necessary to keep those complete edges inside the stage.
Font sizes and internal positions are unchanged; foreground overlap still naturally obscures content.
Drag progress uses the same constrained spacing, with focused regression coverage.
The closing chapter now uses a horizontal desktop heading and an oversized photograph sweeping
in from the right, with matching light-theme paper layering. Longer headings can wrap and scroll;
mobile attribution flows beneath the supporting copy instead of overlapping it.
Chrome verification covered 1280×600, 1440×900, 1920×1080, tablet and mobile in both themes,
plus a long destination name and keyboard access. Native touch gestures were not directly exercised.
No new screenshot collection or implementation report was added. Implementation 05 has not started.

## Continuation priorities

Follow the refresh audit's remaining order, reassessing each item against current `main` before implementation:

1. **P0:** CRAFT-06/07 profile identity hierarchy; CRAFT-08 tablet editorial layout; CRAFT-09/R-06 functional contrast.
2. **P1:** REFRESH-02 applied filter state; REFRESH-03/R-08 empty states; CRAFT-10/13 truthful controls;
   REFRESH-04 gallery names; R-01 suggestion preview anchoring; CRAFT-11 informational tag styling.
3. **P1, separate review:** CRAFT-12 upstream tag-data provenance/correction; then R-02/03 ordinary control feedback
   and R-05 contextual mention feedback.
4. **P2:** R-04 period underline; ready-destination waiting reduction (original I-09).
5. **P3:** reproduce image recentering before proposing changes; optional photo motion only after separate review.

No subsequent improvement has started. Historical audit recommendations about exposed background titles are
superseded by the approved full-cover composition recorded above.
