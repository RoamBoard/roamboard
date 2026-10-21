import type { Metadata } from "next";
import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import FriendsPageContent from "@/components/features/friends/FriendsPageContent";

export async function generateMetadata({
    searchParams
}: {
    searchParams?: Promise<{ handle?: string | string[] }>;
}): Promise<Metadata> {
    const query = searchParams ? await searchParams : {};
    const handle = typeof query.handle === "string" ? query.handle.replace(/^@+/, "").trim() : undefined;
    if (handle) {
        return {
            title: `@${handle}'s Friends | Roamboard`,
            description: `View @${handle}'s travel pals on Roamboard.`
        };
    }
    return {
        title: "Friends | Roamboard",
        description: "View and manage all your travel pals on Roamboard."
    };
}

export default async function FriendsPage({
    searchParams
}: {
    searchParams?: Promise<{ handle?: string | string[] }>;
}) {
    const query = searchParams ? await searchParams : {};
    const rawHandle = typeof query.handle === "string" ? query.handle : undefined;
    const handle = rawHandle?.replace(/^@+/, "").trim() || undefined;

    return (
        <AppShell
            activeHref="/social"
            profile={{
                profileHref: "/profile",
                settingsHref: "/settings"
            }}
        >
            <Suspense
                fallback={<div className="text-muted-foreground p-12 text-center text-sm">Loading travel pals…</div>}
            >
                <FriendsPageContent handle={handle} />
            </Suspense>
        </AppShell>
    );
}
