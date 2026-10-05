# External API hard quotas

Roamboard reserves usage in the backend before sending a metered provider request. A reservation that would cross any configured window is rejected with HTTP `429` and `details.code = "PROVIDER_QUOTA_EXHAUSTED"`. Provider failures and timeouts are not refunded because the provider may already have counted them.

Production uses atomic PostgreSQL reservations in `api_quota_usage`. The application refuses to use memory storage in production because those counters reset on restart and cannot coordinate multiple API instances. `GET /api/v1/quotas` reports current counters, remaining units, reset times, durability, and the official source for every policy.

Quota behavior is intentionally not configurable through `.env`. Environment variables contain credentials and ordinary deployment settings only. Reviewed limits are hardcoded in `src/features/quotas/quota.policies.ts`, so changing a payment boundary is a visible code and documentation change.

## Current policies

These limits leave approximately 1% headroom below the published boundary. They were checked against official provider documentation on 1 October 2026.

| Policy | Roamboard hard limit | Published boundary | Metered operation |
| --- | ---: | ---: | --- |
| `mapbox.map_loads` | 49,500/month | 50,000/month | Mapbox GL JS map initialization on a pay-as-you-go account |
| `mapbox.geocoding` | 99,000/month | 100,000/month | Temporary forward and reverse geocoding |
| `mapbox.permanent_geocoding` | 2,475/month | 2,500/month | Permanent forward geocoding for Board destinations stored in PostgreSQL |
| `mapbox.directions` | 99,000/month | 100,000/month | Directions requests |
| `google.places_text_search_pro` | 4,950/month | 5,000/month | Useful POI text search; the requested name, address, location, and type fields trigger Text Search Pro |
| `google.place_details_essentials` | 9,900/month | 10,000/month | Live address, location, and type lookup for a saved Place ID |
| `unsplash.requests` | 990/hour | 1,000/hour | JSON API requests after Unsplash approves production status |
| `open_meteo.forecast` | 590/minute, 4,950/hour, 9,900/day, 297,000/month | 600/minute, 5,000/hour, 10,000/day, 300,000/month | Free non-commercial Forecast API |
| `wikipedia.action_api` | 190/minute | 200/minute | Identified, unauthenticated Action API client |
| `cloudinary.admin` | 495/hour | 500/hour | Free-plan Admin API |

The profile travel-footprint map uses the existing `mapbox.map_loads` reservation. Its Mapbox Countries v1 boundary tiles and the city GeoJSON overlay are rendered within that same GL JS map load; they do not introduce another provider operation or quota policy.

Board destination lookup uses structured city and country input with `types=place` and `permanent=true`. Board pin search and photo/map reverse geocoding also set `permanent=true` because selected results may be stored. These operations share the reviewed `mapbox.permanent_geocoding` policy. Permanent geocoding requires a billing-enabled Mapbox account; the backend stops at 2,475 requests per month, below the published 2,500-request free boundary.

Mapbox's larger free tier requires a payment method and Mapbox does not offer an account-side spending cap. These code limits therefore assume that all calls use credentials dedicated to Roamboard and pass through this backend. If the same account or key is used elsewhere, Roamboard cannot know about that usage and its local counter is not sufficient.

Unsplash initially grants demo status at 50 requests/hour. The 990/hour policy intentionally assumes the requested production approval has been granted. Do not deploy Unsplash search with demo credentials under this policy; lower the reviewed code constant until approval arrives.

## Google Places design

- Text Search returns the stable Google Place ID plus useful POI fields. That field mask is Text Search Pro, so search stops at 4,950 billable events per Google billing month.
- `POST /api/v1/providers/google-places/saved` persists only a Place ID and timestamp. Place IDs are the durable reference; provider display data is fetched live rather than copied into the database.
- `GET /api/v1/providers/google-places/saved` lists saved references. `DELETE /api/v1/providers/google-places/saved/:placeId` removes one.
- `GET /api/v1/providers/google-places/:placeId` fetches live Essentials fields and stops at 9,900/month.
- Google Maps links are constructed from the Place ID using Maps URLs. Those links need no API key and opening one does not consume a Places API request.

Google also offers Text Search IDs Only and Place Details IDs Only without a monthly free cap. IDs-only search is not used for the visible POI results because it cannot return the names, addresses, and locations the UI needs. A future bulk-import workflow could use it, but every subsequent details request would still need the correct SKU policy.

## Mandatory rule for every future provider call

The table is an inventory of implemented billable operations, not a one-time list of vendors. A single provider can have many endpoints, field masks, SKUs, and reset windows. Every new or changed external request must update this inventory and the executable policies in the same change.

Before merging any new provider call or changing an existing endpoint:

1. Identify its exact endpoint, field mask, billable SKU/unit, free boundary, reset timezone, and every minute/hour/day/month rate limit from current official documentation.
2. Add a separate named policy to `src/features/quotas/quota.policies.ts` with safety headroom. Do not silently reuse a policy merely because the provider name matches.
3. Wrap the provider dispatch with `quota.run("policy.id", operation)`. If one dispatch consumes several billable units, reserve that exact integer.
4. Update this document's table and assumptions. If the operation is free or unlimited, document that conclusion and its source too.
5. Add a boundary test proving no provider dispatch occurs after reservation fails.
6. Recheck pricing before launch and periodically afterward. Provider pricing and field-to-SKU mappings can change without a repository change.

For a browser SDK, route normal access through a backend permit endpoint and restrict any intentionally public token at the provider. Never expose a secret credential to the frontend.

## Limits of the guarantee

- The server-side providers are fail-closed as long as their credentials are exclusive to this backend and production uses PostgreSQL. Calls made elsewhere with the same credentials are invisible here.
- A Mapbox `pk.` token used by Mapbox GL JS is public by design. The map-session route reserves normal Roamboard map loads first, but a copied token can bypass the backend. Use a dedicated public token with only map scopes and strict allowed-URL restrictions. Keep the backend token separate.
- Mapbox and Google billing budgets/alerts do not act as a guaranteed zero-spend cutoff. The code cap is defense in depth; provider-side credential restrictions and exclusive keys are also required.
- Cloudinary combines transformations, storage, and delivered bandwidth into credits. Browser CDN delivery bypasses this backend, so request counting alone cannot cap those credits. Keep Cloudinary on its no-card Free plan unless storage and delivery are separately metered and gated.
- Open-Meteo's free endpoint is non-commercial. Staying within its limits does not grant a commercial license.
- Provider dashboards can lag. The gateway relies on pre-dispatch local reservations rather than dashboard values.
