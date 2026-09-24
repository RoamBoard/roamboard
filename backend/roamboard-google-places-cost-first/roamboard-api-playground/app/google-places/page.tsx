import Link from "next/link";
import { GooglePlacesPlayground } from "@/components/GooglePlacesPlayground";

export default function GooglePlacesPage() {
  return (
    <main>
      <Link className="back-link" href="/">← All API experiments</Link>
      <header className="provider-hero google-hero">
        <div>
          <div className="eyebrow">Cost-controlled provider prototype</div>
          <h1>Google Places API</h1>
          <p>Explore autocomplete and place discovery with minimal Pro fields, then explicitly request rich venue details or photos only when the interface needs them.</p>
        </div>
        <div className="hero-note"><strong>Before testing</strong><span>Enable <em>Places API (New)</em> and add <code>GOOGLE_PLACES_API_KEY</code> to <code>.env.local</code>.</span><small>Google requires billing, but each SKU has a monthly free-use cap. Configure quotas before testing.</small></div>
      </header>
      <GooglePlacesPlayground />
    </main>
  );
}
