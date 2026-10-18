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
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export type FindFriendsDialogProps = {
    open: boolean;
    onClose: () => void;
    onFriendAdded?: () => void;
};

export default function FindFriendsDialog({ open, onClose, onFriendAdded }: FindFriendsDialogProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionState, setActionState] = useState<Record<string, "pending" | "done">>({});
    const [confirmUnfriendUser, setConfirmUnfriendUser] = useState<UserSearchResult | null>(null);
    const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
    const inputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    const handleClose = useCallback(() => {
        setQuery("");
        setResults([]);
        setError(null);
        setActionState({});
        setFailedAvatars({});
        onClose();
    }, [onClose]);

    const handleQueryChange = (val: string) => {
        setQuery(val);
        setError(null);
    };

    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const trimmed = query.trim();
        const request = { active: true };

        const handle = setTimeout(
            () => {
                setLoading(true);
                setError(null);
                searchUsers(trimmed)
                    .then((data) => {
                        if (request.active) {
                            setResults(data);
                        }
                    })
                    .catch(() => {
                        if (request.active) {
                            setError("Failed to search users. Please try again.");
                        }
                    })
                    .finally(() => {
                        if (request.active) {
                            setLoading(false);
                        }
                    });
            },
            trimmed ? 250 : 0
        );

        return () => {
            request.active = false;
            clearTimeout(handle);
        };
    }, [query, open]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                handleClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, handleClose]);

    if (!open) return null;

    const handleSendRequest = async (handle: string, userId: string) => {
        setActionState((prev) => ({ ...prev, [userId]: "pending" }));
        setError(null);
        try {
            await sendFriendRequest(handle);
            setActionState((prev) => ({ ...prev, [userId]: "done" }));
            setResults((prev) =>
                prev.map((u) => (u.userId === userId ? { ...u, friendshipStatus: "pending_sent" } : u))
            );
            onFriendAdded?.();
        } catch {
            setError("Could not send friend request. Please try again.");
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
        try {
            await acceptFriendRequest(requestId);
            setActionState((prev) => ({ ...prev, [userId]: "done" }));
            setResults((prev) => prev.map((u) => (u.userId === userId ? { ...u, friendshipStatus: "accepted" } : u)));
            onFriendAdded?.();
        } catch {
            setError("Could not accept friend request. Please try again.");
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
                                                            void handleAcceptRequest(user.requestId!, user.userId)
                                                        }
                                                        className="bg-foreground text-background font-body text-10 cursor-pointer rounded-[2px] px-3 py-1 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                                                    >
                                                        {isActing ? "accepting…" : "accept request"}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isActing}
                                                        onClick={() =>
                                                            void handleSendRequest(user.username, user.userId)
                                                        }
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
                    onCancel={() => setConfirmUnfriendUser(null)}
                    onConfirm={async () => {
                        const target = confirmUnfriendUser;
                        setConfirmUnfriendUser(null);
                        setActionState((prev) => ({ ...prev, [target.userId]: "pending" }));
                        try {
                            await removeFriend(target.userId);
                            setResults((prev) =>
                                prev.map((u) => (u.userId === target.userId ? { ...u, friendshipStatus: "none" } : u))
                            );
                            onFriendAdded?.();
                        } catch {
                            // noop
                        } finally {
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
