# AI generated summary of the feature contract.

# Board creator API contract (v1)

**Evidence:** `extended-backend-demo`; `frontend/src/app/boards/page.tsx`, `frontend/src/app/boards/new/page.tsx`, `frontend/src/components/features/boards/BoardCreator.tsx`, `BoardImageIntake.tsx`, `BoardDiscoveryDetails.tsx`, `DayPlanner.tsx`, `frontend/src/types/board-creator.ts`, `frontend/src/lib/boards.ts`, `backend/src/app.ts`, and `backend/db/migrations/001_initial.sql`. The frontend creator is a prototype; its current request does not match an implemented Board endpoint. The migration is the current database state, not a limit on the agreed design. Cloudinary is the selected v1 upload and image-delivery provider; its [signed-upload](https://cloudinary.com/documentation/client_side_uploading) and [authenticated-delivery](https://cloudinary.com/documentation/control_access_to_media) docs inform the media boundary.

## Goal and scope

A signed-in user creates a Board at `/boards/new`, uploads up to 30 photos per batch (repeat batches allowed), arranges days and activities, chooses up to three predefined tags, then saves an incomplete draft or publishes a valid Board. The owner can find and reopen drafts from `/boards`. A save after the first one updates the same Board. Each save submits the complete current Board document; the backend persists its relational changes in one transaction.

This version excludes the separate Vibe and Highlights controls. Vibes are simply choices in the shared tag pool, stored through `board_tag`. It also excludes invitations/member management UI, saved Board membership, discovery/search, and map-provider API design. Saved Board remix preparation is documented in [the remix contract](../contracts/saved-board-remix.md); membership is documented in [the profile contract](../contracts/profile.md). Existing members and friends still affect read permissions. The Board represents an itinerary or journal without a Board type field.

## Access and lifecycle

| Resource/action                     | Anonymous   | Owner                | Board editor                   | Board viewer, friend, or other signed-in user |
| ----------------------------------- | ----------- | -------------------- | ------------------------------ | --------------------------------------------- |
| Create Board or upload a photo      | No          | Yes, for own content | No creator access              | No                                            |
| Read a draft or its photos          | No          | Yes                  | No                             | No                                            |
| Replace draft content or publish it | No          | Yes                  | No                             | No                                            |
| Read a published Board              | Public only | Yes                  | Yes                            | According to Board visibility                 |
| Change published content            | No          | Yes                  | Yes, with unchanged visibility | No                                            |
| Change visibility or delete Board   | No          | Yes                  | No                             | No                                            |

`visibility` is `collaborators | friends | public`, defaulting to `collaborators`. The current creator's `private` option maps to `collaborators`: invited members can read a published Board, and with no members it is effectively owner-only. `friends` additionally permits accepted friends of the owner; `public` permits anonymous reads. **Draft status overrides visibility:** only the owner can read a draft, even if its selected visibility is `public`.

`status` is `draft | published` and is separate from `isCompleted`, which describes whether the trip was completed. Draft to published is supported for the owner. This endpoint does not allow a published Board to return to draft.

The backend takes the caller from the HTTP-only session cookie; the browser sends `credentials: "include"`. Never accept a client-supplied owner ID or Google token as Board ownership. All cookie-authenticated mutations require the exact configured frontend `Origin`, consistent with the current auth routes. New image IDs in a Board save must belong to the caller; images already linked to that Board may be retained by an authorized editor.

## Data and validation

Board documents include read-only `savedCount`: the current number of other accounts with a persisted Board
bookmark, including zero. It is returned only with an authorized document read; no saver identities are exposed.
Saving again does not increase the count, and removing a save decreases it. Drafts return zero. This is a current
bookmark count, not a lifetime save-event total. It does not change Board revisions and cannot be supplied in writes.

Profile responses and owner statistics include `savesReceived`, the sum of current saves by other accounts on the
owner's published Boards. Owners see all their published Boards; other profile visitors count only public Boards
and friends-only Boards visible through accepted friendship. Hidden Board saves do not affect a visitor's total.
The profile labels this “Saves received” in place of “Activities saved”; saved activity data is retained.

### Board, tags, and days

- Board and activity IDs are database-generated positive integers. Creator UUIDs are local identifiers only and must not be treated as database IDs.
- Each Board has an integer `revision`, starting at 1. A successful update increments it. A full replacement sends the revision it read; a stale revision is rejected before any changes are saved.
- A draft may have an empty title. The backend stores `""`; list views display a fallback such as “Untitled Board.” Publishing requires a non-empty title after trimming. The title limit is 500 characters. Optional description is at most 500 characters; `null` or an empty string means absent.
- `visibility` defaults to `collaborators`; `isCompleted` defaults to `false`. Omitted tags, days, and images on creation mean empty arrays.
- `tagIds` contains at most three distinct IDs from the predefined `tag` pool shared with user profiles. Typing in the creator searches this pool; it never creates a tag. The existing `board_tag` table stores selections.
- Seed the shared `tag` pool with the 40 names below. Their database IDs are generated by PostgreSQL and must be read from `GET /api/v1/tags`, never hardcoded in the frontend. The names are the canonical display values; later additions or renames require a seed/data migration rather than free-text insertion from the creator.
- Days are numbered consecutively from 1, with a maximum of 31 days. Each day has an optional calendar `date` (`YYYY-MM-DD` or `null`) and an ordered list of activities. Empty days must persist and reappear after reload. Reordering a day changes its number and the order in the submitted document.
- Each added activity needs a non-empty title and one allowed category. The current SQL calls the category `activity.type`; the API calls it `category`. An unfinished Add Pin form is local UI state and is not saved. Drafts may contain zero activities.
- Activity `position` is zero-based and consecutive within its day. The backend returns activities in day/position order. Optional `activityTime` uses `HH:mm` and does not override a saved drag-and-drop order. Optional note is at most 500 characters.
- An activity may have no location in a draft. A supplied location needs a name and latitude/longitude in the ranges already checked by the migration; address, city, country, and external place ID are optional. Editing one activity's location must not mutate another activity that shares a Location row.
- The saved `locationConfirmed` field is retained for compatibility. The backend sets it to `true` for photo-generated activities that have a location when saving the Board. Manually placed or searched locations count as confirmed when added. Publishing requires **at least one activity location** and a main destination. Individual photo-activity confirmation is no longer required; the flag is not proof that a person inspected a map.

**Initial tag seed (40):**

|                   |              |              |                    |
| ----------------- | ------------ | ------------ | ------------------ |
| Food              | Street food  | Coffee       | Restaurants        |
| Museums           | Art          | Architecture | History            |
| Culture           | Nature       | Hiking       | Beaches            |
| Mountains         | Wildlife     | Photography  | Nightlife          |
| Shopping          | Markets      | Hidden gems  | Local life         |
| Road trips        | Train travel | Backpacking  | Solo travel        |
| Family travel     | Friends      | Romantic     | Adventure          |
| Wellness          | Slow travel  | City breaks  | Rural escapes      |
| Weekend trips     | Luxury       | Budget       | Sustainable travel |
| Accessible travel | Festivals    | Music        | Winter travel      |

The initial activity-category seed uses the current creator choices: `landmark`, `culture`, `museum`, `restaurant`, `cafe`, `bar`, `shopping`, `park`, `nature`, `hike`, `beach`, `neighborhood`, `city`, `address`, `stay`, `transit`, `event`, `activity`, and `other`. This list is proposed from the frontend prototype and remains subject to frontend teammate review.

### Uploaded and external images

- Express issues a signed Cloudinary upload authorization; the browser sends file bytes directly to Cloudinary. After upload, Express verifies the Cloudinary asset, records its authenticated public ID in `uploaded_image.storage_key` along with the uploader, and returns an `imageId` and an app image URL. The browser cannot register an arbitrary Cloudinary URL as its own image. JPEG, PNG, WebP, HEIC, and HEIF are accepted. Each file is limited to **10,000,000 bytes (10 MB)** for the first release, matching the Cloudinary Free plan's image-size limit. Express checks the declared size before issuing an upload authorization and the verified provider asset size before creating an image row.
- Upload originals as Cloudinary **authenticated** assets; transformed variants must also remain protected. For v1 on the Free plan, Express checks Board permissions on every image request and streams a safe display variant from Cloudinary. It never sends the Cloudinary signed delivery URL to the browser. An unlinked upload may be read by its uploader until cleanup; a linked image follows its Board's read permissions, including owner-only drafts. A standard signed Cloudinary delivery URL is reusable and does not expire on the Free plan; expiring CDN access tokens require a higher plan. The media adapter keeps provider fields out of the Board API.
- A Board has an ordered collection of uploaded images. Upload batches accept up to 30 photos, and subsequent batches may add more to the same Board. An image may remain unattached to any activity, or be attached to **at most one** activity. An activity may have multiple uploaded images in an explicit order. Exactly one uploaded image can be selected as the Board cover through `coverImageId`; it must belong to `imageIds`. When omitted, the first Board image is the default cover. With no Board images, the app shows its default cover. This cover is independent of each activity's own image collection and cover selection.
- Initially order uploaded photos by capture time ascending when metadata provides it; put photos without capture time after those with metadata and show “No metadata available” for them. Once the user reorders photos, save and return that explicit order.
- Images served to other users must have embedded GPS metadata removed. Use Cloudinary transformations without metadata-preservation flags for display variants. An unconfirmed location suggestion may remain in the owner's draft data, but published Board responses expose only confirmed location data. Do not expose raw photo metadata in public image or Board responses.
- A selected Unsplash photo on an activity is stored as an external image reference plus photographer credit. The Unsplash `providerImageId` is persisted in `activity.external_image_id` together with `external_image_provider` and attribution fields; the URL is display metadata, not the image identity. It is separate from `uploaded_image`. `coverImageId` may select one of that activity's `uploadedImageIds`; omitting it chooses the first uploaded activity image, and explicit `null` selects no uploaded cover so the external image can be used. The exact external-image fields appear in the draft request example below.
- Removing an image from the submitted Board document unlinks it from that Board and its activity. After commit, cleanup immediately attempts to delete the authenticated Cloudinary asset and then its image/upload-intent rows if no Board, activity or profile reference remains. Provider failures stay queued for the server's automatic retry sweep. Fresh unattached uploads retain a 24-hour grace period. See [uploaded image deletion](../contracts/image-deletion.md).

## HTTP conventions

Base path: `/api/v1`. JSON fields use camelCase. Successful JSON uses `{ "data": ... }`; errors use `{ "error": { "code": "...", "message": "..." } }`. Express writes use JSON; the file transfer itself goes directly to the image provider. Unknown write fields are rejected. Omitted fields on a **full replacement** do not mean “unchanged”; the frontend sends the complete current document. `null` clears an optional value and `[]` clears a collection.

### `GET /api/v1/tags` and `GET /api/v1/activity-categories`

Return the allowed tag IDs/names and activity category values. The frontend loads these before offering choices; hardcoded suggestions are not authoritative.

### `POST /api/v1/images/upload-intents`

Requires a session and the configured Origin. The JSON request contains `fileName`, `contentType`, and `sizeBytes`. Express checks the declared type and the 10,000,000-byte size limit, obtains a short-lived provider upload authorization, and returns `200`:

```json
{
    "data": {
        "uploadId": "temporary-upload-id",
        "uploadUrl": "https://api.cloudinary.com/v1_1/example-cloud/image/upload",
        "method": "POST",
        "headers": {},
        "formFields": {
            "public_id": "roamboard/temporary-upload-id",
            "type": "authenticated",
            "timestamp": "1791886500",
            "api_key": "example-public-api-key",
            "signature": "temporary-signature",
            "overwrite": "false",
            "allowed_formats": "jpg,jpeg,png,webp,heic,heif",
            "eager": "c_limit,f_jpg,h_1600,q_auto,w_1600|c_limit,f_jpg,h_320,q_auto,w_320"
        },
        "expiresAt": "2026-10-13T10:15:00Z"
    }
}
```

The browser sends the file to Cloudinary using the returned method, headers, and signed multipart `formFields`. These values are temporary and must not be logged or persisted as Board data. The frontend and Express hosting choices remain open.

### `POST /api/v1/images/complete`

Requires a session and the configured Origin. Send `{ "uploadId": "temporary-upload-id" }` after the direct transfer succeeds. Express verifies that this upload authorization belongs to the caller and that the provider received a valid file. It creates the `uploaded_image` row and returns `201`:

```json
{
    "data": {
        "imageId": 12,
        "url": "/api/v1/images/12/content?variant=display",
        "thumbnailUrl": "/api/v1/images/12/content?variant=thumbnail",
        "capturedAt": "2026-05-01T10:00:00Z",
        "latitude": null,
        "longitude": null
    }
}
```

Capture time and GPS may be `null`. The client may use available metadata to suggest a day or location; photo-generated locations remain editable and do not need individual confirmation before publication. Image paths are relative to the API origin, and each fetch applies the read rules below.

### `GET /api/v1/images/:imageId/content?variant=display|thumbnail`

The browser requests this URL with its normal session cookie when one is needed; an `<img>` cannot add an Authorization header. Express checks the image's current Board linkage and the caller's Board read permission for **every** request, then streams a Cloudinary-generated display or thumbnail variant with embedded GPS removed. An image still unlinked to any Board is visible only to its uploader. A photo on a public published Board is visible anonymously. An inaccessible image returns `404`. Responses for protected images use `Cache-Control: private, no-store` and do not expose Cloudinary delivery URLs or raw originals. The backend deployment must support the bandwidth and response sizes of this streaming route; this is a hosting consideration before production.

### `POST /api/v1/boards`

Requires a session. Creates a draft or publishes immediately. The owner comes from the session. The backend checks ownership of all referenced image IDs and saves Board content atomically. Returns `201`, `Location: /api/v1/boards/{boardId}`, and `{ "data": Board }`.

Example published request with an empty second day, a Board image, an activity photo, and an external image:

```json
{
    "status": "published",
    "title": "A weekend in Tokyo",
    "description": "Food and walks",
    "visibility": "collaborators",
    "tagIds": [3],
    "imageIds": [12, 14],
    "coverImageId": 12,
    "days": [
        {
            "dayNumber": 1,
            "date": "2026-05-01",
            "activities": [
                {
                    "position": 0,
                    "title": "Visit the museum",
                    "activityTime": "10:30",
                    "category": "museum",
                    "note": null,
                    "source": "manual",
                    "location": {
                        "name": "Example Museum",
                        "latitude": 35.681236,
                        "longitude": 139.767125,
                        "address": null,
                        "city": "Tokyo",
                        "country": "Japan",
                        "externalPlaceId": null
                    },
                    "locationConfirmed": true,
                    "uploadedImageIds": [14],
                    "coverImageId": 14,
                    "externalImage": {
                        "provider": "unsplash",
                        "providerImageId": "sample-photo-id",
                        "url": "https://images.example.test/external/photo.jpg",
                        "photographer": "Example Photographer",
                        "photographerUrl": "https://example.test/photographer",
                        "sourceUrl": "https://example.test/photo"
                    }
                }
            ]
        },
        { "dayNumber": 2, "date": null, "activities": [] }
    ]
}
```

`imageIds` defines the Board gallery and its order. An activity's `uploadedImageIds` must be a subset of it; image 12 is unattached in this example and becomes the Board cover. Each image ID can belong to at most one activity. `externalImage` may be `null`. Optional `isCompleted` defaults to `false` on creation and preserves the saved value when omitted on replacement. The creator omits it; the profile lab uses it for completed test trips. Only the owner can change completion; editors may retain its current value.

An empty draft may send `{ "status": "draft", "title": "", "description": null, "visibility": "collaborators", "tagIds": [], "imageIds": [], "days": [] }`. Publication of that document fails validation and creates nothing.

Example response to the empty-draft request:

```json
{
    "data": {
        "boardId": 42,
        "revision": 1,
        "status": "draft",
        "title": "",
        "description": null,
        "visibility": "collaborators",
        "isCompleted": false,
        "coverImageId": null,
        "tags": [],
        "images": [],
        "days": [],
        "createdAt": "2026-10-13T10:00:00Z",
        "updatedAt": "2026-10-13T10:00:00Z",
        "permissions": { "canEditContent": true, "canManageBoard": true }
    }
}
```

### `PUT /api/v1/boards/:boardId`

Full replacement for saving or publishing an existing draft, or editing a published Board. Send the same complete fields as `POST` plus the last returned `revision`; include existing `dayId` and `activityId` values returned by the Board read for retained records, and omit IDs for new records. Missing child records are removed from that Board. The backend checks every supplied child ID belongs to this Board and saves all changes in one transaction. Returns `200` with `{ "data": Board }` and an incremented `revision`. Publication requirements also apply to edits of published Boards. A stale revision returns `409` and makes no changes.

Only the owner can edit or publish a draft. The owner can edit published content and visibility. A member with the `editor` role can edit published content, including activities, tags, and images, while keeping visibility unchanged. Viewers cannot edit. A published Board cannot be saved as a draft. The owner alone can delete the Board.

### `GET /api/v1/boards?scope=drafts&page=1&limit=20`

Requires a session. `scope=drafts` lists the caller's own drafts for the “Edit draft” path on `/boards`. Returns summaries sorted newest first, with `boardId`, `title` (possibly `""`), `status`, `visibility`, `coverImageUrl` or `null`, and `updatedAt`. Response uses `{ "data": [...], "meta": { "page": 1, "limit": 20, "hasMore": false } }`. The frontend displays the fallback title; the backend does not rewrite it. A broader owned/member Board list can use a later `scope` value.

### `GET /api/v1/boards?scope=published&page=1&limit=20`

Requires a session. Lists only the caller's own published Boards for the “My Boards” path on `/boards`. It uses the same summary and pagination envelope as the draft list. Membership in someone else's Board does not add it to this list.

### `GET /api/v1/boards/:boardId`

Returns `200` with `{ "data": Board }`. It uses the nested document shape shown above and adds server IDs (`boardId`, each `dayId`, each `activityId`, and uploaded `imageId`), `revision`, resolved tag names, display image URLs, timestamps, and edit permissions. Activities retain their saved order, location-confirmation state, uploaded-image order, and external-image credit. The owner uses it to reopen a draft; a public published Board can be read anonymously. All other reads follow the access table. An inaccessible Board returns `404`, so its existence is not disclosed.

Board documents returned by reads and saves also include the current owner's viewer summary:

```json
{
    "author": {
        "username": "example_traveller",
        "bio": "Notes from my trips.",
        "photo": {
            "imageId": 12,
            "url": "/api/v1/images/12/content?variant=display&boardId=42"
        }
    }
}
```

`username` is the stored username, rather than the display name. `bio` is empty when no biography is saved, and
`photo` is `null` when no profile picture is set. This summary follows the Board's read permission and contains no
email, Google identity or unsupported statistics.

An image-content request with `boardId` is an author-photo request. Express checks that the caller can read that
Board and that the requested image is its owner's current profile picture. An unrelated image, removed profile
picture or inaccessible Board returns `404`. Omitting `boardId` keeps the existing Board-image and uploader rules.
Both paths stream metadata-stripped variants with `Cache-Control: private, no-store`.

### `DELETE /api/v1/boards/:boardId`

Owner-only. Returns `204` with no body. Database relationships such as days, activities, tags, memberships, and saved-Board records are deleted or unlinked according to their foreign keys. Uploaded files that become unreferenced, including Board/activity covers and activity-only photos, are queued transactionally and cleanup is attempted immediately after commit. Cloudinary failure leaves a durable request for the automatic retry worker; images still used by a profile or another Board are retained. See [uploaded image deletion](../contracts/image-deletion.md).

## Errors and frontend states

| HTTP | Code                                  | Case                                                                                                    |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 400  | `INVALID_REQUEST`                     | Malformed fields, unknown tag/category, duplicate or foreign child/image IDs, invalid location or order |
| 401  | `UNAUTHENTICATED`                     | Missing or expired session on protected operation                                                       |
| 403  | `FORBIDDEN`                           | Signed-in user can read a published Board but lacks write permission                                    |
| 403  | `ORIGIN_NOT_ALLOWED`                  | Cookie-authenticated mutation from an unapproved Origin                                                 |
| 404  | `NOT_FOUND`                           | Board or child absent, or Board hidden from caller                                                      |
| 409  | `STALE_BOARD_REVISION`                | Another save changed the Board since this editor loaded it                                              |
| 429  | `PROVIDER_QUOTA_EXHAUSTED`            | Cloudinary Admin budget exhausted before upload verification                                            |
| 409  | `UPLOAD_NOT_READY` / `UPLOAD_EXPIRED` | The direct upload has not arrived at Cloudinary or its authorization expired                            |
| 413  | `IMAGE_TOO_LARGE`                     | A photo exceeds the 10,000,000-byte upload limit                                                        |
| 422  | `PUBLISH_REQUIREMENTS_NOT_MET`        | Missing publish title, no confirmed located activity, or unconfirmed photo suggestion                   |
| 502  | `IMAGE_DELIVERY_FAILED`               | Cloudinary could not provide a protected display variant                                                |
| 503  | `IMAGE_STORAGE_UNAVAILABLE`           | Cloudinary is not configured on the backend                                                             |
| 500  | `INTERNAL_ERROR`                      | Unexpected server failure, with no internal details exposed                                             |

The creator must show upload, save, load, validation, and authorization failures without claiming the Board was saved. After a successful save it retains the server `boardId` and server-returned child IDs. A failed full replacement keeps the previously saved version; local unsaved edits remain available to retry. The draft list needs loading, empty, and error states.

## Implementation changes required

**Backend:** Add an ordered migration rather than editing the applied baseline. At minimum it needs a Board publication state and revision; persisted days and optional dates, including empty days; a Board-to-image relationship and gallery order; photo-location confirmation state; external activity image reference and credit; and suitable timestamps for draft listing. Existing `board_tag`, `uploaded_image`, and `activity_image` relationships remain useful. Validate ID ownership and all access rules in the service layer, save relational updates in transactions, keep Cloudinary calls behind a provider adapter, and enforce authenticated delivery for originals and derivatives. The upload-intent and completion flow must verify ownership and actual Cloudinary state rather than trusting a browser-supplied URL. The image-content route must authorize each read and stream only metadata-stripped display variants. Add routes under `/api/v1` using the feature-first layered architecture.

**Frontend:** Send the session cookie on Board, upload-intent, upload-completion, tag, and category requests. Transfer file bytes directly to the authorized provider URL, then use the returned `imageId` in the Board request. Map `private` to `collaborators` and explain invited-member access accurately. Replace free-text tags with selection from the backend tag pool, maximum three. Remove separate Vibe and Highlights controls/payload fields. Use server IDs and `revision` after the first save, update the same Board on later saves, and show a reload/reconcile path after a stale-save conflict. Send saved photo-location confirmation state. Treat returned data as authoritative, support resuming owner drafts from `/boards`, and keep explicit drag-and-drop order rather than silently re-sorting by time after a manual move.

## Open points for review

All initial review items have been resolved and agreed:

1. Proposed nested full-document request/response shape is accepted and implemented in both frontend and backend.
2. The 40 travel tag seed and 19 activity categories are seeded in the database and integrated with the creator UI.

**Later slices:** A separate unpublish operation, if wanted, would need its own decision and contract. This replacement endpoint keeps published Boards published.

## Decision log and approval

Backend-side decisions made in this interview: complete creator save/publish flow except Highlights and separate Vibes; owner-only drafts; publish title plus confirmed located activity; `private` maps to `collaborators`; unattached Board photos persist; empty days and dates persist; predefined tags shared with profiles, maximum three; Vibes use `board_tag`; seed a shared pool of 40 travel tags; photo-suggested location confirmation persists; Express-authorized direct uploads to Cloudinary supporting JPEG, PNG, WebP, HEIC, and HEIF with a 10 MB per-file limit; Express checks Board access and streams metadata-stripped display images; unlinked uploads are cleaned after 24 hours; first uploaded photo is default Board cover; draft then publish updates one Board; external activity image reference and credit persist; owner can resume drafts; empty draft title stays empty; unfinished pin forms do not persist; creator saves the full Board document in one transaction; retained day and activity IDs stay stable across saves; stale full-document saves are rejected using Board revision.

Smart Create metadata suggestions and the updated batch/day rules are documented in [the Smart Create contract](../contracts/smart-create.md).

## Explicit main destination

Board create/replace accepts optional nullable destination containing name, address, city, ISO alpha-3 country,
latitude, longitude, externalPlaceId (geoapify: reference) and kind (city, region or country). It is independent of
activity locations and follows the same Board access and revision checks. Create without it leaves it null; replace
without the property preserves the stored destination, while explicit null clears it. Responses include it.
Migration 008 links board.primary_location_id to the existing location table and stores primary_location_kind.
Both are updated in the existing Board transaction. Frontend selection is in 01 before description, reusing Home
search interactions with Geoapify locality results. It seeds activity-search context and appears in previews/gallery
and public Board destination data. Public Board search includes the explicit place even without located activities.

Publishing additionally requires a non-null main destination. Draft saves can remain incomplete. Existing published
replacements omitting destination validate the currently stored value; null cannot clear it while published.
The creator may suggest an editable destination from at least three located activities; manual choices are preserved.

## Published Board comments

The approved [Board comments contract](../contracts/board-comments.md) defines the comment API and permissions.
`GET /api/v1/boards/:boardId/comments` returns 20 newest comments and an opaque Board-scoped cursor; authorized
anonymous viewers can read public Board comments. Session and exact frontend Origin are required for POST, PATCH,
and DELETE. Authors edit their own text with a revision check and may delete it; Board owners may delete any comment.
Drafts and inaccessible Boards return 404. Current author display names, handles, and profile photos are read from
`app_user`. Migration `013_board_comments.sql` adds storage after the existing `012_friendship_accepted_at.sql`;
applying it to the shared database remains a separate step.

## Published Board story additions

See the agreed [Board overview story contract](../contracts/board-overview-story.md). Migration
`021_board_story.sql` must be applied before running the updated Board repository. Existing Boards remain opted out.

- Board POST accepts `fillerImagesEnabled` (default false); omission on PUT preserves the saved preference. Only this
  preference is writable. Responses include `fillerImages`, `fillerImageStatus` and the authoritative `commentCount`.
- Opted-in published saves select up to three canonical, distinct Unsplash destination illustrations outside the
  transaction, then commit them with the ordinary permission/revision-checked document. Drafts and disabled saves do
  no provider work. Reads never generate photos. Disabled pools remain stored; destination identity changes discard
  stale selections on the next enabled published save. Provider failures permit partial/empty pools and a normal save.
- Board images include revision-aware `largeUrl` and available presentation dimensions. New uploads record original
  dimensions; old uploads without dimensions retain bounded viewer frames. The new `large` delivery variant applies
  saved presentation edits, caps at 4096 by 4096 without upscaling, uses display authorization and falls back to display
  delivery on provider failure. `original` remains uploader-only.
- Comment pages retain their array, cursor and ordering and add `meta.totalCount`, independent of the current page.
  Totals exclude deleted comments and require the published Board's read access.
- Activity-note API/storage validation remains 500 characters. The story editor's 250-code-point rule is frontend-only.

`npm run db:story` inspects migration status. `npm run db:story -- --apply` first creates and verifies a custom-format
backup, then applies only 021 in a transaction. Shared-database application and deployment are separate from source
implementation; consult the migration log before applying.

### Day color refinement (2026-10-25)

Board day writes accept optional nullable `color` matching `^#[0-9a-f]{6}$` (for example `"#b87568"`).
Reads return the saved color or null. Omission preserves an existing day's color by dayId; a new day without
a color and explicit null use the indexed frontend default. Remix content retains selected colors. Existing
authorization, revisions, day numbering and validation errors apply. Migration 023 adds the nullable constrained
column; it is applied to shared development. See contracts/board-editor-redesign.md for the approved presentation.
