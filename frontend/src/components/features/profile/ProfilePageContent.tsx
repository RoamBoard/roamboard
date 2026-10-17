"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import UnderlineTabs from "@/components/ui/UnderlineTabs";
import {
    apiOrigin,
    loadMapDestinations,
    loadProfile,
    loadProfileStats,
    loadPublishedBoards,
    loadSavedBoards,
    ProfileApiError,
    type MapDestination,
    type ProfileStats,
    type PublishedBoardSummary,
    type SavedBoardSummary,
    type UserProfile
} from "@/lib/profile";
import ProfileHero from "./ProfileHero";
import TravelMapSection from "./TravelMapSection";
import VisitedWorldMap from "./VisitedWorldMap";

type BoardCard = { boardId: number; title: string; coverImageUrl: string | null; author?: string };

function LiveBoardCard({ board }: { board: BoardCard }) {
    return (
        <Link
            href={`/boards/${board.boardId}`}
            className="border-line bg-background hover:border-foreground group block overflow-hidden rounded-[2px] border transition-colors"
        >
            <div className="bg-faint relative aspect-[4/3]">
                {board.coverImageUrl ? (
                    <Image
                        src={new URL(board.coverImageUrl, apiOrigin).toString()}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 1024px) 100vw, 33vw"
                        className="object-cover"
                    />
                ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                        No cover photo
                    </div>
                )}
            </div>
            <div className="p-4">
                <h4 className="font-display text-foreground text-lg font-bold">{board.title}</h4>
                {board.author && <p className="text-muted-foreground mt-1 text-xs">by {board.author}</p>}
            </div>
        </Link>
    );
}

export default function ProfilePageContent() {
    const [activeFilter, setActiveFilter] = useState<"ME" | "FRIENDS" | "EXPLORE">("ME");
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<ProfileStats | null>(null);
    const [published, setPublished] = useState<PublishedBoardSummary[]>([]);
    const [saved, setSaved] = useState<SavedBoardSummary[]>([]);
    const [destinations, setDestinations] = useState<MapDestination[]>([]);
    const [error, setError] = useState("");
    const [sectionErrors, setSectionErrors] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const request = { active: true };
        void loadProfile()
            .then(async (user) => {
                if (!request.active) return;
                setProfile(user);
                const results = await Promise.allSettled([
                    loadProfileStats(),
                    loadPublishedBoards(),
                    loadSavedBoards(1, 3),
                    loadMapDestinations()
                ]);
                if (!request.active) return;
                const failures: string[] = [];
                if (results[0].status === "fulfilled") setStats(results[0].value);
                else failures.push("Statistics could not be loaded.");
                if (results[1].status === "fulfilled") setPublished(results[1].value);
                else failures.push("My boards could not be loaded.");
                if (results[2].status === "fulfilled") setSaved(results[2].value);
                else failures.push("Saved boards could not be loaded.");
                if (results[3].status === "fulfilled") setDestinations(results[3].value);
                else failures.push("The visited map could not be loaded.");
                setSectionErrors(failures);
            })
            .catch((caught: unknown) => {
                if (request.active)
                    setError(
                        caught instanceof ProfileApiError && caught.status === 401
                            ? "Sign in to see your profile."
                            : caught instanceof Error
                              ? caught.message
                              : "Your profile could not be loaded."
                    );
            })
            .finally(() => {
                if (request.active) setLoading(false);
            });
        return () => {
            request.active = false;
        };
    }, [retry]);

    function reload() {
        setLoading(true);
        setError("");
        setSectionErrors([]);
        setRetry((value) => value + 1);
    }

    return (
        <div className="mx-auto w-full max-w-6xl pb-20">
            <header className="mb-8">
                <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">SOCIAL</span>
                <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 font-bold tracking-tight uppercase">
                    {activeFilter}
                </h1>
                <UnderlineTabs
                    tabs={["ME", "FRIENDS", "EXPLORE"]}
                    activeTab={activeFilter}
                    onChange={setActiveFilter}
                    ariaLabel="Audience filter"
                />
            </header>
            {loading && <p role="status">Loading profile…</p>}
            {error && (
                <div role="alert">
                    <p>{error}</p>
                    {error.startsWith("Sign in") ? (
                        <Link href="/login" className="underline">
                            Sign in
                        </Link>
                    ) : (
                        <button type="button" onClick={reload} className="underline">
                            Retry
                        </button>
                    )}
                </div>
            )}
            {!loading && !error && activeFilter !== "ME" && (
                <p className="text-muted-foreground">This section is coming soon.</p>
            )}
            {!loading && !error && profile && activeFilter === "ME" && (
                <main className="flex flex-col">
                    {sectionErrors.length > 0 && (
                        <div role="alert" className="text-muted-foreground mb-6 text-sm">
                            {sectionErrors.join(" ")}{" "}
                            <button type="button" className="underline" onClick={reload}>
                                Retry
                            </button>
                        </div>
                    )}
                    <ProfileHero profile={profile} stats={stats} />
                    <section aria-label="Currently inspired by" className="border-line mt-12 border-t pt-8">
                        <div className="flex items-end justify-between">
                            <div>
                                <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">
                                    currently inspired by
                                </h3>
                                <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                                    boards and destinations on my radar right now
                                </p>
                            </div>
                            <Link
                                href="/boards"
                                className="text-12 text-muted-foreground hover:text-foreground hover:underline"
                            >
                                view all →
                            </Link>
                        </div>
                        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
                            {saved.map((board) => (
                                <LiveBoardCard
                                    key={board.boardId}
                                    board={{ ...board, author: board.owner.displayName }}
                                />
                            ))}
                        </div>
                        {saved.length === 0 && !sectionErrors.some((message) => message.startsWith("Saved")) && (
                            <p className="text-muted-foreground mt-6 text-sm">No saved boards yet.</p>
                        )}
                    </section>
                    <section aria-label="My boards" className="border-line mt-12 border-t pt-8">
                        <div className="flex items-end justify-between">
                            <div>
                                <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">my boards</h3>
                                <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                                    turns out daydreams of new trips looks better as Roamboards
                                </p>
                            </div>
                            <Link
                                href="/boards/mine"
                                className="text-12 text-muted-foreground hover:text-foreground hover:underline"
                            >
                                view all →
                            </Link>
                        </div>
                        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
                            {published.map((board) => (
                                <LiveBoardCard key={board.boardId} board={board} />
                            ))}
                        </div>
                        {published.length === 0 && !sectionErrors.some((message) => message.startsWith("My")) && (
                            <p className="text-muted-foreground mt-6 text-sm">No published boards yet.</p>
                        )}
                    </section>
                    <TravelMapSection
                        stats={stats}
                        mapComponent={
                            sectionErrors.some((message) => message.startsWith("The visited map")) ? (
                                <p role="alert" className="text-muted-foreground">
                                    The visited map could not be loaded.
                                </p>
                            ) : destinations.length ? (
                                <VisitedWorldMap destinations={destinations} embedded />
                            ) : (
                                <p className="text-muted-foreground">No visited destinations yet.</p>
                            )
                        }
                    />
                </main>
            )}
        </div>
    );
}
