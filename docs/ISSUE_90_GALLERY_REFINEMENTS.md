# Issue #90: focused Board gallery refinements

## Current-main audit

This work starts from `75fe7f2` on `board-issue-fix`, matching local `main` and `origin/main` at inspection.
The working tree was clean. The old `ui-ux-enhancements` branch at `3f9642f` was inspected with `git show` and
`git diff`; no branch switch, cherry-pick, commit, push or merge was performed.

The following requirements were already implemented on current main and were preserved:

| Requirement                             | Existing implementation                                                                                                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accurate V4 days and activity totals    | `toPhotoBoardCard` derives activities from persisted `days[].activities`, independent of photos and empty days. Shared V4 Details displays them alongside days.                                                                                            |
| Real Board save totals                  | Canonical `BoardDocument.savedCount` is already supplied by the backend and forwarded by the adapter. V4 and Continue validate nonnegative safe integers, retain valid zero and omit unavailable counts. Continue uses the newer “Saves received” wording. |
| Larger Spatial/Library arrows           | Existing 24px glyphs remain centered within 44px targets. Disabled states, keyboard behavior and current placement are retained.                                                                                                                           |
| Larger Continue metadata and visibility | Selected annotations already show publication, canonical Public/Friends/Restricted access, last update, destination, itinerary and separate saves. Drafts remain owner-only.                                                                               |
| Connector removal                       | The unnecessary annotation connector is already absent.                                                                                                                                                                                                    |
| Newer Continue behavior                 | The Published/Drafts view, compact responsive layout, spring rearrangement, tilt, selection restoration and permission-gated selected-card editor links from main are retained. The retired footer Continue link is not restored.                          |

## Implemented in this branch

- Continue's previous/next buttons and counter are now centered beneath the right-hand deck on desktop and beneath
  the selected card on mobile. The existing compact stage CSS is unchanged. Unavailable-access text precedes the
  control group in the DOM; no CSS reordering reverses keyboard focus order.
- Board Library now exposes `BoardLibraryCarousel` and `BoardLibrarySlide`. They share the existing Embla arrows,
  drag/swipe, horizontal wheel, keyboard, progress, reduced-motion and optional progressive-loading behavior.
  The default My Boards and embedded map presenters retain their existing layouts and map-highlight callbacks.
- Profile My Boards and visitor/friend collections reuse that shell through `LiveBoardLibrary`, retaining the actual
  account-aware V4 cards, real Board links, owner visibility, backend-filtered access and unknown visitor membership.
  Existing collection limits, View All, loading/errors and empty states remain unchanged.
- Currently Inspired By opts into a library presentation of `SavedBoardGrid`. Other saved grids remain grids.
  Confirmed unsaving, inert exiting rows, focus transfer, the focusable empty list, page-one refresh after removal,
  stale-offset protection, sign-in/retry states and account-total callbacks use the existing implementations.
- Vibes uses `DiscoverBoardLibrary` around the existing sample presenter. It retains tag filtering, active tag links,
  disclosures and empty states. No sample Board links, account saving, persisted counts or fake live results are added.
- Profile cards use compact photographic areas (248px on desktop); Discover uses larger areas (320px), more space
  and a visible editorial heading. Both expose the next card on small screens and keep 44px arrow targets.
- The existing development-only Board collection harness now reviews these production presenters. Fixture links
  and account mutations remain intercepted. This is unrelated to the abandoned Experience Lab.

## Old-branch reuse and exclusions

The narrowly reviewed collection-carousel implementation, saved-list opt-in, Vibes adapter and semantic list support
were reused from `ui-ux-enhancements`. Profile changes were applied selectively to current files, preserving newer
main functionality rather than copying old profile files. Continue navigation was adapted directly to current main's
compact layout and direct card-editor navigation. Relevant regression tests were independently reviewed and adapted.

No Experience Lab route, component, fixture, transition, stylesheet, test or architecture was carried forward.
RoamFlow, Discover Featured V3, the shared V4 card/metadata implementation, Creator Preview, backend code/contracts,
API helpers, account stores and unrelated welcome/friends/map/editor work remain untouched.

## Data limits and Discover Collections

The old handoff's statement that canonical Board documents lack save totals is obsolete. Main now supplies real
`savedCount`; this branch preserves that integration. Summary-only saved/profile/destination responses still omit
some optional itinerary/save metadata. Missing values remain absent; account aggregates and search `popularity`
are not used as Board save counts. No full-document reads are added just for optional card metadata.

Destination summaries include at most six activity titles, which cannot establish a full activity count. Decorative
photographs and empty days never add to activity totals. The existing creator preview is not changed to infer counts.

Discover Collections retains its actual unavailable/coming-soon branch; its live Board source remains unconnected.
When authorized results exist under an agreed source, its populated branch can use the shared carousel with real
account-aware card presenters, Board IDs/links, tag matching, attribution and actual pagination/error states.
The sample-only `DiscoverBoardLibrary` must not silently stand in for a live source. No new backend contract is proposed.

## Verification on this branch

- All 658 frontend tests passed, including independently adapted collection-reuse regressions and new Continue
  compact/noncompact control wrapping, accessible grouping/order and editor-link assertions. Existing tests cover canonical save
  counts, missing metadata, account mutations, authorization, confirmed removal and stale pagination responses.
- `pnpm --dir frontend build --webpack` passed with TypeScript, static generation and build traces. The initial
  standalone TypeScript check found stale generated Experience Lab route references from the old workspace;
  the production build regenerated current routes, and the subsequent standalone TypeScript check passed.
- Root formatting/check and frontend/backend lint are run after final edits; results are reported in the handoff.
- Chrome review uses current production presenters in the pre-existing labelled fixture harnesses plus actual Vibe
  routes. Desktop/mobile, both themes, Continue selection and keyboard navigation, right-deck control alignment,
  preserved editor URLs, denied editing, carousel navigation/dragging and accessible Details are checked.
- Initial browser verification used fixtures while the backend was stopped. A subsequent live-backend pass on
  2026-10-19 confirmed authorized profile reads, real Board links, canonical activity/save metadata and persisted
  save/unsave behavior. Details are recorded below. Physical touchscreen gestures, OS reduced-motion emulation and
  exhaustive animation timing remain manual QA limits.

## Live-backend follow-up

- The signed-in profile initially had zero published Boards and zero saved Boards. Both genuine empty states were
  retained. An authorized visitor profile returned two real Boards, with unknown-membership save controls disabled.
- The existing profile-map library hydrated those Boards through the canonical API and displayed actual metadata:
  two days/nine activities/zero saves on one Board, and two days/six activities/one save on the other. The respective
  published viewers exposed nine and six activity controls, independently matching the card totals.
- Saving both Boards from their real viewers produced two genuine Currently Inspired By cards after a profile
  reload, with confirmed membership, original Board URLs and a profile saved total of two.
- Keyboard unsaving the first card transferred focus to the remaining bookmark and updated the profile total to one.
  A reload confirmed that removal persisted. Keyboard unsaving the last card focused the persistent empty Saved
  Boards list and updated the total to zero. Another reload confirmed the original zero-saved state was restored.
  Fresh canonical cards again showed the original per-Board save totals (zero and one).
- The live visitor-profile and hydrated map carousels navigated on mobile, and pointer dragging did not activate
  the underlying Board link. Keyboard navigation and focused V4 Details remained available.
- Live mobile review exposed cramped View All links beside profile collection descriptions. The two collection
  headers now reserve a non-wrapping 44px-high link target, add a gap and allow descriptions to wrap naturally.
  This follow-up changes only those profile collection headers; account/store/backend behavior is unchanged.
- The current account has no owned published Boards or drafts. Both live Continue filters returned their genuine
  empty states. Populated owner visibility and editor-link permission combinations still rely on the existing
  labelled harness and regression tests. No fake persisted Boards were created for QA.

The code is ready for a focused review of Issue #90. Live Discover Collections is the existing data-source limitation,
not replaced with fixtures. No unrelated UI/UX experiment is part of the proposed diff.
