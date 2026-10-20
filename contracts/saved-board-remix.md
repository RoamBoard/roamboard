# Saved Board creation

`/create/remix` lists the signed-in user's saved Boards using the Continue page gallery, without search,
filters or placeholder content. Back remains available. The short introduction explains that a saved Board
is a starting point for the user's own trip. The focused published card background opens `/boards/<boardId>`. Secondary deck and collection cards select first, without navigating; arrows and drag gestures also change the primary card. Only the primary card exposes hover
actions: Remix retains plus + View, and Continue owners receive pen + View. The pen uses current edit permission;
the eye and background use the published Board view. Per the user's decision, drafts keep opening their existing
editor rather than acquiring a new read-only preview. Unresolved draft permissions do not grant an editor link.
Actions appear on hover or keyboard focus and remain visible on touch devices. The count uses the same spacing
as Continue, reserving its filter-row space without showing filters. Both galleries place arrows beneath the
secondary deck and above the divider; small screens place controls beneath the main card.

Both Continue and Remix primary cards share the same profile header and hover spacing. The author photo and
`@handle` form one link to `/profile/<handle>`. The photo retains its Board authorization query;
missing or failed photos use the account icon. The action row reserves room above the metadata divider,
with description/tags clipped within their own text area so they cannot overlap buttons or totals.

## Preparation API

`POST /api/v1/boards/:boardId/remix-content` requires a session and exact frontend Origin. The Board must
still be published, readable and saved by that user. The request has no content fields. Success returns
`200 { data: ... }` containing `title`, `description`, `destination`, `tags`, `days`, `images` and `coverImageId`.
It creates no Board, membership or bookmark. Only Save/Publish creates a Board through the existing API.

Days retain their numbers and activities retain their order, times, locations, text and external photo credits.
Calendar dates are cleared and persisted day/activity IDs are omitted. Uploaded photos are staged as independent,
caller-owned authenticated assets with their own image IDs, including cover choices. Copies preserve the rendered
display crop (up to 1600px), with that crop baked in; the uploader's uncropped original and private capture/GPS
metadata are not copied. New crop/resize edits and Reset apply to this independent displayed image.
Deleting the original Board must preserve the remixed Board's cover, activity photos and independent image records.
Deleting the remix later cleans only its unused copies. Any older shared image references also prevent cleanup until
the last Board/activity/profile reference is removed. See [uploaded image deletion](image-deletion.md).
The original author, completion, visibility, memberships and save counts are not copied. The creator uses the
current user's normal new-Board visibility preference. New Board ownership/completion follow normal creation.

Preparation returns 401 without a session, 404 for a missing/inaccessible/unsaved Board, and 503 when photo copying
is unavailable. Provider failures keep the creator disabled with retry. Failed/abandoned preparation can leave
unattached uploads or expired intents, handled by the existing unused-image cleanup after its grace period.
No new migration is required. Preparation is not idempotent; the frontend deduplicates in-flight preparation
within one mounted creator. Reloading starts a fresh unsaved copy.

## Shared browsing hover controls

User decision: other-author cards in featured, destination and library browsing use bookmark + View, rather than the Remix plus. Saving uses the existing saved-Board API, confirms membership before filling the bookmark, supports unsaving, and retains visible error/sign-in feedback. The Remix picker keeps its plus + View actions. Owners see the shared profile header and View, plus a pen only with edit permission. Focused spatial/deck card backgrounds open their Board view; out-of-focus cards select first. Component 2 is an equal-card library, so every library card opens directly. Explicit controls retain their own destinations. No new backend endpoint or stored field is introduced. Destination summaries are enriched by the selected Board document for author photos, permissions, activity/save totals and saved membership; unavailable previews retain honest summary cards with retry. Standalone Unsplash cover credits are suppressed in these three gallery layouts.

Hover controls use the same disclosure state as metadata, with subtle hover/focus scaling and reduced-motion support. Dragging suppresses all hover layers together; native image/link dragging is disabled. Featured cards update their positions, scale and opacity continuously with horizontal drag, then settle to the selected Board. Dragging a secondary Continue/Remix deck card moves it with the pointer and promotes it on release; drag-release clicks do not navigate. The equal-card library keeps its component boundary, removes per-card divider lines, and uses a thicker, keyboard-accessible draggable scrollbar. The scrollbar adapter targets Embla 8.6 distance scrolling so it moves continuously between snap positions.

All three Board list components share the same mouse-only corner tilt, with drag/reset and reduced-motion handling. Component 1 displays the existing visibility indicator for a known access setting even on another author's Board, without inferring ownership or granting edit controls. API visibility values and access rules are unchanged.

The saved picker shows known visibility on primary and secondary cards, including other authors' Boards. A visibility indicator does not confer ownership or expose editor actions.
