# V4 frontend–backend handoff

Stages 2 and 3 Batch 1 — shared enhancement and initial gallery adoption. Updated 2026-10-18.
No backend contracts, endpoints or schemas changed. Further Stage 3 batches await separate review.

## Already implemented and connected

- V4 account saving uses existing `PUT/DELETE /api/v1/boards/{boardId}/save` through `saveBoardBookmark` and
  `unsaveBoardBookmark`. `BoardDocumentPhotoCard` is connected in expanded `/dev/boards` records. It reuses a
  document fetched for inspection, accepts `savedByMe`, prevents duplicate requests, retains state on failure,
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

## Existing capabilities requiring later frontend adoption

- `/api/v1/users/me/saved-boards` already supplies accessible saved membership and owner/title/cover summaries.
  Stage 3 adapters can use confirmed list membership without a document request per card. This stage does not migrate
  the saved grid or enable Remix creation.
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

## Contract decision requiring discussion

- Product decision: no collaborative Board editing, invitations, or member-management features. Existing backend
  `collaborators` visibility nevertheless permits the owner and existing Board members; `friends` also admits members.
  V4 accurately labels these “Restricted access” and “Friends” with accessible explanations. Drafts say “only you.”
  Backend teammates must agree on any future access/vocabulary changes. The frontend has not changed permissions,
  treated `collaborators` as owner-only, or added collaboration workflows.

## Integration boundaries and verification

- Presentation: `PhotoBoardCard` and `PhotoBoardCardData`; controlled save presentation: `PhotoBoardSave`.
- Canonical integration: `BoardDocumentPhotoCard`, `toPhotoBoardCard`, `createBoardSaveStore`.
- No additional backend capability is needed to use the current save/unsave controls with a known Board document.
- Automated tests cover real API helper calls with controlled responses, confirmed state, errors, authentication,
  ownership and adapters. Live saving could not be verified: the local API returned an error and the documented SSH database tunnel on
  port 15432 was not listening. No account save was claimed or database configuration changed.
- Batch 1 browser review covered `/boards` and all three destination routes, desktop and narrow layouts, both themes,
  keyboard selection/disclosure, spring rearrangement, dragging, carousel controls and horizontal wheel navigation.
  The local owned-list failure displayed labelled samples; canonical owner controls and real navigation were verified
  through production-component/API-helper tests rather than claimed as live account verification. Physical touch
  hardware was unavailable; whole-card disclosure and first-touch preview before linked navigation are independently tested alongside pointer/keyboard controls. The visible Details/Close control was removed following Batch 1 feedback.
