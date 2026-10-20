"use client";

import Link from "next/link";
import Image from "next/image";
import { createContext, useContext, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
    Bookmark,
    Check,
    Eye,
    Globe2,
    Info,
    LoaderCircle,
    LockKeyhole,
    Pencil,
    Plus,
    UserRound,
    UsersRound
} from "lucide-react";
import type { PhotoBoardCardData, PhotoBoardCardProps } from "@/types/board-card";
import { BoardCardFrame, BoardCardPhoto, BoardCardTitle } from "./BoardCardParts";
import BoardCardTilt from "./BoardCardTilt";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white";
const validCount = (value: number | undefined) => value !== undefined && Number.isSafeInteger(value) && value >= 0;
export const BoardDragContext = createContext(false);

export function BoardAuthorAvatar({ src }: { src?: string | null }) {
    const [failedSource, setFailedSource] = useState<string>();
    return src && src !== failedSource ? (
        <Image
            src={src}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="size-full rounded-full object-cover"
            onError={() => setFailedSource(src)}
        />
    ) : (
        <UserRound aria-hidden="true" size={20} strokeWidth={1.5} />
    );
}

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
    const listDragging = useContext(BoardDragContext);
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const systemReducedMotion = useReducedMotion();
    const detailsId = useId();
    const pointerType = useRef("");
    const content = (
        <PhotoBoardCardContent
            {...props}
            suppressHover={props.suppressHover || listDragging}
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
    return props.tilt ? (
        <BoardCardTilt active={!props.reduceMotion && !props.suppressHover && !listDragging}>{content}</BoardCardTilt>
    ) : (
        content
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
    presentation = "interactive",
    ownership = "unknown",
    save,
    reduceMotion = false,
    imageSizes,
    hideCoverCredit = false,
    suppressHover = false,
    showVisibility = false,
    hoverActions,
    selection,
    expanded: requestedExpanded,
    onExpandedChange,
    detailsId,
    pointerType = { current: "" },
    onHoverChange,
    onFocusChange
}: ContentProps) {
    const tags = [...new Set(board.tags?.map((tag) => tag.trim()).filter(Boolean))].slice(0, 3);
    const selectedProfile = Boolean((selection?.selected && (selection.href || selection.viewHref)) || hoverActions);
    const editHref =
        hoverActions?.editHref ?? (selection?.selected && !selection.remixHref ? selection.href : undefined);
    const viewHref =
        hoverActions?.viewHref ??
        (selection?.selected && board.status !== "draft"
            ? (selection.viewHref ?? (selection.remixHref ? selection.href : undefined))
            : undefined);
    const remixHref = selection?.selected ? selection.remixHref : undefined;
    const actionLayout = Boolean(hoverActions || (selection?.selected && (selection.href || selection.viewHref)));
    const authorHandle = board.author.trim().replace(/^@/, "");
    const suppressCoverCredit =
        hideCoverCredit &&
        [board.image?.src, board.image?.creditUrl, board.image?.sourceUrl].some((value) =>
            /^https:\/\/(?:[a-z0-9-]+\.)?unsplash\.com(?:\/|$)/i.test(value ?? "")
        );
    const hasCount = validCount(board.savedCount);
    const hasActivities = validCount(board.activityCount);
    const hasDays = validCount(board.durationDays) && board.durationDays! > 0;
    const hasDetails =
        presentation === "details" ||
        (details &&
            Boolean(
                board.destination.trim() ||
                tags.length ||
                board.description?.trim() ||
                hasCount ||
                hasDays ||
                hasActivities
            ));
    const interactiveDetails = hasDetails && presentation === "interactive";
    const expanded =
        hasDetails &&
        !suppressHover &&
        (presentation === "details" || (presentation === "interactive" && requestedExpanded));
    const actionVisibility = `${expanded ? "opacity-100 delay-100" : "pointer-events-none opacity-0"} ${suppressHover ? "" : "[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"}`;
    const ownerControl =
        ownership === "owner" &&
        (board.status === "draft" || (board.status === "published" && Boolean(board.visibility)));
    const visibilityControl =
        ownerControl ||
        (showVisibility && (board.status === "draft" || (board.status === "published" && Boolean(board.visibility))));
    const saveControl = ownership === "other" && board.status !== "draft" && save;
    const enhanced = hasDetails || visibilityControl || Boolean(saveControl);
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
                className={`font-body absolute top-[5.75cqw] left-[6.5cqw] line-clamp-2 max-w-[87cqw] text-[10cqw] leading-none font-bold [overflow-wrap:anywhere] ${selectedProfile ? "[@media(hover:none)]:top-[calc(6.5%+3.75rem)]" : ""} ${visibilityControl || saveControl ? "pr-[max(44px,10cqw)]" : ""}`}
            />
            {board.author && (
                <p
                    className={`font-body absolute top-[28.25cqw] left-[6.5cqw] line-clamp-2 max-w-[83cqw] [overflow-wrap:anywhere] ${selectedProfile ? "[@media(hover:none)]:hidden" : ""} ${enhanced ? "text-[max(12px,3.5cqw)] leading-tight" : "text-[3.5cqw] leading-none"}`}
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
            onPointerDownCapture={
                presentation === "interactive"
                    ? (event) => {
                          pointerType.current = event.pointerType;
                          pointerType.expandedOnPointerDown = expanded;
                      }
                    : undefined
            }
            onHoverStart={interactiveDetails && !suppressHover ? () => onHoverChange?.(true) : undefined}
            onHoverEnd={presentation === "interactive" ? () => onHoverChange?.(false) : undefined}
            onPointerLeave={
                presentation === "interactive"
                    ? (event) => {
                          onHoverChange?.(false);
                          if (event.buttons) {
                              onFocusChange?.(false);
                              onExpandedChange(false);
                          }
                      }
                    : undefined
            }
            onFocusCapture={
                presentation === "interactive"
                    ? (event) => {
                          if (
                              hasDetails &&
                              !event.currentTarget.contains(event.relatedTarget) &&
                              event.target.matches(":focus-visible")
                          )
                              onFocusChange?.(true);
                      }
                    : undefined
            }
            onBlurCapture={
                presentation === "interactive"
                    ? (event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) onFocusChange?.(false);
                      }
                    : undefined
            }
            onKeyDown={
                presentation === "interactive"
                    ? (event) => {
                          pointerType.current = "";
                          if (event.key === "Escape" && expanded) {
                              event.stopPropagation();
                              onExpandedChange(false);
                          }
                      }
                    : undefined
            }
            onDragStartCapture={(event) => event.preventDefault()}
            className="relative w-full"
        >
            <BoardCardFrame
                board={board}
                width={400}
                height={500}
                href={selection ? undefined : href}
                linkProps={
                    interactiveDetails && !hoverActions
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
                className="group/card overflow-clip text-white [&>a]:focus-visible:outline-offset-[-4px] [&>a]:focus-visible:outline-white"
            >
                <PhotoCover board={board} sizes={imageSizes} expanded={expanded} />
                {selectedProfile && authorHandle && (
                    <Link
                        href={`/profile/${encodeURIComponent(authorHandle)}`}
                        data-board-selection=""
                        aria-label={`View @${authorHandle}'s profile`}
                        title={`@${authorHandle}`}
                        tabIndex={selection?.tabIndex}
                        className={`absolute top-[6.5%] left-[6.5%] z-20 inline-flex min-h-11 max-w-[87%] items-center gap-3 text-white ${actionVisibility} transition-[opacity,transform] duration-150 motion-safe:hover:scale-105 motion-safe:focus-visible:scale-105 motion-reduce:transition-none ${focus}`}
                    >
                        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-white/40 bg-black/45 backdrop-blur-sm">
                            <BoardAuthorAvatar src={board.authorPhotoUrl} />
                        </span>
                        <span className="min-w-0 truncate text-xs tracking-[.22em] text-white/65">@{authorHandle}</span>
                    </Link>
                )}
                {actionLayout && (
                    <div
                        className={`pointer-events-none absolute bottom-[calc(6.5%+5rem)] z-20 flex justify-center gap-[clamp(1.5rem,20cqw,6rem)] ${saveControl ? "right-[calc(28.25%-0.875rem)]" : "inset-x-[6.5%]"}`}
                    >
                        {[
                            ...(editHref ? [{ href: editHref, label: `Edit ${board.title}`, Icon: Pencil }] : []),
                            ...(remixHref ? [{ href: remixHref, label: `Remix ${board.title}`, Icon: Plus }] : []),
                            ...(viewHref ? [{ href: viewHref, label: `View ${board.title}`, Icon: Eye }] : [])
                        ].map(({ href: actionHref, label, Icon }) => (
                            <Link
                                key={label}
                                href={actionHref}
                                data-board-selection=""
                                aria-label={label}
                                tabIndex={selection?.tabIndex}
                                className={`pointer-events-auto grid size-14 shrink-0 place-items-center rounded-full border border-white/40 bg-black/45 text-white backdrop-blur-sm ${actionVisibility} transition-[opacity,transform] duration-150 motion-safe:hover:scale-105 motion-safe:focus-visible:scale-105 motion-reduce:transition-none ${focus}`}
                            >
                                <Icon aria-hidden="true" size={23} strokeWidth={1.5} />
                            </Link>
                        ))}
                    </div>
                )}
                {selection?.selected && (selection.viewHref || selection.href) ? (
                    <Link
                        href={selection.viewHref ?? selection.href!}
                        data-board-selection=""
                        aria-label={`Open ${board.title}`}
                        tabIndex={selection.tabIndex}
                        onClick={selection.onNavigate}
                        aria-describedby={hasDetails && expanded ? detailsId : undefined}
                        className={`absolute inset-0 z-10 cursor-pointer ${focus}`}
                    />
                ) : (
                    selection && (
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
                                if (interactiveDetails && selection.selected && !event.defaultPrevented)
                                    onExpandedChange(!expanded);
                            }}
                            className={`absolute inset-0 z-10 cursor-pointer ${focus}`}
                        />
                    )
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
                        className={`pointer-events-none absolute inset-x-[6.5%] top-[6.5%] flex flex-col ${actionLayout ? "bottom-[6.5%]" : "bottom-[19%]"}`}
                    >
                        <div
                            className={
                                actionLayout ? "absolute inset-x-0 top-0 bottom-[9.5rem] overflow-hidden" : "contents"
                            }
                        >
                            {selectedProfile && authorHandle ? (
                                <div aria-hidden="true" className="mb-3 h-12 shrink-0" />
                            ) : (
                                <p className="mb-[8cqw] truncate pr-10 text-[10px] tracking-[.22em] text-white/65">
                                    THE JOURNEY
                                </p>
                            )}
                            <motion.div
                                variants={{
                                    open: { y: 0, opacity: 1 },
                                    closed: { y: reduceMotion ? 0 : 10, opacity: 0 }
                                }}
                                transition={transition}
                            >
                                <p
                                    data-photo-board-field="destination"
                                    className="line-clamp-2 pb-[.12em] text-[clamp(24px,8cqw,44px)] leading-[1.12] font-medium tracking-[-.04em] [overflow-wrap:anywhere]"
                                >
                                    {board.destination.trim() || board.title}
                                </p>
                                {board.description?.trim() && (
                                    <p
                                        className={`${selectedProfile ? "mt-[3cqw] line-clamp-2" : "mt-[4cqw] hidden @min-[360px]:line-clamp-3"} text-[clamp(12px,3.25cqw,15px)] leading-relaxed [overflow-wrap:anywhere] text-white/75`}
                                    >
                                        {board.description}
                                    </p>
                                )}
                            </motion.div>
                            {tags.length > 0 && (
                                <motion.ul
                                    aria-label="Board tags"
                                    data-photo-board-field="tags"
                                    variants={{
                                        open: { y: 0, opacity: 1 },
                                        closed: { y: reduceMotion ? 0 : 10, opacity: 0 }
                                    }}
                                    transition={transition}
                                    className={`flex gap-x-3 gap-y-2 text-[clamp(12px,3cqw,14px)] leading-snug text-white/90 ${actionLayout ? "mt-[3cqw] flex-nowrap @min-[360px]:flex-wrap" : "mt-[5cqw] flex-wrap"}`}
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
                        </div>
                        <div className={actionLayout ? "absolute inset-x-0 bottom-0 h-14" : "contents"}>
                            <motion.div
                                variants={{ open: { scaleX: 1 }, closed: { scaleX: reduceMotion ? 1 : 0 } }}
                                transition={
                                    reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 24 }
                                }
                                aria-hidden="true"
                                className={
                                    actionLayout
                                        ? "mb-2 h-px origin-left bg-white/35"
                                        : "mt-auto mb-[3cqw] h-px origin-left bg-white/35"
                                }
                            />
                            <motion.p
                                variants={{
                                    open: { y: 0, opacity: 1 },
                                    closed: { y: reduceMotion ? 0 : 6, opacity: 0 }
                                }}
                                transition={transition}
                                className="flex flex-col items-start gap-2 text-[clamp(12px,3cqw,14px)] text-white/80 tabular-nums"
                            >
                                {(hasDays || hasActivities) && (
                                    <span data-photo-board-field="itinerary">
                                        {hasDays && (
                                            <span data-photo-board-field="duration">
                                                {board.durationDays} {board.durationDays === 1 ? "day" : "days"}
                                            </span>
                                        )}
                                        {hasDays && hasActivities && " · "}
                                        {hasActivities && (
                                            <span data-photo-board-field="activities">
                                                {board.activityCount}{" "}
                                                {board.activityCount === 1 ? "activity" : "activities"}
                                            </span>
                                        )}
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
                        </div>
                    </motion.div>
                )}
                {visibilityControl && (
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
                        className={`absolute z-20 grid cursor-pointer place-items-center rounded-full backdrop-blur-sm disabled:cursor-default ${hoverActions ? `bottom-[calc(6.5%+5rem)] left-[calc(28.25%-0.875rem)] size-14 border border-white/40 bg-black/45 ${actionVisibility} transition-[opacity,transform] duration-150 motion-safe:hover:scale-105 motion-safe:focus-visible:scale-105 motion-reduce:transition-none` : "top-[3%] right-[3%] size-11 bg-black/20 disabled:opacity-60"} ${focus}`}
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
                                    <LoaderCircle
                                        aria-hidden="true"
                                        size={hoverActions ? 23 : 17}
                                        className="motion-safe:animate-spin"
                                    />
                                ) : (
                                    <Bookmark
                                        aria-hidden="true"
                                        size={hoverActions ? 23 : 17}
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
                {interactiveDetails && !selection && !href && (
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
                {interactiveDetails &&
                    ((href && hoverActions) || (selection?.selected && (selection.href || selection.viewHref))) && (
                        <button
                            type="button"
                            data-board-disclosure=""
                            data-board-selection=""
                            aria-label={`${expanded ? "Hide" : "Show"} details for ${board.title}`}
                            aria-expanded={expanded}
                            aria-controls={detailsId}
                            tabIndex={selection?.tabIndex}
                            disabled={suppressHover}
                            onPointerDownCapture={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onExpandedChange(!expanded);
                            }}
                            className={`absolute right-[3%] bottom-[3%] z-20 hidden size-11 cursor-pointer place-items-center rounded-full bg-black/45 backdrop-blur-sm disabled:pointer-events-none [@media(hover:none)]:grid ${focus}`}
                        >
                            <Info aria-hidden="true" size={20} strokeWidth={1.5} />
                        </button>
                    )}
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 border border-[#565656]" />
            </BoardCardFrame>
            {board.image?.credit && !suppressCoverCredit && (
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
            {enhanced && saveControl && (save.message || save.error) && (
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
