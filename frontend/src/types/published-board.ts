import type { Board, BoardImage, BoardItem } from "@/types/board";

// Frontend presentation data; not an implemented backend response contract.
export type BoardAuthor = {
    id: string;
    name: string;
    bio: string;
    photo?: BoardImage;
    countriesVisited?: number;
    boardsCreated?: number;
};

// Everything the viewer needs, including the author section below the board.
export type PublishedBoardData = {
    board: Board;
    author: BoardAuthor;
    highlights: string[];
};

// One day after the board's items have been grouped for display.
export type PublishedBoardDay = {
    number: number;
    title: string;
    items: BoardItem[];
};
