"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, UserRound } from "lucide-react";
import { observeCurrentUser, type AuthUser } from "@/lib/auth";
import { loadFriendRequests, acceptFriendRequest, rejectFriendRequest, type FriendRequest } from "@/lib/profile";

export default function NotificationsContent({ initialRequests }: { initialRequests?: FriendRequest[] }) {
    const [requests, setRequests] = useState<FriendRequest[]>(initialRequests ?? []);
    const [loading, setLoading] = useState(false);
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
    const [actionInProgress, setActionInProgress] = useState<Record<number, "accepting" | "rejecting">>({});
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        return observeCurrentUser((user) => {
            setSessionUser(user);
            if (!user && !initialRequests) {
                setRequests([]);
            } else if (user) {
                setLoading(true);
            }
        });
    }, [initialRequests]);

    useEffect(() => {
        if (!sessionUser) return;
        const request = { active: true };
        void loadFriendRequests()
            .then((data) => {
                if (request.active) {
                    setRequests(data);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (request.active) setLoading(false);
            });
        return () => {
            request.active = false;
        };
    }, [sessionUser]);

    const handleAccept = async (requestId: number) => {
        setActionInProgress((prev) => ({ ...prev, [requestId]: "accepting" }));
        setActionError(null);
        try {
            await acceptFriendRequest(requestId);
            setRequests((prev) => prev.filter((r) => r.requestId !== requestId));
        } catch {
            setActionError("Failed to accept friend request");
        } finally {
            setActionInProgress((prev) => {
                const next = { ...prev };
                delete next[requestId];
                return next;
            });
        }
    };

    const handleReject = async (requestId: number) => {
        setActionInProgress((prev) => ({ ...prev, [requestId]: "rejecting" }));
        setActionError(null);
        try {
            await rejectFriendRequest(requestId);
            setRequests((prev) => prev.filter((r) => r.requestId !== requestId));
        } catch {
            setActionError("Failed to reject friend request");
        } finally {
            setActionInProgress((prev) => {
                const next = { ...prev };
                delete next[requestId];
                return next;
            });
        }
    };

    return (
        <div className="relative h-full w-full overflow-hidden">
            <div className="h-full w-full overflow-y-auto px-4 pt-6 pb-20 sm:px-8 sm:pt-8 md:px-12 md:pt-10 lg:px-16">
                <div className="mx-auto w-full max-w-3xl pb-20">
                    <header className="mb-8">
                        <span className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                            COMMUNITY
                        </span>
                        <div className="mt-1 flex items-baseline justify-between gap-4">
                            <h1 className="font-display text-48 sm:text-60 text-foreground font-bold tracking-tight uppercase">
                                NOTIFICATIONS
                            </h1>
                            {requests.length > 0 && (
                                <span className="border-line text-12 text-muted-foreground bg-faint rounded-[2px] border px-2.5 py-1 font-medium">
                                    {requests.length} pending
                                </span>
                            )}
                        </div>
                    </header>

                    {actionError && (
                        <div
                            role="alert"
                            className="text-12 mb-6 rounded-[2px] border border-red-500/30 bg-red-500/10 p-3 font-medium text-red-500"
                        >
                            {actionError}
                        </div>
                    )}

                    {!sessionUser && !loading && (
                        <div className="border-line bg-background rounded-[2px] border p-8 text-center sm:p-12">
                            <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
                                <Bell size={24} strokeWidth={1.5} />
                            </div>
                            <h2 className="font-display text-24 text-foreground font-bold">
                                Sign in to see notifications
                            </h2>
                            <p className="text-14 text-muted-foreground mx-auto mt-2 max-w-sm font-medium">
                                View incoming friend requests and updates by logging into your Roamboard account.
                            </p>
                            <Link
                                href="/login"
                                className="bg-foreground text-background font-body text-12 mt-6 inline-block rounded-[2px] px-5 py-2 font-medium transition-opacity hover:opacity-90"
                            >
                                Sign in →
                            </Link>
                        </div>
                    )}

                    {sessionUser && loading && requests.length === 0 && (
                        <div className="border-line bg-background rounded-[2px] border p-12 text-center">
                            <p className="text-14 text-muted-foreground font-body">Loading notifications…</p>
                        </div>
                    )}

                    {sessionUser && !loading && requests.length === 0 && (
                        <div className="border-line bg-background rounded-[2px] border p-8 text-center sm:p-12">
                            <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
                                <Bell size={24} strokeWidth={1.5} />
                            </div>
                            <h2 className="font-display text-24 text-foreground font-bold">All caught up!</h2>
                            <p className="text-14 text-muted-foreground mx-auto mt-2 max-w-sm font-medium">
                                You don&apos;t have any pending friend requests or new notifications right now.
                            </p>
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                <Link
                                    href="/social"
                                    className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors"
                                >
                                    Explore Community →
                                </Link>
                                <Link
                                    href="/boards"
                                    className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors"
                                >
                                    Explore Boards →
                                </Link>
                            </div>
                        </div>
                    )}

                    {requests.length > 0 && (
                        <section aria-label="Friend requests list">
                            <div className="border-line mb-4 border-b pb-2">
                                <h2 className="text-12 tracking-label text-muted-foreground font-bold uppercase">
                                    Friend Requests ({requests.length})
                                </h2>
                            </div>
                            <ul className="flex flex-col gap-3">
                                {requests.map((req) => (
                                    <li
                                        key={req.requestId}
                                        className="border-line bg-background hover:bg-faint/30 flex flex-col gap-4 rounded-[2px] border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex min-w-0 items-center gap-3.5">
                                            {req.requester.profilePictureUrl ? (
                                                <Image
                                                    src={req.requester.profilePictureUrl}
                                                    alt=""
                                                    width={44}
                                                    height={44}
                                                    unoptimized
                                                    className="size-11 shrink-0 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full">
                                                    <UserRound size={22} strokeWidth={1.5} />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={`/profile/${encodeURIComponent(req.requester.username)}`}
                                                    className="text-14 text-foreground block truncate font-medium hover:underline"
                                                >
                                                    {req.requester.displayName}
                                                </Link>
                                                <span className="text-12 text-muted-foreground block truncate">
                                                    @{req.requester.username}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2.5 sm:shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => void handleAccept(req.requestId)}
                                                disabled={Boolean(actionInProgress[req.requestId])}
                                                aria-label={`Accept friend request from ${req.requester.displayName}`}
                                                className="bg-foreground text-background font-body text-12 cursor-pointer rounded-[2px] px-4 py-2 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
                                            >
                                                {actionInProgress[req.requestId] === "accepting"
                                                    ? "accepting…"
                                                    : "accept"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleReject(req.requestId)}
                                                disabled={Boolean(actionInProgress[req.requestId])}
                                                aria-label={`Reject friend request from ${req.requester.displayName}`}
                                                className="border-line text-muted-foreground hover:text-foreground hover:border-foreground font-body text-12 cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors disabled:opacity-50"
                                            >
                                                {actionInProgress[req.requestId] === "rejecting"
                                                    ? "rejecting…"
                                                    : "reject"}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
