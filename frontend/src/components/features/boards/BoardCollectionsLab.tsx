"use client";

import { useState } from "react";
import type { SavedBoardSummary } from "@/lib/profile";
import type { PublishedSummary } from "@/lib/board-creator-api";
import { publicDiscoverPreviewBoards } from "@/data/discover-boards";
import DiscoverBoardLibrary from "@/components/features/discover/DiscoverBoardLibrary";
import { LiveBoardLibrary } from "@/components/features/profile/ProfilePageContent";
import { OwnedBoardCard } from "./PublishedBoardList";
import SavedBoardGrid from "./SavedBoardGrid";

const savedExamples: SavedBoardSummary[] = ["Porto", "Lofoten", "Barcelona"].map((city, index) => ({
    boardId: 91001 + index,
    title: `${city} · collection fixture`,
    description: "A sample description for the photographic metadata reveal.",
    owner: {
        id: `fixture-owner-${index}`,
        username: `sample_author_${index + 1}`,
        displayName: `Sample Author ${index + 1}`
    },
    coverImageUrl: `http://localhost:3000/images/board-cards/v4-${city.toLowerCase()}-frame172.png`,
    savedAt: "2026-10-19T10:00:00Z"
}));
const ownedExamples: PublishedSummary[] = savedExamples.map((board, index) => ({
    boardId: board.boardId,
    title: board.title,
    coverImageUrl: board.coverImageUrl,
    updatedAt: board.savedAt,
    status: "published",
    visibility: (["public", "friends", "collaborators"] as const)[index]
}));

export default function BoardCollectionsLab() {
    const [context, setContext] = useState("saved");
    const [items, setItems] = useState(savedExamples);
    const [query, setQuery] = useState("");
    return (
        <article className="mx-auto w-full max-w-[1320px] min-w-0 px-5 py-12 sm:px-10">
            <h1 className="text-xl font-medium">V4 collections · visual fixtures</h1>
            <p className="text-muted-foreground mt-4 max-w-3xl text-sm leading-relaxed">
                Development only. The production card presenters use sample summaries and existing reference photos
                here. Account actions and Board navigation are intercepted; no Board requests or persistence occur. Tag
                links open real Discover categories.
            </p>
            <div className="my-8 flex flex-wrap items-end gap-5 text-sm">
                <label className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
                    Context
                    <select
                        value={context}
                        onChange={(event) => setContext(event.target.value)}
                        className="border-line bg-background min-h-11 max-w-full min-w-0 border px-3"
                    >
                        <option value="saved">Saved collection</option>
                        <option value="owned">Owned list · View / Edit</option>
                        <option value="profile-owner">Own profile</option>
                        <option value="profile-public">Public profile · unknown membership</option>
                        <option value="discover">Discover samples</option>
                    </select>
                </label>
                {context === "saved" && (
                    <>
                        <label className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
                            Filter sample Boards
                            <input
                                aria-label="Filter sample Boards"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                className="border-line min-h-11 max-w-full min-w-0 border px-3"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setItems((current) => current.slice(1))}
                            className="min-h-11 underline"
                        >
                            Remove first visual fixture
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setItems(savedExamples);
                                setQuery("");
                            }}
                            className="min-h-11 underline"
                        >
                            Reset fixtures
                        </button>
                    </>
                )}
            </div>
            <div
                onClickCapture={(event) => {
                    const target = event.target as Element;
                    const bookmark = target.closest("button[aria-pressed]");
                    if (target.closest('a[href^="/boards/"]') || bookmark) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                }}
            >
                {context === "saved" ? (
                    <SavedBoardGrid
                        presentation="library"
                        boards={items.filter((board) =>
                            `${board.title} ${board.owner.displayName}`.toLowerCase().includes(query.toLowerCase())
                        )}
                        onUnsave={() => {}}
                    />
                ) : context === "discover" ? (
                    <DiscoverBoardLibrary boards={publicDiscoverPreviewBoards.slice(0, 3)} title="Discover samples" />
                ) : context === "owned" ? (
                    <ul className="grid items-start gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                        {ownedExamples.map((board) => (
                            <li key={board.boardId}>
                                <OwnedBoardCard board={board} />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <LiveBoardLibrary
                        boards={ownedExamples}
                        author="sample_profile_author"
                        ownership={context === "profile-owner" ? "owner" : "other"}
                        publicView={context === "profile-public"}
                    />
                )}
            </div>
        </article>
    );
}
