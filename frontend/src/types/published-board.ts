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

export type PublishedBoardData = {
    board: Board;
    author: BoardAuthor;
    highlights: string[];
};

export type PublishedBoardDay = {
    number: number;
    title: string;
    items: BoardItem[];
};
