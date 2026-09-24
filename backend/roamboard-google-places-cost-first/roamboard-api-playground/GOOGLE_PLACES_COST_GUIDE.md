# Cost-first Google Places design for Roamboard

This version keeps Google Places useful while preventing ordinary UI actions from requesting the most expensive field tiers.

## Recommended user flow

1. **Destination input:** call Autocomplete only after 250–350 ms of no typing and after at least three characters. Reuse one session token until a suggestion is selected.
2. **Discovery search:** call Text Search only when the user submits a query. Use Nearby Search only for an explicit “near this stop” action.
3. **Render results:** use the ID, name, address, coordinates, primary type and Google Maps URL already returned by Search. Do not make one Details call per result.
4. **Select a place:** retain the selected Google Place ID and search result in the draft itinerary. Place IDs may be stored; follow Google’s policy for other returned content.
5. **Open basic details:** request `mode=basic` only if the page needs refreshed identity, address, type, business status, time-zone offset or Google Maps URL.
6. **Open rich details:** request `mode=rich` only after an explicit click when ratings, opening hours, phone, website or photo references are actually visible.
7. **Load photos:** request photo media only after another explicit click. This prototype loads at most three images per click and renders returned author attribution.

## Fixed API cost boundaries

| Local route | Maximum tier allowed | Purpose |
| --- | --- | --- |
| `/api/google-places/autocomplete` | Autocomplete | Search-as-you-type predictions |
| `/api/google-places/search` | Text Search Pro | Minimal discovery result cards |
| `/api/google-places/nearby` | Nearby Search Pro | Minimal nearby result cards |
| `/api/google-places/details/{id}?mode=basic` | Place Details Pro | Basic selected-place refresh |
| `/api/google-places/details/{id}?mode=rich` | Place Details Enterprise | Ratings, hours, contact and photo references |
| `/api/google-places/photo` | Place Details Photos | One requested image |

The server owns every field mask. The browser cannot pass an arbitrary Google field mask or request Atmosphere/review/AI-summary fields.

## Zero-charge-oriented Cloud quotas

Set these in **Google Cloud Console → Google Maps Platform → Quotas → Places API (New)**:

| Google quota | Per day | Per minute |
| --- | ---: | ---: |
| `AutocompletePlacesRequest` | 300 | 30 |
| `SearchTextRequest` | 150 | 10 |
| `SearchNearbyRequest` | 150 | 10 |
| `GetPlaceRequest` | 30 | 5 |
| `GetPhotoMediaRequest` | 30 | 5 |

The prototype does not call `SearchMediaRequest` or `SearchReviewPostsRequest`. Set their adjustable daily quotas to `1` (or `0` if Google accepts it).

Why Details is limited to 30/day: this route deliberately retains an Enterprise mode, whose monthly free cap is 1,000. Even in a 31-day month, `30 × 31 = 930`.

Why Search is 150/day: search is locked to Pro fields, whose monthly free cap is 5,000. In a 31-day month, `150 × 31 = 4,650`.

Why Autocomplete is 300/day: its free cap is 10,000. In a 31-day month, `300 × 31 = 9,300`.

These values assume this is the only project using the billing account’s corresponding free SKU allowance. Apply comparable protection to other enabled projects. Google may change prices and caps, so re-check the official pricing page before public deployment.

## Data storage rule of thumb

Store Roamboard-owned data—journals, itinerary order, notes, votes, uploads and collaborations—in PostgreSQL/Elasticsearch. Store Google Place IDs as external references. Do not treat Google ratings, reviews, photo names or photos as your permanent database; follow current Google Maps Platform caching and attribution policies.
