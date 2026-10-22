# Clear notifications contract

Status: **Implemented at the requester's direction; pending frontend and backend review.**

Initiated by the requester on branch `128-feat-clear-notifications` on 2026-10-21. The requester directed implementation on 2026-10-21. Frontend and backend reviewers have not been identified or recorded as approving this contract.

Sources reviewed: [the existing comment notification contract](board-comment-notifications.md), [the mentions extension](board-comment-mentions.md), `frontend/src/components/features/notifications/`, `frontend/src/components/ui/NotificationControl.tsx`, `frontend/src/lib/comment-notifications.ts`, `backend/src/features/board-comment-notifications/`, `backend/src/features/users/users.routes.ts`, `backend/src/features/users/users.repository.ts`, and `backend/db/migrations/014_board_comment_notifications.sql`.

## Baseline before this feature

- Implemented: comment and mention notifications are persisted per recipient. The bell shows the latest five, and `/notifications` pages through 20 at a time. Opening an item marks it read, but read items remain in history. The unread count includes visible unread comment and mention items.
- Implemented: pending friend requests appear in the same bell and page. They are separate friendship records with accept and reject actions, not comment notification rows.
- Implemented: personal notification reads and writes require a session. Existing cookie-authenticated writes require the configured frontend Origin. Comment notification lists and read actions are restricted to the current account and currently accessible Boards.
- Before this change, there was no bulk clear or mark-all action, clear control, or clear-specific endpoint. The previously agreed comment notification contract explicitly excluded a mark-all-read action from its first version.

## Goal and scope

The requester chose for **Clear notifications** to mark comment and mention notifications read while retaining their history. Pending friend requests remain pending and keep their accept/reject actions. The control appears in both the bell panel and `/notifications`. It covers every existing comment and mention notification owned by the account, including older pages and rows currently hidden because Board access was lost. The bell shows unread comment/mention items only, while `/notifications` keeps read history. These are requester decisions on 2026-10-21, pending frontend and backend review.

This extends the earlier comment-notification contract, which excluded a bulk read action from its first version. The action changes notification read state only; it does not change the underlying comments, subscriptions, Board access, or friendships. The unread comment/mention portion of the bell badge falls after a successful clear; pending friend requests still contribute to the badge.

## User journey and permissions

- A signed-in user chooses Clear notifications from the bell panel or `/notifications`. The action marks all their existing unread comment and mention rows read, including rows not currently visible because Board access was lost. It affects older pages without requiring the client to load them first.
- Read items remain in `/notifications` history but no longer appear in the bell panel, which shows the latest five unread comment/mention items. The action changes only the caller's read state; it does not affect another recipient, the underlying comments, Board subscriptions or access, or friendships.
- Pending friend requests remain actionable and continue to contribute to the bell badge. A user with only pending friend requests has no visible comment/mention items to clear, though inaccessible unread rows may still exist.
- A new notification committed after the bulk update remains unread. Repeating the action is safe. Clearing an empty collection succeeds with no change.
- Anonymous visitors cannot clear notifications. The server derives the account from the session cookie; the client never sends a user ID.

## Implemented API pending review

These endpoints follow the existing `/api/v1`, session-cookie, exact frontend-Origin, `Cache-Control: no-store`, `{ "data": ... }` success-envelope, and `{ "error": ... }` error-envelope conventions. They extend the existing comment-notification resource; they do not modify the single-item read endpoint.

| Method | Path                                                     | Authentication and request                                                   | Success                                                                                                                                                       |
| ------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/users/me/comment-notifications?unreadOnly=true` | Session cookie; no cursor needed for the bell                                | Existing list envelope with only currently visible unread comment/mention items in `data`, newest first. `meta.unreadCount` remains the visible unread total. |
| `POST` | `/api/v1/users/me/comment-notifications/read-all`        | Session cookie and exact frontend Origin; no request body, query, or user ID | `200` with `{ "data": { "unreadCount": 0 } }` for the caller's currently visible unread comment/mention count after the update.                               |

The existing `GET /api/v1/users/me/comment-notifications` without `unreadOnly` remains unchanged and supplies full read/unread history to `/notifications`. The new optional `unreadOnly` query accepts only `true` or `false`; omitted and `false` both return full history. An invalid value returns `400 INVALID_REQUEST`. Pagination retains the existing cursor and 20-item page shape in either mode. The bell requests the first unread-only page and displays at most five; it does not filter the first full-history page locally, which could miss older unread items.

The server sets `read_at` on the caller's unread `board_comment_notification` rows without joining Board visibility. That is necessary to include notifications for Boards the caller cannot currently access. It does not return those rows or reveal their contents. The existing list and badge count still apply Board visibility filters. A concurrent new notification may make the returned `unreadCount` greater than zero.

Success with unread items:

```json
{
    "data": {
        "unreadCount": 0
    }
}
```

After a successful clear with no concurrent new notification, the bell's unread-only read returns:

```json
{
    "data": [],
    "meta": {
        "nextCursor": null,
        "hasMore": false,
        "unreadCount": 0
    }
}
```

Success when there was nothing to clear has the same shape and zero count. If a new notification arrives after the bulk update but before the count is read, the response may instead contain `{ "data": { "unreadCount": 1 } }`; that new item remains unread.

Missing session: `401` with `{ "error": { "code": "UNAUTHENTICATED", "message": "Not signed in" } }`. Wrong or missing Origin: `403` with `{ "error": { "code": "ORIGIN_NOT_ALLOWED", "message": "Origin not allowed" } }`. An unexpected storage failure uses the existing generic server error envelope and does not claim success. There is no `404` for an empty collection.

## Frontend behavior

- Offer Clear notifications in the comment/mention area of both the bell panel and `/notifications`, so it does not imply that pending friend requests will be accepted or rejected. In the bell, show the control when the visible comment/mention unread count is greater than zero. On `/notifications`, keep it available to a signed-in user even when the visible count is zero, so they can also clear rows hidden by lost Board access. An empty clear is safe. The bell requests unread-only comment/mention items; `/notifications` requests full history.
- Disable the control while the request is pending. On success, publish the existing comment-notification update event so both surfaces refetch their first page and unread count. The full page resets older-page pagination to the newest page; the items remain in history. The bell's comment/mention list becomes empty unless a new unread item arrived. The badge still includes pending friend requests and any new unread comment/mention notifications.
- On failure, retain the current list and badge, show an actionable error, and allow retry. Do not claim locally that all items were read before server success. If the account changes while a request is pending, ignore its response for the new account and reload that account's state.
- Loading and empty states continue to distinguish comment notifications from friend requests. No background polling, email, or push channel is added.

## Backend and storage implications

- Add an account-scoped bulk read method to the existing notification service and repository, plus route/controller wiring and relevant validation. Update only rows with `recipient_user_id` from the authenticated session and `read_at IS NULL`. Do not filter this write by Board visibility. Extend the existing list query with `unreadOnly=true` so the bell can get the latest unread items while preserving the existing full-history default.
- Reuse `board_comment_notification.read_at` and its recipient/unread index from migration 014. No schema migration is proposed. Do not apply or rerun migrations for this feature.
- Test ownership isolation, both kinds, older and currently inaccessible rows, empty and repeated calls, Origin/session errors, and a notification inserted after clear. Verify unread-only listing returns the latest unread items even when the first full-history page is all read. Frontend tests should verify both surfaces update without changing friend-request actions or hiding read history, including the page control when only inaccessible unread rows remain.

## Implementation inventory

| Side     | Implemented work                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | Add the clear control to both surfaces and a client API helper; use unread-only bell reads and coordinate account-safe refresh of the list and badge after success. |
| Backend  | Add a session/Origin-protected bulk read route, an unread-only list filter, and an account-scoped update to the existing notifications feature.                     |
| Storage  | Reuse `board_comment_notification.read_at`; no migration is proposed.                                                                                               |

## Review needed

1. Do both teammates accept the proposed endpoints, responses, and frontend behavior above?
2. Who is reviewing and approving the contract for frontend and backend? One person may explicitly decide for both.

## Decision log and approval

| Decision                                                                                   | State                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Mark comment and mention notifications read; retain history; leave friend requests pending | Chosen by requester on 2026-10-21; pending team review    |
| Show clear in both bell panel and `/notifications`                                         | Chosen by requester on 2026-10-21; pending team review    |
| Include older and currently inaccessible rows owned by the account                         | Chosen by requester on 2026-10-21; pending team review    |
| Existing read-history and pending friend-request behavior                                  | Implemented baseline, not a new feature decision          |
| Show only unread comment/mention items in the bell; keep full page history                 | Chosen by requester on 2026-10-21; pending team review    |
| Endpoint, response, and failure behavior                                                   | Implemented at requester's direction; pending team review |

Approval: **No separate frontend or backend reviewer acceptance recorded.** The requester's instruction to implement authorized the code work; it does not record approval from an absent teammate.
