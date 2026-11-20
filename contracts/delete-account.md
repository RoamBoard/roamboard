# Delete account contract

Status: Agreed

Issue: [RoamBoard/roamboard#186](https://github.com/RoamBoard/roamboard/issues/186), titled “feat: Delete account.” The requester supplied only the title; no further issue requirements are assumed.

Approval: the requester explicitly stated they speak for both frontend and backend and authorized implementation on 2026-11-20 (Europe/Stockholm).

Sources: local `main` (five commits behind the available `origin/main` reference); `frontend/src/components/features/settings/SettingsContent.tsx`, `frontend/src/lib/auth.ts`; `backend/src/features/auth/`, `backend/src/features/users/users.routes.ts`, `backend/src/features/images/`, `backend/src/features/boards/boards.repository.ts`, `backend/src/features/board-discovery/`; `backend/db/migrations/001_initial.sql` through `024_activity_photos.sql` where relevant; `contracts/profile.md`, `contracts/board-comments.md`, `contracts/image-deletion.md`, and `contracts/saved-board-remix.md`. The newer `origin/main` commits were checked by file list; migrations 022–024 were read without changing the worktree.

## Goal and first-version scope

A signed-in Google account owner can permanently delete their Roamboard account from Settings. A warning dialog explains the effect and has a final **Delete account** button. The current session and this confirmation suffice; no fresh Google sign-in or typed phrase is required. The account and all live user-owned application data disappear when the backend reports success. There is no recovery window.

Deleting the account removes its draft and published Boards, their dependent activities, photos and comments, other users' comments and saves on those Boards, and the account's comments on other Boards. It also removes the account's profile, saved Boards and activities, saved places, friendships, memberships, notifications, subscriptions, mentions, view/discovery records, provider references, sessions and other user-linked application rows. Other people's Boards created through the remix flow remain, including their independently copied photos.

Locations referenced by the deleted account's Boards or activities are removed when no surviving Board or activity references them. Shared locations stay available to surviving Boards. Migration 025 removes older unreferenced location rows left by prior Board edits and deletions; future Board writes and deletions clean up locations they detach in the same transaction.

Uploaded provider assets whose last saved reference was removed are cleaned up after commit through a retryable worker. A temporary provider failure must not delay or reverse account deletion. The cleanup system may retain the minimum technical storage reference needed to complete deletion; it must not retain an active account, profile, session or user-owned application record for that purpose.

## Out of scope

- Development guest-account deletion. The endpoint must reject a guest session; hiding the frontend control alone is insufficient.
- Recovery, soft deletion, account export and deletion of the person's external Google account.
- Changing remix ownership or deleting independent copies owned by someone else.

## Existing behavior and integration

- **Implemented:** The Settings Account tab has theme and default Board visibility controls, with no deletion action. `frontend/src/lib/auth.ts` handles sign-in and local account updates but has no deletion request.
- **Implemented:** Google sign-in uses the verified Google subject to find or create `app_user`; a later sign-in after deletion can therefore create a new, empty account. Development guest accounts are tracked in `guest_account`.
- **Implemented:** Sign-out removes only one session. User, Board and image relationships span several migrations. Some foreign keys cascade; several user references, including Board ownership and upload ownership, currently block a direct `DELETE app_user`.
- **Implemented:** Board deletion cascades to activities, comments and saves. Image reference triggers queue unreferenced uploads, and provider deletion is retried. Fresh unattached uploads and incomplete upload intents currently have a 24-hour grace period.
- **Implemented:** Current Board writes reject attaching another user's uploaded image to a separate Board. An integration test covers older shared-image references created directly in the database. Those references remain protected until their last Board releases them, per the existing image-deletion contract.
- **Not implemented:** Account deletion UI, API, transaction, or the schema/cleanup changes required for immediate user-row removal with deferred provider cleanup.

## Actors and access

| Actor                          | Delete account     | Result                                                                  |
| ------------------------------ | ------------------ | ----------------------------------------------------------------------- |
| Signed-in Google account owner | Yes, for self only | Permanent deletion after confirmation                                   |
| Signed-out or expired session  | No                 | `401 UNAUTHENTICATED`                                                   |
| Development guest account      | No                 | `403 ACCOUNT_DELETION_UNAVAILABLE`                                      |
| Other user                     | No                 | No user ID is accepted in the endpoint; the session selects the account |

All sessions for the deleted account become invalid in the same database transaction. The session and linked browser cookies are cleared in the successful response. Any pending request using an old session must fail authorization after deletion. A repeat deletion request using that cookie returns `401`.

## Data and lifecycle

The deletion transaction must identify the account from the server-verified session, reject guests, then remove all of its live application records and owned Boards and finally remove `app_user`. This includes relationships that lack database cascades today. It must also remove user-keyed view/challenge rows that have no user foreign key and any linked browser records, so a later account starts with no old browsing or save state. A failure before commit rolls back the entire database deletion.

Image reference removal requests cleanup for owned photos and their profile/Board placements. The new migration and cleanup workflow must let the user row disappear even if provider cleanup fails or a fresh unattached upload is still inside its grace period. Keep only minimal, retryable provider-cleanup metadata after commit; do not expose the asset through a deleted profile or Board. Preserve any genuinely surviving reference from an older shared-image row until its final reference is removed, while removing the deleted account's uploader identity and private metadata. Normal API writes cannot create this legacy case.

Completed remixes owned by others use their own image IDs and remain readable under their existing permissions. The deleted account's username becomes available under the normal unique-handle rules; a later Google sign-in runs normal new-account creation and restores no deleted data.

## HTTP contract

This endpoint is implemented on `feat/delete-account`. Migration 025 must be applied before the deployed backend can serve it.

| Method and path           | Authentication                                           | Request                                              | Success                                                                            |
| ------------------------- | -------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `DELETE /api/v1/users/me` | Session for a Google account and exact frontend `Origin` | No body, query parameters or client-supplied user ID | `200` with `{"data":{"deleted":true}}`; expires session and linked browser cookies |

Omitted body means “delete the authenticated account.” JSON `null`, `{}`, and any other body are invalid; no empty-string or nullable field is defined. The request is not a profile revision update. It must not act on an account identified by client input.

Errors use `{"error":{"code":"...","message":"..."}}`:

| Status | Code                           | Meaning                                                            |
| ------ | ------------------------------ | ------------------------------------------------------------------ |
| 400    | `INVALID_REQUEST`              | Body or query supplied                                             |
| 401    | `UNAUTHENTICATED`              | Missing, expired or already deleted session                        |
| 403    | `ORIGIN_NOT_ALLOWED`           | `Origin` does not exactly match the configured frontend            |
| 403    | `ACCOUNT_DELETION_UNAVAILABLE` | Development guest account                                          |
| 500    | `INTERNAL_ERROR`               | Database deletion failed; transaction rolled back, account remains |

Provider cleanup failures after database commit do **not** change the successful deletion response. The backend must log/retry cleanup without exposing provider details to the client.

### Worked examples

Successful request: `DELETE /api/v1/users/me` with the existing session cookie and exact frontend `Origin`, with no body. The response is:

```json
{
    "data": {
        "deleted": true
    }
}
```

An expired session or repeated request after deletion returns `401`:

```json
{
    "error": {
        "code": "UNAUTHENTICATED",
        "message": "Not signed in"
    }
}
```

A development guest session returns `403` without changing that account:

```json
{
    "error": {
        "code": "ACCOUNT_DELETION_UNAVAILABLE",
        "message": "Account deletion is unavailable for this account"
    }
}
```

## Frontend behavior

Add Delete account to the existing Settings Account tab for a signed-in Google user. The warning dialog states that the account, Boards and comments are removed permanently, that other people's saves/comments on the user's Boards disappear, that independent remixes remain, and that provider photo cleanup can finish later. Cancel closes the dialog without a write. The final button sends exactly one request and disables repeat submission while pending.

On success, clear frontend account state and account-specific caches, then navigate to a signed-out page. On a network or server failure, keep the user signed in and the dialog available for retry; do not claim deletion. On `401`, show a sign-in path. The frontend must not substitute a local sign-out for a failed delete. Settings currently loads a profile before rendering the Account tab, so it must handle an expired session and loading state before showing the control.

## Backend storage and migration implications

Use a new ordered migration; do not edit applied migrations. Preserve transactional integrity for live database deletion. Account deletion must cover the non-cascading user references in the current schema and the Board cascade graph, including migrations 022–024. Provider cleanup needs a durable retry path that survives deletion of `app_user` and the original upload-intent/ownership references. The exact internal queue/table design may be chosen during implementation if it satisfies the immediate deletion, minimal cleanup metadata and existing reference-safety requirements. Do not make the success response wait for Cloudinary.

Test an empty account and an account with Boards, comments on another Board, friendships, saves, notifications, linked browser/view rows, attached photos, unattached uploads and completed remixes. Cover guest/anonymous rejection, Origin enforcement, all-session invalidation, rollback, retryable provider failure, no surviving deleted profile/content, and new empty account creation on later Google sign-in. Integration tests must use an isolated schema and fake provider, not the shared database or real Cloudinary assets.

## Decision log and review

The requester decided during this contract interview:

1. Delete owned Boards and their dependents, including other people's comments and saves on them.
2. Delete the account's comments on other Boards.
3. Make deletion irreversible with no recovery window.
4. Use the current session plus a warning dialog; no fresh Google sign-in or typed username.
5. Allow the same Google identity to create a new, empty account later.
6. Remove the account immediately while photo cleanup can finish later through existing retry behavior.
7. Preserve independent Boards and photo copies created by others through remixing.
8. Limit this first version to Google accounts.
9. Remove all user-owned live application data, including dependent rows described by the schema.

No product-scope question remains open for this first version. The implemented route and response use the shapes above. The frontend returns to the public home page after success. Migration 025 adds a provider-only cleanup queue; the live application database has not been migrated as part of this implementation.

## Approval record

Requester decisions recorded on 2026-11-20 (Europe/Stockholm). The requester confirmed they speak for both frontend and backend and approved implementation on that date.
