# Board comment mentions

Status: **Behavior agreed by requester on 2026-10-20; implemented locally.** The requester decides for both frontend and backend. This extends the approved Board comments and comment notifications contracts.

## Behavior

- Signed-in commenters can type `@handle` while posting or editing a comment. The editor suggests existing accounts as the handle is typed. An exact handle typed without selecting a suggestion also works.
- A comment may contain at most 10 distinct @handles, counted case-insensitively, including handles that do not resolve to an account. Repeating a handle does not use another slot. The editor explains when the limit is exceeded and disables posting or saving until it is corrected; the API rejects over-limit create and edit requests with `400 INVALID_REQUEST`.
- A valid handle uses the current username rules: 1–64 letters, digits, periods, or underscores, starting and ending with a letter or digit. Matching is case-insensitive. Email addresses and unknown handles remain plain text.
- The comment body stays plain text with its 2,000-character limit and original line breaks. The server resolves existing handles and returns `mentions: [{ "handle": "avery", "username": "avery" }]` on every comment. Only resolved mentions become profile links. `handle` is the text's lowercase spelling; `username` is the account's current handle, so old comments still link after a rename. No HTML or Markdown is accepted.
- A mentioned account receives one in-app notification per comment when it can currently view the published Board. An author never notifies themself. The mention notification is sent even when that account turned off the Board's general comment bell. An inaccessible account gets no notification and the mention does not grant Board access.
- Editing a comment notifies accounts newly mentioned by that edit. If that person already received a general comment notification, a new mention promotes that item to an unread mention notification. Removing the last mention of a person removes their mention notification when they do not own the Board, even if their general comment bell is on. For the Board owner, it becomes a regular comment notification if their bell is on; otherwise it is removed. Re-adding a removed mention creates a new notification. Other edits and deletion follow the existing comment contract; deletion cascades to mentions and notifications.
- Bell and `/notifications` items distinguish `kind: "mention"` from `kind: "comment"`. A mention reads as “Avery mentioned you in Tokyo.” Both kinds use the existing Board comment link and read action.

## API and storage

Existing comment routes keep the same request bodies. Each comment response adds a `mentions` array, empty when none resolve. The existing comment notification list item adds `kind`, either `comment` or `mention`. No new endpoint is needed: username suggestions use the existing authenticated `GET /api/v1/users/search` route.

Migration `016_board_comment_mentions.sql` adds a mention-to-account table and notification kind. A comment's text, resolved mention links, subscription changes, and notifications are written in the same transaction. The backend derives mention recipients from the text and database; the client cannot supply user IDs or force notifications. Apply 016 only after the existing comment and notification migrations (013 and 014). Future edits reconcile removed mentions in the comment transaction. The requester applies migrations to the shared database.

## Decisions

The requester chose profile links plus notifications, username suggestions, any existing account as a mention target, notifications for newly added mentions on edit, and mention notifications overriding the general Board bell. The API shape and storage details above implement those decisions.
