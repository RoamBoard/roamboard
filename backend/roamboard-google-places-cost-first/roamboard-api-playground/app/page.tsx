import Link from "next/link";

const providers = [
  { name: "Google Places", slug: "google-places", symbol: "G", status: "Cost-first prototype", description: "Autocomplete, minimal Pro search, opt-in rich details and explicitly loaded photos with fixed field masks." },
  { name: "Mapbox", slug: "mapbox", symbol: "M", status: "Basic tester", description: "Turn photo GPS coordinates into addresses, cities, regions, and countries." },
  { name: "Open-Meteo", slug: "weather", symbol: "WX", status: "Basic tester", description: "Forecast temperatures, precipitation, weather codes, sunrise, and sunset without a key." },
  { name: "Pexels", slug: "pexels", symbol: "PX", status: "Basic tester", description: "Search licensed destination imagery with photographer attribution and multiple sizes." },
  { name: "Unsplash", slug: "unsplash", symbol: "UN", status: "Basic tester", description: "Compare destination images, attribution data, colors, and responsive image URLs." },
  { name: "Wikipedia", slug: "wikipedia", symbol: "W", status: "Basic tester", description: "Fetch destination descriptions, thumbnails, article links, and coordinates." },
  { name: "Wikidata", slug: "wikidata", symbol: "WD", status: "Basic tester", description: "Inspect entity IDs and structured claims for destinations and landmarks." },
  { name: "GeoNames", slug: "geonames", symbol: "GN", status: "Basic tester", description: "Resolve canonical place names, hierarchy, population, and coordinates." },
  { name: "Photo journal import", slug: "photo-import", symbol: "EXIF", status: "Workflow prototype", description: "Read timestamps and GPS locally, reverse geocode them, and draft a chronological journal." },
];

export default function Home() {
  return (
    <main>
      <header className="hero home-hero">
        <div className="eyebrow">Roamboard prototype</div>
        <h1>Explore the travel data stack.</h1>
        <p>Each provider has its own isolated playground. Start with the expanded Google Places prototype, then use the lighter comparison pages to decide which APIs deserve production integrations.</p>
      </header>

      <section className="provider-grid" aria-label="API experiments">
        {providers.map((provider) => {
          const href = provider.slug === "google-places" ? "/google-places" : provider.slug === "photo-import" ? "/photo-import" : `/providers/${provider.slug}`;
          return (
            <Link className={provider.slug === "google-places" ? "provider-card featured" : "provider-card"} href={href} key={provider.slug}>
              <div className="provider-card-top"><span className="provider-symbol">{provider.symbol}</span><span className="status-pill">{provider.status}</span></div>
              <h2>{provider.name}</h2>
              <p>{provider.description}</p>
              <span className="card-link">Open tester <span aria-hidden="true">→</span></span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
