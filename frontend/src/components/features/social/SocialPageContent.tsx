"use client";

import { useState } from "react";
import Link from "next/link";
import type { AudienceFilter, UserProfile } from "@/types/social";
import ProfileHero from "./ProfileHero";
import InterestingFacts from "./InterestingFacts";
import SocialBoardCard from "./SocialBoardCard";
import TravelMapSection from "./TravelMapSection";

type Props = {
    profile: UserProfile;
};

export default function SocialPageContent({ profile }: Props) {
    const [activeFilter, setActiveFilter] = useState<AudienceFilter>("ME");

    const filters: AudienceFilter[] = ["ME", "FRIENDS", "EXPLORE"];

    return (
        <div className="mx-auto w-full max-w-6xl pb-20">
            {/* Top Page Header */}
            <header className="mb-8">
                <span className="text-10 tracking-label text-graphite font-bold uppercase">
                    SOCIAL
                </span>
                <h1 className="font-display text-48 sm:text-60 text-obsidian mt-1 font-bold tracking-tight uppercase">
                    {activeFilter}
                </h1>

                {/* Audience filter tabs */}
                <nav
                    aria-label="Audience filter"
                    className="border-line mt-4 flex items-center gap-6 border-b pb-3"
                >
                    {filters.map((filter) => {
                        const isActive = activeFilter === filter;
                        return (
                            <button
                                key={filter}
                                type="button"
                                onClick={() => setActiveFilter(filter)}
                                aria-current={isActive ? "true" : undefined}
                                className={`text-12 cursor-pointer font-bold tracking-wider uppercase transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 ${
                                    isActive
                                        ? "text-obsidian underline decoration-2 underline-offset-8"
                                        : "text-graphite hover:text-obsidian"
                                }`}
                            >
                                {filter}
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* ME View (Profile & Personal Boards) */}
            {activeFilter === "ME" && (
                <main className="flex flex-col">
                    {/* Hero Section */}
                    <ProfileHero profile={profile} />

                    {/* Facts Section */}
                    <InterestingFacts profile={profile} />

                    {/* Currently inspired by section */}
                    <section
                        aria-label="Currently inspired by"
                        className="border-line mt-12 border-t pt-8"
                    >
                        <div className="flex items-end justify-between">
                            <div>
                                <h3 className="font-display text-20 sm:text-22 text-obsidian font-bold">
                                    currently inspired by
                                </h3>
                                <p className="text-12 text-graphite mt-0.5 font-medium">
                                    boards and destinations on my radar right
                                    now
                                </p>
                            </div>
                            <Link
                                href="/boards"
                                className="text-12 text-graphite hover:text-obsidian transition-colors hover:underline"
                            >
                                view all →
                            </Link>
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
                            {profile.inspiredBoards.map((board) => (
                                <SocialBoardCard key={board.id} board={board} />
                            ))}
                        </div>
                    </section>

                    {/* My boards section */}
                    <section
                        aria-label="My boards"
                        className="border-line mt-12 border-t pt-8"
                    >
                        <div className="flex items-end justify-between">
                            <div>
                                <h3 className="font-display text-20 sm:text-22 text-obsidian font-bold">
                                    my boards
                                </h3>
                                <p className="text-12 text-graphite mt-0.5 font-medium">
                                    turns out daydreams of new trips looks
                                    better as Roamboards
                                </p>
                            </div>
                            <Link
                                href="/boards"
                                className="text-12 text-graphite hover:text-obsidian transition-colors hover:underline"
                            >
                                view all →
                            </Link>
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
                            {profile.myBoards.map((board) => (
                                <SocialBoardCard key={board.id} board={board} />
                            ))}
                        </div>
                    </section>

                    {/* Map & Highlights section */}
                    <TravelMapSection profile={profile} />
                </main>
            )}

            {/* FRIENDS View */}
            {activeFilter === "FRIENDS" && (
                <section
                    aria-label="Friends feed"
                    className="py-12 text-center"
                >
                    <h3 className="font-display text-24 text-obsidian font-bold">
                        Friends &amp; Shared Itineraries
                    </h3>
                    <p className="text-14 text-graphite mx-auto mt-2 max-w-md">
                        Connect with fellow wanderers and view trips shared by
                        your friends on Roamboard.
                    </p>
                    <div className="mt-8 grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
                        {profile.inspiredBoards.slice(0, 2).map((board) => (
                            <SocialBoardCard key={board.id} board={board} />
                        ))}
                    </div>
                </section>
            )}

            {/* EXPLORE View */}
            {activeFilter === "EXPLORE" && (
                <section
                    aria-label="Community explore"
                    className="py-12 text-center"
                >
                    <h3 className="font-display text-24 text-obsidian font-bold">
                        Explore Community Boards
                    </h3>
                    <p className="text-14 text-graphite mx-auto mt-2 max-w-md">
                        Discover public boards, trending destinations, and
                        stories from travelers worldwide.
                    </p>
                    <div className="mt-8 grid grid-cols-1 gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
                        {profile.inspiredBoards.map((board) => (
                            <SocialBoardCard key={board.id} board={board} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
