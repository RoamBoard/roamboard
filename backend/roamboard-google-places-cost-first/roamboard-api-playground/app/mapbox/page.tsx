import Link from "next/link";
import { MapboxPlayground } from "@/components/MapboxPlayground";

export default function MapboxPage() {
  return (
    <main>
      <Link className="back-link" href="/">← All API experiments</Link>
      <header className="provider-hero mapbox-hero">
        <div>
          <div className="eyebrow">Expanded workflow prototype</div>
          <h1>Mapbox for Roamboard</h1>
          <p>Test destination search, photo-GPS reverse geocoding, interactive itinerary markers, and walking, cycling or driving routes.</p>
        </div>
        <aside className="hero-note"><strong>Cost-aware behaviour</strong><small>Search only submits on demand. Route calculation is explicit. A map load occurs once when this page opens.</small></aside>
      </header>
      <MapboxPlayground />
    </main>
  );
}
