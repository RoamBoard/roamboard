import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Development routes | Roamboard",
    robots: { index: false, follow: false }
};

const routes = [
    {
        href: "/dev/board-cards",
        title: "Board card gallery",
        description: "All four collapsed Board designs with twelve Figma reference examples."
    },
    {
        href: "/",
        title: "Start page",
        description: "Introduction and entry into Roamboard."
    },
    {
        href: "/home",
        title: "Destination discovery",
        description: "Search destinations and see weather, descriptions, and imagery."
    },
    {
        href: "/create",
        title: "Create",
        description: "Choose how to start a new Board."
    },
    {
        href: "/boards",
        title: "Boards",
        description: "Search and browse your published Boards, with sample saved and archive collections."
    },
    {
        href: "/boards/new",
        title: "Board creator",
        description: "Upload photos, plan days and pins, preview, and save a draft or publish."
    },
    {
        href: "/dev/boards",
        title: "Saved Board browser",
        description: "Browse saved Boards, inspect their data, and delete your own records."
    },
    {
        href: "/dev/profile",
        title: "Profile API lab",
        description: "Edit your signed-in profile, inspect travel statistics, and create a test Board."
    },
    {
        href: "/dev/profile",
        title: "Profile lab",
        description: "Edit the demo profile, create Boards, and inspect statistics and the travel map."
    },
    {
        href: "/dev/providers",
        title: "Provider lab",
        description: "Try location search, maps and routes, imagery, uploads, place lookup, and search."
    }
];

export default function DevelopmentPage() {
    return (
        <main className="bg-background text-foreground min-h-dvh px-5 py-10 sm:px-10">
            <div className="mx-auto max-w-3xl">
                <h1 className="font-display text-36 font-bold">Development routes</h1>
                <p className="text-14 text-graphite mt-3 leading-6">
                    Pages with functionality in this branch. Provider features need the backend and their configured
                    credentials.
                </p>
                <nav aria-label="Development routes" className="mt-8">
                    <ul className="divide-line border-line divide-y border-y">
                        {routes.map((route) => (
                            <li key={route.href}>
                                <Link
                                    href={route.href}
                                    className="block py-5 focus-visible:outline-2 focus-visible:outline-offset-4"
                                >
                                    <span className="font-display text-20 font-bold underline underline-offset-4">
                                        {route.title}
                                    </span>
                                    <code className="text-12 text-graphite ml-3 inline-block">{route.href}</code>
                                    <p className="text-14 text-graphite mt-2 leading-6">{route.description}</p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <p className="text-14 text-graphite mt-6 leading-6">
                    Saved Board details use <code className="text-12">/boards/[boardId]</code>. Select “Open board” in
                    the{" "}
                    <Link href="/dev/boards" className="underline underline-offset-4">
                        saved Board browser
                    </Link>{" "}
                    to view one. The creator route is <code className="text-12">/boards/new</code>.
                </p>
            </div>
        </main>
    );
}
