import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Development routes | Roamboard",
  robots: { index: false, follow: false },
};

const routes = [
  { href: "/", title: "Start page", description: "Introduction and entry into Roamboard." },
  { href: "/home", title: "Destination discovery", description: "Search destinations and see weather, descriptions, and imagery." },
  { href: "/boards", title: "Boards", description: "Choose how to start a new Board." },
  { href: "/boards/new", title: "Board creator", description: "Upload photos, plan days and pins, preview, and save a draft or publish." },
  { href: "/dev/boards", title: "Saved Board browser", description: "Browse saved Boards, inspect their data, and delete your own records." },
  { href: "/dev/profile", title: "Profile lab", description: "Edit the demo profile, create Boards, and inspect statistics and the travel map." },
  { href: "/dev/providers", title: "Provider lab", description: "Try location search, maps and routes, imagery, uploads, place lookup, and search." },
];

export default function DevelopmentPage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-foreground sm:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-36 font-bold">Development routes</h1>
        <p className="mt-3 text-14 leading-6 text-graphite">Pages with functionality in this branch. Provider features need the backend and their configured credentials.</p>
        <nav aria-label="Development routes" className="mt-8">
          <ul className="divide-y divide-line border-y border-line">
            {routes.map((route) => (
              <li key={route.href}>
                <Link href={route.href} className="block py-5 focus-visible:outline-2 focus-visible:outline-offset-4">
                  <span className="font-display text-20 font-bold underline underline-offset-4">{route.title}</span>
                  <code className="ml-3 inline-block text-12 text-graphite">{route.href}</code>
                  <p className="mt-2 text-14 leading-6 text-graphite">{route.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-6 text-14 leading-6 text-graphite">Saved Board details use <code className="text-12">/boards/[boardId]</code>. Select “Open board” in the <Link href="/dev/boards" className="underline underline-offset-4">saved Board browser</Link> to view one. The creator route is <code className="text-12">/boards/new</code>.</p>
      </div>
    </main>
  );
}
