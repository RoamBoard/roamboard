"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, UserRound, X, Check, Clock } from "lucide-react";
import {
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    type UserSearchResult
} from "@/lib/profile";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export type FindFriendsDialogProps = {
    open: boolean;
    onClose: () => void;
    onFriendAdded?: () => void;
    initialResults?: UserSearchResult[];
    initialConfirmUnfriendUser?: UserSearchResult | null;
    initialError?: string | null;
    onResultsChange?: (results: UserSearchResult[]) => void;
    onErrorChange?: (error: string | null) => void;
    onUnfriendErrorChange?: (error: string | null) => void;
};

export default function FindFriendsDialog({
    open,
    onClose,
    onFriendAdded,
    initialResults,
    initialConfirmUnfriendUser = null,
    initialError = null,
    onResultsChange,
    onErrorChange,
    onUnfriendErrorChange
}: FindFriendsDialogProps) {
    const [query, setQuery] = useState("");
    const currentQueryRef = useRef(query);
    const [results, setResults] = useState<UserSearchResult[]>(initialResults ?? []);
    const resultsRef = useRef<UserSearchResult[]>(initialResults ?? []);

    useEffect(() => {
        resultsRef.current = results;
    }, [results]);

    const searchVersionRef = useRef(0);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const confirmedFriendshipsRef = useRef<
        Record<string, { friendshipStatus: UserSearchResult["friendshipStatus"]; requestId?: number }>
    >({});

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(initialError);
    const [actionState, setActionState] = useState<Record<string, "pending" | "done">>({});
    const [confirmUnfriendUser, setConfirmUnfriendUser] = useState<UserSearchResult | null>(initialConfirmUnfriendUser);
    const [unfriendError, setUnfriendError] = useState<string | null>(null);
    const [unfriendLoading, setUnfriendLoading] = useState(false);
    const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
    const [searchRetry, setSearchRetry] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    const handleClose = useCallback(() => {
        searchVersionRef.current += 1;
        currentQueryRef.current = "";
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        confirmedFriendshipsRef.current = {};
        setQuery("");
        resultsRef.current = initialResults ?? [];
        setResults(initialResults ?? []);
        onResultsChange?.(initialResults ?? []);
        setError(null);
        onErrorChange?.(null);
        setSearchRetry(0);
        setUnfriendError(null);
        onUnfriendErrorChange?.(null);
        setUnfriendLoading(false);
        setActionState({});
        setFailedAvatars({});
        onClose();
    }, [initialResults, onClose, onErrorChange, onResultsChange, onUnfriendErrorChange]);

    useDialogFocus(dialogRef, handleClose, open && confirmUnfriendUser === null);

    useEffect(() => {
        if (!open) {
            searchVersionRef.current += 1;
            currentQueryRef.current = "";
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            confirmedFriendshipsRef.current = {};
        }
    }, [open]);

    useEffect(() => {
        return () => {
            searchVersionRef.current += 1;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            confirmedFriendshipsRef.current = {};
        };
    }, []);

    const handleQueryChange = (val: string) => {
        searchVersionRef.current += 1;
        currentQueryRef.current = val;
        setQuery(val);
        setError(null);
        onErrorChange?.(null);
    };

    const executeSearch = useCallback(
        async (searchQuery: string) => {
            const searchId = ++searchVersionRef.current;
            currentQueryRef.current = searchQuery;
            const trimmed = searchQuery.trim();
            setLoading(true);
            setError(null);
            onErrorChange?.(null);
            try {
                const data = await searchUsers(trimmed);
                if (searchId === searchVersionRef.current && trimmed === currentQueryRef.current.trim()) {
                    const merged = data.map((u) => {
                        const confirmed = confirmedFriendshipsRef.current[u.userId];
                        if (confirmed) {
                            return {
                                ...u,
                                friendshipStatus: confirmed.friendshipStatus,
                                requestId:
                                    confirmed.requestId ??
                                    (confirmed.friendshipStatus === "none" ? undefined : u.requestId)
                            };
                        }
                        return u;
                    });
                    resultsRef.current = merged;
                    setResults(merged);
                    onResultsChange?.(merged);
                }
            } catch (caught) {
                if (searchId === searchVersionRef.current && trimmed === currentQueryRef.current.trim()) {
                    const message =
                        caught instanceof Error ? caught.message : "Failed to search users. Please try again.";
                    setError(message);
                    onErrorChange?.(message);
                }
            } finally {
                if (searchId === searchVersionRef.current && trimmed === currentQueryRef.current.trim()) {
                    setLoading(false);
                }
            }
        },
        [onErrorChange, onResultsChange]
    );

    useEffect(() => {
        if (!open) return;
        if (initialResults && !query.trim() && searchRetry === 0) return;
        const trimmed = query.trim();
        const handle = setTimeout(
            () => {
                void executeSearch(trimmed);
            },
            trimmed ? 250 : 0
        );
        debounceTimerRef.current = handle;

        return () => {
            clearTimeout(handle);
            debounceTimerRef.current = null;
        };
    }, [query, open, initialResults, searchRetry, executeSearch]);

    if (!open) return null;

    const handleSendRequest = async (handle: string, userId: string) => {
        setActionState((prev) => ({ ...prev, [userId]: "pending" }));
        setError(null);
        onErrorChange?.(null);
        try {
            const result = await sendFriendRequest(handle);
            confirmedFriendshipsRef.current[userId] = {
                friendshipStatus: result.status,
                requestId: result.requestId
            };
            setActionState((prev) => ({ ...prev, [userId]: "done" }));
            const next: UserSearchResult[] = resultsRef.current.map((u): UserSearchResult =>
                u.userId === userId ? { ...u, friendshipStatus: result.status, requestId: result.requestId } : u
            );
            resultsRef.current = next;
            setResults(next);
            onResultsChange?.(next);
            onFriendAdded?.();
        } catch (caught) {
            const message =
                caught instanceof Error ? caught.message : "Could not send friend request. Please try again.";
            setError(message);
            onErrorChange?.(message);
            setActionState((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        }
    };

    const handleAcceptRequest = async (requestId: number, userId: string) => {
        setActionState((prev) => ({ ...prev, [userId]: "pending" }));
        setError(null);
        onErrorChange?.(null);
        try {
            await acceptFriendRequest(requestId);
            confirmedFriendshipsRef.current[userId] = {
                friendshipStatus: "accepted",
                requestId: undefined
            };
            setActionState((prev) => ({ ...prev, [userId]: "done" }));
            const next: UserSearchResult[] = resultsRef.current.map((u): UserSearchResult =>
                u.userId === userId ? { ...u, friendshipStatus: "accepted", requestId: undefined } : u
            );
            resultsRef.current = next;
            setResults(next);
            onResultsChange?.(next);
            onFriendAdded?.();
        } catch {
            const message = "Could not accept friend request. Please try again.";
            setError(message);
            onErrorChange?.(message);
            setActionState((prev) => {
                const next = { ...prev };
                delete next[userId];
                return next;
            });
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Find travelers"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
            <div
                ref={dialogRef}
                className="bg-background border-line text-foreground flex w-full max-w-lg flex-col rounded-[2px] border shadow-2xl"
            >
                <div className="border-line flex items-center justify-between border-b px-5 py-4">
                    <div>
                        <span className="text-10 tracking-label text-muted-foreground block font-bold uppercase">
                            COMMUNITY
                        </span>
                        <h2 className="font-display text-20 text-foreground font-bold">Find Travelers</h2>
                    </div>
                    <button
                        type="button"
                        aria-label="Close dialog"
                        onClick={handleClose}
                        className="text-muted-foreground hover:text-foreground grid size-9 cursor-pointer place-items-center rounded-[2px] transition-colors focus-visible:outline-2"
                    >
                        <X size={18} strokeWidth={1.5} />
                    </button>
                </div>

                <div className="border-line border-b p-4">
                    <div className="border-line bg-faint/50 flex items-center gap-2.5 rounded-[2px] border px-3 py-2">
                        <Search size={18} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => handleQueryChange(e.target.value)}
                            onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (debounceTimerRef.current) {
                                        clearTimeout(debounceTimerRef.current);
                                        debounceTimerRef.current = null;
                                    }
                                    const targetValue = (e.target as HTMLInputElement | null)?.value ?? query;
                                    await executeSearch(targetValue);
                                }
                            }}
                            placeholder="Search by name or @handle…"
                            aria-label="Search travelers"
                            className="font-body text-14 text-foreground placeholder:text-muted-foreground/60 w-full bg-transparent focus:outline-none"
                        />
                        {query && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => handleQueryChange("")}
                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                                <X size={16} strokeWidth={1.5} />
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="text-12 border-b border-red-500/20 bg-red-500/10 px-5 py-2.5 font-medium text-red-500"
                    >
                        {error}
                    </div>
                )}

                <div className="max-h-80 min-h-36 overflow-y-auto overscroll-contain p-3">
                    {loading ? (
                        <p className="text-12 text-muted-foreground font-body py-8 text-center">
                            {query.trim() ? "Searching travelers…" : "Loading travelers…"}
                        </p>
                    ) : error && results.length === 0 ? (
                        <div role="alert" className="py-8 text-center">
                            <p className="text-12 font-body mb-2 text-red-500">{error}</p>
                            <button
                                type="button"
                                onClick={() => {
                                    if (debounceTimerRef.current) {
                                        clearTimeout(debounceTimerRef.current);
                                        debounceTimerRef.current = null;
                                    }
                                    void executeSearch(query);
                                }}
                                className="text-12 text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80"
                            >
                                Retry search
                            </button>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-12 text-muted-foreground font-body">
                                {query.trim()
                                    ? `No travelers found matching “${query}”.`
                                    : "No other travelers found yet."}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div className="border-line mb-2 flex items-center justify-between border-b px-1 pb-1.5">
                                <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                                    {query.trim()
                                        ? `Search Results (${results.length})`
                                        : `Suggested Travelers (${results.length})`}
                                </span>
                            </div>
                            <ul className="flex flex-col gap-2">
                                {results.map((user) => {
                                    const isActing = actionState[user.userId] === "pending";
                                    return (
                                        <li
                                            key={user.userId}
                                            className="border-line bg-faint/30 flex items-center justify-between gap-3 rounded-[2px] border p-3 transition-colors"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                {user.profilePictureUrl && !failedAvatars[user.userId] ? (
                                                    <Image
                                                        src={user.profilePictureUrl}
                                                        alt=""
                                                        width={36}
                                                        height={36}
                                                        unoptimized
                                                        onError={() =>
                                                            setFailedAvatars((prev) => ({
                                                                ...prev,
                                                                [user.userId]: true
                                                            }))
                                                        }
                                                        className="size-9 shrink-0 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                                                        <UserRound size={18} strokeWidth={1.5} />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={`/profile/${encodeURIComponent(user.username)}`}
                                                        onClick={onClose}
                                                        className="text-12 text-foreground block truncate font-medium hover:underline"
                                                    >
                                                        {user.displayName}
                                                    </Link>
                                                    <span className="text-10 text-muted-foreground block truncate">
                                                        @{user.username}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="shrink-0">
                                                {user.friendshipStatus === "accepted" ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="border-line text-10 text-muted-foreground inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 font-medium">
                                                            <Check size={12} strokeWidth={2} /> friends
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={isActing}
                                                            onClick={() => setConfirmUnfriendUser(user)}
                                                            className="text-10 text-muted-foreground font-body cursor-pointer rounded-[2px] border border-transparent px-2 py-0.5 font-medium transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                                                        >
                                                            unfriend
                                                        </button>
                                                    </div>
                                                ) : user.friendshipStatus === "pending_sent" ? (
                                                    <span className="border-line text-10 text-muted-foreground inline-flex items-center gap-1 rounded-[2px] border px-2.5 py-1 font-medium">
                                                        <Clock size={12} strokeWidth={1.5} /> request sent
                                                    </span>
                                                ) : user.friendshipStatus === "pending_received" && user.requestId ? (
                                                    <button
                                                        type="button"
                                                        disabled={isActing}
                                                        onClick={() =>
                                                            handleAcceptRequest(user.requestId!, user.userId)
                                                        }
                                                        className="bg-foreground text-background font-body text-10 cursor-pointer rounded-[2px] px-3 py-1 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                                                    >
                                                        {isActing ? "accepting…" : "accept request"}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isActing}
                                                        onClick={() => handleSendRequest(user.username, user.userId)}
                                                        className="bg-foreground text-background font-body text-10 cursor-pointer rounded-[2px] px-3 py-1 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                                                    >
                                                        {isActing ? "adding…" : "+ add friend"}
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="border-line flex justify-end border-t px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="border-line text-12 text-muted-foreground hover:text-foreground font-body cursor-pointer rounded-[2px] border px-4 py-1.5 font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>

            {confirmUnfriendUser && (
                <ConfirmDialog
                    title={`Unfriend ${confirmUnfriendUser.displayName}?`}
                    description={`Are you sure you want to remove @${confirmUnfriendUser.username} from your friends? You will no longer see each other's friends-only boards.`}
                    confirmLabel="Unfriend"
                    error={unfriendError}
                    loading={unfriendLoading}
                    onCancel={() => {
                        setConfirmUnfriendUser(null);
                        setUnfriendError(null);
                    }}
                    onConfirm={async () => {
                        const target = confirmUnfriendUser;
                        setUnfriendLoading(true);
                        setUnfriendError(null);
                        setActionState((prev) => ({ ...prev, [target.userId]: "pending" }));
                        try {
                            await removeFriend(target.userId);
                            confirmedFriendshipsRef.current[target.userId] = {
                                friendshipStatus: "none",
                                requestId: undefined
                            };
                            const next: UserSearchResult[] = resultsRef.current.map((u): UserSearchResult =>
                                u.userId === target.userId
                                    ? { ...u, friendshipStatus: "none", requestId: undefined }
                                    : u
                            );
                            resultsRef.current = next;
                            setResults(next);
                            onResultsChange?.(next);
                            onFriendAdded?.();
                            setConfirmUnfriendUser(null);
                        } catch (caught) {
                            const message =
                                caught instanceof Error ? caught.message : "Could not remove friend. Please try again.";
                            setUnfriendError(message);
                            onUnfriendErrorChange?.(message);
                        } finally {
                            setUnfriendLoading(false);
                            setActionState((prev) => {
                                const next = { ...prev };
                                delete next[target.userId];
                                return next;
                            });
                        }
                    }}
                />
            )}
        </div>
    );
}
