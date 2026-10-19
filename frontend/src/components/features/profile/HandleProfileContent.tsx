"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadProfile, loadPublicProfile, ProfileApiError, type PublicProfileView } from "@/lib/profile";
import ProfileHero from "./ProfileHero";
import ProfilePageContent, { LiveBoardCard } from "./ProfilePageContent";
import TravelMapSection from "./TravelMapSection";
import VisitedWorldMap from "./VisitedWorldMap";

export function ProfileRedirect() {
    const router = useRouter();
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const request = { active: true };
        void loadProfile()
            .then((profile) => {
                if (request.active) router.replace(`/profile/${encodeURIComponent(profile.username)}`);
            })
            .catch((caught: unknown) => {
                if (request.active)
                    setError(
                        caught instanceof ProfileApiError && caught.status === 401
                            ? "Sign in to see your profile."
                            : "Your profile could not be loaded."
                    );
            });
        return () => {
            request.active = false;
        };
    }, [router, retry]);

    return error ? (
        <p role="alert">
            {error}{" "}
            {error.startsWith("Sign in") && (
                <Link href="/login" className="underline">
                    Sign in
                </Link>
            )}
            {!error.startsWith("Sign in") && (
                <button
                    type="button"
                    className="underline"
                    onClick={() => {
                        setError("");
                        setRetry((value) => value + 1);
                    }}
                >
                    Retry
                </button>
            )}
        </p>
    ) : (
        <p role="status">Loading profile…</p>
    );
}

export default function HandleProfileContent({ handle }: { handle: string }) {
    const [view, setView] = useState<PublicProfileView | null>(null);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        const request = { active: true };
        void loadPublicProfile(handle)
            .then((result) => {
                if (request.active) setView(result);
            })
            .catch((caught: unknown) => {
                if (request.active)
                    setError(
                        caught instanceof ProfileApiError && caught.status === 404
                            ? "Profile not found."
                            : "This profile could not be loaded."
                    );
            });
        return () => {
            request.active = false;
        };
    }, [handle, retry]);

    if (error)
        return (
            <p role="alert">
                {error}{" "}
                {error !== "Profile not found." && (
                    <button
                        type="button"
                        className="underline"
                        onClick={() => {
                            setError("");
                            setRetry((value) => value + 1);
                        }}
                    >
                        Retry
                    </button>
                )}
            </p>
        );
    if (!view) return <p role="status">Loading profile…</p>;
    if (view.isOwner) return <ProfilePageContent />;

    return (
        <div className="mx-auto w-full max-w-6xl pb-20">
            <header className="mb-8">
                <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">PROFILE</span>
                <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 font-bold tracking-tight uppercase">
                    @{view.profile.username}
                </h1>
            </header>
            <main className="flex flex-col">
                <ProfileHero
                    profile={view.profile}
                    stats={view.stats}
                    isOwner={false}
                    friendshipStatus={view.friendshipStatus}
                />
                <section aria-label="Public boards" className="border-line mt-12 border-t pt-8">
                    <h2 className="font-display text-20 sm:text-22 text-foreground font-bold">boards</h2>
                    <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                        boards shared by {view.profile.displayName}
                    </p>
                    <div className="mt-8 grid grid-cols-1 items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                        {view.boards.map((board) => (
                            <LiveBoardCard
                                key={board.boardId}
                                board={{ ...board, author: view.profile.username }}
                                ownership="other"
                                publicView
                            />
                        ))}
                    </div>
                    {view.boards.length === 0 && (
                        <p className="text-muted-foreground mt-6 text-sm">No public boards yet.</p>
                    )}
                </section>
                <TravelMapSection
                    stats={view.stats}
                    publicView
                    mapComponent={
                        <VisitedWorldMap
                            key={view.profile.username}
                            destinations={view.destinations}
                            embedded
                            allowSaved={view.friendshipStatus === "accepted"}
                            profileHandle={view.profile.username}
                        />
                    }
                />
            </main>
        </div>
    );
}
