import Link from "next/link";
import { ApiTester } from "@/components/ApiTester";

const stockholm = [
  { name: "latitude", label: "Latitude", defaultValue: "59.3293" },
  { name: "longitude", label: "Longitude", defaultValue: "18.0686" },
];

export default function Home() {
  return (
    <main>
      <header className="hero">
        <div className="eyebrow">Roamboard prototype</div>
        <h1>API playground</h1>
        <p>
          Run each provider separately, inspect its raw JSON, and decide which data is actually useful before coupling it to the final database model.
        </p>
        <nav className="toolbar">
          <Link className="button" href="/photo-import">Test trip-photo import</Link>
          <a className="button secondary" href="https://github.com" target="_blank" rel="noreferrer">Open GitHub</a>
        </nav>
      </header>

      <div className="grid">
        <ApiTester
          title="Foursquare Places"
          description="Restaurants, attractions and POIs near a coordinate. Recommended first POI experiment."
          endpoint="/api/foursquare"
          fields={[
            { name: "query", label: "Search", defaultValue: "museum" },
            ...stockholm,
          ]}
        />
        <ApiTester
          title="Google Places"
          description="Rich place data and ratings, but billing must be enabled and field masks affect cost."
          endpoint="/api/google-places"
          fields={[
            { name: "query", label: "Search", defaultValue: "museums in Stockholm" },
          ]}
        />
        <ApiTester
          title="Mapbox reverse geocoding"
          description="Converts photo GPS coordinates into an address, locality, region and country."
          endpoint="/api/mapbox/reverse"
          fields={stockholm}
        />
        <ApiTester
          title="Open-Meteo"
          description="Forecast weather without an API key. Useful on destination and itinerary-day cards."
          endpoint="/api/weather"
          fields={stockholm}
        />
        <ApiTester
          title="Pexels"
          description="Search destination stock photos and receive photographer attribution and several image sizes."
          endpoint="/api/pexels"
          fields={[{ name: "query", label: "Search", defaultValue: "Stockholm travel" }]}
        />
        <ApiTester
          title="Unsplash"
          description="Alternative stock-image search. Its returned image URLs must be hotlinked and attributed."
          endpoint="/api/unsplash"
          fields={[{ name: "query", label: "Search", defaultValue: "Stockholm travel" }]}
        />
        <ApiTester
          title="Wikipedia"
          description="Destination summaries, article URLs, thumbnails and coordinates. No API key."
          endpoint="/api/wikipedia"
          fields={[{ name: "query", label: "Destination", defaultValue: "Stockholm" }]}
        />
        <ApiTester
          title="Wikidata"
          description="Structured entity IDs and claims such as country, coordinates and official website. No key."
          endpoint="/api/wikidata"
          fields={[{ name: "query", label: "Destination", defaultValue: "Stockholm" }]}
        />
        <ApiTester
          title="GeoNames"
          description="Canonical place names, population, administrative hierarchy and coordinates."
          endpoint="/api/geonames"
          fields={[{ name: "query", label: "Place", defaultValue: "Stockholm" }]}
        />
      </div>
    </main>
  );
}
