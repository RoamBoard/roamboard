import type { BoardDocument, DraftSummary } from "./board-creator-api";
import type { CollageBoardCardData, PhotoBoardCardData } from "../types/board-card";
import { findCountry } from "./countries";
import type { SavedBoardSummary, PublishedBoardSummary } from "./profile";

export function toSavedPhotoBoardCard(board: SavedBoardSummary): PhotoBoardCardData {
    return {
        id: String(board.boardId),
        title: board.title.trim() || "Untitled Board",
        author: board.owner.username || board.owner.displayName,
        destination: "",
        destinationLabel: "",
        description: board.description,
        status: "published",
        image: board.coverImageUrl
            ? {
                  src: new URL(
                      board.coverImageUrl,
                      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
                  ).toString(),
                  alt: `Cover of ${board.title || "Untitled Board"}`
              }
            : undefined
    };
}

export function toProfilePhotoBoardCard(
    board: PublishedBoardSummary,
    author: string,
    publicView = false
): PhotoBoardCardData {
    return {
        id: String(board.boardId),
        title: board.title.trim() || "Untitled Board",
        author,
        destination: "",
        destinationLabel: "",
        status: "published",
        visibility: publicView ? "public" : board.visibility,
        image: board.coverImageUrl
            ? {
                  src: new URL(
                      board.coverImageUrl,
                      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
                  ).toString(),
                  alt: `Cover of ${board.title || "Untitled Board"}`
              }
            : undefined
    };
}

// List summaries do not supply author, itinerary or tags. Keep those absent until an existing preview read resolves.
export function toSummaryPhotoBoardCard(
    summary: DraftSummary & Pick<PhotoBoardCardData, "status" | "visibility">
): PhotoBoardCardData {
    const title = summary.title.trim() || "Untitled Board";
    return {
        id: String(summary.boardId),
        title,
        author: "",
        destination: "",
        destinationLabel: "",
        status: summary.status,
        visibility: summary.visibility,
        image: summary.coverImageUrl
            ? {
                  src: new URL(
                      summary.coverImageUrl,
                      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
                  ).toString(),
                  alt: `Cover of ${title}`
              }
            : undefined
    };
}

export function toDraftPhotoBoardCard(summary: DraftSummary, document?: BoardDocument): PhotoBoardCardData {
    return document ? toPhotoBoardCard(document) : toSummaryPhotoBoardCard({ ...summary, status: "draft" });
}

// Existing editorial fixtures keep their content, without carrying V1 typography or fictional save totals into V4.
export function toEditorialPhotoBoardCard(board: CollageBoardCardData): PhotoBoardCardData {
    return {
        id: board.id,
        title: board.title,
        author: board.author,
        destination: board.destination,
        destinationLabel: board.destinationLabel,
        image: board.images[0],
        tags: board.themes,
        description: board.description,
        durationDays: board.durationDays
    };
}

// Adapt a document already loaded by the parent; never request documents just for hover metadata.
export function toPhotoBoardCard(document: BoardDocument): PhotoBoardCardData {
    const activities = document.days.flatMap((day) => day.activities);
    const locations = activities.flatMap((activity) =>
        activity.locationConfirmed && activity.location ? [activity.location] : []
    );
    const countries = (document.destination ? [document.destination] : locations).map((location) =>
        location.country ? findCountry(location.country) : undefined
    );
    const singleCountry =
        countries.length > 0 && countries.every((country) => country && country.code === countries[0]?.code)
            ? countries[0]
            : undefined;
    const destination = document.destination
        ? [...new Set([document.destination.name, singleCountry?.name].filter(Boolean))].join(", ")
        : [
              ...new Set(
                  locations.flatMap((location, index) =>
                      [location.city?.trim(), countries[index]?.name ?? location.country?.trim()].filter(Boolean)
                  )
              )
          ].join(", ");
    const cover = document.images.find((image) => image.imageId === document.coverImageId) ?? document.images[0];
    const external = activities.find((activity) => activity.externalImage)?.externalImage;
    const src = cover
        ? new URL(cover.url, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").toString()
        : external?.url;
    const title = document.title.trim() || "Untitled Board";
    return {
        id: String(document.boardId),
        title,
        author: document.author.username,
        destination,
        destinationLabel: singleCountry?.code ?? "",
        image: src
            ? {
                  src,
                  alt: `Cover of ${title}`,
                  ...(cover || !external
                      ? {}
                      : {
                            credit: external.photographer,
                            creditUrl: external.photographerUrl ?? undefined,
                            sourceUrl: external.sourceUrl ?? undefined
                        })
              }
            : undefined,
        tags: document.tags.map((tag) => tag.name),
        description: document.description?.trim() || undefined,
        durationDays: document.days.length,
        activityCount: activities.length,
        visibility: document.visibility,
        status: document.status
    };
}
