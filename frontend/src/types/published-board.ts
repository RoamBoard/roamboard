import type { Board, BoardImage, BoardItem } from "@/types/board";

// Viewer presentation data, adapted from the canonical Board document.
export type BoardAuthor = {
    id: string;
    name: string;
    bio: string;
    photo?: BoardImage;
};

// Everything the viewer needs, including the author section below the board.
export type PublishedBoardData = {
    board: Board;
    author: BoardAuthor;
    tagLabels?: string[];
    canEditContent?: boolean;
    canManageBoard?: boolean;
    savedByMe?: boolean;
    savedCount?: number;
};

export type PublishedBoardState = {
    status: "loading" | "ready" | "not-found" | "unauthenticated" | "forbidden" | "error";
    data: PublishedBoardData | null;
};

// One day after the board's items have been grouped for display.
export type PublishedBoardDay = {
    number: number;
    date?: string;
    title: string;
    items: BoardItem[];
};
