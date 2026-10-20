# Board collection grid contract

Status: Agreed — implementation authorized by the user representing frontend and backend on 2026-10-20.

Geographic filter extension: Agreed and implementation authorized by the user on 2026-10-20.

Reviewer: the user confirmed on 2026-10-20 that they represent both frontend and backend.
Source branch: `main`, inspected on 2026-10-20. The user delegated URL/API finalization and requested implementation.

## Goal and confirmed scope

### Geographic filter extension - approved

The user requested this extension on branch `126-make-a-4th-boars-list-component-view-all-boards`.
Status: Approved for implementation by the user representing both teams on 2026-10-20. This extension supersedes the original no-additional-filter-controls scope.

Confirmed decisions:

- Shorten component 4's search field to accommodate geographic filter controls.
- Offer a searchable, scrollable country dropdown showing all country names and flags, with multiple selections.
- Allow multiple continent selections as well.
- Use seven continents everywhere: Africa, Antarctica, Asia, Europe, North America, Oceania and South America.
  Update the shared mapping and existing profile/map continent counts as well as the new filters. Current counts
  derive from country locations at read time; this change does not imply rewriting saved Boards.
- Match the Board's main destination and confirmed activity locations using the same location eligibility as map
  country coverage. Do not infer filter eligibility from titles, descriptions or unconfirmed locations.
- Countries use OR within their selected group; continents use OR within their selected group. The two groups use
  AND at Board level, and may match different locations on the same Board. A Bangladesh-and-France Board qualifies
  for Bangladesh plus Europe; a Bangladesh-only Board does not.
- Apply selection changes immediately, reset to page 1 and preserve the submitted text query and selected sort.
- Emptying the Board text search preserves geographic selections. A separate Clear filters action removes only
  country/continent selections; the source collection remains fixed.
- Expose the same geographic controls in `/boards` search, including its suggestions and full results. Explicit
  geographic selections constrain results even when the existing title-match exception would otherwise qualify a
  Board. No text match may bypass these selected filters or viewer access rules.
- On `/boards`, selecting geography without text opens the filtered results grid automatically. Geography can be
  used on its own; users do not need to type an artificial search term.
- Retain the existing source context and viewer access rules; filters only narrow the eligible collection.

Proposed technical boundary: extend the existing collection, global Board search and suggestion reads with optional
repeated `countries` ISO alpha-3 codes and repeated `continents` identifiers, independently of the existing singular
map-scope `country` parameter. Proposed continent identifiers are `africa`, `antarctica`, `asia`, `europe`,
`north-america`, `oceania`, `south-america`. Country-to-continent assignments come from one shared catalog, also used
by profile/map counts. Classification is country-based rather than a new coordinate-geofencing system.
Validate known values and deduplicate selections. An omitted/empty selection group adds no restriction. Valid
combinations with no matches return 200 with zero items and total zero, not a validation error. Apply geographic
matching before pagination and totals, preserving Featured's fixed source membership before narrowing it. Persist
selections in the URL for refresh, Back and shared links. Country flags/names and dropdown search use the existing
country catalog on the frontend; no new provider or flag-upload endpoint is required. No schema migration appears
necessary; schema/query/index requirements will be checked during implementation.

Evidence: `backend/src/features/board-discovery/discovery.{schemas,types,service,repository}.ts`,
`backend/src/features/users/users.repository.ts`, `backend/src/shared/continents.ts`,
`frontend/src/lib/countries.ts`, `shared/country-codes.json` and `shared/country-continents.json`.
The current continent mapping groups countries into Africa, Americas, Asia, Europe and Oceania.

The seven-continent choice supersedes that five-region mapping throughout the app.
No open product questions remain. The user approved this technical boundary and requested implementation on 2026-10-20.

#### Approved API extension and defaults

Extend these existing reads without changing their authentication, success/error envelopes or Board summary shape:

- `GET /api/v1/boards/collections/:context`
- `GET /api/v1/boards/search`
- `GET /api/v1/boards/search/suggestions`

Use repeated query parameters, for example:

```text
GET /api/v1/boards/collections/friends?countries=FRA&countries=ITA&continents=europe&page=1&limit=20
GET /api/v1/boards/search?countries=BGD&continents=europe&page=1&limit=20
GET /api/v1/boards/search/suggestions?q=food&countries=BGD&continents=europe
```

Countries must be recognized uppercase ISO alpha-3 codes from the shared catalog. Continents must be one of the
seven lowercase identifiers listed above. A single occurrence and repeated occurrences have identical semantics;
deduplicate valid selections and limit unique values to the catalog size/seven continents. Omit parameters when
their selection is empty; an empty parameter value is malformed, not a request to select an unknown country.
Unknown codes/identifiers and malformed query shapes return 400 using the existing validation error envelope.
Valid but contradictory criteria return 200 with zero matches.

Global search accepts omitted/blank `q` only when at least one geographic selection exists. A nonempty `q` retains
the existing 2–100 character validation. Global suggestions still require a 2–100 character query; when there is
no text, show the full filtered grid rather than empty-query suggestions. Text searches retain current relevance
ranking and removable automatic location interpretation. Explicit geography remains a mandatory independent
constraint and survives disabling that interpretation.

Filter-only global results default to Newest published, with Board ID as the deterministic secondary order.
Collections retain their existing sort defaults; typing/submitting a query retains their Relevance default.
Filtering always precedes page slicing and total counts. Keep twenty Boards per results page and four suggestions.
For Featured, preserve its already-selected monthly source set, then narrow it; filtering must not fill its places
with otherwise non-Featured Boards. Do not calculate hidden or unauthorized matching counts.

Example empty filter-only search response:

```json
{
    "data": {
        "items": [],
        "page": 1,
        "limit": 20,
        "total": 0,
        "hasMore": false,
        "location": null
    }
}
```

#### Selection state and frontend behavior

Use the same filter controls in every component 4 context and the `/boards` search area. Make the search field
shorter on wide layouts to leave space for filters and sorting; stack controls at small widths without clipping.
Country options remain the complete catalog even when a selected continent makes some combinations yield no
results. Keep selections when searching within the dropdown, and show selected countries/continents clearly with
individual removal and a separate Clear filters action. Flags accompany readable country names; labels must not
depend on recognizing a flag. Use accessible multi-selection controls with keyboard operation and a scrollable
country list. Searching this option list changes only the displayed options, not the Board text query.

Changing selections applies immediately and resets page 1, preserving the submitted Board query and existing
sort. Country selections use OR; continent selections use OR; the two predicates use AND over the Board as a
whole, so each may match a different eligible location. Boards without known eligible countries remain visible
when geography is unset and do not qualify when geography is selected. Never derive filter eligibility from text.

Persist geography in all result, suggestion-submission and pagination URLs, including refresh and Back. Emptying
Board search preserves geography; Clear filters preserves text and sort. With neither text nor geography,
`/boards` returns to discovery. Collection pages always retain their source collection even when all controls are
cleared. Preserve existing search-clearing sort defaults where applicable. Loading/failure feedback must retain
selected controls; late responses must not replace results for a newer selection or account.

The frontend-only editorial `samples` context applies filters to its explicitly supplied destination countries,
normalizing through the same country catalog. It has no confirmed activity data; do not invent any or claim API
persistence. Samples with no known destination do not match selected geography. Retain the existing disclosure.

#### Backend and data changes required

Extend query schemas/types and pass geography through global search, suggestions and contextual reads. Build one
shared geographic predicate over the main destination and confirmed activity countries. Apply it after source
and viewer authorization, before pagination/counts; keep it independent of text ranking and automatic location
interpretation. A Board visiting Bangladesh and France must pass Bangladesh plus Europe even though no single
location satisfies both selected groups.

Update `shared/country-continents.json` to the seven-continent taxonomy, including Antarctica, and reuse it on both
sides. Preserve existing country assignments where compatible, split the Americas using a documented geographic
catalog, and document assignments for transcontinental countries rather than adding GPS polygon classification.
The existing computed profile/map statistics must use this same mapping, so continent counts may change without
any Board write. Continue delivering the shared catalog with the backend deployment. No schema migration or new
provider request is currently expected; add an index migration only if actual query validation demonstrates a need.

#### Acceptance cases and review record

- France + Italy matches either country's eligible location; no duplicate Board results.
- Europe + Asia matches either continent; Europe + Bangladesh needs both Board-level predicates.
- Bangladesh-only Board fails Europe + Bangladesh; Bangladesh-and-France Board passes it.
- A confirmed activity can supply a match; an unconfirmed activity or title mention cannot.
- Source constraints, saved-map restrictions, draft visibility, protected images and private counts remain enforced.
- No-text geography opens `/boards` results, sorts newest first, and paginates with correct totals.
- Suggestions and full text results obey the same explicit selections.
- Clearing text preserves geography; clearing geography preserves text; clearing both restores discovery.
- Shared URLs, Back, request cancellation, errors, empty results and individual option removal preserve state.
- North/South America and Antarctica filter independently; existing profile/map totals use seven continents.

Product decisions were confirmed by the user representing both frontend and backend during the interview.
The user approved these API examples, defaults and change lists and requested implementation on 2026-10-20.
The active backend and frontend now implement the geographic extension without a migration; check results are reported at handoff.

### Existing approved scope

Visual follow-up approved on 2026-10-20: component 4 uses the main Boards search treatment (search icon, transparent
input, one underline and a text Search action). Board-list titles and descriptions use a consistent 8px gap. Back
and View all share one primary-color, 16px medium-weight navigation style, 16px arrows and a 44px minimum target;
the shared Back style applies throughout the application. Profile Board lists reuse ViewAllBoards.

UX amendment approved by the user on 2026-10-20: remove the outer search-toolbar border in component 4 and `/friends`,
retaining individual input/select borders and accessible focus indicators. Emptying a submitted search automatically
restores its full collection, resets pagination and restores the default sort without requiring Clear. Search/Enter
still submits a nonempty query. View all uses larger primary-color text, vertically centered with its heading.
Across Board covers, replace separate Draft/Published status captions with an accessible draft document/pen SVG
in the existing top-right visibility badge. Published covers retain their visibility badge without a status caption.
These decisions supersede the persistent status-label wording below; permissions and backend data are unchanged.

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

Geographic control refinement approved on 2026-10-20: country rows show local MIT-licensed flag-icons SVGs, country names and right-aligned ISO alpha-3 country codes. Continent selections use title-case names. Only one menu opens at a time; outside pointer/focus and Escape dismiss it. Both menu panels share the same height and align directly below their trigger. Arrow navigation moves focus and scrolls only within the option list. No raster assets or image-library entries are introduced.
