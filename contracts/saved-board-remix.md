# Saved Board creation

`/create/remix` lists the signed-in user's saved Boards using the Continue page gallery, without search,
filters or placeholder content. Back remains available. The short introduction explains that a saved Board
is a starting point for the user's own trip. Only the primary card has actions: its body and eye open
`/boards/<boardId>`, and its plus opens `/boards/new?remix=<boardId>`. These actions appear on hover or keyboard
focus and remain visible on touch devices. Other cards show no hover details or actions; clicking them moves
them into the primary position, as do gallery arrows. The count uses the same spacing as Continue, reserving
its filter-row space without showing filters. Continue retains its existing select/edit behavior.

The primary card's hover header has a smaller author photo at the top left with the author's `@handle` beside
it, together linking to `/profile/<handle>`. The plus and eye are centered as a pair below the details, preserving
their existing gap. The photo uses the existing Board-author URL and its authorization query;
missing or failed photos use the existing account icon while retaining the profile link.

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
The original author, completion, visibility, memberships and save counts are not copied. The creator uses the
current user's normal new-Board visibility preference. New Board ownership/completion follow normal creation.

Preparation returns 401 without a session, 404 for a missing/inaccessible/unsaved Board, and 503 when photo copying
is unavailable. Provider failures keep the creator disabled with retry. Failed/abandoned preparation can leave
unattached uploads or expired intents, handled by the existing unused-image cleanup after its grace period.
No new migration is required. Preparation is not idempotent; the frontend deduplicates in-flight preparation
within one mounted creator. Reloading starts a fresh unsaved copy.
