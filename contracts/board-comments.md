# Board comments contract

Status: **Agreed; frontend and backend implemented, migration pending on the shared database.** On 2026-10-19, the
requester approved this complete contract while deciding for both frontend and backend. Migration
`013_board_comments.sql` was added because `011_board_published_at.sql` and `012_friendship_accepted_at.sql` already
occupied the preceding numbers.

Source branch: `89-feat-add-comment-section-to-boards` (2026-10-19). Relevant existing code and documents:
`frontend/src/app/boards/[boardId]/page.tsx`, `frontend/src/components/features/boards/PublishedBoard.tsx`,
`frontend/src/lib/published-board-data.ts`, `frontend/src/components/features/auth/GoogleAuthPanel.tsx`,
`frontend/src/components/features/auth/GuestAuthPanel.tsx`, `backend/src/features/boards/boards.routes.ts`,
`backend/src/features/boards/boards.types.ts`, `backend/db/migrations/001_initial.sql`,
`backend/BOARD_API_CONTRACT.md`, and `backend/AGENTS.md`. Issue: [#89](https://github.com/RoamBoard/roamboard/issues/89).

## Goal and first version

Add a persistent comment section at the bottom of each published Board's `/boards/{boardId}` page, after the existing
visitor-only footer when that footer is present. Owners also see the section. A viewer can read the 20 newest comments
and load older ones. A signed-in viewer can post plain text, edit their own comments, and delete their own comments.
The Board owner can delete any comment on that Board.

Comments on drafts, replies, rich text, clickable link parsing, image attachments, reactions, notifications, realtime
updates, and moderation roles beyond the Board owner are outside this version. The open notification issue [#42](https://github.com/RoamBoard/roamboard/issues/42)
does not yet provide comment notifications.

## State at approval and integration boundary

| Area                 | Current state                                                                                                                                 | Change needed                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Published Board page | `PublishedBoard` renders the Board and a footer for non-owners. There is no comment UI or mock comment data.                                  | Render the comment section after the Board content for all authorized viewers, including owners.             |
| Board access         | `GET /api/v1/boards/{boardId}` checks public, friends, invited-member, and owner access. The frontend rejects drafts on this published route. | Apply the same current Board read rule to comments and reject drafts.                                        |
| Authentication       | Google and development guest login use a session cookie. Login currently redirects to `/home` or `/welcome`.                                  | Comment writes use the session. A validated Board return path takes precedence after a comment-prompt login. |
| Backend and schema   | No comment endpoint or table exists.                                                                                                          | Add comment routes, access checks, storage, and a new ordered migration.                                     |

The table records the state when this contract was approved. Comments persist after the migration is applied.

## Journeys and permissions

| Actor on a published Board                      | Read comments | Post                | Edit         | Delete                    |
| ----------------------------------------------- | ------------- | ------------------- | ------------ | ------------------------- |
| Signed-out viewer of a public Board             | Yes           | No; offered sign-in | No           | No                        |
| Signed-in viewer with current Board read access | Yes           | Yes                 | Own comments | Own comments              |
| Board owner                                     | Yes           | Yes                 | Own comments | Any comment on that Board |
| Person without Board read access                | No            | No                  | No           | No                        |

Friends-only Boards remain available to accepted friends and invited members; collaborator-only Boards remain
available to invited members; public Boards can be read anonymously. A draft has no comment section or comment API,
even for its owner. A comment never grants access to a Board. Every comment operation rechecks the Board's current
status and access. An inaccessible or missing Board returns `404 NOT_FOUND` rather than revealing whether it exists.

Development guest accounts count as signed-in users. Since a guest identity is shared, anyone signed in as that same
guest can edit or delete comments authored by it. The server derives the author and permissions from the session,
never from a submitted username or user ID.

When a signed-out viewer follows the comment section's sign-in link, it opens
`/login?returnTo=%2Fboards%2F42%23comments` for Board 42. Successful Google or guest login returns them to
`/boards/42#comments`. The frontend accepts only a same-origin relative `/boards/{positiveBoardId}` path with the
optional `#comments` fragment for this parameter. Invalid values fall back to the existing login destination. Other
login flows keep their current destinations. The URL must not contain session data.

## Data and lifecycle

Each comment has a server-generated positive integer `commentId`, a `boardId`, an internal author user ID, a plain-text
`body`, `createdAt`, nullable `editedAt`, and a positive integer `revision` starting at 1. The API returns the author's
**current** `displayName`, `username`, and optional current profile photo URL. It does not expose the internal user ID,
email, or authentication provider. A missing photo is `null`. Profile photo delivery must use the existing
profile-handle authorization path; it must not expose an upload's original variant.

Posting or editing trims whitespace at the two ends of `body`, preserves internal line breaks, and rejects an empty or
whitespace-only result. The trimmed result may contain at most **2,000 Unicode code points**. The frontend and backend
use the same count. The API accepts only a JSON string for `body`; `null`, an omitted field, arrays, and unknown write
fields are invalid. Comments render as text, never as HTML or Markdown. The UI can show an `edited` marker when
`editedAt` is non-null; edit history is not exposed.

Editing replaces the entire body and increments `revision`. The client sends the revision it last read. A stale edit
returns `409 STALE_COMMENT` without overwriting the current text; the frontend retains the attempted edit and offers
reload. Deletion removes the comment from the list rather than leaving a tombstone (there are no replies). Deleting a
Board removes its comments. The proposed migration also removes a user's comments if that account is deleted.

Comments are ordered by `createdAt` descending, then `commentId` descending. Editing does not move a comment. The
first request returns at most 20 rows; “Load older” uses an opaque cursor tied to the last returned row. Each accepted
POST creates a separate comment. The frontend prevents repeated submits while one request is pending, but identical
texts are not treated as duplicates. There is no background polling; another person's new comment appears after a
reload.

## API proposal

All paths use `/api/v1`, camelCase JSON, `{ "data": ... }` success envelopes, and
`{ "error": { "code": "...", "message": "..." } }` error envelopes. All responses containing comments use
`Cache-Control: no-store` because visibility and membership can change. Board and comment path IDs must be positive
integers. Cookie-authenticated writes require the exact configured frontend `Origin` as CSRF protection.

### `GET /api/v1/boards/{boardId}/comments?cursor={opaqueCursor}`

Optional `cursor` is omitted for the first 20 newest comments. The response includes up to 20 comments and a cursor
for the next older set. `nextCursor: null` means there are no older comments. A malformed cursor returns
`400 INVALID_REQUEST`; a cursor from a different Board is also invalid. The server applies Board access before
returning any comment or author data.

```json
{
    "data": [
        {
            "commentId": 81,
            "boardId": 42,
            "body": "Loved this route!\nThanks for sharing.",
            "author": {
                "displayName": "Avery Lee",
                "username": "avery",
                "profilePictureUrl": null
            },
            "createdAt": "2026-10-19T14:00:00.000Z",
            "editedAt": null,
            "revision": 1,
            "permissions": { "canEdit": false, "canDelete": false }
        }
    ],
    "meta": { "nextCursor": null, "hasMore": false }
}
```

`permissions` reflects the current caller, so both flags are false for an anonymous reader. An empty list is
`{ "data": [], "meta": { "nextCursor": null, "hasMore": false } }`.

### `POST /api/v1/boards/{boardId}/comments`

Requires a session, exact frontend Origin, a published Board the caller can read, and
`{ "body": "Loved this route!" }`. For Board 42, an example response is `201` with
`Location: /api/v1/boards/42/comments/81`:

```json
{
    "data": {
        "commentId": 81,
        "boardId": 42,
        "body": "Loved this route!",
        "author": {
            "displayName": "Avery Lee",
            "username": "avery",
            "profilePictureUrl": null
        },
        "createdAt": "2026-10-19T14:00:00.000Z",
        "editedAt": null,
        "revision": 1,
        "permissions": { "canEdit": true, "canDelete": true }
    }
}
```

An omitted, `null`, or empty body returns `400 INVALID_REQUEST`; an absent session returns
`401 UNAUTHENTICATED`.

### `PATCH /api/v1/boards/{boardId}/comments/{commentId}`

Requires a session, exact frontend Origin, Board access, and authorship of the comment. The request is
`{ "body": "Updated text", "revision": 1 }`. Returns `200 { "data": Comment }` with `revision: 2` and
`editedAt` set. A different signed-in reader, including the Board owner, cannot edit another author's text and gets
`403 FORBIDDEN`. A stale revision returns the normal error envelope, for example
`409 { "error": { "code": "STALE_COMMENT", "message": "This comment changed. Reload it before editing." } }`.
The backend checks that the comment belongs to the Board in the path.

### `DELETE /api/v1/boards/{boardId}/comments/{commentId}`

Requires a session, exact frontend Origin, and Board access. The author or Board owner may delete it. Returns `204`
without a body. A different reader gets `403 FORBIDDEN`. A missing comment or a comment attached to another Board
returns `404 NOT_FOUND`.

After required authentication, missing, inaccessible, or draft Boards return `404 NOT_FOUND`. Unexpected failures use
the normal server error envelope. Database writes are atomic. A comment read failure must not hide an otherwise
readable Board.

## Frontend behavior

- After the published Board is ready, load the first comment page independently. Show a loading state, an empty state,
  and a retry control for failures without replacing the Board with mock comments. Loading older comments appends
  them, and its failure leaves already loaded comments visible with a retry path.
- A signed-out public viewer sees comments and a sign-in prompt instead of an enabled composer. A signed-in reader
  sees a plain-text multiline composer with the 2,000-character limit and a submit control. Whitespace-only text
  cannot be submitted. The page retains draft text on network or validation failure.
- On a successful POST, clear the composer and prepend the server-returned comment once. Await the server response
  before claiming persistence. On a successful edit, replace that row with the server response. On a successful delete,
  remove the row. During each mutation, prevent duplicate submissions and show an in-place error on failure.
- Show edit/delete actions only when `permissions` allows them. Give the owner a delete action on other people's
  comments, without an edit action. Show the author's current identity and timestamps; preserve line breaks and
  render the body as text.
- The section is visible on the owner's published Board as well as other people's Boards. It follows the existing
  mobile layout and both themes. A Board error or denied access shows no comment UI.

## Backend storage and delivery

Add a new ordered migration. The implementation uses `013_board_comments.sql` after the existing
`012_friendship_accepted_at.sql` file.
The proposed `board_comment` table has a generated integer primary key, `board_id` referencing `board` with
`ON DELETE CASCADE`, `author_user_id` referencing `app_user` with `ON DELETE CASCADE`, text body, created/edited
timestamps, and revision. SQL constraints require a nonempty body of at most 2,000 Unicode characters and a positive
revision. Add a composite `(board_id, created_at DESC, comment_id DESC)` index for cursor reads.
Service access checks reuse the current Board visibility/membership rule and require `status = 'published'`. The
repository joins current public author fields and builds safe profile photo URLs. A Board revision does not change
when someone comments; comment edits use their own revision.

Frontend work includes a comment API helper and section on `PublishedBoard`, plus a validated return destination
through Google and guest login. Backend work includes migration, routes, validation, service/repository access rules,
and API/integration tests for public/restricted reads, posting, editing, owner moderation, cursors, and failures.
The migration is a deployment step after implementation; this contract does not apply it.

## Decision log and review

| Decision                                                                                       | State                              |
| ---------------------------------------------------------------------------------------------- | ---------------------------------- |
| Published Board comments at the bottom of `/boards/{boardId}`; owners see them                 | Agreed by requester                |
| Signed-in viewers, including owners and shared development guests, may post                    | Agreed by requester                |
| Anyone with Board read access may read; anonymous public readers may read                      | Agreed by requester                |
| Flat list, no replies; newest first; 20 at a time with “Load older”                            | Agreed by requester                |
| Authors may edit/delete their own comments; owners may delete any comment                      | Agreed by requester                |
| Plain text with line breaks, maximum 2,000 characters                                          | Agreed by requester                |
| Display current display name, @username, and optional profile photo                            | Agreed by requester                |
| No notifications in the first version                                                          | Agreed by requester                |
| Sign-in from comments returns to the same Board                                                | Agreed by requester                |
| Exact API shapes, cursor encoding, revision conflict, validation details, and deletion cascade | Agreed by requester for both sides |

Approval record: On 2026-10-19, the requester supplied the product choices above, said they are deciding for both
frontend and backend, and approved this complete document, including the request/response examples and frontend and
backend change list. Implementation and migration application remain separate work.
