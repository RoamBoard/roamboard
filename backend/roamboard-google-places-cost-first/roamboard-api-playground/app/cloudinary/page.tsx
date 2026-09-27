import Link from "next/link";
import { CloudinaryPlayground } from "@/components/CloudinaryPlayground";

export default function CloudinaryPage() {
  return (
    <main>
      <Link className="back-link" href="/">← All API experiments</Link>
      <header className="provider-hero">
        <div>
          <div className="eyebrow">Media storage and crop prototype</div>
          <h1>Cloudinary for Roamboard</h1>
          <p>Upload users&apos; trip images once, then automatically deliver subject-aware hero, card, square and portrait crops with no manual editing.</p>
        </div>
        <aside className="hero-note">
          <strong>Best role in the stack</strong>
          <small>Cloudinary stores user uploads and delivers optimized variants. PostgreSQL only needs ownership, itinerary relations, metadata and the Cloudinary public ID.</small>
        </aside>
      </header>
      <CloudinaryPlayground />
    </main>
  );
}
