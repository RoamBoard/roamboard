"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import UnderlineTabs from "@/components/ui/UnderlineTabs";
import {
    loadMapDestinations,
    loadProfile,
    loadProfileStats,
    loadPublishedBoards,
    ProfileApiError,
    type MapDestination,
    type ProfileStats,
    type PublishedBoardSummary,
    type UserProfile
} from "@/lib/profile";
import ProfileHero from "./ProfileHero";
import TravelMapSection from "./TravelMapSection";
import VisitedWorldMap from "./VisitedWorldMap";

import AccountPhotoBoardCard from "@/components/features/boards/cards/AccountPhotoBoardCard";
import SavedBoardGrid from "@/components/features/boards/SavedBoardGrid";
import { createSavedBoardsStore } from "@/lib/saved-boards-store";
import { toProfilePhotoBoardCard } from "@/lib/photo-board-card";
import type { PhotoBoardCardProps } from "@/types/board-card";

export function LiveBoardCard({
    board,
    ownership = "unknown",
    publicView = false
}: {
    board: PublishedBoardSummary & { author?: string };
    ownership?: PhotoBoardCardProps["ownership"];
    publicView?: boolean;
}) {
    return (
        <AccountPhotoBoardCard
            board={toProfilePhotoBoardCard(board, board.author ?? "", publicView)}
            ownership={ownership}
            href={`/boards/${board.boardId}`}
        />
    );
}

export default function ProfilePageContent() {
    const [activeFilter, setActiveFilter] = useState<"ME" | "FRIENDS" | "EXPLORE">("ME");
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [stats, setStats] = useState<ProfileStats | null>(null);
    const [published, setPublished] = useState<PublishedBoardSummary[]>([]);
    const [savedStore] = useState(() => createSavedBoardsStore(3));
    const saved = useSyncExternalStore(savedStore.subscribe, savedStore.getSnapshot, savedStore.getSnapshot);
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
                    savedStore.loadFirst(),
                    loadMapDestinations()
                ]);
                if (!request.active) return;
                const failures: string[] = [];
                if (results[0].status === "fulfilled") setStats(results[0].value);
                else failures.push("Statistics could not be loaded.");
                if (results[1].status === "fulfilled") setPublished(results[1].value);
                else failures.push("My boards could not be loaded.");
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
    }, [retry, savedStore]);

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
                        {saved.error && (
                            <p role="alert" className="mt-6 text-sm">
                                {saved.error}{" "}
                                {saved.signInRequired ? (
                                    <Link href="/login" className="underline">
                                        Sign in
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void savedStore.retry();
                                        }}
                                        className="min-h-11 underline"
                                    >
                                        Retry saved Boards
                                    </button>
                                )}
                            </p>
                        )}
                        {saved.loading && (
                            <p role="status" className="mt-6 text-sm">
                                Updating saved Boards…
                            </p>
                        )}
                        <SavedBoardGrid
                            boards={saved.items}
                            onUnsave={(boardId) => {
                                savedStore.removeConfirmed(boardId);
                                setStats((current) =>
                                    current
                                        ? { ...current, boardsSaved: Math.max(0, current.boardsSaved - 1) }
                                        : current
                                );
                            }}
                        />
                        {saved.loaded && !saved.loading && !saved.error && saved.items.length === 0 && (
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
                        <div className="mt-8 grid grid-cols-1 items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                            {published.map((board) => (
                                <LiveBoardCard
                                    key={board.boardId}
                                    board={{ ...board, author: profile.username }}
                                    ownership="owner"
                                />
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
