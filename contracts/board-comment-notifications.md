# Board comment notifications contract

Status: **Agreed for frontend and backend.** Approved by the requester on 2026-10-19.

Sources: branch `89-feat-add-comment-section-to-boards`, `frontend/src/components/ui/NotificationControl.tsx`,
`frontend/src/components/features/notifications/NotificationsContent.tsx`, `frontend/src/lib/profile.ts`,
`backend/src/features/users/users.routes.ts`, and the Board comment feature restored on this branch. The implementation
adds persisted comment notifications alongside the existing friend-request notifications.

## Scope and recipients

- A successfully posted comment creates one in-app notification for each eligible recipient, excluding its author.
  Editing or deleting a comment does not create a notification. There is no email, push, or live update channel.
- The Board owner is subscribed by default, including before anyone comments. The owner can turn the comment bell off
  and back on. Each new comment from another person notifies the owner while the bell is on.
- Any signed-in viewer who can read a published Board can turn its comment bell on or off before commenting. Other
  viewers start with it off. After a viewer's first successful comment, it turns on automatically **only if that viewer
  has not already chosen a setting**. A prior explicit off choice stays off. The commenter never gets a notification
  for their own comment.
- Subscriptions do not grant Board access. Creating and reading notifications respects the Board's current published
  status, visibility, friendship, and membership. If access is lost, the notification is not exposed. A draft has no
  comment bell or comment notifications.

## User experience

- The comment section shows a bell toggle to signed-in viewers, including the owner. Its current setting loads with
  the Board. A successful toggle updates the icon and label; a failed toggle keeps the previous setting and shows a
  retryable error. Posting a first comment updates the toggle to the server's resulting setting.
- Unread comment notifications appear alongside pending friend requests in the sidebar bell and on `/notifications`.
  The bell badge counts unread comments plus pending friend requests. Opening the bell does not mark comments read.
  Clicking a comment notification marks it read and goes to `/boards/{boardId}#comment-{commentId}`. Read comments
  remain in the `/notifications` history, ordered newest first; the bell panel shows the latest five. The full page
  loads 20 at a time with a Load older control. There is no Mark all read action in this version.
- Each item identifies the commenter and Board and shows a short plain-text excerpt. It never interprets comment
  text as HTML or Markdown. New notifications appear after opening or refreshing the bell or page; no background
  polling is required. Friend request accept/reject behavior remains as it is today.
- Deleting a comment removes its related notifications. Deleting the Board removes its subscriptions and notifications.

## API

All endpoints use `/api/v1`, the session cookie, `{ "data": ... }` success envelopes, and the existing error envelope.
They return `Cache-Control: no-store`. Cookie-authenticated writes require the exact configured frontend Origin.
Board IDs, comment IDs, and notification IDs are positive integers. A missing, draft, or inaccessible Board returns
`404 NOT_FOUND`; a missing session returns `401 UNAUTHENTICATED` on these personal endpoints.

| Method | Path                                                    | Result                                                                                                                                                                         |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/boards/{boardId}/comment-subscription`                | `{ "data": { "enabled": true } }` for the current viewer.                                                                                                                      |
| `PUT`  | `/boards/{boardId}/comment-subscription`                | Strict body `{ "enabled": false }`; persist the choice and return `{ "data": { "enabled": false } }`.                                                                          |
| `GET`  | `/users/me/comment-notifications?cursor={cursor}`       | Newest 20 visible items, `meta.nextCursor`, `meta.hasMore`, and total `meta.unreadCount`. No cursor starts at newest. Invalid or foreign cursor: `400 INVALID_REQUEST`.        |
| `POST` | `/users/me/comment-notifications/{notificationId}/read` | Idempotently mark the caller's item read; return `{ "data": { "notificationId": 9, "readAt": "2026-10-19T14:05:00.000Z" } }`. Another user's or missing item: `404 NOT_FOUND`. |

Example list item:

```json
{
    "notificationId": 9,
    "boardId": 42,
    "boardTitle": "Tokyo in three days",
    "commentId": 81,
    "commenter": {
        "displayName": "Avery Lee",
        "username": "avery",
        "profilePictureUrl": null
    },
    "excerpt": "Loved this route!",
    "createdAt": "2026-10-19T14:00:00.000Z",
    "readAt": null
}
```

`GET` returns `{ "data": [], "meta": { "nextCursor": null, "hasMore": false, "unreadCount": 0 } }` when empty.
The excerpt is derived from the current comment, truncated to 140 Unicode code points, and is absent after deletion
because the notification is deleted. The server derives subscribers, recipients, and notification ownership from
database state and sessions, not client-supplied IDs.

## Storage and integration

The comment insert and recipient notification inserts succeed or fail in one database transaction. A subscription
row records explicit on/off choices; an absent row means on for the owner and off for other viewers until their first
comment. The first successful comment creates an enabled row only when no choice exists. Notification rows reference
the comment and recipient, store creation/read timestamps, and cascade on comment or recipient deletion. Use indexes
for recipient/newest and recipient/unread reads.

On this branch `012_friendship_accepted_at.sql` already exists. The restored Board comment migration was renamed
`013_board_comments.sql`; the notification migration follows it as `014_board_comment_notifications.sql`.
Check the shared database before applying any migration, since an earlier conversation supplied a command for the
old comment filename. Migration application remains a separate step performed by the requester.

## Decisions and review

| Decision                                                            | State                 |
| ------------------------------------------------------------------- | --------------------- |
| Owner receives notifications by default, excluding own comments     | Agreed by requester   |
| Any signed-in viewer may subscribe before commenting                | Agreed by requester   |
| First comment enables notifications if no explicit setting exists   | Approved by requester |
| Show comment notifications in both bell and `/notifications`        | Agreed by requester   |
| Click marks read; history, counts, pagination, and API shapes above | Approved by requester |

Approval: the requester approved this complete contract for both frontend and backend on 2026-10-19. The code and
migration are implemented; application to the shared database remains the requester's deployment step.
