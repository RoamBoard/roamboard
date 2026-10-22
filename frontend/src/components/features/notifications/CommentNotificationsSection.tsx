"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CommentNotificationList from "./CommentNotificationList";
import {
    clearCommentNotifications,
    commentNotificationHref,
    listCommentNotifications,
    markCommentNotificationRead,
    subscribeToCommentNotificationUpdates,
    type CommentNotification
} from "@/lib/comment-notifications";

export default function CommentNotificationsSection({ userId }: { userId: string }) {
    const router = useRouter();
    const [items, setItems] = useState<CommentNotification[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openingId, setOpeningId] = useState<number | null>(null);
    const [clearing, setClearing] = useState(false);
    const [clearError, setClearError] = useState("");
    const clearingRef = useRef(false);
    const versionRef = useRef(0);
    const userRef = useRef<string | null>(userId);

    const read = useCallback((expectedUserId: string, nextCursor?: string) => {
        const version = ++versionRef.current;
        setLoading(true);
        setError("");
        void listCommentNotifications(nextCursor)
            .then((page) => {
                if (userRef.current !== expectedUserId || version !== versionRef.current) return;
                setItems((previous) =>
                    nextCursor
                        ? [
                              ...previous,
                              ...page.data.filter(
                                  (item) => !previous.some((old) => old.notificationId === item.notificationId)
                              )
                          ]
                        : page.data
                );
                setCursor(page.meta.nextCursor);
            })
            .catch(() => {
                if (userRef.current === expectedUserId && version === versionRef.current)
                    setError("Failed to load Board comment notifications.");
            })
            .finally(() => {
                if (userRef.current === expectedUserId && version === versionRef.current) setLoading(false);
            });
    }, []);

    useEffect(() => {
        userRef.current = userId;
        void Promise.resolve().then(() => read(userId));
        return () => {
            userRef.current = null;
            versionRef.current += 1;
        };
    }, [userId, read]);

    useEffect(
        () =>
            subscribeToCommentNotificationUpdates(() => {
                if (userRef.current) read(userRef.current);
            }),
        [read]
    );

    async function open(notification: CommentNotification) {
        const expectedUserId = userRef.current;
        if (!expectedUserId || openingId !== null) return;
        setOpeningId(notification.notificationId);
        setError("");
        try {
            if (!notification.readAt) await markCommentNotificationRead(notification.notificationId);
            if (userRef.current === expectedUserId) router.push(commentNotificationHref(notification));
        } catch {
            if (userRef.current === expectedUserId) setError("Could not open that notification. Try again.");
        } finally {
            if (userRef.current === expectedUserId) setOpeningId(null);
        }
    }

    async function clear() {
        const expectedUserId = userRef.current;
        if (!expectedUserId || clearingRef.current) return;
        clearingRef.current = true;
        setClearing(true);
        setClearError("");
        try {
            await clearCommentNotifications();
        } catch {
            if (userRef.current === expectedUserId)
                setClearError("Could not clear Board comment notifications. Try again.");
        } finally {
            clearingRef.current = false;
            if (userRef.current === expectedUserId) setClearing(false);
        }
    }

    return (
        <section aria-label="Board comment notifications" className="mt-8">
            <div className="border-line mb-4 flex items-center justify-between gap-3 border-b pb-2">
                <h2 className="text-12 tracking-label text-muted-foreground font-bold uppercase">Board comments</h2>
                <button
                    type="button"
                    onClick={() => void clear()}
                    disabled={clearing}
                    className="text-12 text-muted-foreground hover:text-foreground cursor-pointer underline disabled:cursor-default disabled:opacity-50"
                >
                    {clearing ? "Clearing…" : "Mark All as Read"}
                </button>
            </div>
            {clearError && (
                <p role="alert" className="text-12 mb-4 text-red-500">
                    {clearError}
                </p>
            )}
            {error && (
                <div role="alert" className="text-12 mb-4 flex items-center justify-between text-red-500">
                    <span>{error}</span>
                    <button
                        type="button"
                        className="cursor-pointer underline"
                        onClick={() => read(userId, items.length > 0 ? (cursor ?? undefined) : undefined)}
                    >
                        Retry
                    </button>
                </div>
            )}
            {loading && items.length === 0 && <p className="text-14 text-muted-foreground">Loading Board comments…</p>}
            {!loading && !error && items.length === 0 && (
                <p className="text-14 text-muted-foreground">No Board comment notifications yet.</p>
            )}
            {items.length > 0 && <CommentNotificationList items={items} pendingId={openingId} onOpen={open} />}
            {cursor && (
                <button
                    type="button"
                    onClick={() => read(userId, cursor)}
                    disabled={loading}
                    className="border-line text-12 mt-4 cursor-pointer border px-4 py-2 disabled:opacity-50"
                >
                    {loading ? "Loading…" : "Load older"}
                </button>
            )}
        </section>
    );
}
