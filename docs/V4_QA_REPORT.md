# V4 final migration audit and QA

Stage 3 / Batch 5, 2026-10-19. Read-only audit started from a clean working tree. No variants, identifiers, backend
contracts or schemas were renamed or changed. No dependencies were installed; no Git publishing or branch actions.

## Final usage inventory

Direct imports, `BoardCard` dispatch/configuration, wrappers, hardcoded compact layouts and route reachability were
searched across the repository. Application TSX/JSX lives in `frontend/`; the abandoned backend is not a product UI.

| Location                                                                 | Active presenter / classification                                                                                                                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover RoamFlow                                                        | Existing `RoamFlowGallery` → V4; fictional editorial source, unchanged.                                                                                               |
| Discover This Week's Featured Boards                                     | `FeaturedBoards` → V3; intentional asymmetric exception, unchanged.                                                                                                   |
| Discover vibe/tag results                                                | `DiscoverBoardCard` → V4; labelled fixtures, real tag links, no fake Board/save action.                                                                               |
| Discover country/collection results                                      | Same V4 wrapper in populated branches; current source unavailable, coming-soon UI retained.                                                                           |
| Kyoto, Paris, Copenhagen Board galleries                                 | `DestinationStories` → `BoardCard variant="photo"`; labelled editorial samples.                                                                                       |
| My Boards featured / Recently Created / Archive                          | `SpatialGallery` and `BoardLibrary` → `variant="photo"`; older collage/compact-shaped data is adapted, not rendered as V1/V2. Archive remains explicitly sample data. |
| My Boards saved / own profile saved                                      | `SavedBoardGrid` → `AccountPhotoBoardCard` → V4; existing live saved-list service.                                                                                    |
| Owned published `/boards/mine`                                           | `OwnedBoardCard` → V4 with real owner visibility and sibling View/Edit links.                                                                                         |
| Own/public profile published                                             | `LiveBoardCard` → shared account V4; real summary data, safe unknown public-profile membership.                                                                       |
| Continue / Remix selection presenter                                     | `BoardSelectionGallery` → V4. Continue has real draft/published services; Remix persistence remains unavailable, not a migration regression.                          |
| Recent Drafts / All Drafts                                               | `DraftBoardList` → V4; real list/hydration/restoration services.                                                                                                      |
| Creator Board preview                                                    | `BoardPreviewDiagram` → fixed V4 Cover/Details presentations sharing one derived state.                                                                               |
| `/dev/boards` expanded documents                                         | `BoardDocumentPhotoCard` → V4 using the already-loaded document.                                                                                                      |
| `/dev/board-cards`                                                       | Intentional V1–V4 dispatch and interaction studies; local simulated bookmarks, no persistence.                                                                        |
| `/dev/board-selection`, `/dev/creator-preview`, `/dev/board-collections` | Labelled production-presenter fixtures, intercepted fixture links/actions, unavailable in production.                                                                 |
| `SocialBoardCard`                                                        | Retained V1 adapter with no active importer. Not a migration failure.                                                                                                 |
| `ProfilePrototype`                                                       | Bespoke development-only `/dev/profile`, not live profile cards.                                                                                                      |
| `PublishedBoard`, `DatabasePublishedBoard`, activity/day/photo views     | Full document viewers, not compact cards; retained.                                                                                                                   |
| `PublishedBoardView`, `BoardPreviewForm`                                 | Retained unused older inspector/form, no active route imports.                                                                                                        |
| Vibe/category tiles, destination/collection headers                      | Navigation/editorial imagery, not Board cards.                                                                                                                        |

No unintended V1/V2 rendering was found in active product displays. Only the retained shared dispatcher, unused V1
adapter and development gallery import the old visual components. Variant names/types and older fixture shapes remain.

## Targeted corrections

- Exiting saved rows are inert during their 200 ms removal animation, preventing a second save or navigation after
  confirmed unsave. Before confirmed removal, a focused bookmark moves focus to another available card, or the
  programmatically focusable saved list if none remain. Unfocused removals do not steal focus.
- Destination gallery headings use a slightly smaller bounded scale so Copenhagen fits its laptop column. A word-wrap
  safeguard covers longer future names. The small slide counter stays on one line at narrow widths.
- RoamFlow, V3 Featured and the dual-state preview implementation remain unchanged. No gallery was replaced by a
  conventional grid or new visual copy of V4.

## Browser and functional review

Representative layouts used 1440px desktop, 1280px laptop, 768px tablet and 360px narrow mobile, with light and dark
reviews distributed across the actual pages and shared presenters. This is a targeted matrix, not a claim that every
page/state was exhaustively checked at every width/theme. No physical touchscreen or screen-reader session was available.

| Surface                             | Observed in browser                                                                                                                                                                                               | Verification boundary                                                                                                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discover Featured / RoamFlow        | Preserved asymmetric V3; staggered V4 photography, loaded images, tablet layout, progressive loading to 27 stories and footer controls.                                                                           | Editorial source, not persistent discovery. Pagination, deduplication and cancellation have automated coverage; failure/retry is reviewed in the existing slow-source lab.                                                                       |
| Kyoto / Paris / Copenhagen          | Real route galleries; keyboard selection, arrows, spring rearrangement and horizontal drag; Copenhagen narrow dark layout and accessible controls.                                                                | Samples have no Board document links to invent. Horizontal destination rail is intentional; no global overflow was found.                                                                                                                        |
| My Boards                           | Real failure/sample distinction, featured keyboard/drag selection, independent search, Recent carousel controls, Archive filtering; narrow dark and desktop fan.                                                  | Owned/saved live API data failed. Sample interactions are visual only; real pagination/retries are tested through API helpers.                                                                                                                   |
| Continue                            | Real loading/failure UI; production fixture presenter promotion, keyboard selection, annotation changes, published editing target, denied permissions.                                                            | Actual document restoration/edit authorization awaits DB access; labelled fixture links only report their target.                                                                                                                                |
| Drafts                              | Actual route loading/error; fixture search, load-more, preview retry, draft-only visibility, tablet Recent gallery and missing-cover presentation.                                                                | Requests, hydration limits and real editor URLs are regression tested; fixture pagination is not persisted account verification.                                                                                                                 |
| Creator                             | Actual `/boards/new` title/description/day edits, both preview states updating, title annotation focusing `#board-title`; wide fixed Cover/Details, synchronized fixture cover changes, long-title mobile layout. | No save/publish/upload was performed. Tags/default profile reads fail with the DB connection; rich metadata is separately inspected in labelled fixtures.                                                                                        |
| Saved / owned / profile collections | Actual saved/owned/profile errors; shared populated fixture cards at narrow and desktop widths; filled saved state, all three owner visibility labels, public unknown bookmark disabled, keyboard Edit target.    | Live save/unsave/refill and public/owner account permissions remain unverified. Exiting fixture row was observed with native `inert` while remaining rows stayed active. Focus restoration on a real successful DELETE still needs a live check. |
| Discover results                    | Real Culture tag link/navigation, sample labels, cover/metadata reveal and Escape; all tag links remain outside card overlays. Real collection/country coming-soon states.                                        | No fake persistent identity, Board link, save action, destination or count was added.                                                                                                                                                            |
| Shared V4 / retained gallery        | V1–V4 remain available. Local save/unsave appearance, pending disabled state, error feedback, draft-owner-only indicator, unknown ownership hiding account controls and forced reduced-motion branch reviewed.    | Lab states are explicitly simulated. Actual save request validation/errors/duplicate guards are covered by controlled-response tests. Existing touch handlers have automated coverage, not physical-device validation.                           |

Card-level transitions do not change 4:5 layout geometry; parent springs/carousels keep their own transforms. Long titles
retain clamping and full accessible labels. Missing metadata stays absent, and unavailable images retain the architectural
fallback. Expanded creator details stay locked without requiring hover. Reduced motion preserves control functionality.

## Backend diagnosis and final checks

The API runs, but the configured loopback database port 15432 has no listener. `/health/db` reports unavailable and the
existing setup checker reports ECONNREFUSED outside the sandbox. Origin and Google client-ID consistency checks pass.
Credentials/schema/migrations and live account permissions cannot be assessed behind that connection failure.
See [the four-part backend handoff](V4_BACKEND_HANDOFF.md) for existing capabilities versus actual gaps.

The independent review's 122 focused migration tests pass. The full frontend suite passes **410 tests** (including that focused subset), with zero failures/skips. Frontend TypeScript, root formatting/check, root frontend/backend lint and the production webpack build pass. The installed tests use Node/React SSR and controlled HTTP responses; they do
not mount Motion's browser exit lifecycle. No implementation-mirroring source assertion or new test dependency was added
for the inert fix; the actual exiting DOM was inspected instead.

Frontend changes are suitable for PR review; final checks pass. Live account end-to-end QA remains an explicit
pre-merge verification dependency; public-profile saving and live Discover remain the documented product integration gaps.
