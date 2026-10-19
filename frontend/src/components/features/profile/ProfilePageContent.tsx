"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, UserRound } from "lucide-react";
import {
    loadFriends,
    loadMapDestinations,
    loadProfile,
    loadProfileStats,
    loadPublishedBoards,
    removeFriend,
    ProfileApiError,
    type FriendUser,
    type MapDestination,
    type ProfileStats,
    type PublishedBoardSummary,
    type UserProfile
} from "@/lib/profile";
import ProfileHero from "./ProfileHero";
import TravelMapSection from "./TravelMapSection";
import VisitedWorldMap from "./VisitedWorldMap";
import FindFriendsDialog from "@/components/features/social/FindFriendsDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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

function FriendAvatar({ friend }: { friend: FriendUser }) {
    const [failed, setFailed] = useState(false);
    if (friend.profilePictureUrl && !failed) {
        return (
            <Image
                src={friend.profilePictureUrl}
                alt=""
                width={64}
                height={64}
                unoptimized
                className="size-full object-cover"
                onError={() => setFailed(true)}
            />
        );
    }
    return <UserRound size={28} strokeWidth={1.5} className="text-muted-foreground" />;
}

export type ProfilePageContentProps = {
    initialProfile?: UserProfile | null;
    initialStats?: ProfileStats | null;
    initialPublished?: PublishedBoardSummary[];
    initialFriends?: FriendUser[];
    initialDestinations?: MapDestination[];
    initialConfirmUnfriendTarget?: FriendUser | null;
    initialSectionErrors?: string[];
};

export default function ProfilePageContent({
    initialProfile = null,
    initialStats = null,
    initialPublished = [],
    initialFriends = [],
    initialDestinations = [],
    initialConfirmUnfriendTarget = null,
    initialSectionErrors = []
}: ProfilePageContentProps = {}) {
    const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
    const [stats, setStats] = useState<ProfileStats | null>(initialStats);
    const [published, setPublished] = useState<PublishedBoardSummary[]>(initialPublished);
    const [savedStore] = useState(() => createSavedBoardsStore(3));
    const saved = useSyncExternalStore(savedStore.subscribe, savedStore.getSnapshot, savedStore.getSnapshot);
    const [friends, setFriends] = useState<FriendUser[]>(initialFriends);
    const [confirmUnfriendTarget, setConfirmUnfriendTarget] = useState<FriendUser | null>(initialConfirmUnfriendTarget);
    const [unfriendError, setUnfriendError] = useState<string | null>(null);
    const [unfriendLoading, setUnfriendLoading] = useState(false);
    const [destinations, setDestinations] = useState<MapDestination[]>(initialDestinations);
    const [searchOpen, setSearchOpen] = useState(false);
    const [error, setError] = useState("");
    const [sectionErrors, setSectionErrors] = useState<string[]>(initialSectionErrors);
    const [loading, setLoading] = useState(!initialProfile);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (initialProfile && retry === 0) return;
        const request = { active: true };
        void loadProfile()
            .then(async (user) => {
                if (!request.active) return;
                setProfile(user);
                const results = await Promise.allSettled([
                    loadProfileStats(),
                    loadPublishedBoards(),
                    savedStore.loadFirst(),
                    loadMapDestinations(),
                    loadFriends()
                ]);
                if (!request.active) return;
                const failures: string[] = [];
                if (results[0].status === "fulfilled") setStats(results[0].value);
                else failures.push("Statistics could not be loaded.");
                if (results[1].status === "fulfilled") setPublished(results[1].value);
                else failures.push("My boards could not be loaded.");
                if (results[3].status === "fulfilled") setDestinations(results[3].value);
                else failures.push("The visited map could not be loaded.");
                if (results[4].status === "fulfilled") setFriends(results[4].value);
                else failures.push("Travel pals could not be loaded.");
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
    }, [initialProfile, retry, savedStore]);

    function reload() {
        setLoading(true);
        setError("");
        setSectionErrors([]);
        setRetry((value) => value + 1);
    }

    return (
        <div className="mx-auto w-full max-w-6xl pb-20">
            <header className="mb-8">
                <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">ACCOUNT</span>
                <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 font-bold tracking-tight uppercase">
                    PROFILE
                </h1>
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
            {!loading && !error && profile && (
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
                    <section aria-label="My friends" className="border-line mt-12 border-t pt-8">
                        <div className="mb-4 flex items-end justify-between">
                            <div>
                                <h3 className="font-display text-20 sm:text-22 text-foreground font-bold">
                                    my friends ({friends.length})
                                </h3>
                                <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                                    fellow travelers you&apos;re connected with
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => setSearchOpen(true)}
                                    className="font-body text-12 text-muted-foreground hover:text-foreground cursor-pointer underline-offset-4 hover:underline"
                                >
                                    + find friends
                                </button>
                                <Link
                                    href="/social"
                                    className="text-12 text-muted-foreground hover:text-foreground hover:underline"
                                >
                                    social hub →
                                </Link>
                            </div>
                        </div>

                        {sectionErrors.some((message) => message.startsWith("Travel pals")) ? (
                            <div
                                role="alert"
                                className="border-line bg-background text-12 text-muted-foreground rounded-[2px] border p-8 text-center font-medium"
                            >
                                <p className="mb-2 text-red-500">Travel pals could not be loaded.</p>
                                <button
                                    type="button"
                                    onClick={reload}
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
                                    Connect with other travelers on Roamboard to see their shared boards and latest
                                    trips.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSearchOpen(true)}
                                    className="bg-foreground text-background font-body text-12 mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] px-4 py-2 font-medium transition-opacity hover:opacity-90"
                                >
                                    <Plus size={14} strokeWidth={2} /> Find Friends
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-start gap-6 overflow-x-auto overscroll-contain pt-1 pb-3">
                                {friends.map((friend) => (
                                    <div
                                        key={friend.userId}
                                        className="group flex w-20 shrink-0 flex-col items-center text-center"
                                    >
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
                                        <button
                                            type="button"
                                            onClick={() => setConfirmUnfriendTarget(friend)}
                                            aria-label={`Unfriend ${friend.displayName}`}
                                            className="text-10 text-muted-foreground font-body mt-1 cursor-pointer rounded-[2px] border border-transparent px-2 py-0.5 font-medium transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                                        >
                                            unfriend
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => setSearchOpen(true)}
                                    className="group flex w-20 shrink-0 cursor-pointer flex-col items-center text-center focus-visible:outline-2"
                                >
                                    <div className="border-line hover:border-foreground bg-faint/40 text-muted-foreground hover:text-foreground mb-2 flex size-16 shrink-0 items-center justify-center rounded-full border border-dashed transition-all duration-150 group-hover:scale-105">
                                        <Plus size={22} strokeWidth={1.5} />
                                    </div>
                                    <span className="text-12 text-muted-foreground group-hover:text-foreground font-medium">
                                        add friends
                                    </span>
                                </button>
                            </div>
                        )}
                    </section>
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
            <FindFriendsDialog
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
                onFriendAdded={() => {
                    void loadFriends()
                        .then(setFriends)
                        .catch(() => {
                            setSectionErrors((prev) =>
                                prev.includes("Travel pals could not be loaded.")
                                    ? prev
                                    : [...prev, "Travel pals could not be loaded."]
                            );
                        });
                }}
            />
            {confirmUnfriendTarget && (
                <ConfirmDialog
                    title={`Unfriend ${confirmUnfriendTarget.displayName}?`}
                    description={`Are you sure you want to remove @${confirmUnfriendTarget.username} from your friends? You will no longer see each other's friends-only boards.`}
                    confirmLabel="Unfriend"
                    error={unfriendError}
                    loading={unfriendLoading}
                    onCancel={() => {
                        setConfirmUnfriendTarget(null);
                        setUnfriendError(null);
                    }}
                    onConfirm={async () => {
                        const target = confirmUnfriendTarget;
                        setUnfriendLoading(true);
                        setUnfriendError(null);
                        try {
                            await removeFriend(target.userId);
                            setFriends((prev) => prev.filter((f) => f.userId !== target.userId));
                            setStats((prev) => (prev ? { ...prev, friends: Math.max(0, prev.friends - 1) } : null));
                            setConfirmUnfriendTarget(null);
                        } catch (caught) {
                            setUnfriendError(
                                caught instanceof Error
                                    ? caught.message
                                    : `Failed to remove ${target.displayName} from friends.`
                            );
                        } finally {
                            setUnfriendLoading(false);
                        }
                    }}
                />
            )}
        </div>
    );
}
