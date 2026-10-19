"use client";

import { useId, useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, UserRound, Plus, LayoutGrid, List, X, ArrowRight, UserMinus } from "lucide-react";
import BackLink from "@/components/ui/BackLink";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import FindFriendsDialog from "@/components/features/social/FindFriendsDialog";
import { loadFriends, removeFriend, ProfileApiError, type FriendUser } from "@/lib/profile";

type SortOption = "name-asc" | "name-desc" | "recent";
type ViewMode = "grid" | "list";

export type FriendsPageContentProps = {
    initialFriends?: FriendUser[];
    initialLoading?: boolean;
    initialError?: string | null;
    initialConfirmUnfriendTarget?: FriendUser | null;
};

function requiresLogin(error: unknown): boolean {
    return error instanceof ProfileApiError && error.status === 401;
}

function FriendAvatar({ friend, size = 64 }: { friend: FriendUser; size?: number }) {
    const [failed, setFailed] = useState(false);
    if (friend.profilePictureUrl && !failed) {
        return (
            <Image
                src={friend.profilePictureUrl}
                alt=""
                width={size}
                height={size}
                unoptimized
                className="size-full object-cover"
                onError={() => setFailed(true)}
            />
        );
    }
    const iconSize = size <= 48 ? 20 : 28;
    return <UserRound size={iconSize} strokeWidth={1.5} className="text-muted-foreground" />;
}

export default function FriendsPageContent({
    initialFriends,
    initialLoading,
    initialError = null,
    initialConfirmUnfriendTarget = null
}: FriendsPageContentProps = {}) {
    const searchInputId = useId();
    const sortSelectId = useId();

    const readVersionRef = useRef(0);
    const confirmedRemovalsRef = useRef<Map<string, number>>(new Map());

    const [friends, setFriends] = useState<FriendUser[]>(initialFriends ?? []);
    const [loading, setLoading] = useState(initialLoading ?? (!initialFriends && !initialError));
    const [error, setError] = useState<string | null>(initialError);
    const [loginRequired, setLoginRequired] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [sortOption, setSortOption] = useState<SortOption>("name-asc");
    const [viewMode, setViewMode] = useState<ViewMode>("grid");

    const [searchOpen, setSearchOpen] = useState(false);
    const [confirmUnfriendTarget, setConfirmUnfriendTarget] = useState<FriendUser | null>(initialConfirmUnfriendTarget);
    const [unfriendLoading, setUnfriendLoading] = useState(false);
    const [unfriendError, setUnfriendError] = useState<string | null>(null);

    const filterFriends = (data: FriendUser[], readId: number) =>
        data.filter((f) => {
            const removedAtReadId = confirmedRemovalsRef.current.get(f.userId);
            return removedAtReadId === undefined || readId > removedAtReadId;
        });

    const fetchFriends = async () => {
        const readId = ++readVersionRef.current;
        setLoading(true);
        setError(null);
        try {
            const data = await loadFriends();
            if (readId === readVersionRef.current) {
                setError(null);
                setFriends(filterFriends(data, readId));
            }
        } catch (err) {
            if (readId === readVersionRef.current) {
                if (requiresLogin(err)) {
                    setLoginRequired(true);
                } else {
                    setError(err instanceof Error ? err.message : "Failed to load your travel pals.");
                }
            }
        } finally {
            if (readId === readVersionRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        if (initialFriends || initialError) return;
        const readId = ++readVersionRef.current;
        const tracker = { active: true };
        void loadFriends()
            .then((data) => {
                if (tracker.active && readId === readVersionRef.current) {
                    setError(null);
                    setFriends(filterFriends(data, readId));
                }
            })
            .catch((err) => {
                if (!tracker.active || readId !== readVersionRef.current) return;
                if (requiresLogin(err)) {
                    setLoginRequired(true);
                } else {
                    setError(err instanceof Error ? err.message : "Failed to load your travel pals.");
                }
            })
            .finally(() => {
                if (tracker.active && readId === readVersionRef.current) {
                    setLoading(false);
                }
            });
        return () => {
            tracker.active = false;
        };
    }, [initialFriends, initialError]);

    const filteredAndSortedFriends = useMemo(() => {
        const query = searchQuery.trim().toLowerCase().replace(/^@+/, "");
        const matched = query
            ? friends.filter(
                  (f) =>
                      f.displayName.toLowerCase().includes(query) ||
                      f.username.toLowerCase().includes(query) ||
                      (f.location && f.location.toLowerCase().includes(query))
              )
            : friends;

        const sorted = [...matched];
        if (sortOption === "name-asc") {
            sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
        } else if (sortOption === "name-desc") {
            sorted.sort((a, b) => b.displayName.localeCompare(a.displayName));
        } else if (sortOption === "recent") {
            sorted.sort((a, b) => {
                if (a.acceptedAt && b.acceptedAt) {
                    const timeDiff = new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime();
                    if (timeDiff !== 0) return timeDiff;
                } else if (a.acceptedAt) {
                    return -1;
                } else if (b.acceptedAt) {
                    return 1;
                }
                const idA = a.friendshipId ?? 0;
                const idB = b.friendshipId ?? 0;
                return idB - idA;
            });
        }

        return sorted;
    }, [friends, searchQuery, sortOption]);

    const handleConfirmUnfriend = async () => {
        if (!confirmUnfriendTarget) return;
        const target = confirmUnfriendTarget;
        setUnfriendLoading(true);
        setUnfriendError(null);
        try {
            await removeFriend(target.userId);
            confirmedRemovalsRef.current.set(target.userId, readVersionRef.current);
            setFriends((prev) => prev.filter((f) => f.userId !== target.userId));
            setConfirmUnfriendTarget(null);
        } catch (err) {
            setUnfriendError(
                err instanceof Error ? err.message : `Failed to remove ${target.displayName} from friends.`
            );
        } finally {
            setUnfriendLoading(false);
        }
    };

    if (loginRequired) {
        return (
            <div className="relative h-full w-full overflow-y-auto px-4 pt-6 pb-20 sm:px-8 sm:pt-8 md:px-12 md:pt-10 lg:px-16">
                <div className="mx-auto w-full max-w-5xl">
                    <BackLink fallbackHref="/social" className="mb-6" />
                    <h1 className="font-display text-48 sm:text-60 text-foreground mt-1 mb-8 font-bold tracking-tight uppercase">
                        FRIENDS
                    </h1>
                    <div role="alert" className="border-line bg-background rounded-[2px] border p-8 text-center">
                        <p className="text-14 text-foreground mb-4 font-medium">
                            Sign in to see and manage all your travel pals.
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
                    <BackLink fallbackHref="/social" className="mb-6" />

                    {/* Page Header */}
                    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                                ALL FRIENDS
                            </span>
                            <h1 className="font-display text-36 sm:text-48 text-foreground mt-1 font-bold tracking-tight">
                                my friends {!loading && `(${friends.length})`}
                            </h1>
                            <p className="text-14 text-muted-foreground mt-1 font-medium">
                                fellow travelers you&apos;re connected with
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSearchOpen(true)}
                                className="bg-foreground text-background font-body text-12 inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] px-4 py-2 font-medium transition-opacity hover:opacity-90"
                            >
                                <Plus size={14} strokeWidth={2} /> Find Friends
                            </button>

                            {/* View Mode Toggle */}
                            <div
                                role="group"
                                aria-label="View mode"
                                className="border-line bg-background flex items-center rounded-[2px] border p-0.5"
                            >
                                <button
                                    type="button"
                                    aria-label="Grid view"
                                    aria-pressed={viewMode === "grid"}
                                    onClick={() => setViewMode("grid")}
                                    className={`flex size-8 cursor-pointer items-center justify-center rounded-[2px] transition-colors ${
                                        viewMode === "grid"
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <LayoutGrid size={16} strokeWidth={1.5} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="List view"
                                    aria-pressed={viewMode === "list"}
                                    onClick={() => setViewMode("list")}
                                    className={`flex size-8 cursor-pointer items-center justify-center rounded-[2px] transition-colors ${
                                        viewMode === "list"
                                            ? "bg-foreground text-background"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <List size={16} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="border-line bg-background mb-8 flex flex-col gap-4 rounded-[2px] border p-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <label htmlFor={searchInputId} className="sr-only">
                                Search friends
                            </label>
                            <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center">
                                <Search size={16} strokeWidth={1.5} />
                            </div>
                            <input
                                id={searchInputId}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, @handle, or location…"
                                className="border-line bg-background text-14 text-foreground placeholder:text-muted-foreground focus:border-foreground w-full rounded-[2px] border py-2 pr-9 pl-9 transition-colors outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => setSearchQuery("")}
                                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-3 flex items-center"
                                >
                                    <X size={14} strokeWidth={1.5} />
                                </button>
                            )}
                        </div>

                        {/* Sort Selector */}
                        <div className="flex items-center gap-2">
                            <label
                                htmlFor={sortSelectId}
                                className="text-12 text-muted-foreground shrink-0 font-medium"
                            >
                                Sort by:
                            </label>
                            <select
                                id={sortSelectId}
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value as SortOption)}
                                aria-label="Sort friends"
                                className="border-line bg-background text-12 text-foreground focus:border-foreground cursor-pointer rounded-[2px] border px-3 py-2 transition-colors outline-none"
                            >
                                <option value="name-asc">Alphabetical (A–Z)</option>
                                <option value="name-desc">Alphabetical (Z–A)</option>
                                <option value="recent">Recently added</option>
                            </select>
                        </div>
                    </div>

                    {/* Active filter count indicator */}
                    {searchQuery.trim() && (
                        <p className="text-12 text-muted-foreground mb-4 font-medium">
                            Showing {filteredAndSortedFriends.length} of {friends.length} travel pals
                        </p>
                    )}

                    {/* Main Content States */}
                    {loading && friends.length === 0 ? (
                        <div className="border-line bg-background rounded-[2px] border p-12 text-center">
                            <p className="text-14 text-muted-foreground font-body">Loading travel pals…</p>
                        </div>
                    ) : error ? (
                        <div
                            role="alert"
                            className="border-line bg-background text-12 text-muted-foreground rounded-[2px] border p-8 text-center font-medium"
                        >
                            <p className="mb-2 text-red-500">{error}</p>
                            <button
                                type="button"
                                onClick={fetchFriends}
                                disabled={loading}
                                className="text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80 disabled:opacity-50"
                            >
                                {loading ? "Retrying…" : "Retry"}
                            </button>
                        </div>
                    ) : friends.length === 0 ? (
                        <div className="border-line bg-background rounded-[2px] border p-10 text-center sm:p-14">
                            <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
                                <UserRound size={26} strokeWidth={1.5} />
                            </div>
                            <h2 className="font-display text-20 text-foreground font-bold">No travel pals yet</h2>
                            <p className="text-14 text-muted-foreground mx-auto mt-2 max-w-md font-medium">
                                Connect with other travelers on Roamboard to view their shared boards, follow their
                                adventures, and plan trips together.
                            </p>
                            <button
                                type="button"
                                onClick={() => setSearchOpen(true)}
                                className="bg-foreground text-background font-body text-12 mt-6 inline-flex cursor-pointer items-center gap-1.5 rounded-[2px] px-5 py-2.5 font-medium transition-opacity hover:opacity-90"
                            >
                                <Plus size={14} strokeWidth={2} /> Find Friends
                            </button>
                        </div>
                    ) : filteredAndSortedFriends.length === 0 ? (
                        <div className="border-line bg-background rounded-[2px] border p-10 text-center">
                            <p className="text-14 text-foreground font-medium">
                                No friends match &quot;{searchQuery}&quot;
                            </p>
                            <p className="text-12 text-muted-foreground mt-1">
                                Try searching with a different name or @handle.
                            </p>
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="text-foreground text-12 font-body mt-4 inline-block cursor-pointer font-medium underline underline-offset-4 hover:opacity-80"
                            >
                                Clear search
                            </button>
                        </div>
                    ) : viewMode === "grid" ? (
                        /* Grid View */
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {filteredAndSortedFriends.map((friend) => (
                                <div
                                    key={friend.userId}
                                    className="border-line bg-background hover:border-foreground group flex flex-col justify-between rounded-[2px] border p-5 transition-colors"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-3">
                                            <Link
                                                href={`/profile/${encodeURIComponent(friend.username)}`}
                                                aria-label={`${friend.displayName}'s profile`}
                                                className="border-line bg-muted relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-transform duration-150 group-hover:scale-105"
                                            >
                                                <FriendAvatar friend={friend} size={56} />
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmUnfriendTarget(friend)}
                                                aria-label={`Unfriend ${friend.displayName}`}
                                                title={`Unfriend ${friend.displayName}`}
                                                className="text-muted-foreground font-body cursor-pointer rounded-[2px] border border-transparent p-1.5 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                                            >
                                                <UserMinus size={16} strokeWidth={1.5} />
                                            </button>
                                        </div>

                                        <div className="mt-3 min-w-0">
                                            <Link
                                                href={`/profile/${encodeURIComponent(friend.username)}`}
                                                className="block"
                                            >
                                                <h3 className="font-display text-16 text-foreground truncate font-bold group-hover:underline">
                                                    {friend.displayName}
                                                </h3>
                                                <p className="text-12 text-muted-foreground truncate">
                                                    @{friend.username}
                                                </p>
                                            </Link>
                                            {friend.location && (
                                                <p className="text-12 text-muted-foreground mt-2 truncate">
                                                    📍 {friend.location}
                                                </p>
                                            )}
                                            {friend.bio && (
                                                <p className="text-12 text-muted-foreground mt-1 line-clamp-2">
                                                    {friend.bio}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="border-line mt-4 border-t pt-3">
                                        <Link
                                            href={`/profile/${encodeURIComponent(friend.username)}`}
                                            className="text-12 text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium hover:underline"
                                        >
                                            profile &amp; boards <ArrowRight size={12} strokeWidth={1.5} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* List View */
                        <div className="border-line divide-line bg-background divide-y rounded-[2px] border">
                            {filteredAndSortedFriends.map((friend) => (
                                <div
                                    key={friend.userId}
                                    className="hover:bg-faint/30 flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex min-w-0 items-center gap-3.5">
                                        <Link
                                            href={`/profile/${encodeURIComponent(friend.username)}`}
                                            aria-label={`${friend.displayName}'s profile`}
                                            className="border-line bg-muted relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border transition-transform duration-150 hover:scale-105"
                                        >
                                            <FriendAvatar friend={friend} size={44} />
                                        </Link>
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={`/profile/${encodeURIComponent(friend.username)}`}
                                                className="flex flex-wrap items-baseline gap-x-2"
                                            >
                                                <span className="font-display text-15 text-foreground truncate font-bold hover:underline">
                                                    {friend.displayName}
                                                </span>
                                                <span className="text-12 text-muted-foreground truncate">
                                                    @{friend.username}
                                                </span>
                                            </Link>
                                            {(friend.location || friend.bio) && (
                                                <p className="text-12 text-muted-foreground truncate">
                                                    {friend.location ? `📍 ${friend.location} • ` : ""}
                                                    {friend.bio || ""}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">
                                        <Link
                                            href={`/profile/${encodeURIComponent(friend.username)}`}
                                            className="border-line text-12 text-foreground hover:bg-faint inline-flex items-center gap-1 rounded-[2px] border px-3 py-1.5 font-medium transition-colors"
                                        >
                                            profile &amp; boards <ArrowRight size={12} strokeWidth={1.5} />
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmUnfriendTarget(friend)}
                                            aria-label={`Unfriend ${friend.displayName}`}
                                            className="text-12 text-muted-foreground cursor-pointer rounded-[2px] border border-transparent px-2.5 py-1.5 font-medium transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                                        >
                                            unfriend
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Unfriend Confirmation Modal */}
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
                    onConfirm={handleConfirmUnfriend}
                />
            )}

            {/* Global User Discovery Modal */}
            <FindFriendsDialog open={searchOpen} onClose={() => setSearchOpen(false)} onFriendAdded={fetchFriends} />
        </div>
    );
}
