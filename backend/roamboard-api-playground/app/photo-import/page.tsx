import Link from "next/link";
import { PhotoMetadataTester } from "@/components/PhotoMetadataTester";

export default function PhotoImportPage() {
  return (
    <main>
      <header className="hero">
        <div className="eyebrow">Spontaneous itinerary / journal</div>
        <h1>Import a trip from photos</h1>
        <p>
          This proves the first half of the workflow: read timestamps and GPS from original images, sort them chronologically, and reverse-geocode each location for a draft journal.
        </p>
        <nav className="toolbar">
          <Link className="button secondary" href="/">Back to API tests</Link>
        </nav>
      </header>
      <PhotoMetadataTester />
    </main>
  );
}
