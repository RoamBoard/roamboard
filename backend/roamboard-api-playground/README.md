# Roamboard API Playground

A deliberately small Next.js + TypeScript project for testing the external APIs in the Roamboard proposal before integrating them into the real Express/PostgreSQL/Elasticsearch architecture.

## Recommended first stack

Do **not** integrate every alternative into the final application. Start with:

1. **Foursquare** for restaurants, attractions and POIs.
2. **Mapbox** for maps, forward geocoding and reverse geocoding photo GPS.
3. **Pexels** for destination cover/board photography.
4. **Cloudinary** for user-uploaded trip photos.
5. **Open-Meteo** for forecasts and historical weather.
6. **Wikipedia/Wikidata** for destination descriptions and structured facts.
7. **exifr** (local package, not an external API) for timestamps/GPS in uploaded photos.

Google Places and Unsplash are included as comparison experiments. GeoNames is useful if you need a canonical city/country hierarchy, but much of its role overlaps with Mapbox and Wikidata.

## 1. Start from an empty repo

```bash
git clone YOUR_EMPTY_REPO_URL
cd YOUR_REPO

# Copy the contents of this starter into the repo, then:
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The no-key endpoints (Open-Meteo, Wikipedia and Wikidata) work immediately. Routes that lack credentials return a helpful `503` response.

Run checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## 2. Get credentials

| Provider | How to get it | Environment variable | Keep server-side? |
| --- | --- | --- | --- |
| [Foursquare](https://docs.foursquare.com/developer/docs/manage-service-api-keys) | Create a developer project, then generate a **Service API Key** under project Settings. Copy it immediately; Foursquare only shows it once. | `FOURSQUARE_API_KEY` | Yes |
| [Google Places](https://developers.google.com/maps/documentation/places/web-service/get-api-key) | Create/select a Google Cloud project, attach billing, enable **Places API (New)**, then create and restrict an API key. | `GOOGLE_PLACES_API_KEY` | Yes |
| [Mapbox](https://docs.mapbox.com/help/dive-deeper/access-tokens/) | Create an account. A default public `pk.*` token is created automatically; create a project-specific restricted token before production. | `MAPBOX_ACCESS_TOKEN` | A public `pk.*` token may be client-side, but this starter proxies it |
| [Pexels](https://www.pexels.com/api/documentation/) | Create a Pexels account and request an API key from the API page. | `PEXELS_API_KEY` | Yes |
| [Unsplash](https://unsplash.com/documentation) | Join as a developer, create an application, then copy its Access Key. Demo mode is rate-limited. | `UNSPLASH_ACCESS_KEY` | Yes |
| [GeoNames](https://www.geonames.org/login) | Register an account, open **Manage Account**, enable the free web service, then use your username. | `GEONAMES_USERNAME` | Prefer server-side |
| [Cloudinary](https://cloudinary.com/documentation/node_quickstart) | Create a product environment and copy cloud name, API key and API secret from Console Settings/API Keys. | Three `CLOUDINARY_*` values | The secret must stay server-side |
| [Open-Meteo](https://open-meteo.com/en/docs) | No key for ordinary non-commercial/open-access testing. | None | N/A |
| [Wikipedia/Wikidata](https://www.mediawiki.org/wiki/API:REST_API) | No key for these public read requests. Replace the placeholder API User-Agent contact before deployment. | None | N/A |

Never commit `.env.local`. Do not prefix secrets with `NEXT_PUBLIC_`; Next.js exposes variables with that prefix to the browser bundle.

## 3. What each experiment returns

| Local route | Useful returned data | Roamboard use |
| --- | --- | --- |
| `/api/foursquare` | Place ID, name, coordinates, address/location, categories, distance | POI search, attraction/restaurant suggestions |
| `/api/google-places` | Place ID, display name, address, coordinates, type, rating count/rating, photos, Google Maps URL | Richer POI comparison; be mindful of field-based billing |
| `/api/mapbox/reverse` | GeoJSON features, address, neighborhood/locality, region, country, coordinates | Turn EXIF GPS into readable journal locations |
| `/api/weather` | Seven daily dates, weather codes, min/max temperature, precipitation probability, sunrise/sunset | Destination and itinerary-day forecasts |
| `/api/pexels` | Photo IDs, multiple image sizes, alt text, photographer/name/profile URL | Destination board imagery |
| `/api/unsplash` | Photo IDs, sizes/URLs, color/blur hash, photographer and attribution links | Alternative destination imagery |
| `/api/wikipedia` | Title, intro extract, article URL, thumbnail, coordinates | Destination overview copy |
| `/api/wikidata` | Entity IDs and structured claims | Country, coordinates, official site and knowledge-graph links |
| `/api/geonames` | GeoName ID, canonical/local names, country/admin hierarchy, population, coordinates | Destination normalization and hierarchy |
| `/api/cloudinary/upload` | Public ID, delivery URL, dimensions, format, bytes | Store user trip photos and derived thumbnails |

## 4. Direct fetch/curl examples

All examples below call your local server, so private provider credentials remain inside route handlers.

```bash
curl "http://localhost:3000/api/foursquare?query=museum&latitude=59.3293&longitude=18.0686"

curl "http://localhost:3000/api/google-places?query=museums%20in%20Stockholm"

curl "http://localhost:3000/api/mapbox/reverse?latitude=59.3293&longitude=18.0686"

curl "http://localhost:3000/api/weather?latitude=59.3293&longitude=18.0686"

curl "http://localhost:3000/api/pexels?query=Stockholm%20travel"

curl "http://localhost:3000/api/wikipedia?query=Stockholm"

curl -X POST -F "file=@/absolute/path/to/photo.jpg" \
  "http://localhost:3000/api/cloudinary/upload"
```

From the frontend, the matching pattern is simply:

```ts
const response = await fetch(
  "/api/foursquare?query=cafe&latitude=59.3293&longitude=18.0686",
);

if (!response.ok) {
  throw new Error(`Places request failed: ${response.status}`);
}

const data = await response.json();
```

## 5. Photo-to-journal workflow

The `/photo-import` page demonstrates the privacy-friendly first stage:

1. The user selects original images.
2. `exifr` reads `DateTimeOriginal`, GPS and camera fields **locally in the browser**.
3. Images are sorted by capture time.
4. Only GPS coordinates are sent to your own `/api/mapbox/reverse` route.
5. The UI displays a chronological draft with readable places.

For the real feature, continue with:

6. Group nearby photos into candidate activities using time/distance gaps.
7. Ask the user to confirm/edit the automatically inferred day, time and location.
8. Upload confirmed media to Cloudinary using signed uploads.
9. Persist the normalized journey/activity/photo records through your Express backend.

A useful draft object is:

```ts
type ImportedActivityDraft = {
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  placeLabel: string | null;
  sourceFileName: string;
  cloudinaryPublicId: string | null;
  cloudinaryUrl: string | null;
  userTitle: string;
  userNotes: string;
};
```

### Important metadata limitations

- WhatsApp, Instagram, screenshots and downloaded copies often strip EXIF/GPS.
- Users can disable camera location tagging, so GPS must be optional.
- EXIF timestamps are sometimes missing a timezone; let users correct the day/time.
- iPhones commonly produce HEIC/HEIF. `exifr` can read many HEIC metadata blocks, but browser preview/processing support varies.
- Explain clearly that GPS metadata is sensitive, obtain consent, and let users remove or alter inferred locations before saving.
- Do not trust client metadata as authoritative; validate file types/sizes and user-entered values on the server.

## 6. Architecture note

Next.js route handlers are used here only to make experimentation fast. In the production Roamboard architecture, move provider integrations into your Express server as adapters/services:

```text
React/Next.js -> Express REST API -> provider adapter -> external API
                               -> normalized DTO -> PostgreSQL/Elasticsearch cache
```

That keeps provider keys out of the browser, gives you one normalized `Place`/`Destination` model, and makes provider changes easier later.
