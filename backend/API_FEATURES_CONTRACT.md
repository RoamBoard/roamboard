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

Cloudinary lab routes, Google Places lab routes, `/api/v1/dev/boards` and search
reindexing require both `NODE_ENV=development` and a signed-in user. They return
`404 NOT_FOUND` outside development and `401 UNAUTHENTICATED` without a session.
`npm run dev` explicitly selects development mode; `npm start` does not enable
these tools. An unapproved mutation Origin returns `403 ORIGIN_NOT_ALLOWED`.

## Provider and Home routes

The paths below are relative to `/api/v1/providers` and return the existing
frontend types from `frontend/src/lib/providers.ts`.

| Method   | Path                            | Input and behavior                                                                                                             |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET      | `/config`                       | Configuration booleans, Google billing notice and optional public cloud name; no keys or Mapbox token                          |
| GET      | `/locations/search`             | `q`, optional `limit`; Geoapify results suitable for saved locations                                                           |
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

`GET /api/v1/destinations/search?q=...&limit=6` returns temporary Mapbox locations.
`GET /api/v1/destinations/context` accepts the selected `id`, `name`, `address`,
`latitude`, `longitude`, `placeType`. It returns the selected destination,
optional Open-Meteo weather, Wikipedia article and Unsplash image, plus
`unavailable` labels (`weather`, `description`, `image`). Individual provider
failures or exhausted budgets do not discard the other context results.
Preview coordinates are not proof of a validated persistent location.

## Signed-in profile

Paths below are relative to `/api/v1/users/me` and return the types in
`frontend/src/lib/profile.ts`.

| Method | Suffix              | Behavior                                                                                                                      |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET    | None                | Caller profile, biography as `description`, tag names, image reference and timestamps                                         |
| PATCH  | None                | Replace `{ displayName, description, location, interests }`; return saved profile                                             |
| PUT    | `/profile-picture`  | Set `{ imageId }` only for an existing image uploaded by the caller; return saved profile                                     |
| DELETE | `/profile-picture`  | Unlink picture; return saved profile; unreferenced files enter normal orphan cleanup                                          |
| GET    | `/stats`            | Completed published Board countries, all owned Board count, accepted friends, saved activities as `placesSaved`, saved Boards |
| GET    | `/boards`           | All owned Boards, newest updated first, destinations derived from activity locations                                          |
| GET    | `/recent-boards`    | Latest six owned Boards by update time; not browsing history                                                                  |
| GET    | `/map-destinations` | Owned published Board locations with Board IDs/titles and completion flags                                                    |

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
titles. Queries have 2–100 characters. Elasticsearch supplies fuzzy matching,
prefix suggestions and filters.

The durable source is public, published PostgreSQL Boards, represented as
`itinerary` documents. Activities and their locations are never indexed as
standalone search results. Place/destination entity filters are rejected with
`400 INVALID_REQUEST`. External POIs, restaurants and landmarks use the separate
Mapbox Search Box endpoint; they are not persisted into the Board search index.
Provider queries filter current public
IDs, then displayed content and suggestion titles are checked against a fresh
database read. Private, draft and deleted Boards cannot leak from stale index
records. Results may shift during concurrent edits.

`POST /api/v1/search/reindex` refreshes the derived `roamboard-boards-v1` index and
returns `{ indexed, index }`. Existing Boards need an initial reindex. Board
saves/deletes attempt an index update after the PostgreSQL commit. A search
outage does not roll back a saved Board or claim saving failed; reindexing
reconciles missed updates. Missing Elasticsearch returns `503 SEARCH_UNAVAILABLE`;
upstream failure returns `502 SEARCH_FAILED`.

## Shared usage budgets and verification

Migration `004_api_features.sql` adds PostgreSQL quota counters, per-user Google
place references and profile timestamps. All time windows reserve atomically;
exhaustion rolls back counters and skips the upstream call. Failed upstream
calls still consume reservations. Restarts/processes share usage. Old windows
are pruned after 31 days. Google months use America/Los_Angeles; others use UTC.

Budgets in `src/features/quotas/quota.policies.ts` retain the prototype limits:
Mapbox map loads 49,500/month and 1,540/day; geocoding/directions each
99,000/month and 3,090/day; Geoapify 2/second, 118/hour and 2,970/day; Google text
search 4,950/month and details 9,900/month; Open-Meteo 590/minute, 4,950/hour,
9,900/day and 297,000/month; Wikipedia 190/minute; Cloudinary Admin 495/hour,
shared by lab inspection and Board upload verification. Unsplash uses 49/hour,
below its [50/hour demo allowance](https://unsplash.com/documentation#rate-limiting),
because production approval has not been established.

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
