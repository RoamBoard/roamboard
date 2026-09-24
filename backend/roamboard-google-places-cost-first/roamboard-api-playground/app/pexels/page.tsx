import Link from "next/link";
import { PexelsPlayground } from "@/components/PexelsPlayground";

export default function PexelsPage() {
  return (
    <main>
      <Link className="back-link" href="/">
        ← All API experiments
      </Link>

      <header className="provider-hero pexels-hero">
        <div>
          <div className="eyebrow">Visual media prototype</div>
          <h1>Pexels for Roamboard</h1>
          <p>
            Search destination photography and video, inspect responsive image
            sizes and attribution, then preview a selected photo as a Roamboard
            destination cover.
          </p>
        </div>

        <aside className="hero-note">
          <strong>Best role in the stack</strong>
          <small>
            Use Pexels for destination mood and cover imagery. Use Mapbox for
            place identity, coordinates, POIs and routing.
          </small>
        </aside>
      </header>

      <PexelsPlayground />
    </main>
  );
}