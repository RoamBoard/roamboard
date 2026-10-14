# External API hard quotas

Roamboard reserves usage in the backend before sending a metered provider request. A reservation that would cross any configured window is rejected with HTTP `429` and `details.code = "PROVIDER_QUOTA_EXHAUSTED"`. Provider failures and timeouts are not refunded because the provider may already have counted them.

Production uses atomic PostgreSQL reservations in `api_quota_usage`. The application refuses to use memory storage in production because those counters reset on restart and cannot coordinate multiple API instances. `GET /api/v1/quotas` reports current counters, remaining units, reset times, durability, and the official source for every policy.

Quota behavior is intentionally not configurable through `.env`. Environment variables contain credentials and ordinary deployment settings only. Reviewed limits are hardcoded in `src/features/quotas/quota.policies.ts`, so changing a payment boundary is a visible code and documentation change.

## Current policies

These limits leave approximately 1% headroom below the published boundary. They were checked against official provider documentation on 6 October 2026.

| Policy                            |                             Roamboard hard limit |                                Published boundary | Metered operation                                                                                      |
| --------------------------------- | -----------------------------------------------: | ------------------------------------------------: | ------------------------------------------------------------------------------------------------------ |
| `mapbox.map_loads`                |                         49,500/month + 1,540/day |                                      50,000/month | Mapbox GL JS map initialization on a pay-as-you-go account                                             |
| `mapbox.geocoding`                |                         99,000/month + 3,090/day |                                     100,000/month | Temporary forward and reverse geocoding                                                                |
| `mapbox.permanent_geocoding`      |                                 **0 (disabled)** |                               Paid from request 1 | No request may dispatch                                                                                |
| `geoapify.geocoding`              |                    2/second, 118/hour, 2,970/day |                       5/second, 3,000 credits/day | Shared forward/city/reverse lookup for stored locations                                                |
| `mapbox.directions`               |                                     99,000/month |                                     100,000/month | Directions requests                                                                                    |
| `google.places_text_search_pro`   |                                      4,950/month |                                       5,000/month | Useful POI text search; the requested name, address, location, and type fields trigger Text Search Pro |
| `google.place_details_essentials` |                                      9,900/month |                                      10,000/month | Live address, location, and type lookup for a saved Place ID                                           |
| `unsplash.requests`               |                                         990/hour |                                        1,000/hour | JSON API requests after Unsplash approves production status                                            |
| `open_meteo.forecast`             | 590/minute, 4,950/hour, 9,900/day, 297,000/month | 600/minute, 5,000/hour, 10,000/day, 300,000/month | Free non-commercial Forecast API                                                                       |
| `wikipedia.action_api`            |                                       190/minute |                                        200/minute | Identified, unauthenticated Action API client                                                          |
| `cloudinary.admin`                |                                         495/hour |                                          500/hour | Free-plan Admin API                                                                                    |

The profile travel-footprint map uses the existing `mapbox.map_loads` reservation. Its Mapbox Countries v1 boundary tiles and the city GeoJSON overlay are rendered within that same GL JS map load; they do not introduce another provider operation or quota policy.

Stored Board destinations, pin search, and map/photo reverse lookup now use Geoapify, not Mapbox permanent geocoding. The former 2,500-free-requests assertion was incorrect; permanent geocoding is paid from the first request and has a zero policy. There is no paid fallback if Geoapify is unconfigured or exhausted.

The frontend uses `/api/v1/providers/locations/search`, `/locations/destinations`, and `/locations/reverse`. Legacy `/mapbox/board-*` routes remain aliases and share the same Geoapify counter. A city lookup filters by country and returns the existing `place` result type. The intentionally legacy `mapboxId` / `mapbox_id` field holds the namespaced `geoapify:<id>` reference, so existing stored locations survive without rewriting them. New searched pins have source `geoapify`; GPS-derived pins keep source `photo`. Migration `006_geoapify_pin_source` permits the new source in PostgreSQL. Roamboard stores the pin's event, day, local time, description, and confirmed location; Geoapify only supplies location metadata. Reverse lookup now presents area plus city as `label`, an explicitly named POI as `detail` (otherwise empty), and the full address separately as `address`. Categories and source tags distinguish named restaurants, shopping, museums, parks and landmarks from generic addresses. This mapping uses the same single geocoding request and quota; it does not query nearby POIs or infer what an image depicts.

Set `GEOAPIFY_API_KEY` in the backend `.env`; Compose forwards it server-side. The configuration response contains only a boolean, never the key. Attribution is included in the frontend footer. One geocoding request is one credit. Limits reserve before dispatch: 2 per UTC second (at most 4 across a boundary), 118/hour, 2,970/day. At most 25 UTC hourly buckets overlap any 24-hour provider day, so hourly limits keep usage below 3,000 even before the account reset timezone is verified. Provider failures are counted. Use a dedicated no-card Free project; calls elsewhere are invisible to these counters. Official sources: [Geoapify pricing](https://www.geoapify.com/pricing/), [geocoding](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/), [Mapbox pricing](https://www.mapbox.com/pricing).

Mapbox map display and Directions stay enabled; temporary Mapbox geocoding remains for live session use. Mapbox billing periods need not match calendar months, so daily safeguards allow at most 49,280 map loads or 98,880 geocoding/Directions requests across 32 overlapping UTC days. Unused Mapbox products (Search Box, Autofill, Matrix, Optimization, Isochrone, Map Matching, static images, standalone tiles, Tilequery, uploads/tilesets/datasets, premium Boundaries, navigation/mobile SDKs) have explicit zero policies pending SKU review. Unknown policies fail closed. Public-token use outside this app cannot be stopped by local counters.

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
