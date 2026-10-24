# Board editor redesign contract

Status: Agreed.

Requesting user decisions recorded on 2026-10-24. The user explicitly confirmed decision authority for both
frontend and backend. On 2026-10-24 the user approved this completed document, including its technical proposals,
for both applications. The user separately authorized implementation on 2026-10-24, with iterative visual feedback to follow.

## Goal and scope

Create and edit share a refreshed editor with five horizontally snapping sections inspired by the existing
Board story and destination experience. All sections are freely accessible through scrolling and section navigation;
required fields are validated when publishing rather than gating section navigation.

1. Basics: title and Board cover, changeable later using activity uploads too.
2. Day plan: retain planning capabilities, refresh the appearance of Smart Create and photo upload/drop areas,
   replace the circuit artwork with a design consistent with Roamboard, and redesign the activity dialog.
3. Map: whole-Board map. Activities also have a compact, expandable Mapbox map in their editor.
4. Details and discovery: retain existing details/settings and place destination illustrations here.
5. Overview: review and publishing/draft actions. For published Boards, Save changes updates the published
   Board directly; there is no separate private working draft. Unsaved changes stay in the editor.

The requesting user established a general Roamboard design rule: desktop horizontal scrolling translates to
vertical scrolling on mobile. This editor therefore presents the same five sections in the same order vertically
on mobile. This contract does not authorize a retrofit of unrelated pages.

On desktop, scrolling traverses the current section's vertical content before snapping to the next section at its
end. Section tabs remain available for direct jumps. Activity dialogs contain their scrolling and must not advance
the underlying editor. Approved interaction safeguards are specified below.

## User decisions so far

These product decisions and the technical details below were approved by the requesting user for both applications.

### Activity locations

- Geoapify supplies persistent search/location data; Mapbox renders the map.
- Users may manually place a pin and supply an editable location name even without a named Geoapify result.
- Suggested address/area data must not silently replace the manually chosen pin or custom name.
- Activity title and location name are independently editable. A selected/suggested location name fills an empty
  activity title automatically; changing the activity title does not rename or move the location.
- Prefer an actual named POI/place when resolving a location, including photo metadata suggestions, rather than
  presenting an arbitrary nearby street address as the place name. Addresses are supporting detail. Do not
  fabricate a POI or overwrite the photo/manual pin coordinates merely to use a nearby place's name.
- If no named POI/place is found, use a relevant named natural feature or area, such as Siljan. Otherwise prompt
  the user to name the pin. Do not substitute an unrelated nearby business or street address. Keep the original
  pin coordinates and allow the user to correct any suggested name.
- A named activity may be saved without a location/pin, including Travel day or Free afternoon. Show it in the
  itinerary and omit it from the map. Retain the existing publication requirement for at least one confirmed
  located activity somewhere on the Board, along with the existing title and destination requirements.
- The current dialog's location-required save restriction must be relaxed; the backend already permits
  locationless activities. A missing location is null, not fabricated coordinates or an empty location object.
- Temporary Mapbox search followed by Geoapify resolution is deferred outside this version: a second lookup
  does not establish permission to persist Mapbox-derived fields or coordinates. Use Geoapify search in this
  version; revisit Mapbox search only after permitted storage/use is established separately.

### Activity photos and metadata

- Allow at most five uploads per activity upload batch, with repeated batches permitted. This is not a
  five-photo total cap and does not replace the existing 30-photo Board Smart Create batch limit.
- Metadata fills empty fields automatically and preserves user-entered values. Do not invent missing details.
- Among a batch's photos, prioritize valid capture timestamps; the earliest photo is the default activity cover.
  If none has a valid timestamp, use upload order. Only choose automatically when the activity has no cover;
  later batches preserve any existing cover, including an automatically chosen one, even if new photos are earlier.
- Use the earliest GPS-bearing photo for location, prioritizing dated photos and otherwise using upload order;
  the cover does not need to have GPS. Preserve existing user location edits.
- Photo controls include cover selection, crop/resize and removal. Hover reveals crop/resize and delete;
  equivalent keyboard-focus and touch controls must be available.
- Deletion removes the activity attachment when edits are committed. Cancelling preserves saved attachments.
  An uploaded asset is permanently deleted from PostgreSQL and Cloudinary only after the Board save commits
  and no Board/activity/profile references remain. Reuse the durable cleanup workflow in
  [image-deletion.md](image-deletion.md); provider failures remain queued rather than rolling back the Board save.
  Fresh unattached uploads retain that workflow's grace period. External Unsplash images are not Cloudinary uploads.
- Saving crop/resize in the photo editor applies the presentation change immediately, independently of activity
  and Board saves. Cancelling the activity dialog afterward does not undo that saved photo edit. Retain the
  existing protected original, ownership checks and presentation revision conflict handling.

### Optional illustrative photos

- When an exact activity photo is unavailable, offer relevant nearby suggestions, then widen to the region.
- Do not fall back to generic country-wide images or automatically attach illustrative suggestions.
- Clearly identify illustrative suggestions and show their known actual location; do not invent location metadata.
- Regional suggestions may use an explicit location named in Unsplash metadata without GPS coordinates,
  for example Dalarna, Sweden. Label the photo as a regional illustration; a named region is not an exact
  activity-location match. Exclude unknown locations and contradictory metadata.
- The user selects a suggestion explicitly. Existing upload photos remain intact on provider failure/no match.
- Approved regional boundaries, relevance evidence and request limits are specified below.

### Smart Create

- Available only while creating a new Board. Reopened drafts and published editing use ordinary activity-level
  uploads with metadata autofill, without Smart Create day-plan generation.
- This supersedes the user's earlier proposal to expose Smart Create in edit mode and retains the current
  new-Board-only scope in [smart-create.md](smart-create.md).
- Retain the existing new-Board planning/review safeguards and preserve manual edits. No existing-itinerary
  Smart Create merge or date-mapping workflow is needed.

## Current implementation evidence

Source branch: `185-improve-create-board-page`, inspected 2026-10-24.

- `frontend/src/components/features/boards/BoardCreator.tsx`: shared create/edit state and save workflow;
  reopened Boards currently bypass Smart Create planning and retain uploads for manual assignment.
- `frontend/src/components/features/boards/ActivityEditorDialog.tsx` and `AddActivityDialog.tsx`:
  shared activity editing, uploads, metadata suggestions, photo ordering and crop editor integration.
- `frontend/src/components/features/boards/ActivityLocationSearch.tsx`: persistent Board location search.
- `frontend/src/types/board-creator.ts`: current activity/location/photo draft shapes.
- `backend/src/features/providers/provider.geoapify.ts`: reverse lookup preserves supplied coordinates;
  passing Mapbox coordinates through it would not independently replace their source.
- `backend/src/features/boards/boards.schemas.ts` and `boards.service.ts`: nullable activity locations;
  publication requires a destination, nonempty Board title and at least one confirmed activity location.
- `backend/API_FEATURES_CONTRACT.md`: persistent Board locations use Geoapify; temporary Mapbox results
  are not saved; existing shared provider budgets apply.
- `contracts/smart-create.md`, `contracts/image-deletion.md`, `contracts/board-overview-story.md`:
  current planning, protected-media lifecycle and viewer-navigation reference behavior.

Existing support is evidence for reuse, not proof the requested redesigned flow is implemented.

## Frontend/backend changes

Frontend: shared five-section editor/navigation, planner/intake visuals, location map/pin/name editing,
activity batch intake and metadata selection, accessible photo controls, illustrative selection, refreshed new-Board
Smart Create presentation, and action/error/loading states. Create and edit share the editor structure, with
Smart Create available only for new Boards.

Backend: retain existing nullable activity locations and publication validation; add opt-in POI-first pin suggestions,
bounded illustrative-photo discovery/selection and persisted illustration context. Retain protected uploads,
revision checks, exact-Origin mutation checks and reference-aware cleanup. The following API/storage changes are
agreed specifications, not implemented endpoints. Do not apply database changes during this discussion.

## Interaction and lifecycle defaults

These approved defaults complete the specification without changing the accepted product decisions.

- Explicit Save draft/Publish for a new Board or reopened draft; explicit Save changes for a published Board.
  No autosave or separate private version. Section navigation retains one in-memory editor document and does not save.
  Retain existing unsaved-navigation protection. Successful saves refresh the revision; failures retain local edits.
- Respect reduced motion by removing animated travel while retaining section navigation. A desktop section at its
  beginning scrolls backward to the preceding section; nested planners/photo lists consume their scroll first.
  Do not intercept text editing, dropdown navigation, crop controls or dialog gestures to advance sections.
- Maps do not consume ordinary page-wheel scrolling in compact view. Expand to interact with the map; use an
  explicit Place/move pin control before clicks place a marker. Support dragging an existing pin, accessible map
  zoom controls, search-result selection without dragging, and Escape to collapse. Preserve map attribution.
- Location lookup failure retains the current pin, typed name, activity and uploads. Offer explicit retry, manual
  naming or a locationless activity. Never silently replace a selected location or retry providers automatically.
- Fill title, time and location only when empty; suggest category only while untouched at its default. User edits,
  including intentional clearing while a request is pending, win over delayed results. The earliest timestamp
  supplies time independently of which photo supplies GPS. Preserve camera wall time as in Smart Create.
- Finish the batch before choosing its earliest successful photo, breaking timestamp ties by original selection
  order. Missing/invalid dates follow valid dates. Failed photos are excluded; keep successes and name failures.
  Retry failed files explicitly. Metadata lookup failure must not invalidate a successful upload.
- If batch photos have different locations, retain the accepted earliest-GPS source rather than splitting the
  activity or moving it repeatedly. Other photo locations can be offered as explicit alternatives.
- Saving an activity commits its staged title/location/photo attachments to the Board editor, not the server.
  Cancelling preserves pre-dialog attachments. Crop Save remains the explicitly agreed immediate exception.
- Removing an activity cover chooses the earliest remaining uploaded photo by the same rule; if none remain,
  use an existing external photo or the normal empty-photo treatment. Never silently replace the Board cover.
  Activity Delete also removes the upload's otherwise-unused gallery reference in the pending Board document,
  so automatic Board gallery membership does not keep every deleted activity photo alive. Preserve the image
  if it is still the Board cover or explicitly retained elsewhere. Shared references in other Boards/profiles remain
  protected by the backend cleanup workflow.
- Keep cover and crop/resize distinct: cover selection changes a reference; crop edits the uploaded image's
  presentation everywhere that asset is used. Show that effect before crop Save. Crop controls apply to owned
  uploads, not external Unsplash assets; external photos retain provider delivery and credits.
- New-Board Smart Create retains existing 30-photo batches, 31-day limit and review safeguards. The five-photo
  limit is a frontend activity-intake batch limit; existing Board image totals remain unchanged.

## Permissions and unchanged integration contracts

Retain the permission matrix and full-document writes in [the Board API contract](../backend/BOARD_API_CONTRACT.md):
only an owner edits a draft; an owner or authorized editor edits published content; editors cannot change visibility;
viewers cannot mutate. Unauthorized Board reads do not disclose existence. No new sharing or collaborator roles.

Board writes retain `POST /api/v1/boards`, `PUT /api/v1/boards/:boardId` and the read endpoint. Writes require
session and exact frontend Origin; replacements carry the last `revision` and existing child IDs. All child changes
remain transactional. No downgrade from published to draft. Board title and destination plus at least one confirmed
activity location remain required for publication, including published edits. New empty drafts remain permitted.

Existing upload intents/completion, protected delivery, `/images/smart-create`, location refresh and
`GET/PUT /api/v1/images/:imageId/presentation` remain in use. Upload types and the 10,000,000-byte file limit do not
change. Presentation PUT keeps `{revision, edit}`, normalized bounds, 32–4096px output limits and 409 conflicts.
The owner-only crop tool must not expose another uploader's original to a collaborating editor.

### Existing Board payload semantics to retain

An activity title is required when saving an activity (trimmed, 1–500 characters). Location names are also 1–500
when a location exists; finite latitude is -90 to 90 and longitude -180 to 180. Missing activity location is explicit
`null` with `locationConfirmed: false`. Manual pins use `source: "manual"`, confirmed coordinates, and
`externalPlaceId: null`; a nearby name suggestion must not invent a provider identity for that exact pin.
Search-selected Geoapify locations retain their actual Geoapify identity. Photo GPS retains `source: "photo"`.

Time is `HH:mm` or null, notes are nullable with the existing 500-character limit, and category must be in the
existing server catalog. Empty optional text becomes null on write; omitted mandatory full-document fields are
invalid. Existing image ordering, subset/ownership constraints and one-activity-per-upload attachment remain.
Activity cover null means no uploaded cover; a cover ID must be attached to that activity. Preserve explicit covers
on reopening. Board cover selection remains an independent uploaded-image reference; default artwork works without one.

Example locationless activity inside an otherwise complete Board request:

```json
{
    "position": 1,
    "title": "Free afternoon",
    "activityTime": null,
    "category": "activity",
    "note": null,
    "source": "manual",
    "location": null,
    "locationConfirmed": false,
    "uploadedImageIds": [],
    "coverImageId": null,
    "externalImage": null
}
```

This activity can coexist with a located activity on a published Board. It cannot satisfy publication's located
activity requirement itself. Keep the existing JSON success envelope `{ "data": ... }` and error envelope
`{ "error": { "code": "...", "message": "..." } }`.

## API additions to implement

### POI-first pin suggestion

Extend existing `GET /api/v1/providers/locations/reverse` with opt-in `preferPlace=true`, paired latitude/longitude,
and no arbitrary URL or provider selector. Without the flag, preserve existing response behavior for callers.
With the flag, resolve one nearby named POI using the existing 75m lookup, otherwise one reverse lookup for a
named feature/area. At most two Geoapify calls. Return the existing normalized location shape or `data: null`
when no suitable name exists; raw coordinates remain in the editor. Returning null is not a provider failure.
Keep the existing read authentication policy and shared quotas; no database writes occur.

Keep the input coordinates in the returned suggestion. A POI name is a suggestion, not proof of a visit. Do not
select an unrelated POI simply because it is closest. The user can change name and pin before Save activity.
No named result must be represented as no suggestion rather than an address labelled as a POI.

### Illustrative-photo discovery

Add `GET /api/v1/providers/unsplash/activity-photo-suggestions`, requiring a signed-in session. Query fields:
`name` (2–160), `category` (existing activity category), paired finite `latitude`/`longitude`, optional `city`
(maximum 160), and optional ISO alpha-3 `countryCode`. Missing optional fields are omitted, not string "null".
No location means no automatic suggestions; uploads and saving remain available.

Run on explicit Find alternatives after the existing exact-photo path has no match. Preserve that existing
exact-only path and its callers. Do not silently attach an illustration through the exact-photo endpoint.

Search/matching limits:

- Resolve the activity's administrative state/region and country with at most one Geoapify reverse lookup.
  Do not use the Board destination's region when an activity is elsewhere. Without a reliable region, stop at
  nearby candidates; never widen to a whole country as the regional fallback.
- Nearby means photo GPS within 25km, or an explicit matching locality plus country when GPS is absent.
  If none qualify, search the named administrative region. Return at most three candidates total.
- A regional candidate needs the same country and region, established from explicit photo location metadata or
  by reverse-resolving its GPS. Use at most four additional Geoapify reverse calls, one per inspected GPS candidate.
  Contradictory GPS/country/region excludes a candidate even when its text matches. No administrative polygons
  or new geographic dataset are required for this first version.
- At most two Unsplash searches total (nearby then region), inspecting at most two canonical photo details per
  stage and four total. Reserve the regional inspection allowance so failed nearby candidates cannot consume it.
  Deduplicate IDs before inspection. Stop when the inspection budget is exhausted; fewer or zero results are valid.
  Do not broaden the budget silently. No automatic pagination or retries.
- Build queries from place/locality/region plus activity category. Require compatible category/subject evidence in
  canonical title/description/alt metadata, not just inclusion in search results. Broad nature categories may match
  landscape terms; a café should not get a forest solely because both are in Dalarna. Metadata is evidence, not
  visual verification. Skip ambiguous results rather than claim exact subject/location accuracy.

Response entries contain the existing ProviderPhoto fields plus `context`:

```json
{
    "data": [
        {
            "id": "example-photo-id",
            "url": "https://images.unsplash.com/example-photo",
            "thumbnailUrl": "https://images.unsplash.com/example-photo?w=400",
            "alt": "Lake landscape in Dalarna",
            "photographer": "Example Photographer",
            "photographerUrl": "https://unsplash.com/@example",
            "sourceUrl": "https://unsplash.com/photos/example-photo-id",
            "width": 2400,
            "height": 1600,
            "context": {
                "kind": "illustrative",
                "scope": "region",
                "locationLabel": "Dalarna, Sweden"
            }
        }
    ]
}
```

The example is illustrative JSON, not a verified provider photo. Actual responses use canonical validated URLs,
provider IDs and attribution. `scope` is `nearby` or `region`; locationLabel is required, 1–500 characters.
An empty list is a successful no-match response. This GET does not record download selection or persist attachments.

### Explicit illustrative-photo selection

Add `POST /api/v1/providers/unsplash/activity-photo-suggestions/select`, requiring session and exact frontend Origin.
Body: the discovery fields plus `photoId` (1–80 ASCII letters, numbers, underscores or hyphens). Do not accept
client-supplied provider URLs, credits or an arbitrary download URL. Example:

```json
{
    "name": "Siljan",
    "category": "nature",
    "latitude": 61.0,
    "longitude": 14.5,
    "city": "Mora",
    "countryCode": "SWE",
    "photoId": "example-photo-id"
}
```

Re-fetch that one canonical photo, revalidate relevance and nearby/region evidence against the current target,
and record exactly one provider download-equivalent selection call on success. At most two Geoapify reverse
lookups (target and candidate), one Unsplash detail call and one download call; no new search. Return `{data: photo}`
with context and canonical credit. It stages an external activity photo; Board persistence still uses the normal save.
If selection is no longer eligible return 422 `PHOTO_SUGGESTION_NOT_ELIGIBLE`; preserve existing attachments.
Client ignores responses for stale/changed locations and requires selection again for the current location.

All external requests use existing quota management; no cap increases. Exhaustion returns 429 and a safe
Retry-After when known. Provider unavailable/errors return safe 502/503 handling, never raw bodies or secrets.
Mutations without session return 401, wrong Origin 403, malformed inputs 400. Read-only no-match returns 200.

## Persistence change and compatibility

Add optional nullable `context` to Board activity `externalImage` on writes and reads, with the exact shape above.
Store it alongside the existing external image identity/attribution through a new ordered migration (next number
after current 021, recheck at implementation). Prefer one nullable JSONB column with database shape constraints
over a new photo table. Clear it with external-image removal or replacement; copy it in Board remixes.

- Explicit context null means no recorded illustration context. Existing images are not backfilled as exact matches.
- On creation omission means null. On replacement, omission preserves context only if provider/photo identity is
  unchanged; changing or removing the image clears old context. New clients send context explicitly.
- Validate strict context shape and supported kind/scope; retain current external-image URL/credit validation.
  Canonical selection supplies trusted display metadata; Board writes do not accept arbitrary provider-fetch URLs.
- Discovery cards show the label before selection. The activity editor and published activity/photo views retain
  the illustrative label and location after save/reload, including remixes. Keep credits in both cases.
- Unsplash remains an external reference, never a Cloudinary upload. Do not crop/rehost it or remove a provider
  image when removing its Board reference. Do not rewrite an old external photo's context just by opening the editor.

Manual pins, locationless activities and five-photo activity batches need no new tables. Reuse existing image cleanup
and presentation schema. No migration application or provider-budget change belongs to this discussion.

## Important success and failure examples

- New user creates a title, uploads photos, reviews Smart Create, adjusts activities, selects destination/settings,
  reviews and publishes. The saved Board remains readable through the existing viewer and permission rules.
- Returning owner edits the same five sections with Smart Create absent. Save changes uses the current revision
  and updates the live Board. A 409 retains local work and asks the user to reload/reconcile, without force-overwrite.
- Activity upload batch has five files, of which one fails. Four remain available; earliest successful dated photo
  becomes cover only if no cover exists, earliest GPS photo fills an empty location, and the failed filename is shown.
- Six selected files are rejected before uploads start, with a five-per-batch explanation; further batches are allowed.
- A rural pin has no POI: relevant natural feature/area may name it; otherwise require a user name for that pin or let
  the user remove the pin and keep the named activity. A failed lookup must not assign zero coordinates.
- Regional photo is chosen explicitly, credited and labelled as illustrative after reload. Unknown-region or
  contradictory photos are not offered. Quota failure leaves all current uploads and activity fields unchanged.
- Deleting an activity photo and cancelling leaves the saved attachment intact. Board-save failure schedules no
  permanent deletion. A successful removal queues cleanup only when the asset has no remaining references;
  Cloudinary failure retries through the existing durable worker.
- Anonymous users cannot save, upload, crop or select photos. Unauthorized image access stays protected even
  when a public Board is otherwise readable. Unauthorized Board mutations retain existing safe errors.

## Implementation verification plan

Frontend checks should cover shared create/edit sections, mobile vertical order, desktop nested scrolling/dialog
isolation, reduced motion and keyboard/touch controls. Focused logic tests cover five-file batches, partial failures,
earliest date/GPS selection, preserved covers, intentional clearing versus delayed autofill, locationless saves,
illustration context round trips, and cancellation versus immediate crop Save.

Backend service/API tests should cover opt-in reverse compatibility, named-place fallback and coordinates,
bounded request counts, category/region evidence, unknown/contradictory location rejection, explicit canonical
selection/download calls, auth/Origin, quota errors, persisted context and stale Board/presentation revisions.
Use fake providers; never make normal tests depend on live geography or paid provider access. Add an isolated-schema
migration test for context constraints, round trips and remix copying. Retain existing reference-aware deletion tests.

Before implementation handoff, run repository formatting/lint plus applicable application CI checks and visually
verify both themes, desktop/mobile, actual map gestures and representative photo metadata in a connected session.

## Review and approval record

2026-10-24: requesting user explicitly confirmed decision authority for both frontend and backend, then approved
the completed contract in response to the review request covering the technical proposals, API examples and
frontend/backend changes. This approval covers the full document, including saving defaults, provider boundaries,
bounded regional suggestions, illustration-context persistence and reference-aware photo deletion.

The user separately authorized implementation after agreement. A first implementation now exists on the source
branch: five responsive sections, shared staged activity editor, pin/name editing, five-photo batches and metadata
defaults, illustrative discovery/selection and persisted context. Migration 022 was applied to development after
a verified backup; see the migration log. No deployment performed. Live-provider accuracy and browser visual/touch
acceptance remain pending; further design feedback will update this contract before changing behavior.

Provider reference checked on 2026-10-24:
[Mapbox Search Box restrictions](https://docs.mapbox.com/api/search/search-box/#search-box-api-restrictions-and-limits).
