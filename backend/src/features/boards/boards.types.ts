import type { BoardWrite } from "./boards.schemas.js";

export interface BoardAccess {
    boardId: number;
    ownerUserId: string;
    status: "draft" | "published";
    visibility: "collaborators" | "friends" | "public";
    revision: number;
    memberRole: "editor" | "viewer" | null;
    isFriend: boolean;
}

export interface BoardDocument extends BoardWrite {
    boardId: number;
    revision: number;
    isCompleted: boolean;
    coverImageId: number | null;
    tags: Array<{ tagId: number; name: string }>;
    images: Array<{
        imageId: number;
        url: string;
        thumbnailUrl: string;
        capturedAt: string | null;
        position: number;
    }>;
    createdAt: string;
    updatedAt: string;
    permissions: { canEditContent: boolean; canManageBoard: boolean };
}

export interface DraftSummary {
    boardId: number;
    title: string;
    status: "draft";
    visibility: "collaborators" | "friends" | "public";
    coverImageUrl: string | null;
    updatedAt: string;
}

export type PublishedSummary = Omit<DraftSummary, "status"> & { status: "published" };

export interface BoardRepository {
    listTags(): Promise<Array<{ tagId: number; name: string }>>;
    listCategories(): Promise<string[]>;
    getAccess(boardId: number, userId: string | null): Promise<BoardAccess | null>;
    getBoard(boardId: number): Promise<BoardDocument | null>;
    listDrafts(userId: string, page: number, limit: number): Promise<{ items: DraftSummary[]; hasMore: boolean }>;
    listPublished(userId: string, page: number, limit: number): Promise<{ items: PublishedSummary[]; hasMore: boolean }>;
    saveBoard(userId: string, boardId: number | null, expectedRevision: number | null, input: BoardWrite): Promise<number>;
    deleteBoard(boardId: number, userId: string): Promise<boolean>;
}

export interface BoardsService {
    listTags(): Promise<Array<{ tagId: number; name: string }>>;
    listCategories(): Promise<string[]>;
    create(userId: string, input: BoardWrite): Promise<BoardDocument>;
    replace(userId: string, boardId: number, revision: number, input: BoardWrite): Promise<BoardDocument>;
    read(boardId: number, userId: string | null): Promise<BoardDocument>;
    listDrafts(userId: string, page: number, limit: number): Promise<{ items: DraftSummary[]; hasMore: boolean }>;
    listPublished(userId: string, page: number, limit: number): Promise<{ items: PublishedSummary[]; hasMore: boolean }>;
    delete(boardId: number, userId: string): Promise<void>;
}
