# Board editor redesign contract

Status: Agreed, including second refinement. Requesting user approved frontend/backend implementation and migration 024 on 2026-10-25.

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

## Editor refinement agreed 2026-10-25

The requesting user approved saving day colors, with the same colors on map filters and activity pins and soft light/dark variants. Existing authorization, revisions, provider budgets, photo ownership and staged activity saves remain in effect.

Day objects in Board create/replace/read and remix content add optional nullable `color`, a lowercase six-digit hex string (for example `"#b87568"`). Omission on an existing day preserves its saved color by dayId; omission on a new day and explicit null use the default indexed palette. Unknown fields and malformed colors return the existing validation error. New clients send color or null. Migration 023 adds nullable board_day.color with the same format constraint. The frontend offers 30 colors and derives light/dark display variants without changing saved identity. No existing rows are recolored.

Activity photo removal detaches uploaded images while retaining them in the Board image collection and cover choices. Only explicit Board photo removal removes a Board reference. Publishing collects field errors and reveals the first invalid chapter, retaining all other inline errors. Shared chapter navigation, drag carousels, photo zoom, and direct map clicks replace editor-specific controls. Geoapify remains the permanent location source.

## Second refinement: approved 2026-10-25

Source branch: 185-improve-create-board-page. Evidence: PlannerDayColumn, BoardPhotoStrip, BoardEditorRail,
ActivityEditorDialog, BoardPlanMap, BoardCreationPreview, InteractiveMap, provider.providers.ts,
provider.photo-suggestions.ts, boards.schemas.ts, migrations 022/023 and the migration log.
The requesting user retains the previously recorded frontend/backend decision authority.
The requesting user approved the concrete API/storage proposal and authorized implementation plus migration 024 on 2026-10-25. Implementation is complete; verification and migration application are recorded separately.

### Agreed user requirements

- Replace the 30 soft palette choices with more distinct, stronger colors. Keep theme variants and reduce the
  whole-day background tint slightly from the implemented 10%; approved default is 6%. Persisted day colors must
  carry through editor, Board overview maps, filters, pins and remixes. Existing selected values must not be silently
  rewritten. Previously saved colors remain valid; stronger colors are new palette choices, not a rewrite of existing Board data.
- Restore reliable activity dragging within/across days. Keep insertion feedback, time preservation, keyboard and
  touch access; verify real browser dragging rather than accepting the visible grab cursor as evidence.
- Hide the empty-time dash and reclaim its space. It is a placeholder, not a minus action. Keep actual activity times.
  The adjacent category icon is functional; retain category editing without a duplicate icon or wasted gutter.
- Gallery hover grows the whole image/card slightly without enlarging the image inside its crop. Preserve the
  framing, rounded corners, focus behavior and reduced-motion behavior; leave room to avoid clipping the growth.
- Add user-entered Unsplash photo search with explicit submission and paginated results. Search must not require a
  location or silently constrain the query to the activity's place/category. Do not automatically replace attachments.
- User explicitly chose multiple Unsplash photos alongside uploads. Saved ordering and cover choices must work
  across both sources and survive reload and remix. This requires a new media persistence/API extension, not just
  additional thumbnails. The current model stores only one external photo per activity.
- Remove the Map chapter's gray top divider. At desktop sizes, heading, filters and map fit the available editor
  viewport without an inner vertical scroll. Mobile retains access to all controls/content rather than clipping them.
- Map pins grow on hover/focus and reveal the activity title plus a short Click to see more hint, reusing the profile
  map/globe presentation where appropriate. Clicking opens the activity editor.
- Dismissing an activity dialog by its backdrop consumes the complete pointer interaction: no click-through to
  previous/next chapter arrows. Existing discard confirmation must still work.
- Reduce the gap between tag-picker help text and Visibility so Details does not need a short nested scroll before
  section navigation. Place each validation message immediately beside/below its field, not after its bottom margin.
- Review full itinerary starts expanded for create/edit and resembles the Board summary. Use larger clickable photo
  thumbnails and the existing zoom viewer. Remove the separate Review all photos disclosure; keep photo controls
  in the itinerary review. Hover/focus exposes Crop and Delete controls with the existing subtle action animation.

### Confirmed existing migrations and current gaps

- 022_activity_photo_context.sql is committed on this branch and applied to shared development after a verified
  backup on 2026-10-24. It stores nullable context for the existing single external activity image.
- 023_board_day_color.sql is committed on this branch and applied to shared development after a verified backup
  on 2026-10-25. It stores nullable day colors. Stronger palette choices and correcting overview color delivery do
  not themselves require another migration. Audit read/adaptation/map rendering before proposing a new color field.
- Migration 024_activity_photos.sql implements storage for multiple external activity photos and mixed
  media cover/order persistence. It has not been created or applied. Existing photos/credits/context must be migrated
  without loss. Old-client compatibility and replacement semantics must be explicit before implementation.
- Current Unsplash search has no page parameter and forces landscape orientation. The current geographically
  checked suggestion selector cannot serve arbitrary manual searches because it rejects unrelated selections.
  Manual search needs a separate selection path that does not claim location verification.

### Agreed search behavior and boundaries

- Reuse Unsplash first. Explicit Search submits the user's trimmed query; show 12 results per page with Previous
  and Next plus current page and result count. Do not prefetch pages or search on every keystroke. Remove the
  landscape-only restriction for manual search. Retain existing application quotas and safe failure/429 handling.
- Keep the existing simple search endpoint compatible for its callers; add an activity-search endpoint with page,
  per-page and total-pages metadata rather than changing an array response beneath existing clients.
- Require the normal session for editor search, and session plus exact Origin for photo selection. Selection accepts
  an Unsplash photo ID, fetches canonical details, records the provider download-equivalent event and returns canonical
  URLs/credit. Never fetch arbitrary client URLs. Search and preview alone do not record a selection/download.
- Manual results are illustrative choices, not verified images of the activity's location. Preserve photographer and
  provider credit and hotlink provider image URLs. User approved cropping both uploads and Unsplash photos.
  External crops are presentation settings on that activity photo; never download/rehost the source or change provider identity.
- Agreed: Unsplash only for this revision. Pexels integration, credentials and additional provider quotas are out of scope.

### User decision log

1. Agreed: multiple Unsplash photos coexist with uploaded activity photos.
2. Agreed: unrestricted paginated Unsplash search first; no Pexels integration in this revision.
3. Agreed: unassigned uploads appear under Other Board photos inside the expanded itinerary review.
4. Agreed: under an activity, Remove detaches the photo; Other Board photos uses Delete from Board. Both use the
   trash icon with accurate accessible labels/tooltips. Removing an external activity photo removes that reference,
   never the provider asset. Uploaded photos remain available on the Board after activity detachment.
5. Agreed: Crop works on uploads and Unsplash photos. Unsplash crops belong to the activity photo and persist with
   Board saves/remixes. Upload crop Save retains its existing immediate, revision-checked global behavior.
6. Agreed: the concrete API/storage/compatibility proposal below; implementation and migration 024 authorized.

### Agreed API

Keep existing Board permissions and revision checks. Add these routes behind the backend provider layer; never
send provider credentials to the browser.

- GET /api/v1/providers/unsplash/activity-search?q=red%20sailing%20boat&page=1 requires a session. q is a trimmed
  nonempty string, at most 160 characters; page is a positive safe integer, default 1. Each page has 12 results.
  Use all orientations, relevant ordering and the exact submitted words. No geographic eligibility check, automatic
  pagination, retry or prefetch. One quota-managed Unsplash search per explicit request. A new query resets page 1;
  ignore stale replies when query/page changes or the dialog closes. Keep previous attachments on all failures.
- POST /api/v1/providers/unsplash/activity-photos/select requires a session and exact frontend Origin. Body contains
  only photoId (1?80 ASCII letters, numbers, underscore or hyphen). Fetch that canonical photo, validate expected
  provider response/URLs, and record its canonical download-equivalent event. At most one detail and one download
  call through existing shared quotas. Search/previews/crops are not selection events. Disable repeated selection
  while pending and deduplicate the same provider ID within an activity. Failure adds no attachment.
- Search/selection errors use the existing error envelope: malformed input 400, missing session 401, foreign
  selection Origin 403, unavailable photo 404, quota exhaustion 429 with safe Retry-After where known, provider
  failure 502/503. No raw upstream bodies, keys or automatic quota increases.

Illustrative search response (example identity/URLs only, not a verified provider asset):

```json
{
    "data": {
        "query": "red sailing boat",
        "page": 1,
        "pageSize": 12,
        "total": 1,
        "totalPages": 1,
        "photos": [
            {
                "id": "example-photo-id",
                "url": "https://images.unsplash.com/example-photo?ixid=example",
                "thumbnailUrl": "https://images.unsplash.com/example-photo?ixid=example&w=400",
                "alt": "Red sailing boat",
                "photographer": "Example Photographer",
                "photographerUrl": "https://unsplash.com/@example",
                "sourceUrl": "https://unsplash.com/photos/example-photo-id",
                "width": 2400,
                "height": 1600
            }
        ]
    }
}
```

The selection request is `{"photoId":"example-photo-id"}`; success is `{"data": photo}` containing the canonical
ProviderPhoto fields above plus `context: null`. This does not assert the photo depicts the activity's location.
Existing nearby/region context stays on previously verified suggestions; manual photos show Selected by you.
New manual selections are not silently discarded when the activity location changes. Automatic suggestions remain
optional and never overwrite a manual attachment or explicitly chosen cover.

### Mixed activity photos: write/read and compatibility

Add optional `photos` and `coverPhoto` to activity objects in Board create/replace/read and remix content.
The photos array order is the display order, including interleaved uploads and Unsplash photos. Identity is
`{source:"upload", imageId}` or `{source:"unsplash", providerImageId}`. Duplicate identities in one activity are invalid.
Uploaded IDs must be owned/authorized Board uploads and retain existing one-activity assignment rules. Unsplash
entries use canonical provider metadata fields returned by selection, nullable existing illustration context, and
optional nullable presentation settings. Apply existing strict external-image validation plus Unsplash URL-host
validation; never fetch a supplied image/download URL. Existing API request-size and upload limits remain in effect.

Example activity media fragment (all enclosing existing activity fields still apply):

```json
{
    "photos": [
        { "source": "upload", "imageId": 42 },
        {
            "source": "unsplash",
            "providerImageId": "example-photo-id",
            "url": "https://images.unsplash.com/example-photo?ixid=example",
            "thumbnailUrl": "https://images.unsplash.com/example-photo?ixid=example&w=400",
            "alt": "Red sailing boat",
            "photographer": "Example Photographer",
            "photographerUrl": "https://unsplash.com/@example",
            "sourceUrl": "https://unsplash.com/photos/example-photo-id",
            "width": 2400,
            "height": 1600,
            "context": null,
            "presentation": null
        }
    ],
    "coverPhoto": { "source": "unsplash", "providerImageId": "example-photo-id" }
}
```

- photos present replaces this activity's complete ordered attachment list; [] detaches all. null is invalid.
  New clients use photos/coverPhoto and omit legacy media fields. Reject a write that mixes the new photos field
  with legacy uploadedImageIds/externalImage/coverImageId rather than guessing which one wins.
- coverPhoto must reference an attached photo; null means no explicit selection and uses the first attached photo.
  Omission preserves the current cover if still attached, otherwise uses the first photo. New activities start with
  the existing earliest-upload default when applicable; later additions do not override an explicit cover.
- Reads retain legacy uploadedImageIds, externalImage and coverImageId projections for existing readers, in addition
  to photos/coverPhoto. externalImage projects the first Unsplash photo; coverImageId is the selected upload ID or
  null for an external/default cover. This projection is not a promise that the activity has only one external photo.
- Legacy writes without photos retain support: uploadedImageIds updates upload attachments, and externalImage updates
  or clears only the first projected external photo. Preserve every additional external photo and its presentation.
  Legacy unchanged/null upload cover projections must not wipe an existing external cover; an explicit valid numeric
  legacy cover selection chooses that upload. An omitted legacy field preserves its current meaning.
- Remix copies media order, source credit, illustration context, external crop settings and cover choice. Existing
  owned upload-copy/remapped-ID behavior remains. Provider binaries stay on Unsplash.
- Photo review changes update the same staged Board state as Day plan. Removing an activity photo does not remove
  a Board upload; the detached upload appears immediately under Other Board photos. Deleting an unassigned upload
  removes the Board reference, updates a matching Board cover using the existing fallback, and uses existing
  reference-aware cleanup only after a successful save. A failed save never deletes the provider/original binary.

### Unsplash crop presentation

Reuse the crop geometry and controls of PhotoEditorDialog without routing external IDs into the protected-upload
API. External presentation is null or `{x,y,width,height,outputWidth,outputHeight}`: normalized finite crop bounds
inside [0,1], positive width/height, x+width and y+height at most 1; reuse existing minimum crop/output constraints
and integer output dimensions 32?4096. Reject invalid bounds at the API boundary and database constraint.

Crop applies a local presentation window plus supported provider sizing to the canonical image URL; retain ixid and
all attribution. Do not depend on unsupported arbitrary crop-rectangle CDN parameters, canvas export, or rehosting.
The original stays available for subsequent crop edits. External crop Save stages changes in the activity/Board
editor; cancelling that activity discards its staged external crop, and Board Save persists it under the Board revision.
In the overview review, Crop stages into the Board editor directly. The same provider photo in another activity/Board
keeps its own presentation. Upload crop behavior remains the existing explicit immediate/global Save with revision checks.

### Storage and migration

Use migration 024_activity_photos.sql. Introduce
one canonical activity-photo relation for uploaded and external references, ordered position and selected cover.
Use database foreign keys for activities/uploads, uniqueness for per-activity position/source identity, at most one
selected cover, and constrained external metadata/presentation. Migrate existing activity_image links and single
external-image metadata/context without loss, retaining old upload ordering and the saved cover. Place the old
external photo after existing uploads unless it was explicitly the activity cover; cover selection is independent
of order. Do not rewrite original upload presentation or day colors.

Port Board read/write/remix, published viewer adapters, image-access/reference queries and cleanup triggers to this
canonical relation in one reviewed change. Legacy API fields are projections, not a second mutable source of truth.
Update every isolated-schema fixture using these repositories. Verify the migration and backwards-compatible
service behavior against existing single-photo Boards before applying it to shared development. Shared application
requires a verified backup; the requesting user explicitly authorized applying only 024 on 2026-10-25.

### Approved defaults

The requesting user approved 12 search
results per page, 6% day tint, stronger new palette choices while preserving existing saved colors, staged per-activity
Unsplash crops, and the media API/legacy compatibility behavior above. Frontend/backend implementation and
migration 024 are authorized; application and verification status are recorded separately.

Provider references checked 2026-10-25:
[Unsplash documentation](https://unsplash.com/documentation),
[Pexels API documentation](https://www.pexels.com/api/documentation/).

### Verification required for this refinement

Independent behavior tests for media ordering/cover/reload/remix, paginated query changes and stale responses,
selection auth/Origin/credits/provider failure, photo detach versus Board removal, first-error proximity/routing,
and complete backdrop pointer consumption. Isolated-schema migration tests must preserve existing media.
Browser checks must include an actual successful drag within/across days, hover scaling without crop zoom, map
pin labels, desktop map/detail viewport fit, mobile section order and physical touch where available.

### Second refinement approval record

2026-10-25: in response to the completed contract review covering both applications, the requesting user replied
"Yes. go ahead. Migrate 24 also." This approves the documented defaults, API/storage compatibility and crop behavior,
authorizes implementation and authorizes applying only migration 024 to development after tests and a verified backup.
The activity_image compatibility name will remain an upload-only database view over the canonical activity_photo relation,
so existing reference-aware access/cleanup queries retain their meaning without a second mutable attachment table.

### Second refinement implementation verification

Migration 024 was applied to shared development on 2026-10-25 after a verified custom-format backup;
see backend/db/MIGRATION_LOG.md for preservation checks. Migrations 022 and 023 were already applied and
were not repeated. All 968 frontend tests, 280 backend tests and 29 local PostgreSQL integration tests pass.
Production builds, application typechecks, root formatting and lint pass. Browser checks verify native drag
within/across days, backdrop dismissal without chapter navigation and desktop map/details viewport fit.
Physical touch and live provider relevance remain separate acceptance checks.

## Third refinement: selection fix, photo interactions and rendering performance

Status: Agreed. Requesting user approved implementation for both backend and frontend on 2026-10-25.
Requesting user previously spoke for frontend/backend on this feature; their current review is still required.
Source branch: 185-improve-create-board-page, inspected 2026-10-25 with existing uncommitted second-refinement work retained.

### Evidence and current implementation

- frontend/src/lib/providers.ts: selectManualActivityPhoto sends a JSON string without Content-Type; the shared
  request helper does not add it. backend/src/app.ts parses application/json and the selection route validates
  photoId. This explains the reported INVALID_REQUEST 400 without requiring a new selection endpoint.
- ActivityEditorDialog renders attached photos in a two-column grid, rather than BoardPhotoStrip. Its image buttons
  omit editor-photo-card. Shared CSS applies scaling to the image button's hover, whereas overlay buttons are siblings;
  moving onto an overlay ends image hover. Pointer cursors are not consistently applied to overlay controls.
- BoardPhotoStrip always reserves a navigation row, including when every photo fits. It already supports Embla drag,
  horizontal wheel/Shift-wheel and shared directional controls. Existing BoardLibrary has a draggable scrollbar pattern.
- DayPlanner mounts the activity dialog inside the day-plan chapter even when opened from BoardPlanMap.
  BoardEditorRail responds to focusin from any chapter, including a dialog; useDialogFocus also restores prior focus.
  Focus-driven chapter navigation is a candidate cause in addition to backdrop event propagation. Reproduce the exact
  map-pin journey before choosing the smallest fix; the previous generic backdrop test did not prove this journey.
- BoardCreationPreview starts its review open, renders one activity per row and one carousel per activity, and filters
  the entire image array repeatedly. CroppedPhoto derives external request dimensions from saved crop/output sizes,
  up to 4096px even when rendering a small thumbnail. Protected upload thumbnails already have a 320px bound.
  The runtime lag has not yet been profiled; these are evidenced costs, not a claim that all lag has one cause.

### Requested scope and proposed behavior

1. Fix manual Unsplash selection through the existing authenticated, Origin-protected endpoint. Send application/json
   and the unchanged {photoId} payload; preserve safe errors, attribution, quotas and one selection download request.
   Add a real frontend-helper-to-Express regression so a mocked fetch cannot conceal the missing header again.
2. Apply a shared photo-frame hover/focus state across create/edit intake, activity attached/available photos, cover
   selection, manual search results and full Board review. The frame grows subtly, without zooming its contents.
   Keep this state while any overlay control is hovered/focused. Images and enabled actions use pointer cursors.
   Proposed motion: approximately 2% frame growth over 160-200ms; action reveal/scale over 120-160ms with a quick
   spring-like ease-out. Respect reduced motion; keep controls accessible on touch and keyboard.
3. Attached activity photos reuse the shared carousel, with approximately 144-160px cards on desktop and responsive
   smaller-screen sizing. More than two photos normally overflow the dialog. Show applicable left/right controls and
   a shared draggable progress scrollbar only on overflow, without empty navigation rows when every item fits.
   Preserve independent cover/crop/remove/zoom actions and saved photo order. Carousel dragging scrolls the strip;
   the existing reorder actions continue to change saved photo order. No implicit photo reassignment on scroll.
4. Opening, saving or dismissing a map activity keeps the current Map chapter and map position. Backdrop dismissal
   consumes the complete pointer/click sequence and restores useful focus in Map, including keyboard-opened pins.
   Dirty changes retain the existing discard confirmation; nested crop/zoom dismissal cannot navigate chapters.
5. Rename the expanded review to Review full Board and retain its default-open state. Reuse the visual structure
   of BoardStoryEnding Summary: each day has an all-photo gallery followed by a compact activity list. Unlike the
   published Summary, do not cap photos at three. Show every attachment in saved activity order, then saved photo
   order within that activity, reading left-to-right then down. Do not reorder activities by time or omit repeated
   photos belonging to different activities. Show the activity title on photo hover/keyboard focus, with a usable
   touch alternative; retain credits, Crop/Delete and the shared zoom viewer. Use a responsive wrapping grid with
   approximately 4-6 thumbnails across wide available space and fewer columns on narrow screens. Keep compact
   activity rows in saved order with their times, location and full notes available; activity titles open editing.
   Other Board photos remain a separate unassigned group using the same photo controls. This agreed day-gallery
   design supersedes the earlier two-activity pairing and 160-character eligibility proposal.
6. Profile image-heavy editor chapters and fix measured decode/network/render/layout costs. Use bounded thumbnails
   for cards/strips/review, with larger existing authorized delivery only when zoom/crop is opened. External crop
   thumbnails must honor their display budget instead of inheriting a 4096px crop-output request. Retain Unsplash
   parameters/attribution and protected upload permissions, presentation revisions and cache semantics. Originals and
   saved crop data are unchanged. Avoid loading large gallery assets before a viewer opens; lazy/defer offscreen photo
   work and reuse grouped photo data where profiling justifies it. Do not introduce dependencies, new photo limits,
   rehosting, global cache permission bypasses or whole-page virtualization without evidence that simpler fixes fail.

### API and storage implications

No new endpoint, stored field or migration is currently proposed. Existing mixed-media contract and migration 024
remain authoritative. Example selection request uses Content-Type: application/json with body {"photoId":"photo_123"}.
Success retains the existing data envelope with canonical ProviderPhoto and context:null; session, Origin, provider
failure and malformed-ID behavior remain unchanged. A failed selection attaches nothing and preserves existing media.
Lower-resolution thumbnails are delivery/presentation choices and do not overwrite image files or saved dimensions.

### Verification and review gates

Reproduce real JSON selection through the existing Express parser; test failure/retry and no duplicate attachment.
Browser-test actual map-pin opening, backdrop/Close/Escape/dirty-discard and nested dialogs without rail movement.
Test frame hover moving onto Crop/Delete plus focus/touch alternatives, scrolling overflow and no-overflow controls,
complete day-gallery membership/order, compact activity rows, and mobile reading order in both themes and reduced motion.
Record before/after request sizes, decoded image dimensions, long tasks and scrolling behavior with a representative
photo-heavy Board and a larger stress fixture, without persisting fixture Boards or calling providers unnecessarily.
Keep root formatting/lint, relevant frontend/backend types/tests/builds and independent test review requirements.

### Open decisions and approval

- Agreed by requesting user on 2026-10-25: Summary-style all-photo day galleries followed by compact activity lists,
  using wider photo rows and activity titles on hover/focus. The earlier pairing proposal is superseded.
- Proposed: 144-160px attached-photo cards; overflow-only arrows and draggable scrollbar.
- Proposed: bounded thumbnails with larger viewer delivery and measured offscreen rendering improvements.
- Requested: shared persistent frame hover, pointer cursors, selection fix, Map chapter retention and review rename.
- Approved: the requesting user authorized implementation for both frontend and backend on 2026-10-25.
  No new endpoint or migration is required; the selection failure is fixed in the frontend JSON request.

Third refinement approval: on 2026-10-25 the requesting user stated "Start implementing. Yes, both BE and FE."
This authorizes the documented revision across both applications; no additional database migration is proposed.

### Third refinement implementation verification (2026-10-25)

The selection helper now sends application/json; an independently authored helper-to-real-Express-parser test
verifies the body. The backend selection endpoint, authorization, quotas and storage contract remain unchanged.
All 973 frontend tests and 280 backend tests pass; both application builds and typechecks pass. Final root formatting
and lint are required after the last edits. No database migration was added or applied for this refinement.

Independent Chrome checks used controlled API/image responses without Board saves or real provider selections.
A 160-photo fixture verified all photos in saved order, six desktop columns/two mobile columns, no 390px overflow,
159 attached photos in the draggable strip with arrows/range versus no navigation row for one photo, persistent
frame enlargement over Crop/Delete with pointer cursors, and Map retention through native backdrop/Close/Escape,
dirty discard and nested zoom dismissal. In a settled 15-step review scroll lasting 761ms, no task exceeded 50ms.
Initial/HMR tasks were excluded; this is controlled development-browser evidence, not a production SLA.
Small cropped requests were bounded to 640px in both dimensions; 4096px appeared only after explicit zoom.
The maximum source-pixel budget changes from 4096 squared to 640 squared (97.56% lower); this is a dimensional
calculation, not a measured live-CDN byte saving. Offscreen review days use content visibility, photos use lazy
decoding/loading and review grouping avoids repeated full-gallery scans/per-activity carousel layout work.
Physical touch, real-CDN throughput and profiling the reporting user's signed-in Board remain untested.
