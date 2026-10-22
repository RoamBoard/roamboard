"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { commentNotificationHref, type CommentNotification } from "@/lib/comment-notifications";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function CommentNotificationList({
    items,
    compact = false,
    pendingId,
    onOpen,
    onMarkRead,
    reducedMotion = false
}: {
    items: CommentNotification[];
    compact?: boolean;
    pendingId: number | null;
    onOpen: (notification: CommentNotification) => Promise<void>;
    onMarkRead?: (notification: CommentNotification) => Promise<void>;
    reducedMotion?: boolean | null;
}) {
    return (
        <ul className={compact ? "flex flex-col gap-2 p-3" : "flex flex-col gap-3"}>
            <AnimatePresence initial={false}>
                {items.map((notification) => (
                    <motion.li
                        key={notification.notificationId}
                        layout={compact && !reducedMotion}
                        initial={compact ? { opacity: 0, height: 0, x: reducedMotion ? 0 : 8 } : false}
                        animate={compact ? { opacity: 1, height: "auto", x: 0 } : undefined}
                        exit={compact ? { opacity: 0, height: 0, x: reducedMotion ? 0 : 8 } : undefined}
                        transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
                        className="relative overflow-hidden"
                    >
                        <Link
                            href={commentNotificationHref(notification)}
                            onClick={(event) => {
                                if (
                                    event.button !== 0 ||
                                    event.metaKey ||
                                    event.ctrlKey ||
                                    event.shiftKey ||
                                    event.altKey
                                )
                                    return;
                                event.preventDefault();
                                if (pendingId === null) void onOpen(notification);
                            }}
                            aria-label={`${notification.commenter.displayName} ${notification.kind === "mention" ? "mentioned you in" : "commented on"} ${notification.boardTitle}`}
                            aria-disabled={pendingId !== null}
                            className={`border-line hover:bg-faint/60 flex items-start gap-3 border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                notification.readAt ? "bg-background" : "bg-faint/50"
                            } ${pendingId !== null ? "pointer-events-none" : ""} ${onMarkRead && !notification.readAt ? "pr-11" : ""}`}
                        >
                            <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                                {notification.commenter.profilePictureUrl ? (
                                    <Image
                                        src={new URL(notification.commenter.profilePictureUrl, apiOrigin).toString()}
                                        alt=""
                                        width={32}
                                        height={32}
                                        unoptimized
                                        className="size-full object-cover"
                                    />
                                ) : (
                                    <UserRound size={17} aria-hidden="true" />
                                )}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="text-12 text-foreground block font-medium">
                                    {notification.commenter.displayName}{" "}
                                    {notification.kind === "mention" ? "mentioned you in" : "commented on"}{" "}
                                    {notification.boardTitle}
                                </span>
                                <span className="text-muted-foreground text-11 mt-1 block truncate">
                                    {notification.excerpt}
                                </span>
                                <time
                                    dateTime={notification.createdAt}
                                    className="text-muted-foreground text-10 mt-1 block"
                                >
                                    {new Date(notification.createdAt).toLocaleString()}
                                </time>
                            </span>
                            {notification.readAt ? (
                                <MessageCircle
                                    size={15}
                                    className="text-muted-foreground shrink-0"
                                    aria-hidden="true"
                                />
                            ) : onMarkRead ? null : (
                                <span className="bg-foreground mt-1 size-2 shrink-0 rounded-full" aria-label="Unread" />
                            )}
                        </Link>
                        {onMarkRead && !notification.readAt && (
                            <button
                                type="button"
                                onClick={() => void onMarkRead(notification)}
                                disabled={pendingId !== null}
                                aria-label={`Mark notification from ${notification.commenter.displayName} on ${notification.boardTitle} as read`}
                                className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default"
                            >
                                <X size={14} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                        )}
                    </motion.li>
                ))}
            </AnimatePresence>
        </ul>
    );
}
