"use client";

import Image from "next/image";
import Link from "next/link";
import { MessageCircle, UserRound } from "lucide-react";

import { commentNotificationHref, type CommentNotification } from "@/lib/comment-notifications";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function CommentNotificationList({
    items,
    compact = false,
    pendingId,
    onOpen
}: {
    items: CommentNotification[];
    compact?: boolean;
    pendingId: number | null;
    onOpen: (notification: CommentNotification) => Promise<void>;
}) {
    return (
        <ul className={compact ? "flex flex-col gap-2 p-3" : "flex flex-col gap-3"}>
            {items.map((notification) => (
                <li key={notification.notificationId}>
                    <Link
                        href={commentNotificationHref(notification)}
                        onClick={(event) => {
                            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                                return;
                            event.preventDefault();
                            if (pendingId === null) void onOpen(notification);
                        }}
                        aria-label={`${notification.commenter.displayName} ${notification.kind === "mention" ? "mentioned you in" : "commented on"} ${notification.boardTitle}`}
                        aria-disabled={pendingId !== null}
                        className={`border-line hover:bg-faint/60 flex items-start gap-3 border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            notification.readAt ? "bg-background" : "bg-faint/50"
                        } ${pendingId !== null ? "pointer-events-none opacity-60" : ""}`}
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
                            <MessageCircle size={15} className="text-muted-foreground shrink-0" aria-hidden="true" />
                        ) : (
                            <span className="bg-foreground mt-1 size-2 shrink-0 rounded-full" aria-label="Unread" />
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}
