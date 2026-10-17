# Profile and saved Boards contract

Status: **Agreed and implemented in code**. Teoma confirmed frontend-team approval on 2026-10-16. Backend and frontend integration are present; applying migration `005_profile.sql` and checking the live profile remain deployment steps.

## Goal and scope

Connect the signed-in user's **ME** profile and its editing flow to persistent data. `/profile` loads the user's details, statistics, published Boards, saved Boards, and visited map. `/settings` saves profile details, the uploaded profile picture, and default visibility for newly created Boards. A user can save or unsave an accessible published Board owned by someone else.

The FRIENDS and EXPLORE tabs, other users' profile pages, account-wide theme persistence, saved-activity actions, archives, traveler tier, headline, and the four sample travel milestones are outside this contract. The profile's milestones (“most visited,” “longest trip,” “biggest travel year,” and “most visited region”) and their sample imagery must be removed from the live page. Theme may continue as a browser preference. No sample identity, Board, count, or map location should appear as live account data.

## Evidence from `main`

| Status              | Evidence                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Implemented         | `backend/src/features/users/` provides `GET/PATCH /api/v1/users/me`, profile-picture mutations, owned Board lists, stats, and map destinations. `backend/src/features/boards/` provides published Board lists and protected Board reads. `backend/src/features/images/` provides authenticated upload intents and protected image content. |
| Implemented storage | `backend/db/migrations/001_initial.sql` has `app_user.username` (unique), `display_name`, `biography`, `location`, `occupation`, `profile_picture_image_id`, `language`, `user_language`, `user_tag`, and `saved_boards`.                                                                                                                  |
| Mocked              | `frontend/src/app/profile/page.tsx` supplies `mockRowanProfile`. `ProfilePageContent.tsx`, `ProfileHero.tsx`, and `TravelMapSection.tsx` render mock cards, counts, milestone images, and a map placeholder. `SettingsContent.tsx` saves to browser-local mock state. Its avatar control accepts Unsplash URLs and presets.                |
| Partial integration | `frontend/src/lib/profile.ts` and `/dev/profile` call the existing profile API, but production `/profile` and `/settings` do not. `/boards` shows real owned published Boards but its saved collection is still sample data.                                                                                                               |
| Mismatch            | The current profile API accepts only display name, biography, location, and three interests. The agreed profile requires editable username, occupation, up to ten tags, languages, and default Board visibility. The existing `boardsCreated` statistic counts drafts; the live profile must count published Boards only.                  |

Sources are code and migrations on local `main`, inspected on 2026-10-16. Code and mock data describe current behavior, not approval of its product rules. Local `8-social-page` is behind `main`; `extended-backend-demo` has additional old commits, but its `/profile` page is a placeholder and it has no current users route. Neither branch provides a newer profile implementation to adopt.

## User journeys and access

| Action                                      | Signed-out visitor | Signed-in owner                                                                           | Other signed-in user                   |
| ------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| Read/edit ME profile and preferences        | Sign in required   | Allowed                                                                                   | Cannot access another account's `/me`  |
| Upload, set, or remove profile photo        | Sign in required   | Allowed for an upload owned by this user                                                  | Cannot change another user's photo     |
| Read owned published Boards and visited map | Sign in required   | Allowed                                                                                   | No `/me` access to another user's data |
| Read saved Boards                           | Sign in required   | Allowed, filtered to currently accessible Boards                                          | No access to another user's saved list |
| Save a Board                                | Sign in required   | Allowed only for someone else's accessible published Board                                | Same rule for their own account        |
| Unsave a Board                              | Sign in required   | Allowed for the caller's saved row, including a row currently hidden by lost Board access | Cannot delete another user's saved row |

Access to a Board follows the existing Board rule: public Boards are readable by anyone; friends-only Boards by accepted friends or Board members; collaborators-only Boards by Board members; drafts by the owner only. A saved Board grants **no access**. If access is lost, its saved row remains but the Board is omitted from saved lists and visible saved counts. It reappears if access returns. Deleting a Board removes its saved rows through the existing foreign key cascade. Saving one's own Board is forbidden.

On a signed-out visit to `/profile` or `/settings`, the frontend shows a sign-in path rather than Rowan's mock content. Saving from a public Board asks the visitor to sign in. Requests use the existing session cookie. All cookie-authenticated writes require the backend's origin check.

## Profile data and editing

The API field `username` is the unique handle **without** `@`; the UI displays `@` before it. It is stored in lowercase, including when Google sign-in first creates the account. Edits are trimmed and lowercased. Proposed validation is 1–64 lowercase letters, digits, periods, or underscores, with no leading or trailing punctuation. Names differing only by capitalization are the same handle. `displayName` is independently editable and non-unique; preserve the user's casing in storage and use CSS for any uppercase presentation.

| Field                    | Read value                               | Save/clear rule                                                                                                                                            |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | Stable Google-sub-backed user ID         | Never client-editable                                                                                                                                      |
| `username`               | Nonempty string, no `@`                  | Required and unique; duplicate returns `409 USERNAME_TAKEN`                                                                                                |
| `displayName`            | Nonempty string                          | Required; duplicates allowed                                                                                                                               |
| `description`            | Biography, string                        | `""` clears the biography; maps to the UI's `bio`                                                                                                          |
| `location`               | String or `null`                         | `null` clears it; free-text “based in,” not a map pin                                                                                                      |
| `occupation`             | String or `null`                         | `null` clears it                                                                                                                                           |
| `languages`              | Array of canonical language names        | `[]` clears; at most ten distinct choices from the shared language list                                                                                    |
| `interests`              | Array of tag names                       | `[]` clears; at most ten distinct names from the existing shared tag pool                                                                                  |
| `profilePicture`         | Owned uploaded-image reference or `null` | Changed through its own endpoint; `null` displays the app's default image                                                                                  |
| `defaultBoardVisibility` | `collaborators`, `friends`, or `public`  | Required; defaults to `collaborators` for new and existing accounts; applies only to the initial selection for **new** Boards, which the user can override |
| `revision`               | Positive integer                         | Sent on a full profile save to reject stale tabs                                                                                                           |

The database's `headline` column is not part of the live profile API or UI. The traveler-tier selector and banner are removed. The current `settings: {}` compatibility object should be replaced by a documented `defaultBoardVisibility` value or retained temporarily only for old clients; the new frontend must not interpret an empty object as persisted preferences. String fields use the existing 500-character storage limit unless a stricter validation rule is stated above. Trim user-entered whitespace. An empty optional location or occupation input is sent as `null`.

The first allowed-language file is [`shared/spoken-languages.json`](../shared/spoken-languages.json). It is a small, reviewable starter list, not a claim that unsupported languages do not exist. The backend serves these choices, seeds the `language` table from them, and rejects unknown names; users cannot create shared language rows through profile editing. The team can expand the JSON file and seed later without changing the API shape. Existing tag choices still come from `GET /api/v1/tags`.

The Settings Save action sends the complete editable text, language, tag, and default-visibility document in one transaction. Omitted required keys are invalid; omitted values do **not** mean “leave unchanged.” `null` is accepted only for `location` and `occupation`; empty arrays remove all selections. Profile photo changes are separate immediate operations. A successful profile or picture change increments `revision`. A stale profile save returns `409 STALE_PROFILE` without changing any fields. “Reset” discards unsaved edits and restores the last server values. “Undo” after a successful save is a new version-checked save of the previous values, not a local-only reversal.

The live avatar control offers **Upload photo** and **Remove photo**. The current external URL field and Unsplash presets are removed. Upload uses the existing `POST /api/v1/images/upload-intents` → storage upload → `POST /api/v1/images/complete` flow, then sets the returned owned image ID as the profile picture. If upload or association fails, keep the previous picture. Removing the picture restores the app's default. The uploaded file is subject to the existing image limits and orphan cleanup.

## Profile Boards, map, and statistics

“My boards” shows the owner's **published** Boards only, newest updated first. It uses the existing `GET /api/v1/boards?scope=published&page=1&limit=3`; “view all” opens `/boards/mine`. Drafts stay in the draft flow. Cards must render actual returned title and cover, with a default visual when no cover exists; mock quotes, collage images, or popularity numbers must not be substituted as account data.

“Currently inspired by” shows the three most recently saved **currently accessible** Boards owned by other users. “View all” opens the real saved collection on `/boards`; the existing sample saved collection must be replaced or clearly kept separate from this live list. Board cards link to `/boards/{boardId}` and show real owner/title/cover information. A Board with no cover uses a default visual. An inaccessible saved Board is neither rendered nor linked, but its bookmark remains stored. Saved-list pagination is over visible rows, so `hasMore` must not be based on hidden rows.

The map displays locations from the owner's **completed, published** Boards only. Planned/incomplete Boards do not appear on this profile map. Use the existing protected Mapbox map component with visited styling, rather than the placeholder. A location without coordinates cannot become a marker. The map has loading, empty, provider-unavailable, and request-failure states; an unavailable map must not replace valid text statistics with mock values.

Statistics are computed from live storage and return zero for an empty account:

| Response field      | Definition                                                                                                                                                          | UI label           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `countriesVisited`  | Distinct recognized countries in activity locations of completed published owned Boards                                                                             | countries visited  |
| `citiesExplored`    | Distinct normalized city + country pairs in those locations; skip missing cities                                                                                    | cities explored    |
| `continentsCovered` | Distinct continents for recognized visited countries, using one reviewed country-to-continent mapping; unknown codes contribute none                                | continents covered |
| `photosUploaded`    | Distinct uploaded image IDs linked as Board or activity images or covers on completed published owned Boards; exclude external provider images and profile pictures | photos uploaded    |
| `boardsCreated`     | Published Boards owned by the user; exclude drafts                                                                                                                  | boards created     |
| `friends`           | Accepted friendships involving the user                                                                                                                             | friends made       |
| `activitiesSaved`   | Saved activity rows belonging to the user                                                                                                                           | activities saved   |
| `boardsSaved`       | Saved Boards that the user can currently read; hidden bookmarks do not count                                                                                        | boards saved       |

Country and city counts use normalized country codes rather than raw country spelling. The country-to-continent mapping must be versioned with the backend so the count is deterministic. The former four milestone cards are removed, so no trip-date or “region” inference is required.

## Proposed HTTP contract

Success bodies use `{ "data": ... }`; paginated responses also use `meta`. Errors use `{ "error": { "code": "...", "message": "..." } }`. Existing paths keep their current meaning where possible.

| Method and path                                                      | Auth                  | Behavior                                                                                                                      |
| -------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/languages`                                              | Public                | Return the starter allowlist as canonical strings                                                                             |
| `GET /api/v1/users/me`                                               | Session               | Return the editable profile, picture, preference, and revision                                                                |
| `PATCH /api/v1/users/me`                                             | Session + origin      | Atomically replace editable fields if `revision` matches; return the saved profile                                            |
| `POST /api/v1/images/upload-intents`, `POST /api/v1/images/complete` | Session + origin      | Existing upload protocol for a profile photo                                                                                  |
| `PUT /api/v1/users/me/profile-picture`                               | Session + origin      | Set `{ "imageId": 17 }` for a caller-owned completed upload; return profile                                                   |
| `DELETE /api/v1/users/me/profile-picture`                            | Session + origin      | Remove the picture association; return profile with `profilePicture: null`                                                    |
| `GET /api/v1/users/me/stats`                                         | Session               | Return the eight real counts defined above                                                                                    |
| `GET /api/v1/boards?scope=published&page=1&limit=3`                  | Session               | Existing owned published summary list for “my boards”                                                                         |
| `GET /api/v1/users/me/map-destinations?scope=visited`                | Session               | Return only completed published owned Board locations; default behavior for callers without `scope` may remain as implemented |
| `GET /api/v1/users/me/saved-boards?page=1&limit=20`                  | Session               | Paginated visible saves, newest saved first; page size 1–100                                                                  |
| `PUT /api/v1/boards/{boardId}/save`                                  | Session + origin      | Idempotently save an accessible published Board owned by someone else                                                         |
| `DELETE /api/v1/boards/{boardId}/save`                               | Session + origin      | Idempotently remove the caller's saved row, even if access was later lost                                                     |
| `GET /api/v1/boards/{boardId}`                                       | Existing Board access | Add `savedByMe` for signed-in viewers so the bookmark action has its initial state; false for an anonymous viewer             |

Example profile read:

```json
{
    "data": {
        "id": "google-sub-example",
        "username": "rowan.mercer",
        "displayName": "Rowan Mercer",
        "description": "Travel for the food and the views.",
        "location": "Stockholm, Sweden",
        "occupation": "Photographer",
        "languages": ["English", "Swedish"],
        "interests": ["Photography", "Hiking"],
        "profilePicture": { "imageId": 17, "url": "/api/v1/images/17/content?variant=thumbnail", "storageKey": null },
        "defaultBoardVisibility": "collaborators",
        "revision": 4,
        "createdAt": "2026-10-01T10:00:00.000Z",
        "updatedAt": "2026-10-16T10:00:00.000Z"
    }
}
```

Example full save; a response has the same shape as the profile read with `revision: 5`:

```json
{
    "revision": 4,
    "username": "rowan.mercer",
    "displayName": "Rowan Mercer",
    "description": "Travel for the food and the views.",
    "location": null,
    "occupation": "Photographer",
    "languages": ["English", "Swedish"],
    "interests": ["Photography", "Hiking"],
    "defaultBoardVisibility": "friends"
}
```

`GET /api/v1/languages` returns `{ "data": [...] }`, where the array contains every canonical name in the shared JSON file in that file's order. A populated statistics response looks like this:

```json
{
    "data": {
        "countriesVisited": 2,
        "citiesExplored": 3,
        "continentsCovered": 2,
        "photosUploaded": 12,
        "boardsCreated": 4,
        "friends": 5,
        "activitiesSaved": 7,
        "boardsSaved": 2
    }
}
```

For `GET /api/v1/users/me/map-destinations?scope=visited`, a location has a stable `id`, numeric `boardId`, Board title, country and optional city, coordinates, and `isCompleted: true`. The existing endpoint's string `boardId` should be aligned with the Board API's numeric IDs when implementing this contract. An empty visited map returns `{ "data": [] }`.

Example saved-Boards page; `coverImageUrl` may be `null`:

```json
{
    "data": [
        {
            "boardId": 42,
            "title": "Three days in Kyoto",
            "description": "Temples, food, and quiet streets.",
            "owner": { "id": "other-user-sub", "username": "akiko", "displayName": "Akiko" },
            "coverImageUrl": "/api/v1/images/88/content?variant=thumbnail",
            "savedAt": "2026-10-16T11:00:00.000Z"
        }
    ],
    "meta": { "page": 1, "limit": 20, "hasMore": false }
}
```

First `PUT /api/v1/boards/42/save` returns `201 { "data": { "boardId": 42, "saved": true } }`; repeating it returns `200` with the same data. `DELETE` returns `204` whether the row existed or not. Failed access checks never create a bookmark. `GET /api/v1/boards/42` includes `"savedByMe": true` at the top level of its `data` Board document for a caller who saved it. A duplicate username example is `409 { "error": { "code": "USERNAME_TAKEN", "message": "That username is already taken." } }`. An older profile revision returns `409 { "error": { "code": "STALE_PROFILE", "message": "Your profile changed. Reload it before saving." } }`; the frontend retains the unsaved form and offers reload. Invalid fields or unknown language/tag choices return `400 INVALID_REQUEST`. Unauthenticated protected calls return `401 UNAUTHENTICATED`. An inaccessible or deleted Board returns `404 NOT_FOUND` when saving or reading it. Saving one's own Board returns `403 CANNOT_SAVE_OWN_BOARD`.

## Frontend and backend work required after agreement

**Frontend:** Replace `/profile` mock subscription with cookie-authenticated reads and intentional loading/empty/error states. Map real profile fields into the hero; remove headline fallback, traveler tier, milestone cards, and fake counters. Use the visited-only map data. Show three real published owned Boards and three real accessible saved Boards, with real links and default cover visuals. Make `/settings` PROFILE controls load/save server state; remove avatar URL/preset controls and use the existing upload protocol; use the language list and existing tag list. Save default Board visibility with the profile, and initialize new Board creation from it without changing existing Boards. Keep theme local. Make Board detail bookmark actions use the save endpoints; make `/boards` saved collection live. Protected image requests must carry the session cookie; do not assume a server-side image optimizer forwards it.

**Backend:** Extend the users route/schema/service/repository in the existing feature layers, preserving atomic full replacement, tag/language validation, and version checking. Normalize and uniquely enforce usernames. Add the small language-list read endpoint and seed storage from the shared JSON file. Add default visibility and a profile revision in a new ordered migration; add `saved_at` to saved bookmarks for stable newest-first ordering and an appropriate index. Add save/unsave/list behavior with the existing Board visibility check and no owner self-save. Add the Board read's `savedByMe`, the visited-only map filter, and the defined statistics. Reuse image upload and protected content routes. The old `headline` column becomes unused by this feature and can be removed in a separately reviewed migration; no milestone storage is needed. Keep `layered-backend-demo1/` untouched.

## Decision log and review

| Decision                                                                                                                                | Record                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ME first, with persistent `/settings` edits                                                                                             | Decided by Teoma; approved by frontend team                                     |
| Editable unique lowercase handle, independent editable non-unique display name                                                          | Decided by Teoma; approved by frontend team                                     |
| Include occupation, languages, tags, uploaded/default photo, and persistent default Board visibility; remove headline and traveler tier | Decided by Teoma; approved by frontend team                                     |
| Small shared JSON language allowlist initially; maximum ten profile tags from shared tag pool                                           | Decided by Teoma, consistent with prior tag decision; approved by frontend team |
| “My boards” published only; inspired Boards are accessible saved Boards with save/unsave/list                                           | Decided by Teoma; approved by frontend team                                     |
| Visited-only map; real country/city/continent/upload counts; remove four milestone cards                                                | Decided by Teoma; approved by frontend team                                     |
| Reject stale full-profile saves                                                                                                         | Decided by Teoma; approved by frontend team                                     |

**Agreed implementation details:** the username character/length rule, starter language names, `revision` and saved-list response shapes, three-card preview size, immediate profile photo changes, and static country-to-continent mapping.

**Approval record:** Backend-side product decisions recorded from Teoma on 2026-10-16. Teoma reported frontend-team approval and requested backend implementation on 2026-10-16.

## Public handle profiles (2026-10-17)

Teoma approved public profile pages at `/profile/{handle}`. `/profile` resolves the signed-in user's handle and redirects to that path. A visitor, including a signed-out visitor, sees the profile fields, current profile photo, public published Boards, and travel data derived only from completed public published Boards. The visitor cannot see saved Boards, private Board counts or locations, account preferences, or edit controls. The owner continues to see the existing `/me` profile data at their handle path.

`GET /api/v1/users/by-handle/{handle}` returns `{ data: { profile, isOwner, stats, boards, destinations } }` without requiring a session. Its `profile` contains only `username`, `displayName`, `description`, `location`, `occupation`, `languages`, `interests`, and `profilePicture`; it excludes the account ID, revision, and default Board visibility. `stats` contains public country, city, continent, photo, and Board counts. Unknown handles return `404 NOT_FOUND`. Public profile photo URLs carry `profileHandle`; image content is served only while that image remains the handle owner's current profile photo. Board links retain their normal read authorization.
