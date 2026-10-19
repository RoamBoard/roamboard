# Issue #90: Board gallery refinements

## Implemented

- Shared V4 Details show persisted activity totals beside days, with valid per-Board saves on a separate line.
  `toPhotoBoardCard` counts canonical `days[].activities` from documents the parent already loaded. Photos and empty
  days never add activities. Missing counts stay absent; valid zero activities/saves remain meaningful.
- Existing hover, keyboard focus, disclosure, touch preview, save controls and reduced-motion branches remain shared.
  Cover presentation, V3 Featured, RoamFlow and creator preview data sources are unchanged.
- Spatial Gallery, destination stories and Board Library use larger, centered arrow glyphs within their existing
  44px targets. Carousel disabled states, pagination, dragging, wheel and keyboard handlers are unchanged.
- Continue has larger annotation labels/values, canonical Public/Friends/Restricted access visibility, and owner-only
  draft wording. Optional saves have their own “Saved by travelers” group. The connector line is removed.
- Continue navigation is centered beneath the right-hand deck on desktop; Continue Board remains a separate footer
  action. Mobile centers controls below the selected card and retains the two-column annotation layout.
  Spring rearrangement, tilt, collection promotion and fresh-document edit permission checks remain intact.

## Backend metadata limitations

No backend or database changes, new response fields, dependencies or per-card requests were introduced.
Canonical Board documents and owned, saved, profile and destination summaries currently lack per-Board save totals.
The existing presentation `savedCount` supports valid totals, but adapters intentionally do not manufacture them.
Account aggregate totals and search `popularity` are not substitutes.

Destination summaries expose up to six activity titles, not a complete activity count. Those titles and cover images
must not be counted. Summary-only saved/profile/owned cards also omit unavailable itinerary totals. A future backend
capability should supply trustworthy full activity and per-Board save totals in relevant summaries/documents; field
names and response changes still require team agreement. Existing document hydration continues to provide accurate
activity totals where already available.

## Verification

- Root formatting, format check, frontend/backend lint and frontend TypeScript passed. All 557 frontend tests passed.
- Production `pnpm build` failed in Turbopack because the environment denied a compiler port bind (`EPERM`),
  including the elevated retry. The fallback `pnpm --dir frontend build --webpack` passed, including TypeScript, static page generation and build traces.
- Independent regression tests cover persisted activity counts with empty days and unrelated photos, unavailable
  summary counts, invalid/fractional/negative totals, valid zero saves, singular/plural labels, canonical visibility
  overriding stale presentation data, owner-only drafts and separate save-count annotations.
- Chrome: Continue fixtures reviewed at desktop and 390×844 in light and dark themes; selected metadata, arrows,
  keyboard selection, Details disclosure and Escape verified. My Boards sample library reviewed on mobile;
  arrow navigation, dragging and keyboard navigation exercised. Desktop library disables arrows when cards fit.
- Browser data was explicitly labelled development fixtures/sample collections. The backend was unavailable, so
  live account persistence, real Board permissions and destination-provider integration were not verified.
  Touch hardware, wheel gestures, OS reduced-motion emulation and exhaustive animation timing were not verified
  manually; the V4 lab’s forced reduced-motion disclosure and separate sample saves line were checked in Chrome.
  Existing automated interaction tests and unchanged handlers provide additional regression coverage.

## Proposed collection reuse — approval required before implementation

| Location                       | Recommendation and behavior to preserve                                                                                                                                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile: My Boards             | Board Library fits the existing published Board collection. Preserve real View links, owner visibility, public-profile restrictions, empty/error states and the existing three-item preview/view-all scope.                                                                                                     |
| Profile: Currently Inspired By | Board Library fits the owner's real saved Board preview, provided it accepts account-aware cards. Preserve confirmed unsaving, focus after removal, refresh after offset shifts, account aggregate updates and loading/retry/sign-in states. Do not expose the owner's saved list to public viewers.            |
| Discover: collections          | Board Library fits future Board results, but the live source is currently unavailable and the page shows a coming-soon state. Preserve tag-set matching, editorial header/back navigation, attribution and empty/unavailable distinctions. Agree live data, pagination and save eligibility before integration. |
| Discover: vibes                | Board Library fits the current tag-filtered V4 sample cards. Preserve active tag navigation outside the card, sample disclosure, no fabricated Board URLs or saving, and empty states. A live source remains a separate integration decision.                                                                   |

The present Board Library accepts `GalleryBoard` and renders plain V4 cards. Reusing its interaction pattern should
allow the existing account-aware/tag-navigation presenters instead of discarding those behaviors or coercing all
sources into sample collage data. No broader profile/Discover layout replacement was implemented.
