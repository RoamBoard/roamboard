# Board collection grid contract

Status: Agreed — implementation authorized by the user representing frontend and backend on 2026-10-20.

Reviewer: the user confirmed on 2026-10-20 that they represent both frontend and backend.
Source branch: `main`, inspected on 2026-10-20. The user delegated URL/API finalization and requested implementation.

## Goal and confirmed scope

Add a reusable fourth Board list: a wider grid using component 2's photographic covers, four columns on desktop,
fewer columns at smaller widths, and up to twenty Boards per page on every screen size. Five full desktop rows
therefore contain twenty Boards; the last page may contain fewer. Use Previous, numbered pages and Next.

Replace the friends' Boards section directly on Social with this grid, including search, sorting and pagination.
Add a slightly larger `view all →` link at the far right of the heading of every existing Board list representing
a defined collection, across all three existing list presentations. It opens a separate collection page using
the fourth list. This includes profiles, Discover categories and map-related collections wherever those lists occur.
The screenshots are layout references, not new editorial image assets to import.

The source context defines eligibility. There are no additional filter controls in this version. Search and sorting
must never expand the collection. My Boards includes owned drafts and published Boards; other profiles expose only
Boards the viewer may access. Discover categories and map collections retain their defining constraints.
Preserve the source's membership and ranking window when applicable; do not silently turn Featured into all Boards.

## Search and sorting

Search covers titles, descriptions, creator display names and handles, destinations, tags and activity content.
Apply access checks and collection membership before matching, counting or pagination. Search the complete eligible
collection, not just a loaded carousel or one page. Contextual search includes owned Boards when the context does.

Also update `/boards` search and suggestions to include the viewer's own published Boards within existing discovery
visibility rules. Drafts remain in My Boards. A direct title match remains eligible even when automatic location
interpretation finds no matching destination or activity location. This changes the earlier search decisions in
`boards-discovery.md`; other location and relevance rules remain unless they conflict with this title exception.
Read-only verification against the configured database confirms that the actual Board, `bali villa with da boys`, now appears for both Bali and Indonesia using the updated service. This verifies the new behavior without establishing which old exclusion caused the original incident.

Sort options confirmed by the user:

- Relevance, available during search.
- A–Z and Z–A, by Board title.
- Newest published, using first publication time.
- Recently updated.
- Most saved, using total current saves.
- Recently saved, only for saved collections, using the collection owner's save time.

Defaults: Recently saved for saved collections, Recently updated for My Boards, Newest published for friends and
other collections. Submitting a search selects Relevance. Users may then select another sort within search results.

## Permissions and card behavior

Reuse `BoardLibrary` / `AccountPhotoBoardCard` behavior, including authorized View/Edit actions, bookmark state,
confirmed unsaving, draft editor navigation and status labels. Ownership alone is not a replacement for server
permissions. Actions appear on hover and keyboard focus and remain reachable on touch. Do not offer bookmarking
one's own Boards. Preserve protected cover delivery. Cards and previews do not count as qualified Board views.

Guests may browse public collections; My Boards, personal Saved Boards and friends' Boards require a session.
Public profile collections retain existing viewer-specific access. Losing access hides both metadata and images;
saved relationships retain existing persistence rules. No new collaborator permissions are introduced.

## Navigation and API

Use `/boards/collections/<context>` as the standalone collection route, with context-defining parameters and
submitted `q`, `sort` and `page` in the URL. Social hosts the same grid directly and preserves its state in its URL.
Source lists provide a typed context descriptor, never arbitrary SQL, a client-supplied authorization claim or a
list of the currently loaded Board IDs. Back, refresh and shared links reconstruct the same collection definition.
Map collections need stable source identifiers and must preserve the selected map scope, not a temporary ID snapshot.

Read endpoint: `GET /api/v1/boards/collections/:context`.
Supported persisted context families: `mine`, `saved`, `friends`, `profile`, `profile-saved`, `category`, `map`, `recent`, `featured`. Discover currently uses editorial examples, so its View all route uses the explicit frontend-only `samples` context with optional tag ID. It searches and paginates the complete sample catalog, offers title sorting and discloses unavailable publication/save data and lack of persisted Board actions. It never substitutes examples for API results.
During implementation, inventory all call sites and reuse existing reads where they already satisfy this contract.
Any additional context family or unrepresentable map scope requires a documented contract update before coding it.

Query: optional `q` (trimmed, 2–100 characters when nonempty), optional `sort` enum
(`relevance`, `title-asc`, `title-desc`, `published-desc`, `updated-desc`, `saved-count-desc`, `saved-at-desc`),
`page` (integer 1–10000, default 1), and `limit` (20 only, default 20). Omitted, empty or whitespace-only `q` means
no search; the UI does not submit one-character queries. Reject `relevance` without a query and `saved-at-desc`
outside saved contexts. Invalid context, query or missing required context parameter returns 400.

Context parameters must be validated per family: profile handle, category identifier, map scope identifiers and
Featured period (`week` or `month`) as applicable. Map scope uses either an ISO alpha-3 `country` or paired `longitude`/`latitude`, plus `collection=published|saved|both` and optional profile `handle`. These reproduce the selected map scope server-side. Saved map reads remain restricted to the owner and accepted friends. Optional `status=draft|published` is accepted only for `mine`, preserving the Continue page's selected tab.
Unrelated parameters are rejected. Do not trust a browser-supplied viewer ID; derive the viewer from the session.

Success envelope example, showing an empty saved collection:

```json
{
    "data": {
        "items": [],
        "page": 1,
        "limit": 20,
        "total": 0,
        "hasMore": false,
        "sort": "saved-at-desc"
    }
}
```

Items reuse the existing discovery summary fields: integer Board ID, title, nullable description and cover URL,
owner identity, nullable destination, tags, duration/activity/save counts, saved state, status, visibility,
nullable first publication timestamp, update timestamp and server-resolved permissions. Saved collections include
the collection owner's save timestamp; omit it elsewhere. Dates use ISO 8601. Reuse existing field shapes rather
than fetching complete Board documents per card. Required summary extensions must be typed on both sides.

Use deterministic Board ID tie-breaking after the selected sort; null publication times sort last for drafts.
Counts describe only authorized matching Boards. Pagination is live rather than a snapshot; concurrent edits may
move items. A page beyond the last page returns an empty list and the current total, allowing a return to page 1.

Return 401 for session-only collections, 404 for an inaccessible/missing source, and the standard error envelope:

```json
{
    "error": {
        "code": "UNAUTHENTICATED",
        "message": "Not signed in"
    }
}
```

Use existing validation error codes for 400. Responses are viewer-specific (`Cache-Control: private, no-store`).
This introduces no writes; existing bookmark writes retain session, exact-Origin and authorization requirements.

## Frontend states and change list

Build the shared grid and typed context navigation; add View all across existing presenters and replace Social's
friends grid. Reset to page 1 when query or sort changes. Clearing search restores the context's default order.
Show loading feedback, distinguish an empty collection from no search matches, and offer retry on failure without
losing URL state. Prevent stale requests from replacing results for a newer query or signed-in viewer.
After unsaving in a saved context, remove the card and refresh counts/page as necessary; preserve keyboard focus.
Update `/boards` search cards to resolve ownership and permissions instead of hardcoding every result as `other`.

## Backend implications and validation

Current evidence: `frontend/src/components/features/boards/BoardLibrary.tsx` implements component 2's covers/actions;
`BoardsDiscovery.tsx` implements URL-backed twenty-result numbered pagination but hardcodes search ownership;
`frontend/src/components/features/social/SocialFriendsContent.tsx` renders friends' Boards;
`backend/src/features/users/users.routes.ts` exposes `/me/friends/boards`;
`backend/src/features/board-discovery/discovery.{routes,schemas,service,repository,ranking}.ts` implements current
discovery lists and search. `contracts/boards-discovery.md` records the older own-Board exclusion and strict location
eligibility. Existing behavior is evidence, not approval of the API proposed here.

Extend active `backend/` collection queries for complete contextual search, ordering, totals and pagination; avoid
N+1 document reads. Broaden searchable creator fields and allow direct title matches past automatic location gating.
Remove own-Board search exclusion without broadening discovery visibility. Existing persisted Board, location,
friendship and saved data appear sufficient; no migration is needed. Collection SQL has been checked in an isolated database schema. Never change the abandoned backend.

Validate title-only Bali matching with absent location metadata, Indonesia country matching with canonical location
data, own published Board discovery, draft exclusion from discovery, contextual containment, permissions/count privacy,
all sort modes, twenty-item pagination, changed access and save-state updates. Visually verify desktop four columns,
responsive layouts, both themes, keyboard/touch actions and View all placement. Validation results are reported with the implementation handoff.

## Decision log and approval record

Confirmed on 2026-10-20 by the user representing both frontend and backend: everywhere View all; direct Social grid;
broad contextual search; own published Boards in `/boards` search; direct title-match eligibility; all listed sort
options and defaults; context-only filtering; twenty results and responsive numbered pagination.

Technical decisions finalized under delegation: routes and context parameters above, search validation, null-last publication ordering for drafts and live pagination. No open product decisions remain.
The user delegated these technical choices and authorized implementation on 2026-10-20; no further approval is required within this scope.
