# Boards discovery contract

Status: Implemented — user authorized implementation on 2026-10-20, representing both frontend and backend

Approver: the user explicitly represents both frontend and backend (2026-10-20).
Source branch: `114-revamp-boards-page`. The user separately requested implementation after the product interview.

## Goal and scope

Make `/boards` primarily a place to search and explore published Boards. Heading: Boards, replacing My Boards.
Reuse the existing photographic Board presenters. My Boards and Saved Boards use the original draggable horizontal
BoardLibrary carousel (user's component 2 reference), including its arrows, scrollbar, mouse dragging and touch swipe.
Recently Published keeps the deck gallery. Remove all separate The Collection grids from `/boards`, while keeping
every loaded recent Board reachable through the deck controls. Remove the Archive section from this page.
Collaborator behavior is out of scope. All backend implementation belongs in `backend/`.

Default section order:

1. Search with up to four Board suggestions.
2. Featured, up to ten Boards, defaulting to This month; This week is also available.
3. Short promotion linking to `/discover`, using the Create page's inspiration treatment.
4. Recently Published, initially twenty Boards, with Load more.
5. My Boards, initially ten Boards, with Load more.
6. Saved Boards, initially ten Boards, with Load more.

Sections independently select Boards; duplicates across sections are allowed. The user's later component-2 decision
supersedes the initial request to use Continue/Remix decks for the personal sections; data and access rules are unchanged.
Visitors see public discovery and one sign-in prompt in place of the two personal sections.

## Confirmed access and journeys

Discovery includes published public Boards and published friends-only Boards when the viewer is an eligible friend.
Friend-only means accessible to that viewer, not globally public. Drafts and other private Boards never enter discovery.
Search and autocomplete exclude the signed-in viewer's own Boards. Featured and Recently Published may include them
when otherwise eligible. My Boards includes only owned Boards, at every visibility, with drafts and published Boards
mixed by most recently edited first. Show persistent Draft/Published labels, including on touch devices.
Saved Boards is ordered by most recently saved first.

Clicking a published Board opens its viewing page. An owned published Board also offers Edit. Clicking an owned draft
opens its editor. Preserve the reused gallery's established secondary-card selection interaction.

Losing access removes cards and previews from discovery and Saved Boards, and denies reads through old links.
The saved relationship remains stored and may reappear if access returns. Authorization must protect metadata and
images as well as full documents. No new collaborator feature is introduced by this contract.

## Confirmed search behavior

Typing opens suggestions while discovery stays visible. Clicking a suggestion, or pressing Enter on a focused
suggestion, opens that Board. Arrow keys navigate suggestions; Tab supports focus. Enter with no selected suggestion
or See all results switches `/boards` to full results and hides discovery until the search is cleared.
Persist the submitted query and numbered page in the URL. Full results use twenty items per page with Previous,
numbered pages and Next. No reusable pagination UI was found in `frontend/src`; create a shared component if still absent.

Suggestions show title, owner, destination and country, with regional detail where needed to distinguish places.
Hover or keyboard focus shows a compact version of the Create/Remix preview, including cover and existing metadata.
This popover must be smaller than the full gallery card. Touch selection opens the Board directly.

Automatically interpret recognized destinations in free text:

For ambiguous interpretations, show a removable location indicator, for example Location: Reading, UK. Removing it
searches the unchanged words normally without an enforced location filter. Preserve this override with the submitted
query in the URL so refresh, sharing and Back do not silently reinstate the removed interpretation.

- A place query requires a matching Board destination or activity location. Text mentions alone do not qualify.
- For Stockholm food, Boards matching both location and food rank ahead of Stockholm-only matches; use the latter
  when needed. Do not fill results with Boards outside Stockholm.
- Matching both terms through a Stockholm activity outranks a destination-only Stockholm Board without a food match.
- Among otherwise comparable matches, Board destination matches outrank activity-location matches.
- Paris prioritizes Paris, France while allowing other places named Paris. Paris in Texas narrows to that place.
- Use a small curated synonym list, such as food/restaurants/cafés/dining. Direct matches beat synonym-only matches
  when other relevance signals are equal.
- Quality, total saves and recency order comparably relevant Boards; they must not override these relevance tiers.

Clarification confirmed after the initial interview: location determines eligibility; other terms are optional ranking
boosts, not mandatory all-word matches or rigid match-count tiers. For Stockholm quiet cafés, keep all eligible
Stockholm Boards as candidates, strongly boost café/topic matches using the curated activity/tag vocabulary, and give
quiet/relaxed/peaceful descriptor matches a smaller boost. A Board matching both may score highest, but requiring both
would be too restrictive. Fill the four suggestions with other eligible Stockholm Boards when needed. A main Board
destination match is a smaller bonus and must not automatically beat an activity-location match with stronger topic
relevance. Initial implementation uses curated synonyms and explicit weights, without a new NLP service.

When no destination is recognized (or the user removes the location interpretation), search across all eligible
locations and require a relevant direct or curated-synonym text match. For cafés, rank café-related Boards from any
location; do not fill empty suggestion slots with unrelated Boards. Fewer than four suggestions is a valid result.

### Planned next iteration: NLP and semantic search

The user explicitly requested NLP and semantic search as a next iteration, outside this version's implementation scope.
Evaluate interpreting relationships such as quiet modifying cafés, broader intent recognition, and semantic retrieval
or reranking beyond curated synonyms. Select packages or providers, costs, privacy boundaries and evaluation cases in
that iteration; no external AI service is selected or required by this contract. Preserve authorization and explicit
location constraints, and compare quality against the first-version search before adopting the new approach.

## Confirmed Featured behavior

This month is a rolling thirty days; This week is a rolling seven days. Use the selected period for activity and ranking.
Fill the ten places in this order, without duplicates within Featured:

1. Public Boards with qualifying activity in the period, ranked by activity score.
2. Remaining public Boards, most recently first-published first.
3. Eligible friends-only Boards, most recently first-published first, if public Boards do not fill ten places.
   Do not rank this fallback by popularity or require activity within the selected period.

Equal Featured activity scores are ordered by more unique qualifying savers, then more unique qualifying commenters,
then newest first publication (confirmed by the user). Use Board ID as a final stable technical tie-break when all
those values are equal.

Starting weights are tunable proposals requested by the user: signed-in unique viewer 1; anonymous unique browser
viewer 0.5; unique saver 5; unique commenter 5. Saves and discussion have equal starting weight. Validate balance with
worked rankings before implementation sign-off; no claim of empirical tuning has been made.

A view qualifies after the Board page is visible for at least three seconds. Card impressions and hover previews
do not qualify. Deduplicate each viewer per Board within the selected period. Exclude owner activity.
On same-browser sign-in, merge guest and account views, including an existing account view: one account contribution,
not 1.5 points. Anonymous identity represents a browser, not guaranteed cross-device person identity.
The anonymous browser identifier expires after thirty days of inactivity (confirmed by the user). Continued activity
renews that inactivity lifetime; same-browser sign-in retains the agreed guest/account merge behavior.

Each saver contributes once per period only while their save remains active. Unsaving removes points; re-saving
cannot multiply points. Saves made before the period do not contribute merely because they remain active.
Each commenter contributes once only while at least one undeleted comment created within the period remains.
Additional comments and comment edits do not add points.

Launch behavior is confirmed: count views only from tracking launch onward. Use existing timestamped saves and
comments where their history reliably supports the counting rules; do not invent historical views or unavailable
activity history. Fill shortages using the agreed recent-publication fallback. The rolling-month ranking matures
naturally during the first thirty days after launch.

## Confirmed publication behavior

Recently Published uses the original first-publication timestamp, descending, including eligible friends-only Boards.
Content edits, unchanged saves, visibility toggles and republication never bump that timestamp.
Specifically confirmed: a friends-only Board first published months ago and made public today retains the old
publication timestamp; becoming public does not move it to the top of Recently Published.
Do not implement an updated-content feed instead.

## Evidence: implemented versus required

Inspected sources on the source branch:

- `frontend/src/app/boards/page.tsx` renders `MyBoardsExperience`.
- `frontend/src/components/features/boards/MyBoardsExperience.tsx` combines owner collections with public search;
  its spatial gallery currently uses owned Boards rather than a real popularity feed.
- `frontend/src/components/features/boards/BoardCollections.tsx` loads Saved Boards and renders a mocked Archive.
- `frontend/src/components/features/boards/BoardSelectionExperience.tsx` and `board-selection-store.ts` support
  Continue/Remix; owned draft/published lists currently paginate separately, requiring care for a globally ordered list.
- `backend/src/features/search/` implements public-only search. Suggestions return title strings; ranking uses text
  matching, not the agreed destination requirement. This does not satisfy the new search contract.
- `backend/src/features/boards/boards.types.ts` contains existing Board access rules and numeric Board IDs.
- `backend/db/migrations/011_board_published_at.sql` already introduces publication storage; inspect and preserve
  its semantics before deciding whether another publication migration is necessary.
- `backend/db/migrations/013_board_comments.sql` and existing saved relationships provide some activity data.

The new discovery feeds and view qualification/deduplication are implemented in `backend/src/features/board-discovery/`.

## Implemented API boundary

Use `/api/v1`, numeric Board IDs, existing session authentication and existing error envelopes.
Prefer dedicated Board discovery endpoints so existing generic `/search` consumers retain compatibility:

| Method/path                      | Input                                             | Access/result                                                     |
| -------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| GET `/boards/search`             | `q`, `page=1`, `limit=20`                         | Optional session; eligible matches excluding own Boards           |
| GET `/boards/search/suggestions` | `q`, `limit=4`                                    | Optional session; same ranking and access, compact Board objects  |
| GET `/boards/featured`           | `period=month` or `week`                          | Optional session; up to ten eligible cards                        |
| GET `/boards/recent`             | `page=1`, `limit=20`                              | Optional session; first-publication ordering                      |
| GET `/boards/mine`               | `page=1`, `limit=10`                              | Required session; globally merged owned drafts/published ordering |
| GET `/boards/saved`              | `page=1`, `limit=10`                              | Required session; rich saved summaries, most recently saved first |
| POST `/boards/:boardId/views`    | `{}` to start; `{ "token": "<UUID>" }` to confirm | Optional session; exact frontend Origin; authorized Board         |

Literal routes are registered before `GET /boards/:boardId`. The new saved feed provides rich batch summaries for
the gallery; existing saved-list consumers and bookmark write endpoints remain compatible and share saved relationships.
All writes using cookies require exact frontend Origin.
Guests must not gain access to friend-only Boards through tracking endpoints.

Common card: `boardId`, `title`, `description`, `owner` (public username/displayName/photoUrl), `status`, `visibility`,
`destination`, `coverImageUrl`, `tags`, `durationDays`, `activityCount`, `savedCount`, `savedByMe`, `firstPublishedAt`,
`updatedAt`, optional `savedAt`, and `permissions`.
Destination includes name, region and country; country follows the existing canonical country-code convention.
Nullable photo/cover/destination fields mean unavailable, never invented values. Dates are UTC ISO timestamps.
Use only existing public author fields; never expose authentication identifiers or email addresses.
Final card metadata should match the reused gallery without requiring a full-document request per search suggestion.

Search response shape (empty successful result):

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

Inputs: trim `q`, accept 2–100 characters, positive integer pages and limits; four suggestions and twenty
full results for this UI. Omitted pagination uses defaults; null and empty queries are invalid.
Success with no matches returns an empty array, not an error. Invalid inputs return 400; account-only reads without
a session return 401; inaccessible/deleted Board reads and view writes use the existing non-disclosing 404 policy.
Use the existing middleware's exact error codes when implementing; do not introduce a second error format.

```json
{
    "error": {
        "code": "INVALID_REQUEST",
        "message": "Invalid request"
    }
}
```

The error code above uses the existing validation middleware.

## Storage and frontend behavior

Migration 018 is implemented and applied to shared development after a verified backup; see `backend/db/MIGRATION_LOG.md`.
Persist timestamped viewer activity and a server-issued anonymous identity with account merge support. Preserve enough
history to compute rolling unique counts without repeated-event inflation. Persist/save event history if the current
saved relationship cannot prevent unsave/re-save gaming. Reuse comment timestamps and deletion state.
Enforce authorization before aggregating or returning Board data; viewer-specific results must not leak through shared
caches. Add indexes appropriate to publication ordering and rolling activity aggregation.

Keep each section independently loadable and retryable. Loading/error states must not pretend that an empty response
or an API failure is a successful sample collection. Preserve loaded cards on recoverable pagination failure. Debounce
suggestions, discard stale responses and clear stale preview data on query or access changes. Keyboard focus and
screen-reader announcements must distinguish selected suggestions from submitting the entire query.

Server authorization changes take effect on subsequent reads. Proposed client behavior is to revalidate on focus and
remove a card when an access-denied response arrives; instantaneous cross-tab removal would require an additional
invalidation mechanism, not established by this contract.

## Implementation resolutions

- `POST /boards/:boardId/views` with `{}` starts a server-timestamped UUID challenge. After three continuous visible
  seconds, send `{ "token": "<returned UUID>" }` to the same endpoint. Hidden tabs reset qualification with a fresh
  challenge. The server requires at least three elapsed seconds, checks current access and consumes the challenge
  once. Challenges expire after two minutes. Owner starts return `{ "counted": false, "token": null }`; other starts
  return a token with counted false. Confirmation returns counted true or false and token null. Early confirmation,
  replay and expired tokens count nothing. Browser visibility is enforced by the client; the server verifies elapsed
  time and authorization, not the physical viewer's attention. There is one current challenge per Board/viewer.
- Server-issued UUID browser cookies are HttpOnly, SameSite=Lax, Secure in production and expire after thirty days
  of inactivity. Sign-in merges historical guest views into account views transactionally before completing login;
  account switches/logout rotate linked browser identities on their next tracking call. Latest qualifying view time
  per Board/viewer supports exact rolling unique counts without storing every visit.
- Search recognizes city/country and geographic destination names from stored location metadata, plus a small
  built-in fallback for Stockholm/Paris. Exact place matches take precedence over typing prefixes. Ambiguous prefixes
  include every matching place rather than selecting an arbitrary longest name. This is a bounded first-version
  lexicon, not a global geocoder. No new provider calls, packages or NLP API are required. Empty lexical queries such
  as punctuation return successful empty results.
- Ranking gives direct topic matches 10 points, curated synonyms 7, descriptors one quarter of those values and a
  main destination match a 1-point bonus. Paris/France has explicit place priority for an unqualified Paris query.
  Equal relevance uses total saves, most recent content update and Board ID. The small synonym/descriptor lists are
  versioned in `discovery.ranking.ts`; NLP/semantic interpretation remains planned for the next iteration.
- Featured uses the agreed 1/0.5/5/5 starting weights. Example: 100 account viewers, 20 guest viewers, 3 savers and
  2 commenters score 135; 20 account viewers, 15 savers and 10 commenters score 145, so meaningful engagement can beat
  a larger viewing audience. These are illustrative checks, not measured production optimization. Stable ties finish
  with descending Board ID after the agreed savers/commenters/publication ordering.
- A save-event trigger preserves the qualifying event through unsave/re-save within thirty days. An active save
  contributes only if its preserved event falls within the selected window. A genuinely new save after thirty days
  without a qualifying event can start a new event, avoiding permanent exclusion. Current active relationships alone
  determine whether event points are included.
- All page feeds use the same batch size for initial and later loads (20 Recently Published, 10 personal collections).
  Numbered search uses 20. Ordering is deterministic but not a frozen snapshot: concurrent publication or permission
  changes may shift offsets. Clients deduplicate appended Boards and revalidate on window focus; focus reloads the
  initial collection page. Access is always rechecked on server reads and protected image delivery.
- `npm run cleanup:discovery` removes challenges older than two minutes, expired browser rows, views older than
  31 days and save events older than 60 days. Deployment should schedule this daily; no scheduler is installed here.
  Window and identity expiry checks remain effective without cleanup. This version has no separate analytics system
  or external identity fingerprinting.
- Card responses use `coverImageUrl`, public owner `photoUrl`, `durationDays`, `activityCount`, optional `savedAt`,
  and the other common fields described above. Optional savedAt is absent when unsaved; nullable destination/photo/
  cover/firstPublishedAt mean unavailable, never invented. Country codes remain ISO alpha-3. Validation errors use
  `{ "error": { "code": "INVALID_REQUEST", "message": "Invalid request" } }` with status 400.

## Verification and remaining limits

Independent tests cover ranking, HTTP validation/access, the production page and card presenters, request races,
pagination retry, visible-time qualification and isolated-schema persistence. A read-only smoke check also exercised
the mounted API against shared development. Full suite/build/check results are reported at implementation handoff.
Browser visual/interaction acceptance on desktop/mobile and both themes remains pending: no browser provider was
connected in this session. NLP/semantic search and a global place lexicon remain later-iteration work.

## Decision log and approval record

All sections labeled Confirmed record the user's product decisions from the interview. The user explicitly represents
both frontend and backend, and separately requested implementation on 2026-10-20. Routine technical resolutions above
were selected during that authorized implementation. No absent teammate approval is claimed. The implemented types
and examples in this document define the integration boundary.
