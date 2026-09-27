import Link from "next/link";
import { UnsplashPlayground } from "@/components/UnsplashPlayground";

export default function UnsplashPage() {
  return (
    <main>
      <Link className="back-link" href="/">← All API experiments</Link>
      <header className="provider-hero">
        <div>
          <div className="eyebrow">Destination cover prototype</div>
          <h1>Unsplash for Roamboard</h1>
          <p>Search a destination, choose one of the five strongest images, and test responsive subject-aware crops and optimized delivery directly from Unsplash.</p>
        </div>
        <aside className="hero-note">
          <strong>Best role in the stack</strong>
          <small>Use Unsplash for hotlinked destination covers, responsive crops and automatic format optimization. Keep user trip photos separate.</small>
        </aside>
      </header>
      <UnsplashPlayground />
    </main>
  );
}
