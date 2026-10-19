"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Pencil, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { observeCurrentUser, type AuthUser } from "@/lib/auth";
import { subscribeBackNavigation } from "@/lib/back-navigation";
import {
    getCommentSubscription,
    notifyCommentNotificationUpdate,
    setCommentSubscription
} from "@/lib/comment-notifications";
import {
    BoardCommentApiError,
    boardCommentLimit,
    commentLength,
    deleteBoardComment,
    editBoardComment,
    limitCommentLength,
    listBoardComments,
    postBoardComment,
    reloadBoardComment,
    type BoardComment
} from "@/lib/board-comments";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const actionClass =
    "text-12 min-h-9 cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2";
const buttonClass =
    "border-line hover:bg-faint min-h-11 cursor-pointer border px-5 py-2 text-14 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButtonClass =
    "bg-foreground text-background hover:bg-foreground/90 min-h-11 cursor-pointer px-5 py-2 text-14 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50";
const textareaClass =
    "border-line bg-background text-foreground min-h-24 w-full resize-y border px-3 py-3 text-14 focus-visible:outline-2 focus-visible:outline-offset-4";

function relativeTime(value: string): string {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "";
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    if (minutes < 2880) return "yesterday";
    if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
    return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function CommentAvatar({ name, url }: { name: string; url?: string | null }) {
    const [failed, setFailed] = useState(false);
    return (
        <span className="border-line bg-faint text-muted-foreground flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border">
            {url && !failed ? (
                <Image
                    src={new URL(url, apiOrigin).toString()}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="size-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <UserRound size={18} strokeWidth={1.5} aria-label={`${name}'s profile photo placeholder`} />
            )}
        </span>
    );
}

function commentError(error: unknown): string {
    return error instanceof Error ? error.message : "The comment request failed. Please try again.";
}

export function subscribeCommentFragment(listener: () => void): () => void {
    const unsubscribeNavigation = subscribeBackNavigation(listener);
    window.addEventListener("hashchange", listener);
    return () => {
        unsubscribeNavigation();
        window.removeEventListener("hashchange", listener);
    };
}

export const getCommentFragment = () => window.location.hash;
const getServerCommentFragment = () => "";

export function BoardCommentRow({
    comment,
    boardId,
    epoch,
    loginHref,
    onUpdated,
    onDeleted
}: {
    comment: BoardComment;
    boardId: string;
    epoch: number;
    loginHref: string;
    onUpdated: (comment: BoardComment, epoch: number) => void;
    onDeleted: (commentId: number, epoch: number) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [editDraft, setEditDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState("");
    const [stale, setStale] = useState(false);
    const [loginRequired, setLoginRequired] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(() => comment.body.length > 280 || comment.body.split("\n").length > 4);
    const bodyRef = useRef<HTMLParagraphElement>(null);
    const busy = saving || deleting;

    useEffect(() => {
        if (editing || !bodyRef.current) return;
        const body = bodyRef.current;
        const measure = () => setCanExpand(body.scrollHeight > 97);
        const timer = window.setTimeout(measure, 0);
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        observer?.observe(body);
        window.addEventListener("resize", measure);
        return () => {
            window.clearTimeout(timer);
            observer?.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [comment.body, editing]);

    function startEdit() {
        setEditDraft(comment.body);
        setExpanded(false);
        setError("");
        setStale(false);
        setEditing(true);
    }

    async function saveEdit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !editDraft.trim()) return;
        setSaving(true);
        setError("");
        setStale(false);
        try {
            const updated = await editBoardComment(boardId, comment.commentId, editDraft.trim(), comment.revision);
            onUpdated(updated, epoch);
            setEditing(false);
        } catch (cause) {
            setStale(cause instanceof BoardCommentApiError && cause.status === 409 && cause.code === "STALE_COMMENT");
            setLoginRequired(cause instanceof BoardCommentApiError && cause.status === 401);
            setError(commentError(cause));
        } finally {
            setSaving(false);
        }
    }

    async function reloadAfterConflict() {
        if (busy) return;
        setSaving(true);
        try {
            const current = await reloadBoardComment(boardId, comment.commentId);
            if (!current) {
                setError("This comment is no longer available. Reload the Board to update the list.");
                return;
            }
            onUpdated(current, epoch);
            setStale(false);
            setError("");
        } catch (cause) {
            setError(commentError(cause));
        } finally {
            setSaving(false);
        }
    }

    async function removeComment() {
        if (busy) return;
        setDeleting(true);
        setError("");
        try {
            await deleteBoardComment(boardId, comment.commentId);
            onDeleted(comment.commentId, epoch);
        } catch (cause) {
            setLoginRequired(cause instanceof BoardCommentApiError && cause.status === 401);
            setError(commentError(cause));
            setDeleting(false);
        }
    }

    return (
        <li
            id={`comment-${comment.commentId}`}
            className="group/comment border-line flex scroll-mt-8 items-start gap-3 border-b py-5"
        >
            <CommentAvatar
                key={comment.author.profilePictureUrl ?? "no-photo"}
                name={comment.author.displayName}
                url={comment.author.profilePictureUrl}
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                    <div className="text-12 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <Link
                            href={`/profile/${encodeURIComponent(comment.author.username)}`}
                            className="font-medium hover:underline"
                        >
                            {comment.author.displayName}
                        </Link>
                        <span className="text-muted-foreground">@{comment.author.username}</span>
                        <time className="text-muted-foreground" dateTime={comment.createdAt} title={comment.createdAt}>
                            {relativeTime(comment.createdAt)}
                            {comment.editedAt ? " · edited" : ""}
                        </time>
                    </div>
                    {(comment.permissions.canEdit && !editing) || (comment.permissions.canDelete && !confirmDelete) ? (
                        <div className="pointer-events-none -my-2 flex shrink-0 opacity-0 transition-opacity group-focus-within/comment:pointer-events-auto group-focus-within/comment:opacity-100 group-hover/comment:pointer-events-auto group-hover/comment:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
                            {comment.permissions.canEdit && !editing ? (
                                <button
                                    type="button"
                                    onClick={startEdit}
                                    disabled={busy}
                                    aria-label="Edit comment"
                                    title="Edit comment"
                                    className="text-muted-foreground hover:text-foreground flex size-9 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Pencil size={17} strokeWidth={1.7} aria-hidden="true" />
                                </button>
                            ) : null}
                            {comment.permissions.canDelete && !confirmDelete ? (
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(true)}
                                    disabled={busy}
                                    aria-label="Delete comment"
                                    title="Delete comment"
                                    className="text-muted-foreground hover:text-foreground flex size-9 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Trash2 size={17} strokeWidth={1.7} aria-hidden="true" />
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                {editing ? (
                    <form onSubmit={(event) => void saveEdit(event)} className="mt-3">
                        <label className="sr-only" htmlFor={`edit-comment-${comment.commentId}`}>
                            Edit comment
                        </label>
                        <textarea
                            id={`edit-comment-${comment.commentId}`}
                            value={editDraft}
                            onChange={(event) => setEditDraft(limitCommentLength(event.target.value))}
                            aria-describedby={`edit-comment-count-${comment.commentId}`}
                            className={textareaClass}
                            disabled={busy}
                        />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <span
                                id={`edit-comment-count-${comment.commentId}`}
                                className="text-muted-foreground text-12"
                            >
                                {commentLength(editDraft)} / {boardCommentLimit.toLocaleString()}
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditing(false)}
                                    disabled={busy}
                                    className={actionClass}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={busy || !editDraft.trim()}
                                    className={primaryButtonClass}
                                >
                                    {saving ? "Saving…" : "Save"}
                                </button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <>
                        <p
                            ref={bodyRef}
                            id={`comment-body-${comment.commentId}`}
                            className={`text-14 mt-2 leading-6 break-words whitespace-pre-wrap ${expanded ? "" : "max-h-24 overflow-hidden"}`}
                        >
                            {comment.body}
                        </p>
                        {canExpand ? (
                            <button
                                type="button"
                                onClick={() => setExpanded((current) => !current)}
                                aria-expanded={expanded}
                                aria-controls={`comment-body-${comment.commentId}`}
                                className="text-muted-foreground hover:text-foreground text-12 mt-2 min-h-9 cursor-pointer underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                                {expanded ? "View less" : "View more"}
                            </button>
                        ) : null}
                    </>
                )}
                {confirmDelete ? (
                    <div className="text-12 mt-2 flex flex-wrap items-center gap-3">
                        Delete this comment?
                        <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            disabled={busy}
                            className={actionClass}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => void removeComment()}
                            disabled={busy}
                            className={actionClass}
                        >
                            {deleting ? "Deleting…" : "Confirm delete"}
                        </button>
                    </div>
                ) : null}
                {error ? (
                    <p role="alert" className="text-13 mt-2">
                        {error}{" "}
                        {loginRequired ? (
                            <Link href={loginHref} className="underline">
                                Sign in
                            </Link>
                        ) : null}
                    </p>
                ) : null}
                {stale ? (
                    <button
                        type="button"
                        onClick={() => void reloadAfterConflict()}
                        disabled={busy}
                        className={`${actionClass} mt-2`}
                    >
                        Reload current comment and keep my draft
                    </button>
                ) : null}
            </div>
        </li>
    );
}

export default function BoardComments({ boardId }: { boardId: string }) {
    const fragment = useSyncExternalStore(subscribeCommentFragment, getCommentFragment, getServerCommentFragment);
    const [viewer, setViewer] = useState<AuthUser | null | undefined>(undefined);
    const [accountEpoch, setAccountEpoch] = useState(0);
    const [comments, setComments] = useState<BoardComment[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [readError, setReadError] = useState("");
    const [readNeedsLogin, setReadNeedsLogin] = useState(false);
    const [olderBusy, setOlderBusy] = useState(false);
    const [olderError, setOlderError] = useState("");
    const [olderNeedsLogin, setOlderNeedsLogin] = useState(false);
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState("");
    const [postNeedsLogin, setPostNeedsLogin] = useState(false);
    const [subscription, setSubscription] = useState<boolean | null>(null);
    const [subscriptionBusy, setSubscriptionBusy] = useState(false);
    const [subscriptionError, setSubscriptionError] = useState("");
    const readVersionRef = useRef(0);
    const accountEpochRef = useRef(0);
    const subscriptionVersionRef = useRef(0);
    const postingRef = useRef(false);
    const olderRef = useRef(false);
    const loginHref = `/login?returnTo=${encodeURIComponent(`/boards/${boardId}#comments`)}`;

    const refreshSubscription = useCallback(
        async (epoch: number) => {
            const version = ++subscriptionVersionRef.current;
            try {
                const result = await getCommentSubscription(boardId);
                if (epoch === accountEpochRef.current && version === subscriptionVersionRef.current) {
                    setSubscription(result.enabled);
                    setSubscriptionError("");
                }
            } catch (cause) {
                if (epoch === accountEpochRef.current && version === subscriptionVersionRef.current)
                    setSubscriptionError(commentError(cause));
            }
        },
        [boardId]
    );

    const loadFirst = useCallback(async () => {
        const version = ++readVersionRef.current;
        olderRef.current = false;
        setLoading(true);
        setReadError("");
        setReadNeedsLogin(false);
        setOlderError("");
        setOlderNeedsLogin(false);
        setOlderBusy(false);
        setComments([]);
        setNextCursor(null);
        try {
            const page = await listBoardComments(boardId);
            if (version !== readVersionRef.current) return;
            setComments(page.data);
            setNextCursor(page.meta.nextCursor);
        } catch (cause) {
            if (version === readVersionRef.current) {
                setReadNeedsLogin(cause instanceof BoardCommentApiError && cause.status === 401);
                setReadError(commentError(cause));
            }
        } finally {
            if (version === readVersionRef.current) setLoading(false);
        }
    }, [boardId]);

    useEffect(() => {
        const unsubscribe = observeCurrentUser((user) => {
            accountEpochRef.current += 1;
            subscriptionVersionRef.current += 1;
            setAccountEpoch(accountEpochRef.current);
            postingRef.current = false;
            olderRef.current = false;
            setViewer(user);
            setDraft("");
            setPostError("");
            setPosting(false);
            setOlderBusy(false);
            setSubscription(null);
            setSubscriptionBusy(false);
            setSubscriptionError("");
            if (user) void refreshSubscription(accountEpochRef.current);
            void loadFirst();
        });
        return () => {
            readVersionRef.current += 1;
            accountEpochRef.current += 1;
            subscriptionVersionRef.current += 1;
            unsubscribe();
        };
    }, [loadFirst, refreshSubscription]);

    const loadOlder = useCallback(async () => {
        if (!nextCursor || olderRef.current || loading) return;
        olderRef.current = true;
        const version = readVersionRef.current;
        setOlderBusy(true);
        setOlderError("");
        setOlderNeedsLogin(false);
        try {
            const page = await listBoardComments(boardId, nextCursor);
            if (version !== readVersionRef.current) return;
            setComments((current) => {
                const known = new Set(current.map((item) => item.commentId));
                return [...current, ...page.data.filter((item) => !known.has(item.commentId))];
            });
            setNextCursor(page.meta.nextCursor);
        } catch (cause) {
            if (version === readVersionRef.current) {
                setOlderNeedsLogin(cause instanceof BoardCommentApiError && cause.status === 401);
                setOlderError(commentError(cause));
            }
        } finally {
            if (version === readVersionRef.current) {
                olderRef.current = false;
                setOlderBusy(false);
            }
        }
    }, [nextCursor, loading, boardId]);

    useEffect(() => {
        if (typeof window === "undefined" || loading || readError) return;
        const match = /^#comment-(\d+)$/.exec(fragment);
        if (!match) return;
        const targetId = Number(match[1]);
        if (comments.some((comment) => comment.commentId === targetId)) {
            const frame = window.requestAnimationFrame(() =>
                document.getElementById(`comment-${targetId}`)?.scrollIntoView()
            );
            return () => window.cancelAnimationFrame(frame);
        } else if (nextCursor && !olderBusy && !olderError) {
            const timer = window.setTimeout(() => void loadOlder(), 0);
            return () => window.clearTimeout(timer);
        }
    }, [fragment, comments, loading, readError, nextCursor, olderBusy, olderError, loadOlder]);

    async function submitComment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!viewer || loading || postingRef.current || !draft.trim()) return;
        postingRef.current = true;
        const epoch = accountEpochRef.current;
        setPosting(true);
        setPostError("");
        setPostNeedsLogin(false);
        try {
            const created = await postBoardComment(boardId, draft.trim());
            if (epoch !== accountEpochRef.current) return;
            setComments((current) => [created, ...current.filter((item) => item.commentId !== created.commentId)]);
            setDraft("");
            notifyCommentNotificationUpdate();
            void refreshSubscription(epoch);
        } catch (cause) {
            if (epoch !== accountEpochRef.current) return;
            setPostNeedsLogin(cause instanceof BoardCommentApiError && cause.status === 401);
            setPostError(commentError(cause));
        } finally {
            if (epoch === accountEpochRef.current) {
                postingRef.current = false;
                setPosting(false);
            }
        }
    }

    function updateComment(updated: BoardComment, epoch: number) {
        if (epoch !== accountEpochRef.current) return;
        setComments((current) => current.map((item) => (item.commentId === updated.commentId ? updated : item)));
    }

    function removeComment(commentId: number, epoch: number) {
        if (epoch !== accountEpochRef.current) return;
        setComments((current) => current.filter((item) => item.commentId !== commentId));
    }

    async function toggleSubscription() {
        if (!viewer || subscription === null || subscriptionBusy) return;
        const epoch = accountEpochRef.current;
        const version = ++subscriptionVersionRef.current;
        setSubscriptionBusy(true);
        setSubscriptionError("");
        try {
            const result = await setCommentSubscription(boardId, !subscription);
            if (epoch === accountEpochRef.current && version === subscriptionVersionRef.current)
                setSubscription(result.enabled);
        } catch (cause) {
            if (epoch === accountEpochRef.current && version === subscriptionVersionRef.current)
                setSubscriptionError(commentError(cause));
        } finally {
            if (epoch === accountEpochRef.current) setSubscriptionBusy(false);
        }
    }

    return (
        <section
            id="comments"
            aria-labelledby="comments-heading"
            className="border-line scroll-mt-8 border-t px-5 py-10 sm:px-9 sm:py-12"
        >
            <div className="mx-auto w-full max-w-3xl">
                <div className="border-foreground flex items-center justify-between gap-3 border-b pb-5">
                    <h2 id="comments-heading" className="font-display text-36">
                        Comments
                    </h2>
                    {viewer ? (
                        <button
                            type="button"
                            onClick={() => void toggleSubscription()}
                            disabled={subscription === null || subscriptionBusy}
                            aria-pressed={subscription === true}
                            aria-busy={subscriptionBusy}
                            aria-label={
                                subscription ? "Turn off comment notifications" : "Turn on comment notifications"
                            }
                            title={subscription ? "Turn off comment notifications" : "Turn on comment notifications"}
                            className="text-muted-foreground hover:text-foreground hover:bg-faint flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Bell size={20} fill={subscription ? "currentColor" : "none"} aria-hidden="true" />
                        </button>
                    ) : null}
                </div>
                {subscriptionError ? (
                    <p role="alert" className="text-13 mt-3">
                        Could not update comment notifications. {subscriptionError}{" "}
                        {viewer ? (
                            <button
                                type="button"
                                onClick={() => void refreshSubscription(accountEpochRef.current)}
                                className={actionClass}
                            >
                                Retry
                            </button>
                        ) : null}
                    </p>
                ) : null}
                <div className="border-line border-b py-7">
                    {viewer === undefined ? (
                        <p role="status" className="text-muted-foreground text-14">
                            Checking your account…
                        </p>
                    ) : viewer === null ? (
                        <p className="text-14">
                            <Link
                                href={loginHref}
                                className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                            >
                                Sign in to comment
                            </Link>
                            . You’ll return to this Board afterward.
                        </p>
                    ) : (
                        <div className="flex items-start gap-3">
                            <CommentAvatar name={viewer.displayName} url={viewer.profilePictureUrl} />
                            <form onSubmit={(event) => void submitComment(event)} className="min-w-0 flex-1">
                                <label htmlFor="board-comment-draft" className="sr-only">
                                    Your comment
                                </label>
                                <textarea
                                    id="board-comment-draft"
                                    value={draft}
                                    onChange={(event) => setDraft(limitCommentLength(event.target.value))}
                                    placeholder="Share a thought about this Board…"
                                    aria-describedby="board-comment-count"
                                    className={textareaClass}
                                    disabled={posting}
                                />
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                                    <span id="board-comment-count" className="text-muted-foreground text-12">
                                        {commentLength(draft)} / {boardCommentLimit.toLocaleString()}
                                    </span>
                                    <button
                                        type="submit"
                                        disabled={posting || loading || !draft.trim()}
                                        className={primaryButtonClass}
                                    >
                                        {posting ? "Posting…" : "Post comment"}
                                    </button>
                                </div>
                                {postError ? (
                                    <p role="alert" className="text-13 mt-3">
                                        {postError}{" "}
                                        {postNeedsLogin ? (
                                            <Link href={loginHref} className="underline">
                                                Sign in
                                            </Link>
                                        ) : null}
                                    </p>
                                ) : null}
                            </form>
                        </div>
                    )}
                </div>
                {loading ? (
                    <p role="status" className="text-muted-foreground text-14">
                        Loading comments…
                    </p>
                ) : null}
                {!loading && readError ? (
                    <div className="text-14">
                        <p role="alert">
                            {readNeedsLogin ? "Sign in to view comments." : `Could not load comments. ${readError}`}
                        </p>
                        {readNeedsLogin ? (
                            <Link href={loginHref} className="mt-4 inline-block underline underline-offset-4">
                                Sign in
                            </Link>
                        ) : (
                            <button type="button" onClick={() => void loadFirst()} className={`${buttonClass} mt-4`}>
                                Retry
                            </button>
                        )}
                    </div>
                ) : null}
                {!loading && !readError && comments.length === 0 ? (
                    <p className="text-muted-foreground text-14">No comments yet. Start the conversation.</p>
                ) : null}
                {comments.length > 0 ? (
                    <ol>
                        {comments.map((comment) => (
                            <BoardCommentRow
                                key={comment.commentId}
                                comment={comment}
                                boardId={boardId}
                                epoch={accountEpoch}
                                loginHref={loginHref}
                                onUpdated={updateComment}
                                onDeleted={removeComment}
                            />
                        ))}
                    </ol>
                ) : null}
                {nextCursor && !loading ? (
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => void loadOlder()}
                            disabled={olderBusy}
                            className={buttonClass}
                        >
                            {olderBusy ? "Loading older…" : "Load older"}
                        </button>
                        {olderError ? (
                            <p role="alert" className="text-13 mt-2">
                                {olderNeedsLogin ? "Sign in to load older comments." : `${olderError} Try again above.`}{" "}
                                {olderNeedsLogin ? (
                                    <Link href={loginHref} className="underline">
                                        Sign in
                                    </Link>
                                ) : null}
                            </p>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
