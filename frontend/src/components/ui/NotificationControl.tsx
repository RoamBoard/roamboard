"use client";

import { useState, useEffect, useId, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, UserRound } from "lucide-react";
import { observeCurrentUser, type AuthUser } from "@/lib/auth";
import { loadFriendRequests, acceptFriendRequest, rejectFriendRequest, type FriendRequest } from "@/lib/profile";

export type NotificationControlProps = {
    sidebar?: boolean;
    iconOnly?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    initialRequests?: FriendRequest[];
};

export default function NotificationControl({
    sidebar = true,
    iconOnly = false,
    open,
    onOpenChange,
    initialRequests
}: NotificationControlProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open ?? internalOpen;
    const panelId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const reducedMotion = useReducedMotion();

    const [requests, setRequests] = useState<FriendRequest[]>(initialRequests ?? []);
    const [loading, setLoading] = useState(false);
    const [actionInProgress, setActionInProgress] = useState<Record<number, "accepting" | "rejecting">>({});
    const [actionError, setActionError] = useState<string | null>(null);
    const [failedAvatars, setFailedAvatars] = useState<Record<number, boolean>>({});
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);

    const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const resolveAvatarUrl = (url: string | null) => {
        if (!url) return null;
        try {
            return new URL(url, apiOrigin).toString();
        } catch {
            return url;
        }
    };

    const toggleOpen = useCallback(
        (nextOpen: boolean) => {
            setInternalOpen(nextOpen);
            onOpenChange?.(nextOpen);
        },
        [onOpenChange]
    );

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
                if (request.active) {
                    setLoading(false);
                }
            });
        return () => {
            request.active = false;
        };
    }, [sessionUser]);

    useEffect(() => {
        if (isOpen && sessionUser) {
            const request = { active: true };
            void loadFriendRequests()
                .then((data) => {
                    if (request.active) setRequests(data);
                })
                .catch(() => {
                    // Ignore background refresh errors
                });
            return () => {
                request.active = false;
            };
        }
    }, [isOpen, sessionUser]);

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

    const containerRef = useRef<HTMLDivElement>(null);

    const flyoutPlacement = sidebar ? "bottom-0 left-[calc(100%+1.75rem)]" : "top-[calc(100%+0.5rem)] right-0";

    useEffect(() => {
        if (!isOpen) return;
        const handlePointerDown = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                toggleOpen(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
        };
    }, [isOpen, toggleOpen]);

    return (
        <div
            ref={containerRef}
            onKeyDown={(event) => {
                if (event.key === "Escape" && isOpen) {
                    event.stopPropagation();
                    toggleOpen(false);
                    triggerRef.current?.focus();
                }
            }}
            className="relative"
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label="Notifications"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleOpen(!isOpen)}
                className={`font-body text-12 text-muted-foreground hover:text-foreground relative flex min-h-11 w-full cursor-pointer items-center font-medium focus-visible:outline-1 focus-visible:outline-offset-4 ${iconOnly ? "justify-center" : "gap-3 px-3"}`}
            >
                <div className="relative flex shrink-0 items-center justify-center">
                    <Bell aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0" />
                    {requests.length > 0 && (
                        <span
                            aria-label={`${requests.length} pending requests`}
                            className="bg-foreground text-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold"
                        >
                            {requests.length > 9 ? "9+" : requests.length}
                        </span>
                    )}
                </div>
                {!iconOnly && <span>notifications</span>}
                {!iconOnly && requests.length > 0 && (
                    <span className="text-10 bg-faint border-line text-muted-foreground ml-auto rounded-[2px] border px-1.5 py-0.5 font-medium">
                        {requests.length}
                    </span>
                )}
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={panelId}
                        initial={{ opacity: 0, x: reducedMotion ? 0 : -8, scale: reducedMotion ? 1 : 0.98 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: reducedMotion ? 0 : -8, scale: reducedMotion ? 1 : 0.98 }}
                        transition={{ duration: reducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
                        role="region"
                        aria-label="Notifications panel"
                        className={`bg-background text-foreground border-line absolute z-50 flex max-h-[min(28rem,calc(100dvh-4rem))] w-80 max-w-[calc(100vw-5rem)] flex-col overflow-hidden rounded-[2px] border p-0 shadow-2xl ${flyoutPlacement}`}
                    >
                        <div className="border-line flex shrink-0 items-center justify-between border-b px-4 py-3">
                            <span className="text-10 tracking-label text-muted-foreground block font-bold uppercase">
                                notifications
                            </span>
                            <Link
                                href="/notifications"
                                onClick={() => toggleOpen(false)}
                                className="font-body text-10 text-muted-foreground hover:text-foreground cursor-pointer underline-offset-4 hover:underline"
                            >
                                view all ↗
                            </Link>
                        </div>
                        <div className="flex-1 overflow-y-auto overscroll-contain">
                            {actionError && (
                                <p role="alert" className="text-10 px-4 py-2 text-red-500">
                                    {actionError}
                                </p>
                            )}
                            {loading && requests.length === 0 ? (
                                <p className="text-12 text-muted-foreground font-body px-4 py-6 text-center">
                                    Loading notifications…
                                </p>
                            ) : requests.length === 0 ? (
                                <p className="text-12 text-muted-foreground font-body px-4 py-6 text-center">
                                    No pending notifications
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-2 p-3">
                                    {requests.map((req) => (
                                        <li
                                            key={req.requestId}
                                            className="bg-faint/50 border-line flex flex-col gap-2 rounded-[2px] border p-3 transition-colors"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {resolveAvatarUrl(req.requester.profilePictureUrl) &&
                                                !failedAvatars[req.requestId] ? (
                                                    <Image
                                                        src={resolveAvatarUrl(req.requester.profilePictureUrl)!}
                                                        alt=""
                                                        width={28}
                                                        height={28}
                                                        unoptimized
                                                        onError={() =>
                                                            setFailedAvatars((prev) => ({
                                                                ...prev,
                                                                [req.requestId]: true
                                                            }))
                                                        }
                                                        className="size-7 shrink-0 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full">
                                                        <UserRound size={16} strokeWidth={1.5} />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={`/profile/${encodeURIComponent(req.requester.username)}`}
                                                        onClick={() => toggleOpen(false)}
                                                        className="text-12 text-foreground block truncate font-medium hover:underline"
                                                    >
                                                        {req.requester.displayName}
                                                    </Link>
                                                    <span className="text-10 text-muted-foreground block truncate">
                                                        @{req.requester.username}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    type="button"
                                                    onClick={() => void handleAccept(req.requestId)}
                                                    disabled={Boolean(actionInProgress[req.requestId])}
                                                    aria-label={`Accept friend request from ${req.requester.displayName}`}
                                                    className="bg-foreground text-background font-body text-10 cursor-pointer rounded-[2px] px-3 py-1.5 font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
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
                                                    className="border-line text-muted-foreground hover:text-foreground hover:border-foreground font-body text-10 cursor-pointer rounded-[2px] border px-3 py-1.5 font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {actionInProgress[req.requestId] === "rejecting"
                                                        ? "rejecting…"
                                                        : "reject"}
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
