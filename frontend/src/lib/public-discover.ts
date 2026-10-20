import { discoveryRequest, type DiscoveryResult } from "./boards-discovery";

// Discover is public, including when its visitor is signed in. Do not include account-only Boards.
export function loadPublicBoardPage(page = 1, limit = 50, signal?: AbortSignal): Promise<DiscoveryResult> {
    return discoveryRequest(`/boards/recent?page=${page}&limit=${limit}`, {
        credentials: "omit",
        signal: signal ?? AbortSignal.timeout(8000)
    });
}
