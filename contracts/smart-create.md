# Smart Create

Status: Implemented for new-Board creation; live-provider and browser acceptance checks pending.

The user approved 30 photos per batch, repeat batches, and confirmation of a revised day plan when a later batch
contains earlier photos (2026-10-18). New Boards share one creation flow. Reopened drafts and published editing
retain ordinary photo attachment; they do not rerun Smart Create automatically.

## Photo metadata and suggestions

The browser uploads original files through the existing signed, authenticated Cloudinary upload flow. The backend
requests `media_metadata` when verifying completion. EXIF decimal, DMS and rational coordinates are normalized and
range checked. Camera capture dates/times are validated; camera wall time is retained without converting a
timezone offset into a different local day. Upload time is never substituted for capture time.

`POST /api/v1/images/smart-create` accepts `{ "imageIds": [12, 13] }`, from 1 to 30 distinct positive IDs. A session
and exact frontend Origin are required. Every image must belong to the caller, even if someone else's published
Board is readable. All ownership checks finish before provider calls. Invalid batches return 400, missing sessions
401, invalid origins 403, and missing/unowned images 404 through the existing error envelope.

Example response:

```json
{
    "data": {
        "photos": [
            {
                "imageId": 12,
                "location": {
                    "id": "geoapify:example",
                    "label": "Eiffel Tower",
                    "detail": "Eiffel Tower",
                    "address": "Champ de Mars, Paris, France",
                    "type": "landmark",
                    "latitude": 48.8584,
                    "longitude": 2.2945,
                    "country": "France",
                    "countryCode": "FRA",
                    "city": "Paris"
                },
                "category": "landmark",
                "warning": null
            }
        ]
    }
}
```

The response preserves request order. Geoapify looks for nearby named tourism, catering, shopping, accommodation,
leisure and entertainment places within 75 metres, using proximity order. If none is named, reverse geocoding
provides an address. These are suggestions, not proof of a visit. Existing shared Geoapify budgets and upstream
quota feedback apply to every request; calls are paced and never automatically retried. A distant batch may take
about a minute to resolve. Nearby same-day photos within two hours reuse a lookup. On provider failure, remaining
photos receive a safe warning and retain editable raw-GPS suggestions. No credentials or raw EXIF are returned.

## Numbered days and grouping

- The earliest valid capture day anchors Day 1, regardless of photo selection order. The 21st and 23rd create
  activities on Day 1 and Day 3, with an empty Day 2. Generated Board day `date` fields stay `null`; only activity
  times are displayed. Missing time stays blank.
- New days and all Board writes are limited to 31. Later photos outside that window stay uploaded and unassigned,
  with an explanation. They do not generate extra days or activities.
- Group photos on the same capture day within 100 metres and two hours of the group's first uploaded photo.
  Compare against that representative, avoiding chains that merge increasingly distant visits. Missing capture
  date/time prevents automatic grouping. A GPS photo without a date gets a Day 1 suggestion with an explanation.
- Each new group gets one editable activity, its earliest known capture time, and its first successfully uploaded
  photo as cover. Subsequent nearby uploads append activity images. Existing titles, times, categories, location
  edits, chosen covers and image order remain intact.
- No GPS means no invented place or activity; retain the photo for manual assignment. Upload failures retain
  successful photos and identify failed filenames. A failed place lookup does not undo completed uploads.

The new-Board editor retains its accepted timeline anchor throughout the session, including after manual activity
moves or saving. If another batch starts earlier, it proposes shifting existing days forward and adding empty gaps.
The confirmation lists the proposed days and names any photo-generated activities falling beyond Day 31. Accepting
removes those overflowing activities from the plan but retains their uploaded photos. If manually created activities
would overflow, the proposal cannot be applied; the new photos remain available for manual assignment instead.
Cancelling or pressing Escape keeps the previous days and all uploaded photos. Editing and saving are locked while
the proposal is pending, and unsaved-navigation protection remains active.

Suggestions are local edits until the existing revision-checked Board save succeeds. Existing ownership,
photo-location confirmation, publication and protected-image delivery rules remain in force. Repeated batches do
not require a new table or migration; source metadata remains on uploaded image rows, while days, activities,
locations and explicit cover/order links use their existing canonical tables.

## Verification and limits

Independent service/HTTP and planner tests cover chronological gaps, reverse uploads, grouping boundaries,
first-upload covers, repeated batches, existing edits, missing metadata, proposal immutability, overflow, access
checks and malformed provider metadata. Existing suites cover Board saving and protected media. Actual browser
focus/drag behavior, live EXIF uploads and live Geoapify accuracy still need acceptance checks in a connected session.

Provider references: [Cloudinary Admin metadata](https://cloudinary.com/documentation/admin_api),
[Geoapify Places](https://apidocs.geoapify.com/docs/places/).
