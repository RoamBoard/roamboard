import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiTester } from "@/components/ApiTester";

const stockholm = [
  { name: "latitude", label: "Latitude", defaultValue: "59.3293" },
  { name: "longitude", label: "Longitude", defaultValue: "18.0686" },
];

const providers = {
  mapbox: { title: "Mapbox reverse geocoding", description: "Convert photo GPS coordinates into an address, locality, region, and country.", endpoint: "/api/mapbox/reverse", fields: stockholm },
  weather: { title: "Open-Meteo", description: "Inspect forecast weather for an itinerary location without an API key.", endpoint: "/api/weather", fields: stockholm },
  pexels: { title: "Pexels", description: "Search destination stock photography and inspect sizes and attribution.", endpoint: "/api/pexels", fields: [{ name: "query", label: "Search", defaultValue: "Stockholm travel" }] },
  unsplash: { title: "Unsplash", description: "Compare image search results, URLs, metadata, and attribution.", endpoint: "/api/unsplash", fields: [{ name: "query", label: "Search", defaultValue: "Stockholm travel" }] },
  wikipedia: { title: "Wikipedia", description: "Retrieve an overview, article URL, thumbnail, and coordinates.", endpoint: "/api/wikipedia", fields: [{ name: "query", label: "Destination", defaultValue: "Stockholm" }] },
  wikidata: { title: "Wikidata", description: "Inspect structured entities and claims for a destination.", endpoint: "/api/wikidata", fields: [{ name: "query", label: "Destination", defaultValue: "Stockholm" }] },
  geonames: { title: "GeoNames", description: "Inspect canonical names, population, administrative hierarchy, and coordinates.", endpoint: "/api/geonames", fields: [{ name: "query", label: "Place", defaultValue: "Stockholm" }] },
} as const;

export default async function ProviderPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const config = providers[provider as keyof typeof providers];
  if (!config) notFound();

  return (
    <main className="narrow-main">
      <Link className="back-link" href="/">← All API experiments</Link>
      <header className="provider-hero">
        <div><div className="eyebrow">Basic provider tester</div><h1>{config.title}</h1><p>{config.description}</p></div>
      </header>
      <ApiTester {...config} />
      <p className="muted tester-note">This comparison page intentionally stays small. Its job is to expose the provider response before you commit to a production data model.</p>
    </main>
  );
}
