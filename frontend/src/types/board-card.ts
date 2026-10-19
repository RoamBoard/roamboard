export type BoardCardImage = {
    src: string;
    alt: string;
    // Provider photos can keep their returned URL instead of using Next's image proxy.
    unoptimized?: boolean;
    position?: string;
    credit?: string;
    creditUrl?: string;
    sourceUrl?: string;
    // Optional crop of the original image, expressed relative to its slot.
    crop?: { width: number; height: number; left: number; top: number };
};

export type BoardCardSummary = {
    id: string;
    title: string;
    titleLines?: readonly string[];
    author: string;
    destination: string;
    destinationLabel: string;
    // Left edge of the decorative lettering, as a percentage of the card width.
    labelOffset?: number;
};

export type CollageBoardCardData = BoardCardSummary & {
    images: readonly BoardCardImage[];
    durationDays: number;
    description: string;
    themes: readonly string[];
    highlights: readonly string[];
    savedCount?: number;
    // Editorial text measure in the 440px reference composition.
    descriptionWidth?: number;
};

export type CompactBoardCardData = BoardCardSummary & {
    image: BoardCardImage;
    footerOffset?: number;
};

export type LandscapeBoardCardData = BoardCardSummary & {
    image: BoardCardImage;
    description: string;
    descriptionLines?: readonly string[];
    highlights: readonly string[];
    referenceWidth?: 700 | 760;
    highlightFontSize?: 11 | 12;
};

export type PhotoBoardCardData = BoardCardSummary & {
    image?: BoardCardImage;
    tags?: readonly string[];
    description?: string;
    durationDays?: number;
    activityCount?: number;
    savedCount?: number;
    status?: "draft" | "published";
    visibility?: "public" | "friends" | "collaborators";
};

export type PhotoBoardSave = {
    state: "saved" | "unsaved" | "unknown";
    pending?: boolean;
    onToggle?: () => void;
    message?: string;
    error?: string;
    signInHref?: string;
};

// Presentation only: callers resolve ownership and perform account mutations.
export type PhotoBoardCardProps = {
    board: PhotoBoardCardData;
    href?: string;
    details?: boolean;
    // Editorial comparisons can hold either state; normal cards remain interactive.
    presentation?: "interactive" | "cover" | "details";
    ownership?: "owner" | "other" | "unknown";
    save?: PhotoBoardSave;
    reduceMotion?: boolean;
    imageSizes?: string;
    // Galleries own selection; a selected card can navigate once its edit access has resolved.
    selection?: {
        selected: boolean;
        href?: string;
        label?: string;
        onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
        tabIndex?: number;
    };
};

export type BoardCardActions = {
    href?: string;
    bookmarked?: boolean;
    onBookmark?: () => void;
};
import type { MouseEvent } from "react";
