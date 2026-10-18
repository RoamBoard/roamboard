# V4 frontend–backend handoff

Stages 2 and 3 Batches 1–4 — shared enhancement and gallery adoption. Updated 2026-10-19.
No backend contracts, endpoints or schemas changed. Batch 4 awaits review; Batch 5 has not begun.

## Already implemented and connected

- V4 account saving uses existing `PUT/DELETE /api/v1/boards/{boardId}/save` through `saveBoardBookmark` and
  `unsaveBoardBookmark`. `AccountPhotoBoardCard` shares the local save integration across summaries and the document adapter.
  `BoardDocumentPhotoCard` reuses an already-loaded document, accepts `savedByMe`, prevents duplicate requests, retains state on failure,
  and offers `/login` after 401. The server still enforces session, Origin, ownership and access.
- `toPhotoBoardCard` consumes canonical title, author, selected cover, confirmed locations, tags, days, status and
  visibility. Protected images retain direct API delivery; external photo fallback retains credits. No count is fabricated.
- Management permission identifies the owner; content-edit permission does not. Draft visibility is always owner-only.
- My Boards featured and Recently Created V4 cards reuse documents already loaded through the authenticated
  owner-published list (`GET /api/v1/boards?scope=published` and existing Board reads). Explicit owner-list context
  supplies ownership; document status/visibility supplies the indicator. No author-name inference or extra requests.
- Batch 1 preserves existing loading, partial-failure retries, search and pagination. Destination stories and Archive
  remain labelled editorial samples with no persistence, account controls, invented Board links or save counts.
  No new blocking backend capability was encountered in this batch.

- Batch 2 Continue and Draft selection use the same canonical V4 adapter. Existing draft/published owner-list
  endpoints, first-five preview reads, separate pagination and targeted retries remain unchanged. Continue editor
  links still require a fresh document's `canEditContent`; drafts retain `/boards/drafts/{id}` and published edits
  `/boards/{id}/edit`. No extra per-card requests or backend writes were added.

- Batch 3 migrated the creator preview, including its fixed Cover View / Details View composition. It reuses local
  creator data and existing cover selection; the preview does not save independently.
- Batch 4 migrates saved Boards on My Boards and own profiles, `/boards/mine`, own/public profile published Boards,
  and Discover result presenters. All use the same V4 visual component. `/boards/mine` retains separate View/Edit links.
- Saved lists use `GET /api/v1/users/me/saved-boards` with existing page/limit parameters. Membership initializes a
  filled bookmark. The endpoint excludes caller-owned Boards, providing reliable other-owner context. Only a confirmed
  DELETE removes a card; failures retain it with feedback. A short exit transition respects reduced motion.
- `saved-boards-store` is page-local, not a global cache. A confirmed removal disables stale load-more offsets and
  refreshes page one, deduplicating rows and ignoring any in-flight pre-removal page. This intentionally resets the
  loaded window rather than skipping shifted rows. Failed refreshes keep remaining rows and offer retry. Own-profile
  saved totals decrement only after confirmed unsave; the three-card preview refills through the existing list endpoint.
- Owned-list summaries already expose visibility. The profile summary type now retains that existing optional field;
  public handle summaries omit it. Ownership comes from authenticated owner-list context or the handle response's
  `isOwner`, never an author-name comparison. No per-card metadata/document requests were added.
- Discover vibe results remain labelled samples with real tag/category links, no Board links or save controls.
  Collection/country populated branches use V4, but their source still returns unavailable/empty. Category tiles,
  full document viewers, unused legacy components and development prototypes are deliberately retained.

## Existing capabilities requiring later frontend adoption

- Remix creation remains unavailable; this batch does not implement it.
- Public search's `popularity` is the existing per-Board save count. A future search-card adapter can map this to
  `PhotoBoardCardData.savedCount`; it is not an account-level total.

## Missing summary data; frontend prepared

- **Per-Board saves outside public search:** canonical documents and ordinary summaries have no save count.
  The optional `savedCount` presentation field is ready; absent values are omitted. A backend decision on exposing
  the actual count is needed only if these surfaces must display it. No new endpoint is assumed.
- **Initial bookmark state outside documents/saved lists:** many summaries do not contain `savedByMe`.
  `PhotoBoardSave.state` supports `unknown` and disables toggling until membership is resolved. Summary enrichment
  could remove that limitation at scale; response shape and access semantics require agreement. V4 makes no extra
  document/list requests solely to infer that an unlisted Board is unsaved.

- **Optional metadata on summary-only selection cards:** owner-list summaries do not include authors, tags,
  confirmed destinations or itinerary length. `toSummaryPhotoBoardCard` / `toDraftPhotoBoardCard` omit them; existing
  preview documents enrich only the cards already hydrated. If metadata reveal is required across every loaded
  library card without additional reads, enrich the existing `GET /api/v1/boards?scope=drafts|published` responses.
  This is optional, not blocking. Published-summary visibility is consumed when supplied; draft access remains owner-only.

## Batch 4 summary limitations

- Saved summaries supply title, description, owner identity, cover and saved date. They do not supply confirmed
  destinations, tags, itinerary length, visibility or per-Board saves. These stay absent rather than being derived
  from titles or account totals. Own published summaries similarly omit most metadata; own profiles supply the
  already-loaded profile username as author.
- Public handle summaries supply only ID/title/cover/updated date. The response establishes public access and
  other ownership, but does not resolve viewer authentication/eligibility or `savedByMe`. Their bookmark is therefore
  disabled with “Save status unavailable,” rather than falsely unsaved. Enabling account saving here needs reliable
  membership and viewer context through an agreed summary enrichment or existing scalable integration. V4 does not
  fetch every document or scan the viewer's entire saved collection to infer missing state.
- `getPublicDiscoverBoards()` remains unavailable. Migrating its presentation does not connect a live discovery feed.
  Agree a mapping to real numeric Board IDs, navigation, filters/pagination and viewer save state before enabling
  persistent interactions. Public search exists, but this batch does not declare it the agreed Discover data source.

## Contract decision requiring discussion

- Product decision: no collaborative Board editing, invitations, or member-management features. Existing backend
  `collaborators` visibility nevertheless permits the owner and existing Board members; `friends` also admits members.
  V4 accurately labels these “Restricted access” and “Friends” with accessible explanations. Drafts say “only you.”
  Backend teammates must agree on any future access/vocabulary changes. The frontend has not changed permissions,
  treated `collaborators` as owner-only, or added collaboration workflows.

## Integration boundaries and verification

- Presentation: `PhotoBoardCard` and `PhotoBoardCardData`; controlled save presentation: `PhotoBoardSave`.
- Account integration: `AccountPhotoBoardCard`, `BoardDocumentPhotoCard`, `createBoardSaveStore`; summary adapters
  `toSavedPhotoBoardCard`, `toProfilePhotoBoardCard`; collection state `createSavedBoardsStore`.
- No additional backend capability is needed to use the current save/unsave controls with a known Board document.
- Automated tests cover real API helper calls with controlled responses, confirmed state, errors, authentication,
  ownership and adapters. Live saving could not be verified: the local API returned an error and the documented SSH database tunnel on
  port 15432 was not listening. No account save was claimed or database configuration changed.
- Batch 1 browser review covered `/boards` and all three destination routes, desktop and narrow layouts, both themes,
  keyboard selection/disclosure, spring rearrangement, dragging, carousel controls and horizontal wheel navigation.
  The local owned-list failure displayed labelled samples; canonical owner controls and real navigation were verified
  through production-component/API-helper tests rather than claimed as live account verification. Physical touch
  hardware was unavailable; whole-card disclosure and first-touch preview before linked navigation are independently tested alongside pointer/keyboard controls. The visible Details/Close control was removed following Batch 1 feedback.

- Batch 2 live routes still returned API errors locally. Browser checks use the real routes for error/retry feedback
  and a development-only, labelled `/dev/board-selection` presentation harness for populated galleries, dark/light
  layouts, keyboard/tilt/promotion and draft carousel behavior. Fixture links cannot open or save account Boards.
  Real document restoration, fresh permissions, hydration limits and retry/pagination are verified through the existing
  API helpers with controlled responses; live persisted editor restoration remains unverified until the API is available.

## Backend teammate action list

Required to unlock currently unavailable behavior (agreement first; no new endpoint is presumed):

- Resolve public-profile card viewer eligibility and initial saved membership at summary level so the frontend can
  enable truthful save/unsave controls without per-card document reads.
- Agree the real Discover Board source and its identity, filters/pagination and viewer-state mapping; fixture cards
  cannot become navigable or persist saves until this exists.
- Discuss the existing `collaborators`/member access semantics against the no-collaborative-editing product direction.
  Preserve current permissions until an explicit contract decision; no collaboration interface is requested.

Optional enrichment, not a blocker for the migrated cards:

- Expose actual per-Board save counts outside public search if those contexts should show them; public search already
  has `popularity`. Never use profile aggregate totals as card counts.
- Add author, confirmed destinations, tags and itinerary length to relevant summaries if every hover should show them
  without hydration. Owned-list visibility already exists and needs no new backend implementation.

Batch 4 verification:

- Full frontend tests, independently authored Batch 4 regressions, frontend TypeScript, root formatting/check and
  root frontend/backend lint pass. The production webpack build passes. No backend or schema changes were made.
- Browser review covered desktop and 390px/320px layouts, light/dark themes, keyboard focus/Escape, saved-card
  filtering/removal transitions, owned View/Edit targets, own/public profile card controls, and Discover disclosure
  and real tag navigation. Reduced-motion emulation was confirmed active while testing immediate fixture removal;
  temporary motion/viewport/theme overrides were restored. A narrow development-selector overflow was corrected.
- Real My Boards saved-list, `/boards/mine` and profile routes still fail locally; error/retry feedback was inspected.
  Populated account layouts were inspected through the labelled `/dev/board-collections` harness. Country and
  collection coming-soon states remain unchanged. Contract-response tests do not establish live account persistence:
  successful saved-list pagination, unsave persistence and refill still need a working API/account session to verify
  end to end. Fixture actions cannot mutate account Boards. Physical touch hardware was unavailable; existing
  touch-preview handlers remain covered by automated tests.
- RoamFlow, Featured V3, the forced dual-state creator preview and full document viewer have no Batch 4 edits;
  existing regression tests pass. The focused audit retained category tiles, unused V1/V2 wrappers and development
  prototypes rather than treating them as active compact Board displays.
