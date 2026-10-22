"use client";

import { useState, useEffect, useId, useRef, useCallback, type ReactNode, type Ref } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bell, UserRound } from "lucide-react";
import { observeCurrentUser, type AuthUser } from "@/lib/auth";
import CommentNotificationList from "@/components/features/notifications/CommentNotificationList";
import MobileSheet from "@/components/ui/MobileSheet";
import {
    clearCommentNotifications,
    commentNotificationHref,
    listCommentNotifications,
    markCommentNotificationRead,
    subscribeToCommentNotificationUpdates,
    type CommentNotification
} from "@/lib/comment-notifications";
import {
    loadFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    subscribeToFriendRequestUpdates,
    type FriendRequest
} from "@/lib/profile";

export type NotificationControlProps = {
    sidebar?: boolean;
    mobile?: boolean;
    iconOnly?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    initialRequests?: FriendRequest[];
    initialError?: string | null;
    initialUserId?: string;
    onRequestsChange?: (requests: FriendRequest[]) => void;
    onActionErrorChange?: (error: string | null) => void;
};

export default function NotificationControl({
    sidebar = true,
    mobile = false,
    iconOnly = false,
    open,
    onOpenChange,
    initialRequests,
    initialError = null,
    initialUserId,
    onRequestsChange,
    onActionErrorChange
}: NotificationControlProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open ?? internalOpen;
    const panelId = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const clearButtonRef = useRef<HTMLButtonElement>(null);
    const sheetCloseRef = useRef<HTMLButtonElement>(null);
    const focusPanelFallback = () => (mobile ? sheetCloseRef : triggerRef).current?.focus();
    const reducedMotion = useReducedMotion();
    const router = useRouter();

    const [requests, setRequests] = useState<FriendRequest[]>(initialRequests ?? []);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(initialError);
    const [actionInProgress, setActionInProgress] = useState<Record<number, "accepting" | "rejecting">>({});
    const [actionError, setActionError] = useState<string | null>(null);
    const [failedAvatars, setFailedAvatars] = useState<Record<number, boolean>>({});
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(
        initialRequests || initialError
            ? ({ userId: initialUserId ?? "initial-session", username: "", displayName: "" } as AuthUser)
            : null
    );
    const [commentItems, setCommentItems] = useState<CommentNotification[]>([]);
    const [commentUnreadCount, setCommentUnreadCount] = useState(0);
    const [commentAccountId, setCommentAccountId] = useState<string | null>(null);
    const [commentLoading, setCommentLoading] = useState(false);
    const [commentLoadError, setCommentLoadError] = useState("");
    const [openingCommentId, setOpeningCommentId] = useState<number | null>(null);
    const [markingCommentId, setMarkingCommentId] = useState<number | null>(null);
    const [clearingComments, setClearingComments] = useState(false);
    const [commentActionError, setCommentActionError] = useState("");
    const clearingCommentUserRef = useRef<string | null>(null);

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

    const activeUserIdRef = useRef<string | null>(
        initialUserId ?? (initialRequests || initialError ? "initial-session" : null)
    );
    const readVersionRef = useRef(0);
    const requestVersionRef = useRef(0);
    const requestsRef = useRef<FriendRequest[]>(initialRequests ?? []);
    const commentReadVersionRef = useRef(0);
    const commentUserRef = useRef<string | null>(null);

    const fetchCommentNotifications = useCallback((expectedUserId: string) => {
        const version = ++commentReadVersionRef.current;
        setCommentLoading(true);
        setCommentLoadError("");
        void listCommentNotifications(undefined, true)
            .then((page) => {
                if (commentUserRef.current !== expectedUserId || version !== commentReadVersionRef.current) return;
                setCommentItems(page.data.slice(0, 5));
                setCommentUnreadCount(page.meta.unreadCount);
            })
            .catch(() => {
                if (commentUserRef.current === expectedUserId && version === commentReadVersionRef.current)
                    setCommentLoadError("Failed to load comment notifications.");
            })
            .finally(() => {
                if (commentUserRef.current === expectedUserId && version === commentReadVersionRef.current)
                    setCommentLoading(false);
            });
    }, []);

    useEffect(() => {
        const userId = sessionUser?.userId ?? null;
        const changed = userId !== commentUserRef.current;
        if (changed) {
            commentReadVersionRef.current += 1;
            commentUserRef.current = userId;
            setCommentAccountId(userId);
            setCommentItems([]);
            setCommentUnreadCount(0);
            setCommentLoadError("");
            setOpeningCommentId(null);
            setMarkingCommentId(null);
            setClearingComments(false);
            setCommentActionError("");
            clearingCommentUserRef.current = null;
            setCommentLoading(false);
        }
        if (userId && (changed || isOpen)) fetchCommentNotifications(userId);
    }, [sessionUser?.userId, isOpen, fetchCommentNotifications]);

    useEffect(
        () =>
            subscribeToCommentNotificationUpdates(() => {
                if (commentUserRef.current) fetchCommentNotifications(commentUserRef.current);
            }),
        [fetchCommentNotifications]
    );

    async function openCommentNotification(notification: CommentNotification) {
        const expectedUserId = commentUserRef.current;
        if (!expectedUserId || openingCommentId !== null || markingCommentId !== null) return;
        setOpeningCommentId(notification.notificationId);
        setActionError(null);
        try {
            if (!notification.readAt) await markCommentNotificationRead(notification.notificationId);
            if (commentUserRef.current !== expectedUserId) return;
            toggleOpen(false);
            router.push(commentNotificationHref(notification));
        } catch {
            if (commentUserRef.current === expectedUserId)
                setActionError("Could not open that notification. Try again.");
        } finally {
            if (commentUserRef.current === expectedUserId) setOpeningCommentId(null);
        }
    }

    async function markCommentRead(notification: CommentNotification) {
        const expectedUserId = commentUserRef.current;
        if (!expectedUserId || openingCommentId !== null || markingCommentId !== null || clearingComments) return;
        setMarkingCommentId(notification.notificationId);
        setCommentActionError("");
        try {
            await markCommentNotificationRead(notification.notificationId);
            if (commentUserRef.current === expectedUserId)
                setCommentItems((current) =>
                    current.filter((item) => item.notificationId !== notification.notificationId)
                );
        } catch {
            if (commentUserRef.current === expectedUserId)
                setCommentActionError("Could not mark that notification as read. Try again.");
        } finally {
            if (commentUserRef.current === expectedUserId) setMarkingCommentId(null);
        }
    }

    async function clearComments() {
        const expectedUserId = commentUserRef.current;
        if (!expectedUserId || markingCommentId !== null || clearingCommentUserRef.current === expectedUserId) return;
        const clearButton = clearButtonRef.current;
        if (clearButton?.closest("section")?.contains(clearButton.ownerDocument.activeElement)) focusPanelFallback();
        clearingCommentUserRef.current = expectedUserId;
        setClearingComments(true);
        setCommentActionError("");
        try {
            await clearCommentNotifications();
        } catch {
            if (commentUserRef.current === expectedUserId)
                setCommentActionError("Could not clear Board comment notifications. Try again.");
        } finally {
            if (clearingCommentUserRef.current === expectedUserId) clearingCommentUserRef.current = null;
            if (commentUserRef.current === expectedUserId) setClearingComments(false);
        }
    }

    useEffect(() => {
        requestsRef.current = requests;
    }, [requests]);

    useEffect(() => {
        return subscribeToFriendRequestUpdates((event) => {
            requestVersionRef.current += 1;
            const next = requestsRef.current.filter((r) => r.requestId !== event.requestId);
            requestsRef.current = next;
            setRequests(next);
            onRequestsChange?.(next);
        });
    }, [onRequestsChange]);

    const fetchRequests = useCallback(() => {
        if (!sessionUser) return Promise.resolve();
        const readId = ++readVersionRef.current;
        const currentUserId = activeUserIdRef.current;
        const requestVersion = requestVersionRef.current;
        setLoading(true);
        setLoadError(null);
        return loadFriendRequests()
            .then((data) => {
                if (
                    activeUserIdRef.current === currentUserId &&
                    readId === readVersionRef.current &&
                    requestVersion === requestVersionRef.current
                ) {
                    requestsRef.current = data;
                    setRequests(data);
                    onRequestsChange?.(data);
                    setLoadError(null);
                }
            })
            .catch(() => {
                if (
                    activeUserIdRef.current === currentUserId &&
                    readId === readVersionRef.current &&
                    requestVersion === requestVersionRef.current
                ) {
                    setLoadError("Failed to load notifications. Please try again.");
                }
            })
            .finally(() => {
                if (activeUserIdRef.current === currentUserId && readId === readVersionRef.current) {
                    setLoading(false);
                }
            });
    }, [sessionUser, onRequestsChange]);

    useEffect(() => {
        return observeCurrentUser((user) => {
            readVersionRef.current += 1;
            requestVersionRef.current += 1;
            if (!user) {
                activeUserIdRef.current = null;
                setSessionUser(null);
                requestsRef.current = [];
                setRequests([]);
                onRequestsChange?.([]);
                setActionInProgress({});
                setActionError(null);
                onActionErrorChange?.(null);
                setLoadError(null);
                setLoading(false);
            } else {
                const previousUserId = activeUserIdRef.current;
                activeUserIdRef.current = user.userId;
                setSessionUser(user);
                const shouldFetch =
                    previousUserId !== user.userId && (previousUserId !== "initial-session" || !initialRequests);
                if (shouldFetch) {
                    requestsRef.current = [];
                    setRequests([]);
                    onRequestsChange?.([]);
                    setActionInProgress({});
                    setActionError(null);
                    onActionErrorChange?.(null);
                    setLoadError(null);
                    setLoading(true);
                    const readId = readVersionRef.current;
                    const expectedUserId = user.userId;
                    const requestVersion = requestVersionRef.current;
                    void loadFriendRequests()
                        .then((data) => {
                            if (
                                activeUserIdRef.current === expectedUserId &&
                                readId === readVersionRef.current &&
                                requestVersion === requestVersionRef.current
                            ) {
                                requestsRef.current = data;
                                setRequests(data);
                                onRequestsChange?.(data);
                                setLoadError(null);
                            }
                        })
                        .catch(() => {
                            if (
                                activeUserIdRef.current === expectedUserId &&
                                readId === readVersionRef.current &&
                                requestVersion === requestVersionRef.current
                            ) {
                                setLoadError("Failed to load notifications. Please try again.");
                            }
                        })
                        .finally(() => {
                            if (activeUserIdRef.current === expectedUserId && readId === readVersionRef.current) {
                                setLoading(false);
                            }
                        });
                }
            }
        });
    }, [initialRequests, onRequestsChange, onActionErrorChange]);

    useEffect(() => {
        if (!isOpen || !sessionUser) return;
        const readId = ++readVersionRef.current;
        const currentUserId = activeUserIdRef.current;
        const requestVersion = requestVersionRef.current;
        void loadFriendRequests()
            .then((data) => {
                if (
                    activeUserIdRef.current === currentUserId &&
                    readId === readVersionRef.current &&
                    requestVersion === requestVersionRef.current
                ) {
                    requestsRef.current = data;
                    setRequests(data);
                    onRequestsChange?.(data);
                    setLoadError(null);
                }
            })
            .catch(() => {
                if (
                    activeUserIdRef.current === currentUserId &&
                    readId === readVersionRef.current &&
                    requestVersion === requestVersionRef.current
                ) {
                    setLoadError("Failed to load notifications. Please try again.");
                }
            })
            .finally(() => {
                if (activeUserIdRef.current === currentUserId && readId === readVersionRef.current) {
                    setLoading(false);
                }
            });
    }, [isOpen, sessionUser, onRequestsChange]);

    const handleAccept = async (requestId: number) => {
        requestVersionRef.current += 1;
        const currentUserId = activeUserIdRef.current;
        if (!currentUserId) return;
        setActionInProgress((prev) => ({ ...prev, [requestId]: "accepting" }));
        setActionError(null);
        onActionErrorChange?.(null);
        try {
            await acceptFriendRequest(requestId);
            if (activeUserIdRef.current !== currentUserId || !activeUserIdRef.current) {
                return;
            }
            const next = requestsRef.current.filter((r) => r.requestId !== requestId);
            requestsRef.current = next;
            setRequests(next);
            onRequestsChange?.(next);
        } catch {
            if (activeUserIdRef.current !== currentUserId || !activeUserIdRef.current) {
                return;
            }
            setActionError("Failed to accept friend request");
            onActionErrorChange?.("Failed to accept friend request");
        } finally {
            if (activeUserIdRef.current === currentUserId && activeUserIdRef.current) {
                setActionInProgress((prev) => {
                    const next = { ...prev };
                    delete next[requestId];
                    return next;
                });
            }
        }
    };

    const handleReject = async (requestId: number) => {
        requestVersionRef.current += 1;
        const currentUserId = activeUserIdRef.current;
        if (!currentUserId) return;
        setActionInProgress((prev) => ({ ...prev, [requestId]: "rejecting" }));
        setActionError(null);
        onActionErrorChange?.(null);
        try {
            await rejectFriendRequest(requestId);
            if (activeUserIdRef.current !== currentUserId || !activeUserIdRef.current) {
                return;
            }
            const next = requestsRef.current.filter((r) => r.requestId !== requestId);
            requestsRef.current = next;
            setRequests(next);
            onRequestsChange?.(next);
        } catch {
            if (activeUserIdRef.current !== currentUserId || !activeUserIdRef.current) {
                return;
            }
            setActionError("Failed to reject friend request");
            onActionErrorChange?.("Failed to reject friend request");
        } finally {
            if (activeUserIdRef.current === currentUserId && activeUserIdRef.current) {
                setActionInProgress((prev) => {
                    const next = { ...prev };
                    delete next[requestId];
                    return next;
                });
            }
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);

    const visibleCommentItems = commentAccountId === sessionUser?.userId ? commentItems : [];
    const displayedCommentItems = visibleCommentItems.filter((item) => item.notificationId !== markingCommentId);
    const pendingCount = requests.length + (commentAccountId === sessionUser?.userId ? commentUnreadCount : 0);

    useEffect(() => {
        if (!isOpen || typeof document === "undefined") return;
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
                aria-haspopup={mobile ? "dialog" : undefined}
                aria-controls={panelId}
                onClick={() => toggleOpen(!isOpen)}
                className={`font-body text-12 text-muted-foreground hover:text-foreground relative flex min-h-11 w-full min-w-11 cursor-pointer items-center font-medium focus-visible:outline-1 focus-visible:-outline-offset-2 md:focus-visible:outline-offset-4 ${iconOnly ? "justify-center" : "gap-3 px-3"}`}
            >
                <div className="relative flex shrink-0 items-center justify-center">
                    <Bell aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0" />
                    {sessionUser && pendingCount > 0 && (
                        <span
                            aria-label={`${pendingCount} pending notifications`}
                            className="bg-foreground text-background absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-bold"
                        >
                            {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                    )}
                </div>
                {!iconOnly && <span>notifications</span>}
                {!iconOnly && sessionUser && pendingCount > 0 && (
                    <span className="text-10 bg-faint border-line text-muted-foreground ml-auto rounded-[2px] border px-1.5 py-0.5 font-medium">
                        {pendingCount}
                    </span>
                )}
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <NotificationPanel
                        id={panelId}
                        mobile={mobile}
                        sidebar={sidebar}
                        reducedMotion={reducedMotion}
                        onClose={() => toggleOpen(false)}
                        closeButtonRef={sheetCloseRef}
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                            {!sessionUser ? (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-12 text-muted-foreground font-body mb-2">
                                        Sign in to see notifications
                                    </p>
                                    <Link
                                        href="/login"
                                        onClick={() => toggleOpen(false)}
                                        className="text-12 text-foreground font-medium underline underline-offset-4 hover:opacity-80"
                                    >
                                        Sign in →
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    {actionError && (
                                        <p role="alert" className="text-10 px-4 py-2 text-red-500">
                                            {actionError}
                                        </p>
                                    )}
                                    {loadError && requests.length > 0 && (
                                        <div
                                            role="alert"
                                            className="border-line text-10 flex items-center justify-between border-b px-4 py-2 text-red-500"
                                        >
                                            <span>{loadError}</span>
                                            <button
                                                type="button"
                                                onClick={() => void fetchRequests()}
                                                className="cursor-pointer underline underline-offset-2 hover:opacity-80"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    )}
                                    {loading && requests.length === 0 ? (
                                        <p className="text-12 text-muted-foreground font-body px-4 py-6 text-center">
                                            Loading notifications…
                                        </p>
                                    ) : loadError && requests.length === 0 ? (
                                        <div role="alert" className="px-4 py-6 text-center">
                                            <p className="text-12 font-body mb-2 text-red-500">{loadError}</p>
                                            <button
                                                type="button"
                                                onClick={() => void fetchRequests()}
                                                className="text-12 text-foreground cursor-pointer font-medium underline underline-offset-4 hover:opacity-80"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    ) : requests.length === 0 &&
                                      visibleCommentItems.length === 0 &&
                                      !commentLoading &&
                                      !commentLoadError ? (
                                        <p className="text-12 text-muted-foreground font-body px-4 py-6 text-center">
                                            No pending notifications
                                        </p>
                                    ) : requests.length > 0 ? (
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
                                                            onClick={() => handleAccept(req.requestId)}
                                                            disabled={Boolean(actionInProgress[req.requestId])}
                                                            aria-label={`Accept friend request from ${req.requester.displayName}`}
                                                            className="bg-foreground text-background font-body text-12 md:text-10 min-h-11 cursor-pointer rounded-[2px] px-3 py-1.5 font-medium transition-opacity hover:opacity-90 disabled:opacity-50 md:min-h-0"
                                                        >
                                                            {actionInProgress[req.requestId] === "accepting"
                                                                ? "accepting…"
                                                                : "accept"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReject(req.requestId)}
                                                            disabled={Boolean(actionInProgress[req.requestId])}
                                                            aria-label={`Reject friend request from ${req.requester.displayName}`}
                                                            className="border-line text-muted-foreground hover:text-foreground hover:border-foreground font-body text-12 md:text-10 min-h-11 cursor-pointer rounded-[2px] border px-3 py-1.5 font-medium transition-colors disabled:opacity-50 md:min-h-0"
                                                        >
                                                            {actionInProgress[req.requestId] === "rejecting"
                                                                ? "rejecting…"
                                                                : "reject"}
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                    {commentLoadError && (
                                        <div
                                            role="alert"
                                            className="text-12 flex items-center justify-between px-4 py-3 text-red-500"
                                        >
                                            <span>{commentLoadError}</span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    commentUserRef.current &&
                                                    fetchCommentNotifications(commentUserRef.current)
                                                }
                                                className="cursor-pointer underline"
                                            >
                                                Retry
                                            </button>
                                        </div>
                                    )}
                                    {commentLoading && visibleCommentItems.length === 0 && (
                                        <p className="text-12 text-muted-foreground px-4 py-3">Loading comments…</p>
                                    )}
                                    <AnimatePresence key={sessionUser.userId} initial={false}>
                                        {(visibleCommentItems.length > 0 ||
                                            (commentAccountId === sessionUser.userId && commentUnreadCount > 0)) && (
                                            <motion.section
                                                key="comment-notifications"
                                                aria-label="Board comment notifications"
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
                                                className="border-line overflow-hidden border-t"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-x-2 px-4 pt-3">
                                                    <h3 className="text-10 tracking-label text-muted-foreground font-bold uppercase">
                                                        Board comments
                                                    </h3>
                                                    {commentUnreadCount > 0 && (
                                                        <button
                                                            ref={clearButtonRef}
                                                            type="button"
                                                            onClick={() => void clearComments()}
                                                            disabled={clearingComments || markingCommentId !== null}
                                                            className="text-12 text-muted-foreground hover:text-foreground md:text-10 min-h-11 cursor-pointer underline disabled:cursor-default md:min-h-0"
                                                        >
                                                            Clear all notifications
                                                        </button>
                                                    )}
                                                </div>
                                                {commentActionError && (
                                                    <p role="alert" className="text-10 px-4 pt-2 text-red-500">
                                                        {commentActionError}
                                                    </p>
                                                )}
                                                {visibleCommentItems.length > 0 && (
                                                    <CommentNotificationList
                                                        items={displayedCommentItems}
                                                        compact
                                                        pendingId={openingCommentId ?? markingCommentId}
                                                        onOpen={openCommentNotification}
                                                        onMarkRead={markCommentRead}
                                                        onDismissFocusFallback={focusPanelFallback}
                                                        reducedMotion={reducedMotion}
                                                    />
                                                )}
                                            </motion.section>
                                        )}
                                    </AnimatePresence>
                                </>
                            )}
                        </div>
                    </NotificationPanel>
                )}
            </AnimatePresence>
        </div>
    );
}

function NotificationPanel({
    id,
    mobile,
    sidebar,
    reducedMotion,
    onClose,
    closeButtonRef,
    children
}: {
    id: string;
    mobile: boolean;
    sidebar: boolean;
    reducedMotion: boolean | null;
    onClose: () => void;
    closeButtonRef: Ref<HTMLButtonElement>;
    children: ReactNode;
}) {
    const viewAll = (
        <Link
            href="/notifications"
            onClick={onClose}
            className="font-body text-12 text-muted-foreground hover:text-foreground md:text-10 flex min-h-11 items-center underline-offset-4 hover:underline md:min-h-0"
        >
            view all ↗
        </Link>
    );
    if (mobile)
        return (
            <MobileSheet
                id={id}
                title="Notifications"
                onClose={onClose}
                closeButtonRef={closeButtonRef}
                action={viewAll}
            >
                {children}
            </MobileSheet>
        );
    const placement = sidebar ? "bottom-0 left-[calc(100%+1.75rem)]" : "top-[calc(100%+0.5rem)] right-0";
    return (
        <motion.div
            id={id}
            initial={{ opacity: 0, x: reducedMotion ? 0 : -8, scale: reducedMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: reducedMotion ? 0 : -8, scale: reducedMotion ? 1 : 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="region"
            aria-label="Notifications panel"
            className={`bg-background text-foreground border-line absolute z-50 flex max-h-[min(28rem,calc(100dvh-4rem))] w-80 max-w-[calc(100vw-5rem)] flex-col overflow-hidden rounded-[2px] border p-0 shadow-2xl ${placement}`}
        >
            <div className="border-line flex shrink-0 items-center justify-between border-b px-4 py-3">
                <span className="text-10 tracking-label text-muted-foreground block font-bold uppercase">
                    notifications
                </span>
                {viewAll}
            </div>
            {children}
        </motion.div>
    );
}
