import type { MapDestination } from "./profile";
import { findCountry } from "./countries";
import { toPhotoBoardCard, toProfilePhotoBoardCard } from "./photo-board-card";
import { BoardApiError, loadBoardDocument } from "./board-creator-api";
import type { GalleryBoard } from "./my-boards";

export type ProfileMapSelection = { kind: "country" | "location"; key: string };
export const profileMapColors = { published: "#b7473e", saved: "#cb782c" };
export const locationKey = (place: MapDestination) => `${place.longitude}:${place.latitude}`;
export const countryName = (code: string) => findCountry(code)?.name ?? code;

export function selectedMapBoards(places: MapDestination[], selection: ProfileMapSelection | null) {
    if (!selection) return [];
    return [
        ...new Map(
            places
                .filter(
                    (place) =>
                        place.boardId &&
                        (selection.kind === "country"
                            ? place.countryCode === selection.key
                            : locationKey(place) === selection.key)
                )
                .map((place) => [place.boardId, place])
        ).values()
    ];
}

export function mapBoardGallery(
    places: MapDestination[]
): Pick<GalleryBoard, "compact" | "photo" | "ownership" | "href">[] {
    return places.flatMap((place) => {
        if (!place.boardId) return [];
        const photo = toProfilePhotoBoardCard(
            {
                boardId: place.boardId,
                title: place.boardTitle ?? "Board",
                coverImageUrl: place.coverImageUrl ?? null,
                updatedAt: ""
            },
            ""
        );
        return [
            {
                photo,
                compact: { ...photo, image: photo.image ?? { src: "", alt: "" } },
                ownership: "unknown" as const,
                href: `/boards/${place.boardId}`
            }
        ];
    });
}

export async function loadMapBoardGallery(places: MapDestination[]) {
    const boards = mapBoardGallery([...new Map(places.map((place) => [place.boardId, place])).values()]);
    const results = await Promise.allSettled(
        boards.map(async (board) => {
            const controller = new AbortController();
            const deadline = setTimeout(() => controller.abort(), 10_000);
            try {
                const document = await loadBoardDocument(Number(board.compact.id), controller.signal);
                return {
                    ...board,
                    photo: toPhotoBoardCard(document),
                    ownership: document.permissions.canManageBoard ? ("owner" as const) : ("other" as const)
                };
            } finally {
                clearTimeout(deadline);
            }
        })
    );
    return {
        boards: results.flatMap((result, index) => {
            if (result.status === "fulfilled") return [result.value];
            if (result.reason instanceof BoardApiError && [401, 403, 404].includes(result.reason.status)) return [];
            return [boards[index]];
        }),
        failed: results.some((result) => result.status === "rejected")
    };
}
