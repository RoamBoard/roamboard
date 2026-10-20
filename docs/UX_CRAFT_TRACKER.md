# UX craft tracker

Living implementation status. Research: [original audit](UX_CRAFT_AUDIT.md) and
[reassessment](UX_CRAFT_AUDIT_REFRESH.md). Historical reports and evidence remain unchanged.

| Issue                                        | Status                               | Implementation reference         |
| -------------------------------------------- | ------------------------------------ | -------------------------------- |
| CRAFT-01 — Accented destination navigation   | Completed                            | [01](CRAFT_IMPLEMENTATION_01.md) |
| REFRESH-01 — Board search state preservation | Completed                            | [01](CRAFT_IMPLEMENTATION_01.md) |
| CRAFT-04 — Short-mobile introduction         | Completed                            | [02](CRAFT_IMPLEMENTATION_02.md) |
| CRAFT-05 — Destination scroll ownership      | Completed                            | [02](CRAFT_IMPLEMENTATION_02.md) |
| CRAFT-02 — Destination typography            | Completed                            | [03](CRAFT_IMPLEMENTATION_03.md) |
| CRAFT-03 — Gallery composition               | Implemented — awaiting visual review | Implementation 04 below          |

## Implementation 04 — Destination fan, revised for visual review

- **Status:** Implemented — awaiting visual review. The detached caption strip from the first draft was removed.
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
- **Follow-up:** `SpatialGallery` and `BoardSelectionGallery` have different geometry and were not changed.
  User visual approval remains required before marking CRAFT-03 complete.
