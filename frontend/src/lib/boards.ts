import type { BoardCreatorPayload, CreatedBoard } from "@/types/board-creator";

const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function createBoard(payload: BoardCreatorPayload): Promise<CreatedBoard> {
  const response = await fetch(`${apiOrigin}/api/v1/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as {
    data?: CreatedBoard;
    error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
  };
  if (!response.ok || !body.data) {
    const fieldMessage = Object.values(body.error?.details?.fieldErrors ?? {}).flat()[0];
    throw new Error(fieldMessage ?? body.error?.message ?? "The Board could not be saved.");
  }
  return body.data;
}

export async function loadBoard(boardId: string): Promise<CreatedBoard> {
  const response = await fetch(`${apiOrigin}/api/v1/boards/${encodeURIComponent(boardId)}`, { cache: "no-store" });
  const body = (await response.json()) as { data?: CreatedBoard; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "The Board could not be loaded.");
  return body.data;
}

export type SavedBoardSummary = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: "private" | "friends" | "public";
  status?: "draft" | "published";
  tags?: string[];
  vibes?: string[];
  highlights?: string[];
  createdAt: string;
  updatedAt: string;
  destinations?: Array<{ id: string; country: string; countryCode: string; city: string | null; latitude: number | null; longitude: number | null }>;
};

export type SavedBoardRecord = SavedBoardSummary & Partial<Pick<CreatedBoard, "days" | "images">>;

export async function loadSavedBoard(boardId: string): Promise<SavedBoardRecord> {
  const response = await fetch(`${apiOrigin}/api/v1/boards/${encodeURIComponent(boardId)}`, { cache: "no-store" });
  const body = (await response.json()) as { data?: SavedBoardRecord; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "The Board could not be loaded.");
  return body.data;
}

export async function listBoards(page = 1): Promise<{ data: SavedBoardSummary[]; meta: { page: number; limit: number; hasMore: boolean } }> {
  const response = await fetch(`${apiOrigin}/api/v1/boards?page=${page}&limit=20`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Boards could not be loaded.");
  return body;
}

export async function deleteBoard(boardId: string): Promise<void> {
  const response = await fetch(`${apiOrigin}/api/v1/boards/${encodeURIComponent(boardId)}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error?.message ?? "The Board could not be deleted.");
  }
}
