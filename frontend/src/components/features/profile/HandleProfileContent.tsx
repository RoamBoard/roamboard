"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserRound } from "lucide-react";
import ViewAllBoards from "@/components/features/boards/ViewAllBoards";
import {
    loadFriends,
    loadProfile,
    loadPublicProfile,
    ProfileApiError,
    type PublicProfileView,
    type FriendUser
} from "@/lib/profile";
import ProfileHero from "./ProfileHero";
import ProfileIdentityText from "./ProfileIdentityText";
import ProfilePageContent, { FriendAvatar, LiveBoardLibrary, ProfileSavedBoardLibrary } from "./ProfilePageContent";
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

export default function HandleProfileContent({
    handle,
    profileSaved = false
}: {
    handle: string;
    profileSaved?: boolean;
}) {
    const [view, setView] = useState<PublicProfileView | null>(null);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    const [saveNoticeDismissed, setSaveNoticeDismissed] = useState(false);

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
    if (view.isOwner)
        return (
            <>
                {profileSaved && !saveNoticeDismissed && (
                    <div
                        role="status"
                        className="border-feedback-success-border bg-feedback-success-surface text-feedback-success mx-auto mb-6 flex max-w-6xl items-start justify-between gap-4 rounded-[2px] border px-4 py-3 text-sm"
                    >
                        <p>Profile changes saved.</p>
                        <button
                            type="button"
                            aria-label="Dismiss save confirmation"
                            onClick={() => setSaveNoticeDismissed(true)}
                            className="cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            Dismiss
                        </button>
                    </div>
                )}
                <ProfilePageContent />
            </>
        );

    return <VisitorProfileContent key={handle} view={view} />;
}

export type VisitorProfileContentProps = {
    view: PublicProfileView;
    initialFriends?: FriendUser[];
    initialFriendsLoading?: boolean;
    initialFriendsError?: string | null;
};

export function VisitorFriendsSection({
    view,
    initialFriends,
    initialFriendsLoading,
    initialFriendsError = null
}: VisitorProfileContentProps) {
    const [friends, setFriends] = useState<FriendUser[]>(initialFriends ?? []);
    const [friendsLoading, setFriendsLoading] = useState(
        initialFriendsLoading ?? (!initialFriends && !initialFriendsError)
    );
    const [friendsError, setFriendsError] = useState<string | null>(initialFriendsError);
    const [retryFriends, setRetryFriends] = useState(0);

    useEffect(() => {
        if (initialFriends || initialFriendsError) return;
        const request = { active: true };
        void loadFriends(view.profile.username)
            .then((data) => {
                if (request.active) {
                    setFriends(data);
                    setFriendsLoading(false);
                }
            })
            .catch(() => {
                if (request.active) {
                    setFriendsError("Travel pals could not be loaded.");
                    setFriendsLoading(false);
                }
            });
        return () => {
            request.active = false;
        };
    }, [view.profile.username, retryFriends, initialFriends, initialFriendsError]);

    const friendsTitle = view.profile.displayName || `@${view.profile.username}`;

    return (
        <section aria-label={`${friendsTitle}'s friends`} className="border-line mt-12 border-t pt-8">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">
                        {`${friendsTitle}'s friends${!friendsLoading ? ` (${friends.length})` : ""}`}
                    </h3>
                    <p className="text-12 text-muted-foreground mt-2 font-medium">
                        travelers they&apos;re connected with
                    </p>
                </div>
                <Link
                    href={`/friends?handle=${encodeURIComponent(view.profile.username)}`}
                    className="text-12 text-muted-foreground hover:text-foreground hover:underline"
                >
                    view all ({friends.length}) →
                </Link>
            </div>

            {friendsLoading && friends.length === 0 ? (
                <div className="border-line bg-background rounded-[2px] border p-8 text-center">
                    <p className="text-12 text-muted-foreground font-body">Loading travel pals…</p>
                </div>
            ) : friendsError ? (
                <div
                    role="alert"
                    className="border-line bg-background text-12 text-muted-foreground rounded-[2px] border p-8 text-center font-medium"
                >
                    <p className="mb-2 text-red-500">{friendsError}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setFriendsError(null);
                            setFriendsLoading(true);
                            setRetryFriends((r) => r + 1);
                        }}
                        className="text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80"
                    >
                        Retry
                    </button>
                </div>
            ) : friends.length === 0 ? (
                <div className="border-line bg-background rounded-[2px] border p-8 text-center sm:p-10">
                    <div className="bg-muted text-muted-foreground mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
                        <UserRound size={22} strokeWidth={1.5} />
                    </div>
                    <h4 className="font-display text-18 text-foreground font-bold">No travel pals yet</h4>
                    <p className="text-12 text-muted-foreground mx-auto mt-1.5 max-w-sm font-medium">
                        {view.profile.displayName || `@${view.profile.username}`} hasn&apos;t connected with any travel
                        pals yet.
                    </p>
                </div>
            ) : (
                <div className="flex items-start gap-6 overflow-x-auto overscroll-contain pt-1 pb-3">
                    {friends.map((friend) => (
                        <div key={friend.userId} className="group flex w-20 shrink-0 flex-col items-center text-center">
                            <Link
                                href={`/profile/${encodeURIComponent(friend.username)}`}
                                className="flex w-full flex-col items-center text-center"
                            >
                                <div className="border-line bg-muted relative mb-2 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-transform duration-150 group-hover:scale-105">
                                    <FriendAvatar friend={friend} />
                                </div>
                                <span className="text-12 text-foreground w-full truncate font-medium group-hover:underline">
                                    {friend.displayName}
                                </span>
                                <span className="text-10 text-muted-foreground w-full truncate">
                                    @{friend.username}
                                </span>
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export function VisitorProfileContent({
    view,
    initialFriends,
    initialFriendsLoading,
    initialFriendsError
}: VisitorProfileContentProps) {
    return (
        <div className="mx-auto w-full max-w-6xl pb-20">
            <header className="@container mb-8">
                <h1
                    aria-label={`@${view.profile.username}`}
                    className="font-display text-foreground text-[clamp(2.5rem,8cqw,3.75rem)] leading-[1.08] font-bold tracking-tight text-balance [overflow-wrap:anywhere] uppercase"
                >
                    @<ProfileIdentityText text={view.profile.username} />
                </h1>
            </header>
            <main className="flex flex-col">
                <ProfileHero
                    profile={view.profile}
                    stats={view.stats}
                    isOwner={false}
                    friendshipStatus={view.friendshipStatus}
                />
                <VisitorFriendsSection
                    view={view}
                    initialFriends={initialFriends}
                    initialFriendsLoading={initialFriendsLoading}
                    initialFriendsError={initialFriendsError}
                />
                <section aria-label="Currently inspired by" className="border-line mt-12 border-t pt-8">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">
                                currently inspired by
                            </h3>
                            <p className="text-12 text-muted-foreground mt-2 font-medium">
                                boards and destinations on my radar right now
                            </p>
                        </div>
                        <ViewAllBoards
                            href={`/boards/collections/profile-saved?handle=${encodeURIComponent(view.profile.username)}`}
                        />
                    </div>
                    <ProfileSavedBoardLibrary boards={view.savedBoards ?? []} ownCollection={false} />
                    {!view.savedBoards?.length && (
                        <p className="text-muted-foreground mt-6 text-sm">No saved boards to show.</p>
                    )}
                </section>
                <section aria-label="My boards" className="border-line mt-12 border-t pt-8">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">my boards</h3>
                            <p className="text-12 text-muted-foreground mt-2 font-medium">
                                turns out daydreams of new trips looks better as Roamboards
                            </p>
                        </div>
                        <ViewAllBoards
                            href={`/boards/collections/profile?handle=${encodeURIComponent(view.profile.username)}`}
                        />
                    </div>
                    <LiveBoardLibrary
                        boards={view.boards}
                        author={view.profile.username}
                        ownership="other"
                        publicView
                    />
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
