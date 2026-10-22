# Board overview story contract

Status: Agreed

Approved on 2026-10-21 by the requesting user, explicitly deciding for both frontend and backend.
The approval covers the complete document, including the technical details proposed during drafting.
Implementation is a separate task; this approval does not itself start feature code, migrations or deployment.

## Goal and scope

Rebuild the individual published Board viewer at `/boards/[boardId]` as an activity-led, day-wise story that helps
visitors browse other users' trips. The `/boards` discovery listing is not currently included in this draft.

Desktop downward scroll gestures snap sideways through the overview and full-screen day scenes, following the
existing destination guide. Each scene contains at most six photographs; use as many scenes as needed to retain every
photo. Balance photographs across scenes: seven becomes four/three, eight becomes four/four, and thirteen becomes
five/four/four. The last scene transitions into a vertically scrolling ending. Mobile presents the same content and
order as a vertical day-by-day story. Empty days retain one scene. Inner scrolling can accommodate unusually long
activity text and timelines without hiding photographs.
Timed activities progress from earliest to latest; untimed activities retain their itinerary slots. Preserve each
activity's saved photo order and group its name, time and short note with its cover photograph. Arrange images in
reading order from top left to bottom right; stable bento variation must not reverse the chronology.
Photo-rich activities can occupy more horizontal space; precise composition is refined during implementation review.

The opening overview should include the title, total saves, total comments, activity information and a whole-trip map.
On desktop, a larger square map sits bottom left on the day canvas, without an additional sidebar.
The day heading, activity count and ordered activity/time timeline sit top left. Each scene lists its own activities in two columns without an inner timeline scrollbar; Summary retains the full day. The opening cover uses the same square map size and bottom-left position as the day scenes. Map labels, manual day filters
and Follow story controls are removed. The current day determines the corner map's pins automatically.
Hovering or keyboard-focusing an activity or its photograph moves and zooms the map to its saved pin; day maps start near their first located activity and zoom to level 15 on focus; the map stays
at the last hovered pin on pointer leave. The overlay enlarge button expands the same map upward and rightward to about half the scene.
Covered content moves outward/upward and fades, then returns with a restrained spring-like settling motion on collapse; it becomes inert while obscured; the same control or Escape collapses it. Reduced motion disables animation. On mobile, each day's map appears inline at the start of that day.

After the last day, the page transitions into a vertical Summary with a compact day-by-day itinerary, key Board stats,
the save action, comments and relevant comment actions. Compact itinerary items can reopen activity details.
Persistent chapter navigation lets readers jump to the overview, any day, and the ending/comments without traversing
intervening photos. Give Overview text more horizontal space with a slightly smaller cover. Place Save/Edit beside the author identity,
keep Access inline with tags, and tighten icon-to-count spacing. Center each statistic value/icon group and label. Statistics are read-only; the comment total is plain text and the chapter bar retains Comments.
Between the day list and author, include an interactive all-days map fitted to every saved location.
Center the ending, enlarge its day-photo selections, and include the owner's larger square profile photo and biography.
The ending heading uses the Board title, with "Save this Board" and "Remix this Board" directly beneath it for eligible
viewers. Remix confirms a bookmark first when necessary, then opens the existing saved-Board copy flow; failures keep
the reader on the summary with feedback. Owners retain Edit under existing permissions. The overview uses a larger
cover photograph and more spacious statistics with save/comment icons. Day scenes have circular previous/next arrows
without decorative lines; the overview only needs its next arrow.
The user emphasized lively, smooth interaction comparable to existing browsing components. Snapped scene
transitions, responsive hover/click feedback, smooth chapter jumps and stable image-loading layouts are acceptance
criteria; story photos retain subtle pointer-following tilt and lift, thin theme-aware outlines and a consistent click pointer.
Remove photo entrance animations; use native horizontal smooth scrolling and mandatory snapping like the destination
guide for forward and backward scene transitions. Reduced-motion preferences disable movement.
Center captions under their photo and vertically center side captions.

Remove the activity Save and Copy preview buttons. Show activity notes up to 150 Unicode code points in full, with longer notes excerpted at 150 points, and the full note
in activity details. Clicking a map pin opens the same activity details as clicking the corresponding activity.
Clicking a photo opens an image-only enlarged view with no activity notes at all, including photos clicked from the
activity details. The enlarged viewer browses all images displayed in the Board story, in story order, starting at the
clicked image. Closing it restores the same story position. Location-to-map behavior is defined below.

The user requests a frontend-only 250-character limit for new or edited activity notes. Existing longer notes remain
readable and survive unrelated Board edits without shortening. If an existing note itself is changed through the
frontend, it must fit within 250 characters before that edit is accepted; no automatic truncation is approved.
The current frontend textarea allows 500 characters. Backend validation remains at 500 characters and the existing
`activity.note VARCHAR(500)` storage remains unchanged. This UX limit must not introduce a backend rejection of
otherwise valid 251-to-500-character notes. Frontend character counting is defined below.

## Image presentation

The requester revised the display direction on 2026-10-21: story-only crops into varied square, 16:9, 4:3 and portrait
frames are approved. Use varied sizes and asymmetric placement with stable, aesthetically balanced compositions.
Clearly portrait photos use a stable mix of tall and square frames, never wide landscape crops. Learn natural
dimensions on image load when persisted dimensions are unavailable. On wide photo tiles, put the activity caption
beside the image, alternating sides where appropriate, to leave a squarer image area; narrower tiles keep captions below.
Remove gray letterboxing frames. Saved uploads and author presentation edits remain intact; the shared enlarged
image viewer shows the complete saved image. Every associated photo still appears in the scenes.

Extreme shapes, such as a 1-by-3404-pixel image, must not stretch the page or receive excessive upscaling. Constrain
their display within sensible frame dimensions while keeping the image intact. These are viewer-only safeguards;
new upload restrictions and crop-tool improvements are outside this PR. Exact display bounds are implementation
details to validate with mixed image fixtures. The image-only enlarged viewer retains attribution where required
and contains no activity notes. All photos shown in the story are browsable from the clicked starting photo.

Higher-resolution delivery for enlarged photos is included. Normal browsing retains lighter delivery. Larger
delivery preserves saved presentation edits, current image-read permissions and aspect ratio. It must not expose
the uploader-only original or upscale beyond the saved presentation's available resolution.

## Low-upload Boards and destination illustrations

Filler images are an explicit author opt-in, available in Board creation and Board editing and disabled by default.
This narrowly scoped setting belongs in this feature even though the broader creation/editor overhaul is deferred.
Every Board can enable fillers, regardless of its photo count. Fewer than three user-uploaded images across the Board
is only the threshold for suggesting the opt-in in the editor, not an eligibility restriction. Adding a third upload
does not hide an author's enabled fillers. Unsplash images attached to activities are a separate source and do not
count toward the suggestion threshold.

When enabled for a Board, select a fixed pool of three distinct, full-color destination illustrations
randomly from the first 20 Unsplash destination-search results. Distribute the selected pool without repetition;
the number is independent of the Board's day count and is not a top-up to three total photos.
Selection and database persistence happen when the Board is published or updated, not during visitor reads.
Selected images must be persisted rather than randomly changing on each viewer resolution.

Ordinary edits reuse the saved selection. Disabling hides the selected images while retaining them; re-enabling
restores them. Changing the Board destination selects a new pool for the new destination. Provider failures or fewer
than three usable results must not block Board saving/publication: use available valid fillers, possibly none, and
show the author a non-blocking notice. Never present a previous destination's photos as the new destination.

Even a Board with no usable photos may be published with fillers disabled. Respect that choice; do not automatically
enable fillers. The editor should clearly recommend adding photos or enabling fillers. The image-light layout
behavior uses maps, day timelines, activity details and tighter spacing instead of large empty photo placeholders.

The approved technical details below define upload counting, generation timing, partial-pool retries and destination
identity. Unsplash images remain on provider delivery;
the database stores selected references and metadata, not image binaries.

Improving activity Unsplash matching and allowing authors to search for and choose their own activity Unsplash photo
are explicitly deferred to a future Board/activity creation overhaul PR. Decorative fillers must remain distinct from
activity-specific imagery; they must not imply that a destination illustration depicts a particular activity.

## Evidence and current behavior

Inspected branch: `main`, on 2026-10-21. These sources show implementation, not approval of future behavior:

- `frontend/src/components/features/boards/DatabasePublishedBoard.tsx` loads the live published viewer and tracks views.
- `frontend/src/components/features/boards/PublishedBoard.tsx` renders the current overview, saves, days, comments and
  browser-only preview-copy actions.
- `frontend/src/components/features/boards/PublishedBoardDay.tsx` contains grayscale decorative-photo styling.
- `frontend/src/components/features/boards/ActivityDetailsDialog.tsx` contains the activity Save/Copy preview controls.
- `frontend/src/lib/published-board-data.ts` maps multiple saved photos per activity and saved counts; the presentation
  type in `frontend/src/types/published-board.ts` has no total-comment field.
- `frontend/src/lib/board-photos.ts` already searches destination pools of up to 20 photos and randomly selects
  distinct illustrations, excluding saved photos. Its browser cache is not database persistence. Illustrations are
  explicitly not saved to the Board today; this flow has no opt-in setting or low-upload editor suggestion.
- `frontend/src/components/features/boards/BoardPlanMap.tsx` supplies the editor's whole-trip map, day filters and
  activity selection; it is a reference for the requested viewer behavior.
- `frontend/src/components/features/discover/DiscoverExperience.tsx` uses continuous desktop horizontal travel followed
  by a vertical feed. `frontend/src/components/features/destinations/DestinationRail.tsx` instead uses snapping chapters.
- Existing contracts: `contracts/board-comments.md` and `contracts/image-library.md`.
- Inspected remote branch `origin/120-colorize-unsplash-photos`, commit `89986e0b`: removes grayscale from day photos;
  this work is not on the inspected `main`. Inspected `origin/122-enlarge-image-feature`, commit `98c7e8a1`: adds an
  `ImageZoomDialog` and photo galleries, currently scoped to activity photos in the activity flow. Coordinate/reuse
  relevant work rather than independently duplicating it; the requested story-wide gallery differs from that scope.
- `backend/src/features/images/images.cloudinary.ts` limits normal display delivery to 1600 by 1600 pixels and
  thumbnail delivery to 320 by 320. Its owner-only original variant has a 4096-pixel limit and omits presentation edits.
  `backend/src/features/images/images.service.ts` restricts original access to the uploader. An enlarged viewer must
  preserve author edits and Board-read authorization; it must not use owner-original access as a viewer shortcut.
- `backend/src/features/boards/boards.types.ts`, `boards.schemas.ts` and `boards.service.ts` define current read/edit
  access, strict Board document writes and revision-aware replacement. New filler fields need explicit contract rules.
- `backend/db/migrations/013_board_comments.sql` stores comments with Board cascade deletion and a Board/time index;
  `backend/src/features/board-comments/` implements paginated comments but has no total-count response field.
- `backend/src/features/providers/provider.routes.ts` permits anonymous map sessions with exact frontend Origin and
  quota handling; map viewing does not inherently require a signed-in Board viewer.

Related issues supplied by the user: [#111](https://github.com/RoamBoard/roamboard/issues/111),
[#120](https://github.com/RoamBoard/roamboard/issues/120), and
[#122](https://github.com/RoamBoard/roamboard/issues/122). Issue pages could not be retrieved during initial research;
only requirements pasted into the conversation have been considered verified user input.

## Frontend/backend boundary

Frontend work will include responsive story layout, scroll behavior, maps, image enlargement, removal of unsupported
preview actions, total-comment presentation, the default-off filler setting in creation/editing, and loading/empty/error
behavior.

Backend work is required for persisted destination illustrations, total comments and the larger authorized image
variant. The following technical details were proposed based on the inspected implementation and approved by the
requesting user for both applications. None of these additions is implemented by this document.

## Permissions to preserve

| Actor                       | Read story, map and comment count | Change fillers                       | Post comments | Save Board                                       |
| --------------------------- | --------------------------------- | ------------------------------------ | ------------- | ------------------------------------------------ |
| Signed-out viewer           | Public published Boards           | No                                   | Sign in       | Sign in                                          |
| Signed-in authorized reader | Existing visibility/member rules  | No                                   | Yes           | Existing non-owner rules                         |
| Owner                       | Yes                               | Yes                                  | Yes           | Keep owner edit action and current save behavior |
| Published Board editor      | Yes                               | Yes, through content-edit permission | Yes           | Existing non-owner rules                         |
| Person without Board access | No                                | No                                   | No            | No                                               |

Drafts stay in the editor, editable by their owner under current rules. Filler settings are presentation content;
ownership, visibility and member-management permissions do not change. Cookie-authenticated writes require the
exact configured frontend Origin and server-derived identity. Counts/media never grant Board access.

Preserve existing comment edits, deletion, mentions, notifications, pagination and sign-in return to `#comments`.
Authors edit/delete their own comments; the Board owner can delete any comment on that Board. This feature adds no
replies, reactions or polling. Public authorized map viewing remains available without signing in.

## API and data contract

The requester approved these agent-proposed details for both frontend and backend on 2026-10-21.
Retain `/api/v1`, `{ "data": ... }` success and `{ "error": { "code": "...", "message": "..." } }` errors.

| Field                 | Contract                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fillerImagesEnabled` | Boolean, default false for new/existing Boards. Optional write field: omitted on POST means false; omitted on PUT preserves stored value. Explicit false disables; true enables. Null/non-booleans are invalid.                                                       |
| `fillerImages`        | Read-only ordered array of zero to three current-destination illustrations. Always present; empty when disabled or unavailable. Disabled retained records are not returned for rendering.                                                                             |
| `fillerImageStatus`   | Read-only `disabled`, `pending`, `ready`, `partial` or `unavailable`. Disabled means opted out; pending means an opted-in draft awaiting publication; ready means three usable images; partial means one/two; unavailable means an opted-in published Board has none. |
| `commentCount`        | Read-only nonnegative integer. Total stored comments for this Board, including owner comments and all pages, excluding deleted comments. Drafts return zero. Always present.                                                                                          |
| `images[].largeUrl`   | Read-only protected enlarged-upload delivery URL, with presentation-revision handling matching existing delivery URLs. Existing `url` and `thumbnailUrl` remain.                                                                                                      |

Filler records contain `provider: "unsplash"`, `providerImageId`, zero-based `position`, `url`, `thumbnailUrl`,
`largeUrl`, positive integer `width`/`height`, `alt`, `photographer`, `photographerUrl` and `sourceUrl`. Save canonical
metadata and attribution, not author-supplied provider URLs or invented credits. `largeUrl` may equal `url` if that
is the best available provider-delivered resolution. Provider images remain on provider delivery.

Only the enabled setting is writable. Clients cannot write selections, counts or status. Preserve strict validation
and the complete-document PUT shape. Create/edit hydration and save serialization must carry the new preference.
Remix preparation does not copy fillers/opt-in: a new Board starts disabled.

| Method/path                                   | Change                                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/boards/{boardId}`                       | Return new fields alongside the complete authorized document; never generate or reshuffle images on reads.                                                                                      |
| POST `/boards`                                | Accept optional preference. Store it on drafts without searching. Direct published creation can select images. Existing 201 complete-document response.                                         |
| PUT `/boards/{boardId}`                       | Accept preference alongside existing complete document and required revision. Use existing content permission and revision checks. Existing 200 complete-document response.                     |
| GET `/images/{imageId}/content?variant=large` | New uploaded-image variant bounded to 4096 by 4096 pixels, without upscaling. Apply saved crop/resize first. Authorize as normal display delivery, preserving applicable Board/profile context. |
| GET `/boards/{boardId}/comments`              | Add `meta.totalCount` with the same definition as `commentCount`; keep existing array response, cursor, hasMore and ordering.                                                                   |

Existing display/thumbnail/original variants keep their behavior. Original remains uploader-only. Large failure
falls back to working display delivery; low-resolution uploads or author-selected smaller outputs may still limit
sharpness. This does not reconstruct missing image detail or bypass presentation edits.

Both intro and ending show days, activities, saves and comments. Comment counts link to the comments section.
Successful local post/delete refreshes the authoritative total and updates both displays; failed mutations do not
change it. Editing does not change the count. Other users' changes appear on refresh, without realtime guarantees.
If a count is unavailable during a partial failure/staggered rollout, show unavailable rather than inventing zero.

### Request/response examples

Valid new draft request with opt-in; selection waits for publication:

```json
{
    "status": "draft",
    "title": "Kyoto weekend",
    "description": null,
    "visibility": "public",
    "tagIds": [],
    "imageIds": [],
    "days": [],
    "fillerImagesEnabled": true
}
```

Valid complete replacement of an existing empty draft at revision 4:

```json
{
    "revision": 4,
    "status": "draft",
    "title": "Kyoto weekend",
    "description": null,
    "visibility": "public",
    "tagIds": [],
    "imageIds": [],
    "days": [],
    "fillerImagesEnabled": false
}
```

Projection of new fields from a complete published Board response, using illustrative provider values. The actual
response also contains existing Board/image fields; this projection is not a complete Board document:

```json
{
    "data": {
        "boardId": 42,
        "revision": 5,
        "commentCount": 27,
        "fillerImagesEnabled": true,
        "fillerImageStatus": "partial",
        "fillerImages": [
            {
                "provider": "unsplash",
                "providerImageId": "example-photo-id",
                "position": 0,
                "url": "https://images.unsplash.com/example-photo?w=1600",
                "thumbnailUrl": "https://images.unsplash.com/example-photo?w=320",
                "largeUrl": "https://images.unsplash.com/example-photo?w=4096",
                "width": 6000,
                "height": 4000,
                "alt": "A street in Kyoto",
                "photographer": "Example photographer",
                "photographerUrl": "https://unsplash.com/@example",
                "sourceUrl": "https://unsplash.com/photos/example-photo-id"
            }
        ],
        "images": [
            {
                "imageId": 81,
                "url": "/api/v1/images/81/content?variant=display&v=2",
                "thumbnailUrl": "/api/v1/images/81/content?variant=thumbnail&v=2",
                "largeUrl": "/api/v1/images/81/content?variant=large&v=2"
            }
        ]
    }
}
```

Empty comment page after all comments are deleted:

```json
{
    "data": [],
    "meta": { "nextCursor": null, "hasMore": false, "totalCount": 0 }
}
```

Stale replacement leaves the stored Board and pool unchanged:

```json
{
    "error": {
        "code": "STALE_BOARD_REVISION",
        "message": "Board changed in another session"
    }
}
```

Preserve existing failures: 400 `INVALID_REQUEST` for malformed fields/variant; 401 `UNAUTHENTICATED` for missing
write authentication; 403 `ORIGIN_NOT_ALLOWED` for invalid write Origin; 403 `FORBIDDEN` for unauthorized content
editing; 404 `NOT_FOUND` for missing/inaccessible reads; 409 `STALE_BOARD_REVISION` for concurrent replacement;
422 `PUBLISH_REQUIREMENTS_NOT_MET` for existing publication requirements. Optional provider failure returns a
successful Board save with partial/unavailable filler status. Database failure still means the Board save failed.

## Persistence and selection lifecycle

Count unique Board upload IDs for the editor suggestion, including its cover once and excluding Unsplash activity
images/fillers. This count never restricts opt-in. Draft saves store the preference without provider work. On enabled
published saves, select missing images only for an absent, changed-destination or incomplete pool. Later explicit
published saves may retry incomplete pools when shared quota policy permits, retaining valid matching selections.
No automatic request retries, visitor generation or increased provider budget are introduced.

Disabled saves retain the pool without searches. Existing Boards default to disabled: no generation backfill is
needed, and their next opt-in published save selects images. Destination identity uses its kind, country code and
canonical provider place ID; cosmetic label/coordinate corrections for the same place do not reroll images.
Query its destination and country names, never Board title, notes or private user text. Randomly select distinct,
valid candidates from the first page of up to 20 relevance results, excluding activity photos and earlier pool picks.
Insufficient results do not justify unrelated destinations or invented imagery. New selections use canonical provider
metadata, attribution and quota-managed download-equivalent reporting. No provider binaries are rehosted.

Add a new ordered migration for the default-false Board setting and Board-scoped reference storage containing
destination identity, order, provider identity, dimensions and delivery/credit metadata. Enforce at most three
positions and distinct provider IDs per pool. Board deletion cascades to reference rows, without deleting Unsplash
files. Disabled pools are ignored when rendering; re-enabling after a destination change replaces the stale pool.
Do not shrink `activity.note` or edit `001_initial.sql`. The large variant needs delivery/schema/type changes,
not a duplicate original file. Derive totals from indexed comment rows instead of a drifting mutable counter.
All counts/media retain parent access checks. Avoid N+1 database/provider work.

Perform provider work outside long database transactions. Recheck permission/revision when committing the setting
and pool atomically with normal Board save. A stale request cannot replace newer selections. A provider reporting
event cannot be rolled back after a later database failure; do not claim transactionally exactly-once external events.

## Frontend behavior and verification

- Preserve title, description, linked author, tags, days, within-activity photo order and available activity times.
  Sort timed activities for viewer chronology while keeping untimed slots and the saved Board document intact. Retain
  save/edit permissions and sign-in behavior. Remove browser-only preview save/copy promotions from the replaced flow.
- Include empty saved days with at least one desktop screen width, an intentional day summary and no-locations state
  where needed. Activities lacking photos retain useful text/map content. No large empty photo placeholders.
- Include all associated activity photos. The overview cover and three optional fillers are additional placements,
  never fabricated activity evidence. Distribute fillers between activity groups without repetition, even on long trips.
- Follow the day occupying the story viewport's center, using a stable boundary to prevent filter flicker. Direct
  jumps update the current chapter. No manual pin filter is exposed.
- All-days pins use day colors and within-day numbers. A pin/activity opens activity details; a location label
  focuses/highlights its pin. Hover/focus moves and zooms the corner map, retaining the latest pin on pointer leave.
  No new route/directions feature is required. The Summary map fits all Board locations without a selected pin.
- Use a sticky desktop stage with a native vertical scroll runway synchronized to horizontal progress. Middle-button
  scrolling remains native; the stage only releases vertically after the final scene. Returning to a scene realigns
  the stage beneath the chapter bar before horizontal navigation, including from a partially released ending. Native
  scrolling settles onto the nearest horizontal scene on scrollend. Scene shells permit scroll chaining to the page
  so the final scene can release into Summary; only inner timeline/text controls retain scroll containment.
- Map zoom/pan must not accidentally move the story. Keep deliberate zoom controls/modifier behavior. Reuse or lazily
  initialize map rendering rather than eagerly starting a session for every offscreen day. Failed/no-location maps
  retain the itinerary with a clear map status/retry or no-locations state.
- Gallery order follows displayed story placements, including cover/fillers, but excludes profile portraits and
  unattached uploads not displayed in the story. Stable placement identity handles cover reuse. Support arrows,
  keyboard and mobile swiping, preserve attribution, and never show notes. Closing restores focus/story position.
- Fetch larger images on demand with bounded neighbor preloading. Retain working display images while loading or
  on failure. Failures must not erase activity text or reset chapter position. Reserve stable image spaces using
  available dimensions; legacy missing dimensions use bounded viewer crops. Extreme or tiny files retain contained
  display, and enlarged viewing preserves the complete saved image.
- Frontend notes count 250 Unicode code points using the existing comment-length approach, with a character indicator.
  Unchanged legacy notes survive unrelated edits; changed over-limit notes get validation, never silent truncation.
- Preserve addressable chapter links and `#comments`, including direct entry, sign-in return and browser Back.
  Keyboard, reduced motion, touch, both themes and compact viewports are part of review.
- Desktop scroll gestures snap one scene at a time, like the destination guide. Use restrained transitions and
  interaction feedback. Reduced motion removes decorative travel while preserving usable navigation. Avoid large
  image shifts, delayed controls and unnecessary animation on tiny scroll movements.

Browser review must cover a short image-rich Board, an empty day, a 31-day Board, many photos per activity,
portraits/panoramas, a 1-by-3404 fixture, no photos with fillers off, partial fillers, missing locations, failed
map/image providers and denied reads. Verify automatic day maps, persistent hover focus, all-pins Summary map, day/end/comment jumps, gallery return,
sign-in return to `#comments`, actual sharpness and animation smoothness. Automated checks alone do not prove UX quality.

Automated coverage should focus on permissions/revisions, preference default/omission/null behavior, pool stability
and destination changes, partial/provider failure, totals beyond page one and after deletion, authorized large-image
delivery preserving saved crops, and the frontend-only legacy-note rule. Implementation must run repository formatting,
lint and applicable frontend/backend CI checks. This document itself needs content/diff review and required root checks.

## Review state

The requester approved the complete contract for both applications, including API names, the 4096-pixel cap,
draft-generation/retry timing, comment refresh, permission mapping and frontend defaults. No blocking contract
decisions remain. Proportions, spacing, easing and exact display bounds are refined in implementation/browser review
within these requirements. Implementation, migration, merging and deployment remain separate tasks.

## Viewer design revision - 2026-10-21

The requester explicitly superseded the earlier continuous-scroll and no-extra-cropping rules. Desktop uses sideways
snapping like the destination guide, with every photo included. The initial two-scene limit was subsequently superseded
by the strict six-photo cap and balanced pagination described above.
Use stable asymmetric collages with varied sizes and aspect ratios, without gray image bars. The small map stays
bottom left under the day counter, integrated into the layout, and can be enlarged on request. Ending day summaries
include small representative saved photographs; the owner's current profile photo and biography appear at the end.
Reuse the shared ImageZoomDialog from main. Mobile remains vertical with the same photos and order.

The subsequent canvas refinement removes the additional map sidebar. Day headings and counts sit top left; small maps
sit bottom left, including on the opening scene. Timed activities sort chronologically around fixed untimed slots,
and their captions sit with their photographs. Bento positions retain top-left-to-bottom-right reading order.
The larger overview cover, icon-led statistics and circular right-edge cue replace the earlier centered cover and
two-arrow prompt. The centered ending uses larger day images and a larger square author portrait.

The latest refinement enlarges the corner map, removes the decorative day eyebrow, adds the timed activity timeline,
and puts captions beside wide photographs. Portrait photographs mix tall and square frames. Previous/next arrows have
no decorative lines. The summary uses the Board title and top Save/Remix actions, and comment statistics are plain text.

## Implementation record

2026-10-21: source implementation now includes the responsive story, shared day-following map, addressable chapters,
photo-only story gallery, authoritative comment totals, frontend legacy-note rule, and persisted filler opt-in.
Backend migration 021 adds the default-false setting, constrained Board-scoped references and nullable upload dimensions.
Protected large delivery preserves saved edits and uses display permissions/fallback; normal browsing stays light.
The story gallery reuses the shared ImageZoomDialog with its zoom/pan controls, adding ordered placements, swipe
navigation, larger delivery and bounded neighbour preloading.

Initial implementation verification: backend lint/typecheck/build and 259 tests passed; frontend production build
and 861 tests passed.
Independently authored isolated PostgreSQL coverage passed 8 tests for migration/pool persistence, revision and
permission races at commit, provider-free authorized reads, full comment totals and pool constraints/cascades.
These tests used and cleaned up a temporary schema, without applying 021 to shared development.

Migration 021 was applied to shared development after explicit requester approval on 2026-10-21. A verified
custom-format backup was created first; existing Board opt-ins remain off and no fillers were generated. Live public
Board/comment reads returned 200 with consistent totals and the new image URLs. See the migration log. The runner is
`npm run db:story -- --apply` from backend: it verifies a custom-format backup and applies only 021.
No browser surface was connected and in-app browser creation was unavailable, so manual browser acceptance remains
pending for scroll feel, responsive compositions, mixed/extreme photos, map/provider failures, gallery focus/touch,
theme/reduced-motion behavior and actual enlarged-photo sharpness. Automated checks do not replace that review.

The viewer design revision passes 871 frontend tests, including production-scene geometry in headless Chromium at
narrow and wide desktop sizes and dense-photo retention/navigation checks. Most new layout/navigation tests were
authored alongside implementation; independent review of their intent and coverage remains pending.

Canvas refinement verification includes independently authored chronology, photo retention, caption/detail callback,
gallery ordering, map integration and ending-permission tests. Live local Chromium smoke checks cover direct ending
links, chapter jumps, wheel navigation, map enlargement/dismissal, shared-photo enlargement/return, a 224px square
author portrait and compact horizontal bounds. Screenshots were reviewed in light and dark themes. A live compact-map
camera failure was fixed by sizing bounds padding to the actual map dimensions; independent regressions cover compact,
normal and zero-size viewports. These automated checks do not replace broader manual UX acceptance.

## Decision log

The requester approved every decision below for both applications on 2026-10-21.

| Topic                     | Status | Direction                                                                                                                                              |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop scrolling         | Agreed | Revised 2026-10-21: sideways snap scenes with at most six photos each, balanced across as many scenes as needed, followed by a vertical ending.        |
| Mobile scrolling          | Agreed | Vertical day-by-day story with the same content and order.                                                                                             |
| Story organization        | Agreed | Activity-led, timed activities sorted chronologically around fixed untimed slots; saved photo order preserved.                                         |
| Minimum day space         | Agreed | At least one desktop screen width per day.                                                                                                             |
| Destination illustrations | Agreed | When enabled, select three distinct full-color fillers from the first 20 destination results and distribute without repetition.                        |
| Filler opt-in             | Agreed | Setting in Board creation and editing, disabled by default.                                                                                            |
| Upload suggestion         | Agreed | Every Board can opt in. Fewer than three uploads triggers an editor suggestion only; later uploads do not hide enabled fillers.                        |
| Upload source distinction | Agreed | Activity Unsplash images do not count as user uploads for the suggestion threshold.                                                                    |
| Selection timing          | Agreed | Select and persist on Board publication or update, not visitor reads.                                                                                  |
| Activity image picker     | Agreed | Better activity Unsplash matching and author search/selection are deferred to a future creation overhaul PR.                                           |
| Day maps                  | Agreed | Persistent desktop map highlights the relevant activity and follows the current day's filter as the story advances. Mobile maps start each day inline. |
| All-days map              | Agreed | Readers can also view all pins across every day.                                                                                                       |
| Automatic map focus       | Agreed | No filter or Follow story controls; hover/focus zooms to a saved pin and retains it on pointer leave.                                                  |
| Chapter navigation        | Agreed | Persistent navigation jumps directly to the overview, any day, and the ending/comments.                                                                |
| Motion quality            | Agreed | Smooth, lively scrolling and interactions, referencing existing `/boards` components.                                                                  |
| Notes and photo clicks    | Agreed | Short note excerpt in the story, full note in activity details; enlarged photo views never show notes.                                                 |
| Activity-note limit       | Agreed | Frontend-only 250-character limit for new/edited notes; preserve existing longer notes and the backend/storage 500-character allowance.                |
| Vertical ending           | Agreed | Compact day-by-day itinerary, key Board stats, save action, comments and relevant comment actions.                                                     |
| Image proportions         | Agreed | Revised 2026-10-21: varied display-only crops; enlarged viewing preserves the complete saved image.                                                    |
| Extreme image shapes      | Agreed | Constrain viewer display and upscaling only; upload validation and crop-tool improvements are deferred.                                                |
| Enlarged image navigation | Agreed | Browse all photos displayed in the story, starting at the clicked photo; close back to the same story position.                                        |
| Filler lifecycle          | Agreed | Preserve through ordinary edits and off/on toggles; changing destination selects a new pool.                                                           |
| Filler failures           | Agreed | Save/publish succeeds with available valid fillers, possibly none; notify the author without blocking.                                                 |
| Boards without photos     | Agreed | Keep publishing available and fillers off unless explicitly enabled; strongly suggest adding photos or enabling fillers.                               |
| Enlarged image quality    | Agreed | Include larger on-demand delivery preserving saved presentation and viewing permissions.                                                               |
| Technical contract review | Agreed | Requester approved the complete contract for both frontend and backend on 2026-10-21.                                                                  |

## Approval record

2026-10-21: the requester selected **A: You approve this contract for both frontend and backend**, after receiving
and being linked to the complete reviewable document. This explicitly supplies approval authority for both sides.
The approval includes the user-directed UX and the agent-proposed API, permissions, lifecycle, persistence and
verification details. No separate absent teammate approval is claimed.

Status changed from Draft to Agreed. At approval time, feature implementation had not been requested or started. The requester subsequently authorized
implementation across both applications on 2026-10-21. The contract remains
the shared implementation reference; later behavior changes must update its decisions before implementation.
