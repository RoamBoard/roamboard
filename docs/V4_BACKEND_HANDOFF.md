# V4 frontend–backend handoff

Final Stage 3 / Batch 5 review, 2026-10-19. V1–V4 names and persisted identifiers are unchanged.
No backend code, endpoint, access rule, schema or migration was changed for this work.
See [the final QA report](V4_QA_REPORT.md) for the usage inventory, browser coverage and verification limits.

## A. Already supported and connected

**Connected in code does not mean successfully tested against a live account.** The following integrations use existing
credentialed services and controlled-response regression tests. Local persisted-account verification remains blocked.

| Capability                                    | Existing contract / integration                                                     | Current frontend behavior                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save another owner's readable published Board | `PUT /api/v1/boards/{id}/save`; `contracts/profile.md`; `saveBoardBookmark`         | `AccountPhotoBoardCard` / `createBoardSaveStore` require reliable ownership, positive persistent ID and known membership. PUT confirmation must match the Board and `saved: true`. Pending writes cannot duplicate; failures retain state; 401 offers sign-in.                                                                                                                                                                                                       |
| Unsave                                        | `DELETE /api/v1/boards/{id}/save` → idempotent 204; `unsaveBoardBookmark`           | Only confirmed success changes membership. Saved collection rows exit after confirmation, become inert during exit, and move an active bookmark's focus to a remaining card or the list before removal.                                                                                                                                                                                                                                                              |
| Saved collections                             | `GET /api/v1/users/me/saved-boards?page=&limit=`; `loadSavedBoardsPage`             | My Boards and own-profile saved previews use reliable membership for filled bookmarks. The API excludes caller-owned and currently inaccessible Boards. `saved-boards-store` refreshes page one after deletion to avoid offset skips, ignores stale in-flight pages, deduplicates rows and retains remaining rows with retry if refresh fails. This deliberately resets the loaded window. The profile's visible saved total decrements only after confirmed unsave. |
| Draft and owned published lists               | `GET /api/v1/boards?scope=drafts\|published&page=`; `backend/BOARD_API_CONTRACT.md` | Continue, Drafts, My Boards and `/boards/mine` retain real IDs, pagination, hydration and retries. `/boards/mine` has card View navigation plus separate View/Edit links. Summary fields remain truthful; no per-card metadata requests were added.                                                                                                                                                                                                                  |
| Canonical document / permissions              | `GET /api/v1/boards/{id}`; `loadBoardDocument`, `BoardDocumentPhotoCard`            | Existing preview reads supply author, cover, confirmed places, tags, days, status, visibility and `savedByMe`. Management permission establishes ownership; editor permission alone does not. Continue requires a fresh document's edit permission before opening the editor. Drafts reopen at `/boards/drafts/{id}`, published edits at `/boards/{id}/edit`.                                                                                                        |
| Ownership and visibility                      | Owner-list context; canonical `permissions.canManageBoard`; public handle `isOwner` | Owners see actual existing visibility instead of Save. Draft status overrides selected visibility and says “only you.” Unknown ownership has no account action. Owned summary visibility already exists; the frontend profile type now retains it.                                                                                                                                                                                                                   |
| Public profile cards                          | `GET /api/v1/users/by-handle/{handle}`; `contracts/profile.md` handle amendment     | Only public summaries and public profile data are shown to other viewers. Profile username supplies the actual author; no edit controls or private fields are introduced. Missing saved membership remains explicitly unavailable, not false.                                                                                                                                                                                                                        |
| Creator preview                               | Existing local creator state and canonical creation/edit services                   | Cover View and permanently expanded Details View share one derived Board state. Title, cover, tags, duration and confirmed places update from that state. Annotation links focus the existing editor controls. The preview never saves independently.                                                                                                                                                                                                                |
| Discover presentation                         | Existing sample sources; `DiscoverBoardCard`; RoamFlow source                       | Vibe samples retain real tag navigation without invented Board URLs or account actions. Country/collection populated branches use V4 but currently show honest coming-soon states. RoamFlow remains its existing fictional editorial preview; V3 Featured remains unchanged.                                                                                                                                                                                         |

Current environment diagnosis:

- Frontend `127.0.0.1:3000` and backend `:3001` are listening. `/health/db` returns `{"status":"unavailable"}`
  (503 in the existing health handler).
- The configured `DATABASE_URL` points to loopback port **15432**, with no listener. The existing read-only setup check,
  run outside the sandbox to distinguish tool restrictions, fails with **ECONNREFUSED**. This matches the missing SSH
  tunnel described in `backend/README.md`.
- `DATABASE_URL`, frontend API URL and Google IDs are present; `CLIENT_ORIGIN` is `http://localhost:3000` and the
  backend/frontend Google client IDs match. Database credentials, schema and migrations cannot be validated until
  connectivity returns. The browser's cached account name is not evidence of a fresh authenticated database read.
- Real saved, owned, Continue, Draft and profile routes expose loading/error/retry states. Successful account saving,
  unsaving, pagination/refill, restoration and permission enforcement still need a live end-to-end check. This is an
  **environment verification blocker**, not evidence those endpoints are missing. No tunnel or configuration was changed.

## B. Backend work required

These gaps block the named intended behavior, not rendering V4 itself. Expected additions below describe the capability
needed, **not an agreed new response shape or endpoint**. Existing save/list/draft APIs do not need reimplementation.

| Missing capability                                                                    | Relevant existing endpoint / contract                                                                                            | Expected behavior                                                                                                                                                                                             | Frontend consumer / readiness                                                                                                                                                                                                                   | Blocking scope                                                                                                                       |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Reliable initial saved membership and viewer eligibility for public-profile summaries | `GET /api/v1/users/by-handle/{handle}`; public-profile amendment in `contracts/profile.md`                                       | Resolve whether the viewer may save each Board and whether it is already saved. Agree summary enrichment or a scalable existing-service composition. Never treat an omitted value as false.                   | `LiveBoardCard` → `toProfilePhotoBoardCard` → `AccountPhotoBoardCard` already supports known/unknown membership and persistent mutations. Summary mapping is pending agreement; the current control is disabled with “Save status unavailable.” | Required **to enable saving from public-profile cards**; non-blocking for safe viewing/navigation.                                   |
| Agreed live Discover Board source / mapping                                           | `getPublicDiscoverBoards()` is unavailable; existing public `/api/v1/search` is documented in `backend/API_FEATURES_CONTRACT.md` | Agree whether existing search is the source and how real numeric IDs, cover/author, destination/tag filters, pagination and viewer state map into Discover. Do not equate fixture IDs with persistent Boards. | Shared V4 presenter/adapters are ready; live fetching/mapping and account actions are not connected. Current category links and samples remain honest.                                                                                          | Required **to replace Discover samples/coming-soon results with persistent Boards**; non-blocking for the current editorial preview. |

Before declaring live account QA complete, restore the already documented local database connection through the normal
team workflow, then rerun the account checks in the QA report. This is operational follow-up, not a requested backend
feature or authorization to change infrastructure.

## C. Contract decisions

Roamboard is **not implementing collaborative editing, invitations or member-management UI**. The current backend
nevertheless accepts `collaborators | friends | public`; existing members may read restricted published Boards,
editors may edit content, and `friends` also admits members. Drafts are owner-only regardless of that field.
V4 currently communicates “Restricted access” and “Friends” with those actual access explanations. The creator's
existing “Private” choice still maps to `collaborators`; it explicitly explains invited-member access.

A possible future vocabulary is **Public / Friends / Private**, with genuinely owner-only Private access. This needs a
joint product/backend decision before implementation: define treatment of existing members/editor permissions, existing
restricted Boards, the friends rule, defaults, compatibility and any migration. Renaming the frontend label alone would
misrepresent current permissions. No such change is implemented or presumed approved here.

## D. Optional future improvements

These improve information density or consistency and are **not required for the migrated cards to work safely**:

- Consistent `savedByMe` in other Board summaries when future non-owner surfaces need bookmarking. Canonical reads
  already expose it; saved-list membership already resolves it. The specific public-profile gap in B is required only
  for enabling that surface's action, not a mandate to enrich every summary.
- Actual per-Board save counts in canonical/summary responses if those contexts should display them. Existing public
  search already supplies `popularity`; the V4 `savedCount` presentation field is ready. Account aggregate totals
  must never substitute for a Board count.
- Author, confirmed destinations, tags and itinerary length in summary-only lists if every expanded card should show
  them without document hydration. Saved summaries currently provide title, description, owner, cover and saved date;
  public handle summaries provide ID/title/cover/updated date. Missing fields are omitted. Owned visibility already
  exists and requires no new backend work.
- Reassess search indexing and very large gallery virtualization once a real, larger public collection is connected.
  Current RoamFlow reserves image geometry and lazy-loads, but is not a virtualized list.

## Destination-story integration after PR #80 reconciliation

City guides now supply live public Board summaries through the existing credentialed
`GET /api/v1/destinations/guide` frontend helper. V4 uses the real ID, username, description, tags, duration and first
(chosen-cover) image. The parent hook retains pagination, de-duplication and retry; gallery selection is keyed by
Board ID. Protected image URLs load directly, and supplied external cover credits remain visible for the selected Board.
These summaries do not expose viewer ownership, saved membership or save counts. Account controls and totals remain
absent; no extra document fetches, inferred ownership, endpoint changes or collaboration UI are added. Country-page
and Discover/RoamFlow data-source limitations documented above are unchanged.
