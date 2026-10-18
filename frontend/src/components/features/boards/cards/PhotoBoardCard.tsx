"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark, Check, Globe2, LoaderCircle, LockKeyhole, UsersRound } from "lucide-react";
import type { PhotoBoardCardData, PhotoBoardCardProps } from "@/types/board-card";
import { BoardCardFrame, BoardCardPhoto, BoardCardTitle } from "./BoardCardParts";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white";
const validCount = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value >= 0;

function PhotoCover({ board, sizes, expanded }: { board: PhotoBoardCardData; sizes?: string; expanded: boolean }) {
    const [failedSource, setFailedSource] = useState<string>();
    const image = board.image;
    const available = image?.src && image.src !== failedSource;
    return (
        <>
            <div aria-hidden="true" className="absolute inset-0 bg-[#253436]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_30%,#68786d_0%,transparent_65%)]" />
                <span className="absolute inset-[12%] border border-white/10" />
                <span className="absolute inset-[16%] border border-white/5" />
            </div>
            {available ? (
                <BoardCardPhoto
                    image={image}
                    onError={() => setFailedSource(image.src)}
                    sizes={
                        sizes ??
                        (image.crop
                            ? `(max-width: 400px) ${image.crop.width}vw, ${Math.ceil(image.crop.width * 4)}px`
                            : "(max-width: 400px) 100vw, 400px")
                    }
                    className="absolute! inset-0"
                />
            ) : (
                <span
                    className={
                        expanded ? "sr-only" : "absolute top-[55%] left-[6.5%] text-xs tracking-[.12em] text-white/60"
                    }
                >
                    No cover photo
                </span>
            )}
        </>
    );
}

function visibilityLabel(board: PhotoBoardCardData) {
    if (board.status === "draft") return "Draft — only you can view this Board";
    switch (board.visibility) {
        case "public":
            return "Public — anyone can view this Board";
        case "friends":
            return "Friends — you, your friends and invited Board members can view this Board";
        case "collaborators":
            return "Restricted access — you and invited Board members can view this Board";
        default:
            return "Visibility unavailable";
    }
}

export default function PhotoBoardCard(props: PhotoBoardCardProps) {
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const systemReducedMotion = useReducedMotion();
    const detailsId = useId();
    const pointerType = useRef("");
    return (
        <PhotoBoardCardContent
            {...props}
            detailsId={detailsId}
            pointerType={pointerType}
            reduceMotion={props.reduceMotion || Boolean(systemReducedMotion)}
            expanded={!dismissed && (hovered || focused || pinned)}
            onExpandedChange={(open) => {
                setPinned(open);
                setDismissed(!open);
            }}
            onHoverChange={(active) => {
                setHovered(active);
                if (active) setDismissed(false);
            }}
            onFocusChange={(active) => {
                setFocused(active);
                if (active) setDismissed(false);
                else setPinned(false);
            }}
        />
    );
}

type ContentProps = PhotoBoardCardProps & {
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    detailsId: string;
    onHoverChange?: (active: boolean) => void;
    onFocusChange?: (active: boolean) => void;
    pointerType?: { current: string; expandedOnPointerDown?: boolean };
};

// Controlled presenter keeps the real interaction handlers independently testable.
export function PhotoBoardCardContent({
    board,
    href,
    details = false,
    ownership = "unknown",
    save,
    reduceMotion = false,
    imageSizes,
    selection,
    expanded: requestedExpanded,
    onExpandedChange,
    detailsId,
    pointerType = { current: "" },
    onHoverChange,
    onFocusChange
}: ContentProps) {
    const tags = [...new Set(board.tags?.map((tag) => tag.trim()).filter(Boolean))].slice(0, 3);
    const hasCount = validCount(board.savedCount);
    const hasDays = validCount(board.durationDays) && board.durationDays! > 0;
    const hasDetails =
        details && Boolean(board.destination.trim() || tags.length || board.description?.trim() || hasCount || hasDays);
    const expanded = hasDetails && requestedExpanded;
    const ownerControl =
        ownership === "owner" &&
        (board.status === "draft" || (board.status === "published" && Boolean(board.visibility)));
    const saveControl = ownership === "other" && board.status !== "draft" && save;
    const enhanced = hasDetails || ownerControl || Boolean(saveControl);
    const feedbackId = `${detailsId}-feedback`;
    const saved = save?.state === "saved";
    const unresolved = save?.state === "unknown";
    const VisibilityIcon =
        board.status === "draft" || board.visibility === "collaborators"
            ? LockKeyhole
            : board.visibility === "friends"
              ? UsersRound
              : Globe2;
    const transition = { duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] as const };
    const coverTitle = (
        <>
            <BoardCardTitle
                board={board}
                className={`font-body absolute top-[5.75cqw] left-[6.5cqw] line-clamp-2 max-w-[87cqw] text-[10cqw] leading-none font-bold [overflow-wrap:anywhere] ${ownerControl || saveControl ? "pr-[max(44px,10cqw)]" : ""}`}
            />
            {board.author && (
                <p
                    className={`font-body absolute top-[28.25cqw] left-[6.5cqw] line-clamp-2 max-w-[83cqw] [overflow-wrap:anywhere] ${enhanced ? "text-[max(12px,3.5cqw)] leading-tight" : "text-[3.5cqw] leading-none"}`}
                    title={`by ${board.author}`}
                >
                    by {board.author}
                </p>
            )}
        </>
    );
    const lettering = (
        <span
            aria-hidden="true"
            className="font-body absolute top-[98.75cqw] text-[32cqw] leading-[1.02] font-bold whitespace-nowrap text-[#ebebeb]"
            style={{ left: `${board.labelOffset ?? 40.75}%` }}
        >
            {board.destinationLabel}
        </span>
    );
    return (
        <motion.div
            initial={false}
            data-photo-board-expanded={expanded}
            onPointerDownCapture={(event) => {
                pointerType.current = event.pointerType;
                pointerType.expandedOnPointerDown = expanded;
            }}
            onHoverStart={hasDetails ? () => onHoverChange?.(true) : undefined}
            onHoverEnd={() => onHoverChange?.(false)}
            onFocusCapture={(event) => {
                if (
                    hasDetails &&
                    !event.currentTarget.contains(event.relatedTarget) &&
                    event.target.matches(":focus-visible")
                )
                    onFocusChange?.(true);
            }}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) onFocusChange?.(false);
            }}
            onKeyDown={(event) => {
                pointerType.current = "";
                if (event.key === "Escape" && expanded) {
                    event.stopPropagation();
                    onExpandedChange(false);
                }
            }}
            className="relative w-full"
        >
            <BoardCardFrame
                board={board}
                width={400}
                height={500}
                href={selection ? undefined : href}
                linkProps={
                    hasDetails
                        ? {
                              "aria-describedby": expanded ? detailsId : undefined,
                              onClick: (event) => {
                                  const preview =
                                      event.detail !== 0 &&
                                      pointerType.current === "touch" &&
                                      !pointerType.expandedOnPointerDown;
                                  pointerType.current = "";
                                  // Touch gets a preview before navigation; mouse and keyboard keep their normal link action.
                                  if (preview) {
                                      event.preventDefault();
                                      onExpandedChange(true);
                                  }
                              }
                          }
                        : undefined
                }
                className="overflow-clip text-white [&>a]:focus-visible:outline-offset-[-4px] [&>a]:focus-visible:outline-white"
            >
                <PhotoCover board={board} sizes={imageSizes} expanded={expanded} />
                {selection && (
                    <button
                        type="button"
                        data-board-selection=""
                        aria-label={selection.label ?? `Select ${board.title}`}
                        aria-pressed={selection.selected}
                        aria-expanded={hasDetails ? expanded : undefined}
                        aria-controls={hasDetails ? detailsId : undefined}
                        tabIndex={selection.tabIndex}
                        onClick={(event) => {
                            selection.onSelect(event);
                            if (hasDetails && selection.selected && !event.defaultPrevented)
                                onExpandedChange(!expanded);
                        }}
                        className={`absolute inset-0 z-10 cursor-pointer ${focus}`}
                    />
                )}
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(-13.907deg,rgba(0,0,0,0)_0%,#000_100%)]"
                />
                {hasDetails && (
                    <motion.span
                        aria-hidden="true"
                        initial={false}
                        animate={{ opacity: expanded ? 1 : 0 }}
                        transition={transition}
                        className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(4,16,18,.7),rgba(4,16,18,.12)_60%,rgba(4,16,18,.65))]"
                    />
                )}
                {hasDetails ? (
                    <motion.div
                        initial={false}
                        animate={{ opacity: expanded ? 0 : 1, y: expanded && !reduceMotion ? -8 : 0 }}
                        transition={{
                            ...transition,
                            opacity: { duration: reduceMotion ? 0 : 0.12, delay: expanded || reduceMotion ? 0 : 0.12 }
                        }}
                        className="pointer-events-none absolute inset-0"
                    >
                        {coverTitle}
                    </motion.div>
                ) : (
                    coverTitle
                )}
                {hasDetails ? (
                    <motion.div
                        initial={false}
                        animate={{ opacity: expanded ? 0.12 : 1, y: expanded && !reduceMotion ? 18 : 0 }}
                        transition={transition}
                        className="pointer-events-none absolute inset-0"
                    >
                        {lettering}
                    </motion.div>
                ) : (
                    lettering
                )}
                {hasDetails && (
                    <motion.div
                        id={detailsId}
                        aria-label="Board details"
                        aria-hidden={!expanded}
                        inert={!expanded}
                        initial={false}
                        animate={expanded ? "open" : "closed"}
                        variants={{
                            open: {
                                opacity: 1,
                                transition: {
                                    duration: reduceMotion ? 0 : 0.2,
                                    delay: reduceMotion ? 0 : 0.12,
                                    delayChildren: reduceMotion ? 0 : 0.12,
                                    staggerChildren: reduceMotion ? 0 : 0.045
                                }
                            },
                            closed: { opacity: 0, transition: { duration: reduceMotion ? 0 : 0.1 } }
                        }}
                        className="pointer-events-none absolute inset-x-[6.5%] top-[6.5%] bottom-[19%] flex flex-col"
                    >
                        <p className="mb-[8cqw] pr-10 text-[10px] tracking-[.22em] text-white/65">THE JOURNEY</p>
                        <motion.div
                            variants={{ open: { y: 0, opacity: 1 }, closed: { y: reduceMotion ? 0 : 10, opacity: 0 } }}
                            transition={transition}
                        >
                            <p className="line-clamp-2 pb-[.12em] text-[clamp(24px,8cqw,44px)] leading-[1.12] font-medium tracking-[-.04em] [overflow-wrap:anywhere]">
                                {board.destination.trim() || board.title}
                            </p>
                            {board.description?.trim() && (
                                <p className="mt-[4cqw] hidden text-[clamp(12px,3.25cqw,15px)] leading-relaxed [overflow-wrap:anywhere] text-white/75 @min-[360px]:line-clamp-2">
                                    {board.description}
                                </p>
                            )}
                        </motion.div>
                        {tags.length > 0 && (
                            <motion.ul
                                aria-label="Board tags"
                                variants={{
                                    open: { y: 0, opacity: 1 },
                                    closed: { y: reduceMotion ? 0 : 10, opacity: 0 }
                                }}
                                transition={transition}
                                className="mt-[5cqw] flex flex-wrap gap-x-3 gap-y-2 text-[clamp(12px,3cqw,14px)] leading-snug text-white/90"
                            >
                                {tags.map((tag) => (
                                    <li
                                        key={tag}
                                        className="max-w-full truncate border-l border-white/35 pl-2.5"
                                        title={tag}
                                    >
                                        {tag}
                                    </li>
                                ))}
                            </motion.ul>
                        )}
                        <motion.div
                            variants={{ open: { scaleX: 1 }, closed: { scaleX: reduceMotion ? 1 : 0 } }}
                            transition={
                                reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 24 }
                            }
                            aria-hidden="true"
                            className="mt-auto mb-[3cqw] h-px origin-left bg-white/35"
                        />
                        <motion.p
                            variants={{ open: { y: 0, opacity: 1 }, closed: { y: reduceMotion ? 0 : 6, opacity: 0 } }}
                            transition={transition}
                            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[clamp(12px,3cqw,14px)] text-white/80 tabular-nums"
                        >
                            {hasDays && (
                                <span>
                                    {board.durationDays} {board.durationDays === 1 ? "day" : "days"}
                                </span>
                            )}
                            {hasCount && (
                                <span className="inline-flex items-center gap-2">
                                    <Bookmark aria-hidden="true" size={13} />
                                    {new Intl.NumberFormat("en-US").format(board.savedCount!)}{" "}
                                    {board.savedCount === 1 ? "save" : "saves"}
                                </span>
                            )}
                        </motion.p>
                    </motion.div>
                )}
                {ownerControl && (
                    <span
                        role="img"
                        aria-label={visibilityLabel(board)}
                        title={visibilityLabel(board)}
                        className="pointer-events-auto absolute top-[3%] right-[3%] z-20 grid size-11 place-items-center rounded-full bg-black/20 backdrop-blur-sm"
                    >
                        <VisibilityIcon aria-hidden="true" size={17} strokeWidth={1.5} />
                    </span>
                )}
                {saveControl && (
                    <button
                        type="button"
                        disabled={save.pending || unresolved || !save.onToggle}
                        aria-label={
                            unresolved
                                ? `Save status unavailable for ${board.title}`
                                : save.pending
                                  ? `${saved ? "Removing" : "Saving"} ${board.title}…`
                                  : `${saved ? "Unsave" : "Save"} ${board.title}`
                        }
                        aria-pressed={unresolved ? undefined : saved}
                        aria-busy={save.pending || undefined}
                        aria-describedby={save.message || save.error ? feedbackId : undefined}
                        title={
                            unresolved
                                ? "Save status is not available yet"
                                : saved
                                  ? "Remove saved Board"
                                  : "Save Board"
                        }
                        onPointerDownCapture={(event) => event.stopPropagation()}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (!save.pending && !unresolved) save.onToggle?.();
                        }}
                        className={`absolute top-[3%] right-[3%] z-20 grid size-11 cursor-pointer place-items-center rounded-full bg-black/20 backdrop-blur-sm disabled:cursor-default disabled:opacity-60 ${focus}`}
                    >
                        <AnimatePresence initial={false} mode="wait">
                            <motion.span
                                key={save.pending ? "pending" : save.state}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.12 }}
                            >
                                {save.pending ? (
                                    <LoaderCircle aria-hidden="true" size={17} className="motion-safe:animate-spin" />
                                ) : (
                                    <Bookmark
                                        aria-hidden="true"
                                        size={17}
                                        strokeWidth={1.5}
                                        fill={saved ? "currentColor" : "none"}
                                    />
                                )}
                            </motion.span>
                        </AnimatePresence>
                        {unresolved && (
                            <span aria-hidden="true" className="absolute right-2 bottom-1 text-[10px]">
                                ?
                            </span>
                        )}
                    </button>
                )}
                {hasDetails && !selection && !href && (
                    <button
                        type="button"
                        data-board-disclosure=""
                        aria-label={`${expanded ? "Hide" : "Show"} details for ${board.title}`}
                        aria-expanded={expanded}
                        aria-controls={detailsId}
                        onClick={(event) => {
                            event.stopPropagation();
                            onExpandedChange(!expanded);
                        }}
                        className={`absolute inset-0 z-10 cursor-pointer ${focus}`}
                    />
                )}
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 border border-[#565656]" />
            </BoardCardFrame>
            {board.image?.credit && (
                <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed">
                    Photo by{" "}
                    {board.image.creditUrl ? (
                        <a
                            href={board.image.creditUrl}
                            tabIndex={selection && !selection.selected ? -1 : undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2"
                        >
                            {board.image.credit}
                        </a>
                    ) : (
                        board.image.credit
                    )}
                    {board.image.sourceUrl && (
                        <>
                            {" "}
                            ·{" "}
                            <a
                                href={board.image.sourceUrl}
                                tabIndex={selection && !selection.selected ? -1 : undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-2"
                            >
                                Source
                            </a>
                        </>
                    )}
                </p>
            )}
            {enhanced && saveControl && (
                <p
                    id={feedbackId}
                    role={save.error ? "alert" : "status"}
                    className="text-foreground mt-3 flex min-h-10 items-start gap-2 text-xs leading-relaxed"
                >
                    {save.message && !save.error && <Check aria-hidden="true" size={14} className="mt-0.5 shrink-0" />}
                    <span>
                        {save.error || save.message}
                        {save.signInHref && (
                            <>
                                {" "}
                                <Link href={save.signInHref} className="underline underline-offset-4">
                                    Sign in
                                </Link>
                            </>
                        )}
                    </span>
                </p>
            )}
        </motion.div>
    );
}
