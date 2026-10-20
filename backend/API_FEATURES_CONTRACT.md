# Existing frontend API features

These routes connect the existing frontend to `backend/` using the existing
feature-first layers, PostgreSQL and Google session cookies. Success uses
`{ "data": ... }`; failures use `{ "error": { "code": "...", "message": "..." } }`.
Provider credentials remain server-side. Unknown request fields are rejected.

## Access

Product provider searches, directions, map sessions, destination context and
public Board search are anonymous. Profile routes require a real session.
POST/PUT/PATCH/DELETE requests require the exact configured `CLIENT_ORIGIN`,
including map sessions and directions. Prototype identity headers are ignored.

Cloudinary lab routes, Google Places lab routes and `/api/v1/dev/boards` require
both `NODE_ENV=development` and a signed-in user. They return
`404 NOT_FOUND` outside development and `401 UNAUTHENTICATED` without a session.
`npm run dev` explicitly selects development mode; `npm start` does not enable
these tools. An unapproved mutation Origin returns `403 ORIGIN_NOT_ALLOWED`.

## Provider and Home routes

Country guides use the same guide and selected-place endpoints with optional `kind=country`. Omitting it retains city
behavior. Country scope is included in the returned destination and provider cache identity. It selects public Boards
with matching activity countries at any distance; visibility and pagination rules are unchanged. Wikivoyage country
titles must match the selected name without stripping parenthetical qualifiers. Country articles and getting-around
tips do not require nearby page coordinates. For country guides, `places` contains the matched country's `city` map
group, keeping its order and coordinates without a city-distance cutoff. Other map groups are ignored, and an empty
city group stays empty without reading district guides. The same validation and ten-item limit used for sights apply.
The country frontend selects these cities on the map and opens their city guides. Selection uses the existing
`place-details` endpoint with `kind=country` for a short city description and a credited Wikimedia photograph; it does
not make a place-match request. City guides retain their `see` listings and sight actions. Unsplash searches the country
name once.

Country city details read the selected marker's description from the country guide's Cities section and its attached
Commons file. Missing listing text or photos can fall back to the city article linked by that marker, using its opening
extract and lead image. At most one linked-article read is attempted. Only relative Wikivoyage article links are used;
the public request cannot supply a URL. Intro-only reads do not replace cached full pages. All photos retain source and
license credits and pass the existing size/format checks. Official Creative Commons HTTP license links are normalized
to HTTPS; unknown HTTP license hosts remain unsupported. Missing content stays empty, and independent failures retain
available text or photos with retry feedback. These reads use the existing quotas and bounded caches.

### City tips and selected-place details

The guide's optional Getting around tip keeps up to two source sentences and 40 words. It is read from the matched city's plain-text Wikivoyage transport section. Advice without fare amounts is preferred. Missing text is `cityTip: null`; failed reads also add `cityTip` to `unavailable`.

`GET /api/v1/destinations/place-details` is public and read-only. It accepts the guide's city identity plus `placeId` (1-300 characters), with no `page` or `limit`. It verifies membership in the city's canonical sightseeing list before reading the source page. Success is `{ data: { placeId, description, sourceUrl, image, unavailable } }`. Descriptions keep at most two source sentences and 60 words. `image` is null or `{ url, alt, width, height, author, sourceUrl, licenseName, licenseUrl }`, from the listing's Commons image reference. Original raster images must have a long edge of at least 800 pixels; thumbnails request up to 1200 pixels without upscaling. Credit the author and link the source/license. Missing text or photos return null; upstream component failures also add `description` or `image` to `unavailable`, independently. Invalid queries return 400, foreign/missing listing IDs 404, unavailable canonical sight lists 429/502. No Board or image searches run on detail reads.

TextExtracts returns the numbered plain-text listing lines, so no HTML parser dependency is needed. Full extracts require a single matched page ID. Plain pages and photo metadata use bounded one-hour caches and in-flight sharing; partial failures remain retryable. Descriptions and photos are display-only; Board links carry the original sight identity and coordinates. No database migration is required.

### City destination guides

`GET /api/v1/destinations/guide` is public and accepts `name` (trimmed, 1-100 characters), ISO alpha-3 `country`,
finite `latitude` and `longitude`, optional `page` (default 1) and `limit` (default 6, maximum 20). Unknown fields,
blank coordinates and invalid input return `400 INVALID_REQUEST`.

The data envelope contains `destination: { name, country, countryCode, latitude, longitude }`,
`article: null | { title, description, url }`, `cityTip: null | { title, text, url }`, up to two distinct landscape Unsplash `images` using the existing
provider photo fields, `places`, `boards`, `page`, `hasMore` and `unavailable`. The latter contains failed components from
`description`, `images`, `boards`, `places`, `cityTip`; independent failures still return 200 with the other content. An unmatched
article or an empty successful search is not a failure. The Wikivoyage guide excerpt keeps at most three opening
sentences and 80 words, preferring complete sentences. An oversized first sentence is cut with an ellipsis.
The frontend links to the full article and displays text-license attribution. Home's separate context lead is unchanged.

`places` contains up to ten Wikivoyage sightseeing listings with `id`, `name`, `address`, `latitude`, `longitude`
and `provider: "wikivoyage"`. Read the matched city's `see` map group in guide order, keeping distinct named Point
listings within 25 km. If the city page has no direct listings, read up to ten linked district pages in one batch
and take turns between their listings. Names are plain text. Same-name cities are separated by title and location.
These are travel-guide selections, not a measured popularity ranking. Empty results stay empty; failures return
`places: []` with `places` in `unavailable`. The source ID is `wikivoyage:<pageId>:<normalized name>`; the frontend
derives a source-page link and credits Wikivoyage contributors under CC BY-SA 4.0, when displaying a sight.

`POST /api/v1/destinations/match-place` accepts `{ name, city, country, latitude, longitude }`, requires frontend
Origin and allows anonymous use. Search Mapbox by name, city, country and proximity; keep only a same-name,
same-country match within 500 m. Return `{ data: { latitude, longitude } }` or `{ data: null }` for no match or
missing configuration. Provider failures return safe 502/429 responses. Only selecting a sight triggers a match.
Its coordinates affect the temporary marker; Board links keep the original travel-guide data.
Responses use `Cache-Control: no-store`, and Mapbox results are never saved in PostgreSQL.

The destination page opens the Board creator with the selected travel-guide sight. It has no save-for-later action.
The former `/destinations/resolve-place` endpoint was removed; Mapbox matching is display-only.

Wikivoyage searches city and country and examines up to five candidates. A candidate must match the city name
(ignoring accents and geographic qualifiers), have primary Earth coordinates within 50 km, contain opening text,
and not be a disambiguation page. The nearest eligible candidate supplies the article. The adapter uses
[coordinates](https://www.mediawiki.org/wiki/Extension:GeoData#prop=coordinates),
[page properties](https://www.mediawiki.org/wiki/API:Pageprops) and
[plain-text opening extracts](https://www.mediawiki.org/wiki/Extension:TextExtracts#API).

Board summaries contain numeric `boardId`, actual author `username`, `title`, nullable `description`, `durationDays`,
tag names, up to six ordered activity titles and up to six image summaries. Images have `url` and `alt`, with
photographer/source fields for external photos. The chosen Board cover is first, followed by remaining saved
images and external activity photos. Image URLs use the existing protected content route.

Each request queries only published, public Boards with an activity location in the same country within 25 km
of the selected centre. Country matching accepts stored ISO codes and the English country name. Each Board is
returned once, ordered by updated time descending and then Board ID descending. Signed-in ownership or membership
does not broaden discovery. Board results and visibility are never cached; HTTP responses use `Cache-Control: no-store`.

Wikivoyage introductions, Unsplash photos and Wikivoyage sights use separate bounded memory caches of 64 city identities each for one hour, including empty
successful results. Concurrent reads share pending provider requests. Failed requests are removed from the cache,
and a page read does not retry upstream automatically. Provider operations retain PostgreSQL quota reservations
and response-feedback observers. The cache clears on restart and does not replace shared quotas. Home's
`/destinations/context` keeps its existing response and behavior. The request schemas and response types live in `src/features/destinations/`.

Wikivoyage requests share the existing `wikipedia.action_api` budget. Each HTTP request, including the optional
district batch, reserves quota and forwards response feedback. Selected-sight matching uses `mapbox.search_box`.
Existing limits and counters are retained.

The optional database regression is `npx tsx --test integration/destination-guide.db.ts` from `backend/`.
It reads `TEST_DATABASE_URL` or `DATABASE_URL`, puts fixture inserts and repository reads on one transaction client,
and rolls back afterward. Explicit identity values avoid advancing shared database sequences. It checks nearby
public filtering, same-country matching, stable pagination, duplicate locations, image order and visibility changes.

### Retained saved-place API (no frontend use)

No current frontend page calls these routes. The destination guide supports browsing sights and starting a Board from a sight. Account saving is undecided; these backend routes and existing records are retained until the team decides whether to remove them.

`GET /api/v1/saved-places` lists only the session owner's saved locations, newest first. `POST` accepts
`{ id, name, address, latitude, longitude, city, country }` and upserts that owner's place identifier; a repeat save
retains `savedAt`. Both return the normal data envelope; records include server-generated `savedAt`.
`DELETE /api/v1/saved-places/:placeId` removes only the caller's record and returns 204 even if already absent.
All require a session, writes require frontend Origin, and unknown body fields are rejected. Anonymous access
returns 401, wrong Origin 403, invalid input 400. No client user ID is accepted. Migration 008 adds `saved_place`,
separate from Google Place references and saved Board activities.

### Existing provider and Home routes

The paths below are relative to `/api/v1/providers` and return the existing
frontend types from `frontend/src/lib/providers.ts`.

| Method   | Path                            | Input and behavior                                                                                                             |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET      | `/config`                       | Configuration booleans, Google billing notice and optional public cloud name; no keys or Mapbox token                          |
| GET      | `/locations/search`             | `q`, optional `limit`; Geoapify results for confirmed Board activity locations                                                 |
| GET      | `/locations/destinations`       | ISO `country`, `city`, optional `limit`; matching Geoapify cities                                                              |
| GET      | `/locations/reverse`            | `latitude`, `longitude`; Geoapify area/city and identified POI details for user-confirmed photo suggestions                    |
| POST     | `/mapbox/map-session`           | Reserve a map load and return `{ publicToken }`; only a `pk.` token                                                            |
| GET      | `/mapbox/search`                | Mapbox Search Box text search using `q`/`limit`, including POIs, restaurants and landmarks; temporary preview results          |
| GET      | `/mapbox/reverse`               | Temporary reverse geocoding using coordinates; not the saved-location provider                                                 |
| POST     | `/mapbox/directions`            | `{ points: [{ latitude, longitude }], profile }`; return kilometres, minutes and `[longitude, latitude]` geometry              |
| GET      | `/unsplash/search`              | `q`, optional `limit`; images with photographer/source attribution                                                             |
| GET      | `/google-places/search`         | `q`, optional `limit`; live POIs with stable IDs and Google Maps links                                                         |
| GET      | `/google-places/:placeId`       | Live details without the display-name billing field                                                                            |
| GET/POST | `/google-places/saved`          | Caller-owned durable `{ placeId, savedAt }` references; POST accepts `{ placeId }` and keeps the original date on repeat saves |
| DELETE   | `/google-places/saved/:placeId` | Remove only the caller's reference; `204`, or `404 NOT_FOUND`                                                                  |
| POST     | `/cloudinary/upload`            | Multipart `file`, JPEG/PNG/WebP/HEIC/HEIF, at most 10 MB; return a lab asset and available metadata                            |
| GET      | `/cloudinary/assets`            | Up to 30 lab-tagged assets, newest first                                                                                       |
| GET      | `/cloudinary/metadata`          | `publicId`; capture time, camera and GPS when available                                                                        |
| GET      | `/cloudinary/delivery`          | `publicId`, optional `width`, `height`, `crop`; `{ url }` for a lab transformation                                             |

Search queries have 2–100 characters and limits of 1–10, default 5. Directions
accept 2–10 points and walking/cycling/driving, default walking. Coordinates are
finite and within geographic bounds. Saved-location response names remain
`MapboxSearchResult`/`MapboxLocation` for frontend compatibility despite using Geoapify.

Lab uploads use `roamboard/provider-lab/` and the `roamboard-provider-lab` tag.
They create no Board media rows. Inspection/delivery cannot access protected
Board originals. Lab assets remain at Cloudinary until cleaned there; Board
orphan cleanup does not manage them. GPS remains a suggestion for user confirmation.

Missing keys return `503 PROVIDER_UNAVAILABLE`; upstream rejection/timeout returns
`502 PROVIDER_FAILED`. Invalid input returns `400 INVALID_REQUEST`; oversized
files return `413 IMAGE_TOO_LARGE`; exhausted budgets return `429 PROVIDER_QUOTA_EXHAUSTED`
before an upstream call.

`GET /api/v1/destinations/search?q=...&limit=3` returns temporary Mapbox destination results.
One Geocoding v6 request forwards the user's query unchanged with `types=country,region,place`, autocomplete and
no proximity, country or bounding-box restriction. This includes travel provinces, states and countries as well as
cities; regions/countries keep their actual `placeType` and have `city: null`. Country codes remain ISO alpha-3.
There is no curated destination catalog or population threshold. Ranking uses case/accent/punctuation-normalized
display names and provider aliases, with a leading English "The" ignored:

1. Exact names (four or more normalized characters) and complete name-plus-country/region qualifiers.
2. Close whole-name spellings for queries of five or more characters: normalized edit similarity at least 0.8,
   including adjacent transpositions. Higher similarity wins within this group.
3. Prefix matches. Short inputs retain provider order rather than forcing a tiny exact namesake above prominent prefixes.
4. Provider-ranked fuzzy results when none of the stronger groups is present.

Only the strongest available group is returned, without padding with weaker results. Provider order breaks ties,
preserving Mapbox prominence where textual strength is equal. One winner per normalized displayed name and provider ID
is retained before applying the requested limit. Alias/qualifier/ranking metadata remains internal; the public response
shape is unchanged. A generic transport label filter excludes airports, aerodromes, airfields, heliports,
railway/train/bus stations and bus/ferry terminals, including facilities misclassified as places. This is best effort,
not an authoritative geographic classification or Google-equivalent ranking. Mapbox v6 exposes no population or
non-address confidence field for this purpose. No additional provider requests, caching or persistence are introduced.
The separate provider Search Box/POI search is unchanged.
`GET /api/v1/destinations/context` accepts the selected `id`, `name`, `address`,
`latitude`, `longitude`, `placeType`. It returns the selected destination,
optional Open-Meteo weather, Wikipedia article and Unsplash image, plus
`unavailable` labels (`weather`, `description`, `image`). Individual provider
failures or exhausted budgets do not discard the other context results.
Preview coordinates are not proof of a validated persistent location.

## Signed-in profile

Paths below are relative to `/api/v1/users/me` and return the types in
`frontend/src/lib/profile.ts`.

| Method | Suffix              | Behavior                                                                                                          |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET    | None                | Caller profile, biography as `description`, tag names, image reference and timestamps                             |
| PATCH  | None                | Replace `{ displayName, description, location, interests }`; return saved profile                                 |
| PUT    | `/profile-picture`  | Set `{ imageId }` only for an existing image uploaded by the caller; return saved profile                         |
| DELETE | `/profile-picture`  | Remove picture; return saved profile; immediately attempt cleanup of unreferenced Cloudinary/database images      |
| GET    | `/stats`            | Visible published Board travel totals, published activities, owned Board count, accepted friends and saved totals |
| GET    | `/boards`           | All owned Boards, newest updated first, primary destinations and confirmed activity locations                     |
| GET    | `/recent-boards`    | Latest six owned Boards by update time; not browsing history                                                      |
| GET    | `/map-destinations` | Visible published or owner-saved locations with Board IDs/titles, covers and completion flags                     |
| GET    | `/saved-boards`     | Saved Boards pagination (`page` positive integer default 1, `limit` integer 1–100 default 20)                     |

Strings use the existing 500-character columns. Display name is required;
description can be empty and location nullable. Interests are up to three
distinct names from `/api/v1/tags`. Username remains read-only. `settings` is an
empty compatibility object, not a persisted settings feature. Country codes are
derived from recognised stored country names, otherwise null. Application codes
and provider responses use ISO 3166-1 alpha-3 (for example `SWE`, `JPN`, `FRA`).
Destination requests require a valid three-letter code. Only Geoapify's outgoing
country filter is converted to alpha-2. Both apps reuse
[the shared mapping](../shared/COUNTRIES.md); existing names and fuzzy selection
remain in the frontend country helper. Existing accounts
receive migration-time timestamps because the baseline had no creation timestamp.

Picture ownership is checked before linking and again in the transaction;
absent/foreign images return `404 NOT_FOUND`. Linked pictures are excluded from
orphan deletion and use the existing protected image-content route. The frontend
resolves relative picture paths against the API URL.

The profile lab creates Boards through canonical `POST /api/v1/boards`, with
selected cities represented as located activities on day one. It introduces no
second Board model. Canonical writes accept optional `isCompleted`: false on
creation, preserved when omitted on replacement. Only the owner can change it;
editor members may retain its current value. The rest of the creator contract
remains in [BOARD_API_CONTRACT.md](BOARD_API_CONTRACT.md).

## Public profiles

`GET /api/v1/users/by-handle/:handle` accepts a public handle parameter (1–64 characters,
alphanumeric plus dots and underscores). It returns `{ data: PublicProfileView }`:

- `profile`: `{ username, displayName, description, location, occupation, languages, interests, profilePicture }`
- `isOwner`: boolean (`true` when the caller session matches the profile owner)
- `friendshipStatus`: `"none" | "pending_sent" | "pending_received" | "accepted"` (`"none"` for anonymous callers or viewing own profile; otherwise reflects relation between caller and user)
- `stats`: `{ countriesVisited, citiesExplored, continentsCovered, photosUploaded, activitiesDone, boardsCreated, friends, activitiesSaved, boardsSaved }`
- `boards`: public published boards, plus friends-only published boards when the viewer is the owner or an accepted friend
- `savedBoards`: the profile owner's saved published Board summaries, newest save first. Visitors see public Boards and
  friends-only Boards they can access through friendship with the Board author (or author ownership). The saver must
  also retain Board access. Viewing a profile never grants Board access. Collaborator-only saves remain owner-only.
  These are the profile owner's bookmarks, not the visitor's bookmark state. The frontend previews three and expands
  the person's full visible collection through View all; no mutation of the profile owner's bookmarks is exposed.
- `destinations`: primary destinations and confirmed activity locations on those same visible published boards, with coordinates, city, country code, board ID/title, cover URL, completion flag and `collection: "published"`

Profile maps exclude drafts and collaborator-only boards, including for owners. Countries, cities and continents count
distinct locations across visible published boards, whether completed or not. Photos count distinct uploaded images
attached to those boards. `activitiesDone` currently counts all activity rows on visible published boards. Restricting it to completed boards
is deferred until completion controls are implemented; activities have no individual completion flag. Saved boards do not increase travel totals.

`GET /api/v1/users/me/map-destinations?scope=published` returns the caller's public and friends-only published locations.
`scope=saved` returns locations of bookmarked public boards and friends-only boards whose author is currently an
accepted friend. It excludes collaborator-only boards, including bookmarked boards to which membership grants access.
Saved locations carry `collection: "saved"`; this `/me` route always reads the session owner's collection. The historical
`scope=visited` additionally restricts the published collection to completed boards. Omitted scope means published.
Unsupported scopes return `400 INVALID_REQUEST`; unauthenticated map reads return `401 UNAUTHENTICATED`.

`GET /api/v1/users/by-handle/:handle/saved-map-destinations` shares a profile's saved map with the profile owner
and accepted friends only. It requires a session (`401`), returns `403 FORBIDDEN` to other viewers (including pending
friends), and `404 NOT_FOUND` for a missing profile. Every returned saved board must also be public or friends-only
with the actual viewer authorized through friendship with its author (or author ownership). Friendship with the profile
owner does not grant access to another author's friends-only board. Drafts and collaborator-only boards remain excluded.
Each request checks current friendships, including revoked access. Saved locations never increase travel totals.

Missing handles return `404 NOT_FOUND`. Invalid handle formats return `400 INVALID_REQUEST`.

## Friendships and Social Hub

Friendship routes are under `/api/v1/users`. Read routes require a signed-in session (`401 UNAUTHENTICATED`);
mutation routes (POST, PUT, DELETE) additionally require a matching frontend `Origin` header (`403 ORIGIN_NOT_ALLOWED`).
All JSON response bodies follow `{ "data": ... }` on success and `{ "error": { "code": "...", "message": "..." } }` on failure.

| Method | Path                                    | Permissions               | Input and behavior                                                                                                                                                                                                                                                         |
| ------ | --------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/me/friends`                           | Session                   | List accepted friends for the caller: `[{ friendshipId, acceptedAt, userId, username, displayName, profilePictureUrl, bio, location }]`. `acceptedAt` records the acceptance timestamp (used for "Recently added" sorting), and `friendshipId` identifies the request row. |
| DELETE | `/me/friends/:targetUserId`             | Session + Frontend Origin | Remove friendship with `targetUserId`; returns `204 NO_CONTENT`. Returns `404 NOT_FOUND` if friendship does not exist                                                                                                                                                      |
| DELETE | `/by-handle/:handle/friend`             | Session + Frontend Origin | Remove friendship with user by handle; returns `204 NO_CONTENT`. Returns `404 NOT_FOUND` if user or friendship does not exist                                                                                                                                              |
| POST   | `/by-handle/:handle/friend-request`     | Session + Frontend Origin | Send friend request to target handle; returns `201 CREATED` with `{ requestId, status }`. Supports crossed-request mutual acceptance (see details below)                                                                                                                   |
| GET    | `/me/friend-requests`                   | Session                   | List pending incoming requests for the caller: `[{ requestId, createdAt, requester: { userId, username, displayName, profilePictureUrl } }]`                                                                                                                               |
| PUT    | `/me/friend-requests/:requestId/accept` | Session + Frontend Origin | Accept pending incoming request; returns `{ requestId, status: "accepted" }`. Returns `404 NOT_FOUND` if request missing or not addressed to caller                                                                                                                        |
| DELETE | `/me/friend-requests/:requestId`        | Session + Frontend Origin | Reject/cancel incoming request; returns `204 NO_CONTENT`. Returns `404 NOT_FOUND` if request missing or not addressed to caller                                                                                                                                            |
| GET    | `/search`                               | Session                   | Search travelers by display name or handle prefix/substring: `q` (max 100 chars, default `""`), `limit` (1–50, default 20); returns `UserSearchResult[]`                                                                                                                   |
| GET    | `/me/friends/boards`                    | Session                   | Published boards owned by caller's accepted friends, ordered by `COALESCE(b.published_at, b.created_at) DESC`; `limit` (1–50, default 20)                                                                                                                                  |
| GET    | `/me/friends/activity`                  | Session                   | Recent friend publications (`activityType: "published_board"`), ordered and timestamped by `COALESCE(b.published_at, b.created_at) DESC`; `limit` (1–50, default 20)                                                                                                       |

### Friend request mechanics and crossed requests

Sending a friend request via `POST /api/v1/users/by-handle/:handle/friend-request` behaves as follows:

- Self-requests return `400 INVALID_REQUEST` ("Cannot add yourself as a friend").
- If no existing relation exists, creates a pending friendship row and returns `{ requestId, status: "pending_sent" }`.
- If an existing relation is already accepted, returns `409 ALREADY_FRIENDS` ("Already friends").
- If the caller already sent a pending request, returns `409 REQUEST_ALREADY_SENT` ("Friend request already sent").
- If the recipient had previously sent a pending request to the caller (crossed request), the service automatically
  marks the friendship as accepted and returns `{ requestId, status: "accepted" }`.
- Concurrent simultaneous requests that race through initial lookups are handled via the unique index constraint
  (`uq_friendship_pair` / PostgreSQL error `23505`). The conflict handler re-fetches the winning row, confirms or completes
  the acceptance if crossed, and returns the appropriate status (`"accepted"` or `"pending_sent"`) rather than failing with a 500 error.

### Feed limits and publication timestamps

Both `/me/friends/boards` and `/me/friends/activity` validate the `limit` query parameter with `friendsQuerySchema`
(integers from 1 to 50, defaulting to 20). Values out of range or non-integers return `400 INVALID_REQUEST`.
Feeds sort items by `COALESCE(b.published_at, b.created_at) DESC`, guaranteeing that boards drafted earlier and published
later appear at the top of the feed at their actual publication time rather than their draft creation time.

### Endpoint error codes and statuses

- `400 INVALID_REQUEST`: Self-requests, invalid UUID or handle parameters, invalid request bodies, or non-integer / out-of-range limit queries (e.g., `-1`, `1.5`, `999`).
- `401 UNAUTHENTICATED`: Missing or invalid session cookie on protected routes.
- `403 ORIGIN_NOT_ALLOWED`: Mutation requests (POST, PUT, DELETE) where the `Origin` header does not match the configured `CLIENT_ORIGIN`.
- `404 NOT_FOUND`: Target user handle, user ID, friendship pair, or friend request ID does not exist or is not addressed to the caller.
- `409 ALREADY_FRIENDS`: Friendship is already accepted between caller and target.
- `409 REQUEST_ALREADY_SENT`: A pending request has already been sent to this user.

## Developer Board list and public search

`GET /api/v1/dev/boards?page=1&limit=20` returns summaries (`boardId`, `ownerId`,
`title`, `status`, `visibility`, `updatedAt`, `coverImageUrl`) and
`meta: { page, limit, hasMore }`. It includes caller-owned drafts and published
Boards readable through public visibility, membership or accepted friendship.
Another owner's draft is always excluded, including for members. Page is
positive and limit is 1–100. Details/deletion use existing canonical Board
endpoints and permissions. The lab renders actual days, activities, tags and
protected images; the full API record stays unmodified.

`GET /api/v1/search?q=...` accepts optional `entityType` (`itinerary` only), `country`, `category`,
`page` (default 1), `limit` (default 10, maximum 50), within the first 1,000 results.
It returns `{ hits: [{ document, score }], total, page, limit }`.
`GET /api/v1/search/suggestions?q=...&limit=6` returns distinct current Board
titles. Queries have 2 to 100 characters. Search reads PostgreSQL records on each
request. The API ranks matching words with title, city and country weighting and
bounded edit distance for typos; suggestions match title word prefixes. Country
and category filters and pagination retain the response shape above. Ranking is
application code over the current public dataset, not a database full-text index;
large datasets will need a separate PostgreSQL query/index optimization.

The durable source is public, published PostgreSQL Boards, represented as
`itinerary` documents. Activities and their locations are never standalone search
results. Place/destination entity filters are rejected with `400 INVALID_REQUEST`.
External POIs, restaurants and landmarks use the separate Mapbox Search Box
endpoint and are temporary discovery results. Geoapify provides activity locations
that users confirm and save in PostgreSQL.

Search and suggestions check fresh public Board data before returning content.
Draft, private and deleted Boards are excluded. Results may shift during concurrent edits.
No separate search store, synchronization or initial reindex is required. Board
writes and deletions are visible through the next database read.

## Shared usage budgets and verification

Migration `004_api_features.sql` adds PostgreSQL quota counters, per-user Google
place references and profile timestamps. All time windows reserve atomically;
exhaustion rolls back counters and skips the upstream call. Failed upstream
calls still consume reservations. Restarts/processes share usage. Each policy/window
type uses one counter row with previous-bucket count/end fields. New periods reuse
that row and start with the reserved units; delayed requests from an older period
are denied rather than resetting a newer counter. All window changes still roll
back together if any limit is exhausted. Verified billing months use calendar boundaries;
other windows conservatively count the current bucket plus the entire previous
bucket while it could overlap the trailing interval. This prevents boundary bursts
without a per-request log. It can block earlier and up to a bucket longer than an
exact sliding window. Open-Meteo's month guard is a fixed 31-day duration, not an
assumed provider calendar month. Rows use explicit `:rolling:` names for these guards.

Mapbox map loads, geocoding and directions use their monthly budgets without extra daily application caps.
Geoapify uses its daily and second guards without an extra hourly application cap. Provider-published rate
windows remain for other APIs, and upstream rate-limit/cooldown feedback is always honored.

There is no per-period history or cleanup job. The current policies use at most 16
counter rows plus 11 `provider:cooldown` rows, independent of request volume.
Cooldown rows use `window_end` as the next permitted attempt time; `window_start`
is negative infinity and `used` stays zero. Every reservation locks its policy's
cooldown row before checking all counters. Restarts and multiple backend instances
share both counts and cooldowns, regardless of user authentication.

### Provider reset rules and response feedback

Public documentation reviewed on 2026-10-15. Account-specific limits still need
confirmation in the team's provider consoles. Known calendar billing boundaries
are distinguished from conservative application guards below.

| Provider      | Documented rule and implemented handling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Places | Free usage resets on the first of the month at midnight US Pacific time. Calendar months use `America/Los_Angeles`, including DST. [Google pricing overview](https://developers.google.com/maps/billing-and-pricing/overview).                                                                                                                                                                                                                                                                                                     |
| Mapbox        | Calendar-month free usage; usage reporting is UTC. Monthly application counters use UTC. Other application guards are rolling. HTTP 429/reset feedback respects `X-Rate-Limit-Reset`; it describes a short rate interval, not the monthly billing allowance. [Billing](https://docs.mapbox.com/accounts/guides/invoices/), [UTC usage](https://docs.mapbox.com/accounts/guides/statistics/), [rate-limit headers](https://docs.mapbox.com/api/guides/#rate-limit-headers).                                                         |
| Geoapify      | Daily credits and requests/second are published, but an exact daily reset timezone was not established. Rolling 24-hour and second guards avoid guessing midnight; there is no additional hourly application budget. Honor `Retry-After` when returned. [Pricing](https://www.geoapify.com/pricing/), [rate limiting](https://www.geoapify.com/how-to-avoid-429-too-many-requests-with-api-rate-limiting/).                                                                                                                        |
| Unsplash      | Team-confirmed production allowance is 1,000/hour; application cap is 990. No exact hourly boundary was established from the docs, so use a conservative trailing-hour guard. Observe remaining/reset headers when present; zero remaining without a reset pauses for an hour. [Unsplash documentation](https://unsplash.com/documentation#rate-limiting).                                                                                                                                                                         |
| Open-Meteo    | Publishes minute/hour/day/month allowances without precise reset boundaries on its pricing page. Use trailing-duration guards (including 31 days for the month); honor upstream `Retry-After`. The current five-day, three-variable request counts as one call; expanded weather requests may cost multiple units and must update accounting. [Pricing and call calculation](https://open-meteo.com/en/pricing).                                                                                                                   |
| Wikipedia     | Per-minute limits depend on client identification, not a monthly billing reset. Use a rolling minute guard and a meaningful server `User-Agent` with a project contact URL. Honor `Retry-After`; unknown 429 cooldown defaults to five seconds. [Wikimedia limits](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits).                                                                                                                                                                                                     |
| Cloudinary    | Admin API exposes hourly remaining/reset metadata. Lab listing/inspection and protected upload verification observe that metadata, including SDK HTTP 420/429 errors, with a rolling-hour application guard. This does not meter storage or transformation/bandwidth credits: Free/self-service plans use current storage and rolling 30-day transformation/bandwidth usage. [Admin API](https://cloudinary.com/documentation/admin_api), [credit periods](https://cloudinary.com/documentation/developer_onboarding_faq_credits). |

Quota-managed HTTP adapters observe feedback before parsing the response. On 429,
or 503 with `Retry-After`, persist a cooldown and return safe 429 errors instead of
generic provider failures. `Retry-After` supports seconds and HTTP dates; reset
headers support Unix seconds. If both specify a time, wait for the later one.
Zero remaining can establish a cooldown even on a successful response, while that
response's data is returned normally. A missing/invalid 429 reset uses a five-second
fallback; known exhaustion without a reset uses the policy's longest duration.
Cooldown updates only extend an existing block. No automatic retries are performed.
Already-reserved in-flight requests cannot be recalled. Local blocks also return
`Retry-After` when known; Home context retains its partial-availability behavior.

Quota counters cannot reconstruct discarded historical windows, pre-rollout requests,
external calls or provider billing state. Restoring an older database also restores
older quota counts. These controls do not promise exact account-wide reconciliation
or guaranteed zero charges. Off-backend public-token calls and Cloudinary credit
usage still require provider-console controls and monitoring.

Application budgets in `src/features/quotas/quota.policies.ts` are:
Mapbox map loads 49,500/month and 1,540/day; geocoding/directions each
99,000/month and 3,090/day; Geoapify 2/second, 118/hour and 2,970/day; Google text
search 4,950/month and details 9,900/month; Open-Meteo 590/minute, 4,950/hour,
9,900/day and 297,000/month; Wikipedia 190/minute; Cloudinary Admin 495/hour,
shared by lab inspection and Board upload verification. Unsplash uses 990/hour,
below the team's confirmed [1,000/hour production allowance](https://unsplash.com/documentation#rate-limiting).

Mapbox Search Box has a separate conservative application budget of 495 requests
per month and 9 per second until the team's account allowance is confirmed.
It is not charged to the geocoding counter. The standalone text-search endpoint
uses request billing, without autocomplete sessions; see
[Mapbox Search Box documentation](https://docs.mapbox.com/api/search/search-box/).
Its results are for temporary use and are not written to the database. Geoapify
continues to supply persistent Board locations and Home retains city geocoding.

These count API calls and map-load reservations, not account-wide usage from
other applications or reuse of public tokens. Permanent Mapbox storage remains
disabled. Review provider dashboards before changing application budgets.

Backend tests inject fakes and mock upstream responses. Independently authored
frontend tests verify URLs, cookies, payloads and errors. `npm run test:db` applies
all migrations in temporary schemas and checks persistence, permissions and
concurrent quota rollback without changing shared application tables. Live
provider accounts, browser flows and deployment migrations need environment checks.

### Contextual saved-location search

GET /api/v1/locations/search accepts both context coordinates or neither; partial or out-of-range pairs return 400.
Coordinates are a soft preference, never a hard restriction. Exact generic terms such as cafe or restaurant with
context use Geoapify Places discovery; named queries use text geocoding with the same bias. Provider relevance
order is preserved without category boosts. Results suggest the existing activity category. The frontend uses
current-day area, then Board area, and labels this Search location. Mapbox remains the map renderer.
See [Geoapify geocoding bias](https://apidocs.geoapify.com/docs/geocoding/) and
[Places proximity bias](https://apidocs.geoapify.com/docs/places/).

### Main destinations and activity photos

GET /api/v1/providers/locations/areas takes q and optional limit, using Geoapify type=locality through the shared
geocoding budget for persistent cities, regions and states. Temporary Mapbox Home search data is not stored.

GET /api/v1/providers/unsplash/activity-photo takes name, latitude, longitude and optional city/country, returning
a canonical photo or null. POST with the same JSON requires session and exact Origin and records a selection.
Invalid/missing GPS returns 400. A single specific search inspects at most three photo-detail records, without
broadening to the city/country. GPS within 100m or exact place-name plus city/country metadata supports a match;
GPS over 3km away rejects it. Coordinates are never inferred from search rank. Missing confident evidence returns
null. Each upstream search, detail and download-equivalent selection consumes the existing Unsplash budget; no
automatic retries or increased quotas. Hotlinks and photographer/Unsplash referral credits are retained.
See [Unsplash photo details and selection](https://unsplash.com/documentation#get-a-photo) and
[Geoapify locality search](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/).

### Uploaded photo presentation

GET /api/v1/images/:imageId/presentation returns {edit,revision} for the uploader. PUT accepts the same JSON, with
exact frontend Origin, and saves only for the uploader at that expected revision. edit is null (reset), or normalized
x/y/width/height crop bounds inside the original and integer outputWidth/outputHeight limits from 32 to 4096.
Invalid bounds return 400, missing sessions 401, inaccessible IDs 404 and stale edits 409. Originals, capture
metadata, image IDs and Board links stay unchanged. Edits affect every use of the upload, independently of Board
field saves. Content variant=original is uploader-only and bypasses edits, providing a bounded 4096px source for the
editor. Display/thumbnail delivery applies edits before existing size limits; optional v is a cache-busting revision.
No raw Cloudinary URL or arbitrary transformation input is accepted.

POST /api/v1/providers/locations/suggest-area requires session/Origin and {points:[{latitude,longitude,city?,country?}]}
with 3 to 100 points. At least three points and 60% of the batch must share a country-compatible cluster within 120km.
The medoid supplies one Geoapify reverse lookup: state for multiple cities or spread over 25km, otherwise city.
Ambiguous input returns null without upstream calls. Responses do not persist a Board destination. Quota limits and
feedback remain unchanged. See [Cloudinary crop coordinates](https://cloudinary.com/documentation/transformation_reference#c_crop).

### Destination illustration pools

GET /api/v1/providers/unsplash/search accepts limit 1 to 20 (default 5). Other provider search limits remain unchanged.
Board decorative spaces share destination/country results rather than making exact hotel/POI requests. Shared
Unsplash request quotas are unchanged; rendering illustrations does not persist them as activity images.
