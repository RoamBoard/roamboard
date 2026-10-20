"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, UserRound, ArrowRight, Layers, Compass } from "lucide-react";
import UnderlineTabs from "@/components/ui/UnderlineTabs";
import FindFriendsDialog from "./FindFriendsDialog";
import {
    loadFriends,
    loadFriendsBoards,
    loadFriendsActivity,
    type FriendUser,
    type FriendBoardSummary,
    type FriendActivityItem,
    ProfileApiError
} from "@/lib/profile";

function requiresLogin(error: unknown): boolean {
    return error instanceof ProfileApiError && error.status === 401;
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RailFriendAvatar({ friend }: { friend: FriendUser }) {
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

function FeedItemAvatar({ owner }: { owner: FriendActivityItem["owner"] }) {
    const [failed, setFailed] = useState(false);
    if (owner.profilePictureUrl && !failed) {
        return (
            <Image
                src={owner.profilePictureUrl}
                alt=""
                width={36}
                height={36}
                unoptimized
                className="size-9 rounded-full object-cover"
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full">
            <UserRound size={18} strokeWidth={1.5} />
        </div>
    );
}

function FeedCoverImage({ url }: { url: string }) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return <Image src={url} alt="" fill unoptimized className="object-cover" onError={() => setFailed(true)} />;
}

function BoardCardCover({ url }: { url: string | null }) {
    const [failed, setFailed] = useState(false);
    if (url && !failed) {
        return (
            <Image
                src={url}
                alt=""
                fill
                unoptimized
                className="object-cover transition-transform duration-200 group-hover:scale-102"
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <div className="text-muted-foreground text-12 flex h-full items-center justify-center font-medium">
            No cover photo
        </div>
    );
}

export type SocialFriendsContentProps = {
    initialFriends?: FriendUser[];
    initialBoards?: FriendBoardSummary[];
    initialActivities?: FriendActivityItem[];
    initialFriendsError?: string | null;
    initialBoardsError?: string | null;
    initialActivitiesError?: string | null;
};

export default function SocialFriendsContent({
    initialFriends,
    initialBoards,
    initialActivities,
    initialFriendsError = null,
    initialBoardsError = null,
    initialActivitiesError = null
}: SocialFriendsContentProps) {
    const router = useRouter();
    const [friends, setFriends] = useState<FriendUser[]>(initialFriends ?? []);
    const [boards, setBoards] = useState<FriendBoardSummary[]>(initialBoards ?? []);
    const [activities, setActivities] = useState<FriendActivityItem[]>(initialActivities ?? []);
    const [friendsLoading, setFriendsLoading] = useState(!initialFriends && !initialFriendsError);
    const [boardsLoading, setBoardsLoading] = useState(!initialBoards && !initialBoardsError);
    const [activitiesLoading, setActivitiesLoading] = useState(!initialActivities && !initialActivitiesError);
    const [friendsError, setFriendsError] = useState<string | null>(initialFriendsError);
    const [boardsError, setBoardsError] = useState<string | null>(initialBoardsError);
    const [activitiesError, setActivitiesError] = useState<string | null>(initialActivitiesError);
    const [loginRequired, setLoginRequired] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    // Initial loads, full refreshes, and section retries all compete for the same section data.
    const readVersions = useRef({ friends: 0, boards: 0, activities: 0 });

    const reloadFriends = async () => {
        const readId = ++readVersions.current.friends;
        setFriendsLoading(true);
        setFriendsError(null);
        try {
            const data = await loadFriends();
            if (readId === readVersions.current.friends) setFriends(data);
        } catch (error) {
            if (readId === readVersions.current.friends) {
                if (requiresLogin(error)) setLoginRequired(true);
                else setFriendsError("Failed to load your travel pals.");
            }
        } finally {
            if (readId === readVersions.current.friends) setFriendsLoading(false);
        }
    };

    const reloadBoards = async () => {
        const readId = ++readVersions.current.boards;
        setBoardsLoading(true);
        setBoardsError(null);
        try {
            const data = await loadFriendsBoards(12);
            if (readId === readVersions.current.boards) setBoards(data);
        } catch (error) {
            if (readId === readVersions.current.boards) {
                if (requiresLogin(error)) setLoginRequired(true);
                else setBoardsError("Failed to load friends' boards.");
            }
        } finally {
            if (readId === readVersions.current.boards) setBoardsLoading(false);
        }
    };

    const reloadActivities = async () => {
        const readId = ++readVersions.current.activities;
        setActivitiesLoading(true);
        setActivitiesError(null);
        try {
            const data = await loadFriendsActivity(10);
            if (readId === readVersions.current.activities) setActivities(data);
        } catch (error) {
            if (readId === readVersions.current.activities) {
                if (requiresLogin(error)) setLoginRequired(true);
                else setActivitiesError("Failed to load recent friend activity.");
            }
        } finally {
            if (readId === readVersions.current.activities) setActivitiesLoading(false);
        }
    };

    const refreshData = () => {
        const readIds = {
            friends: ++readVersions.current.friends,
            boards: ++readVersions.current.boards,
            activities: ++readVersions.current.activities
        };
        setFriendsLoading(true);
        setBoardsLoading(true);
        setActivitiesLoading(true);
        setFriendsError(null);
        setBoardsError(null);
        setActivitiesError(null);
        void Promise.allSettled([loadFriends(), loadFriendsBoards(12), loadFriendsActivity(10)])
            .then(([friendsRes, boardsRes, activitiesRes]) => {
                if (readIds.friends === readVersions.current.friends) {
                    if (friendsRes.status === "fulfilled") {
                        setFriends(friendsRes.value);
                    } else if (requiresLogin(friendsRes.reason)) {
                        setLoginRequired(true);
                    } else {
                        setFriendsError("Failed to load your travel pals.");
                    }
                }
                if (readIds.boards === readVersions.current.boards) {
                    if (boardsRes.status === "fulfilled") {
                        setBoards(boardsRes.value);
                    } else if (requiresLogin(boardsRes.reason)) {
                        setLoginRequired(true);
                    } else {
                        setBoardsError("Failed to load friends' boards.");
                    }
                }
                if (readIds.activities === readVersions.current.activities) {
                    if (activitiesRes.status === "fulfilled") {
                        setActivities(activitiesRes.value);
                    } else if (requiresLogin(activitiesRes.reason)) {
                        setLoginRequired(true);
                    } else {
                        setActivitiesError("Failed to load recent friend activity.");
                    }
                }
            })
            .finally(() => {
                if (readIds.friends === readVersions.current.friends) setFriendsLoading(false);
                if (readIds.boards === readVersions.current.boards) setBoardsLoading(false);
                if (readIds.activities === readVersions.current.activities) setActivitiesLoading(false);
            });
    };

    useEffect(() => {
        if (initialFriends || initialFriendsError || initialBoards || initialActivities) return;
        const tracker = { active: true };
        const readIds = {
            friends: ++readVersions.current.friends,
            boards: ++readVersions.current.boards,
            activities: ++readVersions.current.activities
        };
        void Promise.allSettled([loadFriends(), loadFriendsBoards(12), loadFriendsActivity(10)])
            .then(([friendsRes, boardsRes, activitiesRes]) => {
                if (!tracker.active) return;
                if (readIds.friends === readVersions.current.friends) {
                    if (friendsRes.status === "fulfilled") {
                        setFriends(friendsRes.value);
                    } else if (requiresLogin(friendsRes.reason)) {
                        setLoginRequired(true);
                    } else {
                        setFriendsError("Failed to load your travel pals.");
                    }
                }
                if (readIds.boards === readVersions.current.boards) {
                    if (boardsRes.status === "fulfilled") {
                        setBoards(boardsRes.value);
                    } else if (requiresLogin(boardsRes.reason)) {
                        setLoginRequired(true);
                    } else {
                        setBoardsError("Failed to load friends' boards.");
                    }
                }
                if (readIds.activities === readVersions.current.activities) {
                    if (activitiesRes.status === "fulfilled") {
                        setActivities(activitiesRes.value);
                    } else if (requiresLogin(activitiesRes.reason)) {
                        setLoginRequired(true);
                    } else {
                        setActivitiesError("Failed to load recent friend activity.");
                    }
                }
            })
            .finally(() => {
                if (tracker.active) {
                    if (readIds.friends === readVersions.current.friends) setFriendsLoading(false);
                    if (readIds.boards === readVersions.current.boards) setBoardsLoading(false);
                    if (readIds.activities === readVersions.current.activities) setActivitiesLoading(false);
                }
            });
        return () => {
            tracker.active = false;
        };
    }, [initialFriends, initialFriendsError, initialBoards, initialActivities]);

    const handleTabChange = (tab: "ME" | "FRIENDS") => {
        if (tab === "ME") {
            router.push("/profile");
        }
    };

    if (loginRequired) {
        return (
            <div className="relative h-full w-full overflow-y-auto px-4 pt-6 pb-20 sm:px-8 sm:pt-8 md:px-12 md:pt-10 lg:px-16">
                <div className="mx-auto w-full max-w-5xl">
                    <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 mb-10 font-bold tracking-tight uppercase">
                        SOCIAL
                    </h1>
                    <div role="alert" className="border-line bg-background rounded-[2px] border p-8 text-center">
                        <p className="text-14 text-foreground mb-4 font-medium">
                            Sign in to see your friends, their boards, and recent activity.
                        </p>
                        <Link
                            href="/login"
                            className="bg-foreground text-background inline-block rounded-[2px] px-5 py-2 font-medium"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden">
            <div className="h-full w-full overflow-y-auto px-4 pt-6 pb-20 sm:px-8 sm:pt-8 md:px-12 md:pt-10 lg:px-16">
                <div className="mx-auto w-full max-w-5xl pb-20">
                    <header className="mb-10">
                        <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 font-bold tracking-tight uppercase">
                            SOCIAL
                        </h1>
                        <UnderlineTabs
                            tabs={["ME", "FRIENDS"] as const}
                            activeTab="FRIENDS"
                            onChange={handleTabChange}
                            ariaLabel="Audience filter"
                        />
                    </header>

                    {(friendsError || boardsError || activitiesError) && (
                        <div
                            role="alert"
                            className="border-line bg-background text-12 text-muted-foreground mb-8 flex items-center justify-between rounded-[2px] border p-4 font-medium"
                        >
                            <span>{[friendsError, boardsError, activitiesError].filter(Boolean).join(" ")}</span>
                            <button
                                type="button"
                                onClick={refreshData}
                                disabled={friendsLoading || boardsLoading || activitiesLoading}
                                className="text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
                            >
                                {friendsLoading || boardsLoading || activitiesLoading ? "Retrying…" : "Retry all"}
                            </button>
                        </div>
                    )}

                    {/* Section 1: My Friends */}
                    <section aria-label="My friends" className="mb-12">
                        <div className="mb-4 flex items-end justify-between">
                            <div>
                                <h2 className="font-display text-20 sm:text-22 text-foreground font-bold">
                                    my friends
                                </h2>
                                <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                                    keep up with your travel pals
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
                                    href="/friends"
                                    className="text-12 text-muted-foreground hover:text-foreground hover:underline"
                                >
                                    view all ({friends.length}) →
                                </Link>
                            </div>
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
                                    onClick={() => reloadFriends()}
                                    disabled={friendsLoading}
                                    className="text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
                                >
                                    {friendsLoading ? "Retrying…" : "Retry"}
                                </button>
                            </div>
                        ) : friends.length === 0 ? (
                            <div className="border-line bg-background rounded-[2px] border p-8 text-center sm:p-10">
                                <div className="bg-muted text-muted-foreground mx-auto mb-3 flex size-12 items-center justify-center rounded-full">
                                    <UserRound size={22} strokeWidth={1.5} />
                                </div>
                                <h3 className="font-display text-18 text-foreground font-bold">No travel pals yet</h3>
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
                                                <RailFriendAvatar friend={friend} />
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

                                {/* Plus button at the end */}
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

                    {/* Section 2: Two-column layout (recent activity & feeling inspired) */}
                    <div className="border-line mb-12 border-t pt-8">
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                            {/* Left: Recent Activity */}
                            <section aria-label="Recent activity" className="lg:col-span-2">
                                <div className="mb-4">
                                    <h2 className="font-display text-20 sm:text-22 text-foreground font-bold">
                                        recent activity
                                    </h2>
                                    <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                                        what your friends have been up to
                                    </p>
                                </div>

                                {activitiesLoading && activities.length === 0 ? (
                                    <div className="border-line bg-background rounded-[2px] border p-8 text-center">
                                        <p className="text-12 text-muted-foreground font-body">
                                            Loading recent activity…
                                        </p>
                                    </div>
                                ) : activitiesError ? (
                                    <div
                                        role="alert"
                                        className="border-line bg-background text-12 text-muted-foreground rounded-[2px] border p-8 text-center font-medium"
                                    >
                                        <p className="mb-2 text-red-500">{activitiesError}</p>
                                        <button
                                            type="button"
                                            onClick={() => reloadActivities()}
                                            disabled={activitiesLoading}
                                            className="text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
                                        >
                                            {activitiesLoading ? "Retrying…" : "Retry"}
                                        </button>
                                    </div>
                                ) : activities.length === 0 ? (
                                    <div className="border-line bg-background rounded-[2px] border p-8 text-center">
                                        <p className="text-12 text-muted-foreground font-body">
                                            No recent activity yet. When your friends publish boards or share trips,
                                            their updates will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="flex flex-col gap-3">
                                        {activities.map((item) => (
                                            <li
                                                key={`${item.activityType}-${item.boardId}-${item.timestamp}`}
                                                className="border-line bg-background hover:bg-faint/30 flex items-center justify-between gap-4 rounded-[2px] border p-3.5 transition-colors"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Link
                                                        href={`/profile/${encodeURIComponent(item.owner.username)}`}
                                                        className="shrink-0"
                                                    >
                                                        <FeedItemAvatar owner={item.owner} />
                                                    </Link>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-12 text-foreground truncate font-medium">
                                                            <Link
                                                                href={`/profile/${encodeURIComponent(item.owner.username)}`}
                                                                className="font-bold hover:underline"
                                                            >
                                                                {item.owner.displayName}
                                                            </Link>{" "}
                                                            published a new board{" "}
                                                            <Link
                                                                href={`/boards/${item.boardId}`}
                                                                className="text-foreground underline decoration-1 underline-offset-2 hover:opacity-80"
                                                            >
                                                                {item.title}
                                                            </Link>
                                                        </p>
                                                        <span className="text-10 text-muted-foreground block">
                                                            {formatRelativeTime(item.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {item.coverImageUrl && (
                                                    <Link
                                                        href={`/boards/${item.boardId}`}
                                                        className="border-line relative size-12 shrink-0 overflow-hidden rounded-[2px] border"
                                                    >
                                                        <FeedCoverImage url={item.coverImageUrl} />
                                                    </Link>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            {/* Right: Feeling Inspired? */}
                            <section aria-label="Feeling inspired" className="lg:col-span-1">
                                <div className="mb-4">
                                    <h2 className="font-display text-20 sm:text-22 text-foreground font-bold">
                                        feeling inspired?
                                    </h2>
                                    <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                                        actions with your travel pals
                                    </p>
                                </div>

                                <div className="border-line bg-background divide-line flex flex-col divide-y rounded-[2px] border">
                                    <Link
                                        href="/create"
                                        className="hover:bg-faint/50 flex items-center justify-between p-4 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Plus size={16} strokeWidth={1.5} className="text-muted-foreground" />
                                            <span className="font-body text-12 text-foreground font-medium">
                                                create new board
                                            </span>
                                        </div>
                                        <ArrowRight size={14} strokeWidth={1.5} className="text-muted-foreground" />
                                    </Link>

                                    <Link
                                        href="/boards"
                                        className="hover:bg-faint/50 flex items-center justify-between p-4 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Layers size={16} strokeWidth={1.5} className="text-muted-foreground" />
                                            <span className="font-body text-12 text-foreground font-medium">
                                                explore boards
                                            </span>
                                        </div>
                                        <ArrowRight size={14} strokeWidth={1.5} className="text-muted-foreground" />
                                    </Link>

                                    <Link
                                        href="/discover"
                                        className="hover:bg-faint/50 flex items-center justify-between p-4 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Compass size={16} strokeWidth={1.5} className="text-muted-foreground" />
                                            <span className="font-body text-12 text-foreground font-medium">
                                                explore destinations
                                            </span>
                                        </div>
                                        <ArrowRight size={14} strokeWidth={1.5} className="text-muted-foreground" />
                                    </Link>
                                </div>
                            </section>
                        </div>
                    </div>

                    {/* Section 3: Friends' Boards */}
                    <section aria-label="Friends' boards" className="border-line border-t pt-8">
                        <div className="mb-6 flex items-end justify-between">
                            <div>
                                <h2 className="font-display text-20 sm:text-22 text-foreground font-bold">
                                    friends&apos; boards
                                </h2>
                                <p className="text-12 text-muted-foreground mt-0.5 font-medium">
                                    boards created by your friends
                                </p>
                            </div>
                        </div>

                        {boardsLoading && boards.length === 0 ? (
                            <div className="border-line bg-background rounded-[2px] border p-8 text-center">
                                <p className="text-12 text-muted-foreground font-body">Loading friends&apos; boards…</p>
                            </div>
                        ) : boardsError ? (
                            <div
                                role="alert"
                                className="border-line bg-background text-12 text-muted-foreground rounded-[2px] border p-8 text-center font-medium"
                            >
                                <p className="mb-2 text-red-500">{boardsError}</p>
                                <button
                                    type="button"
                                    onClick={() => reloadBoards()}
                                    disabled={boardsLoading}
                                    className="text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
                                >
                                    {boardsLoading ? "Retrying…" : "Retry"}
                                </button>
                            </div>
                        ) : boards.length === 0 ? (
                            <div className="border-line bg-background rounded-[2px] border p-8 text-center">
                                <p className="text-12 text-muted-foreground font-body">
                                    No friends&apos; boards yet. When your friends publish boards, they will appear
                                    here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {boards.map((board) => (
                                    <Link
                                        key={board.boardId}
                                        href={`/boards/${board.boardId}`}
                                        className="border-line bg-background hover:border-foreground group block overflow-hidden rounded-[2px] border transition-colors"
                                    >
                                        <div className="bg-faint relative aspect-[4/3] w-full">
                                            <BoardCardCover url={board.coverImageUrl} />
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-display text-16 text-foreground truncate font-bold">
                                                {board.title}
                                            </h3>
                                            <p className="text-12 text-muted-foreground mt-1 truncate">
                                                by {board.owner.displayName}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <FindFriendsDialog open={searchOpen} onClose={() => setSearchOpen(false)} onFriendAdded={refreshData} />
        </div>
    );
}
