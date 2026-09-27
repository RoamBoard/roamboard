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
          <p>Test autocomplete, restaurants and attractions, nearby category discovery, photo-GPS reverse geocoding, itinerary markers, and walking, cycling or driving routes.</p>
        </div>
        <aside className="hero-note"><strong>Search Box prototype</strong><small>Autocomplete uses one session token per selection. Category and submitted searches run on demand. One map load occurs when the page opens.</small></aside>
      </header>
      <MapboxPlayground />
    </main>
  );
}
