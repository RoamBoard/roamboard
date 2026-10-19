export interface CommentRecord {
    commentId: number;
    boardId: number;
    authorUserId: string;
    body: string;
    author: { displayName: string; username: string; profilePictureUrl: string | null };
    createdAt: string;
    editedAt: string | null;
    revision: number;
}

export type BoardComment = Omit<CommentRecord, "authorUserId"> & {
    permissions: { canEdit: boolean; canDelete: boolean };
};

export interface CommentCursor {
    boardId: number;
    createdAt: string;
    commentId: number;
}

export interface CommentsRepository {
    list(boardId: number, cursor: CommentCursor | null, limit: number): Promise<CommentRecord[]>;
    get(boardId: number, commentId: number): Promise<CommentRecord | null>;
    create(boardId: number, authorUserId: string, body: string): Promise<CommentRecord>;
    update(
        boardId: number,
        commentId: number,
        authorUserId: string,
        revision: number,
        body: string
    ): Promise<CommentRecord | null>;
    delete(boardId: number, commentId: number, userId: string, ownerUserId: string): Promise<boolean>;
}
