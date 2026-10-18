"use client";

import { useState } from "react";
import type { BoardDocument } from "@/lib/board-creator-api";
import type { BoardSelectionState, BoardSelectionStore } from "@/lib/board-selection-store";
import type { DraftBoardsState } from "@/lib/draft-boards-store";
import { photoBoardExamples } from "@/data/board-card-examples";
import { BoardSelectionContent } from "./BoardSelectionExperience";
import { DraftBoardListContent } from "./DraftBoardList";

// Presentation fixtures only. These IDs are never requested or persisted; editor links are intercepted below.
const fixtures: BoardDocument[] = Array.from({ length: 8 }, (_, index) => {
    const sample = photoBoardExamples[index % photoBoardExamples.length];
    return {
        boardId: 90001 + index,
        title: index === 0 ? "" : `${sample.title} ${index + 1}`,
        author: { username: "visual_fixture", bio: "", photo: null },
        description: index === 0 ? null : "A visual study of a journey in progress. Development fixture only.",
        status: index % 3 === 0 ? "draft" : "published",
        visibility: index % 2 ? "public" : "friends",
        revision: 1,
        coverImageId: index ? index : null,
        imageIds: index ? [index] : [],
        tagIds: [],
        tags: index ? [{ tagId: 1, name: "Architecture" }] : [],
        permissions: { canEditContent: true, canManageBoard: true },
        createdAt: "2026-10-01T10:00:00Z",
        updatedAt: `2026-10-${String(18 - index).padStart(2, "0")}T10:00:00Z`,
        images: index
            ? [{ imageId: index, url: sample.image.src, thumbnailUrl: sample.image.src, position: 0, capturedAt: null }]
            : [],
        days: index
            ? [
                  {
                      dayId: index,
                      dayNumber: 1,
                      date: null,
                      activities: [
                          {
                              activityId: index,
                              title: "A place to begin",
                              category: "other",
                              note: null,
                              source: "manual",
                              activityTime: null,
                              position: 0,
                              uploadedImageIds: [],
                              coverImageId: null,
                              externalImage: null,
                              locationConfirmed: true,
                              location: {
                                  name: sample.destination,
                                  city: sample.destination.split(",")[0],
                                  country: sample.destination.split(",")[1]?.trim() ?? null,
                                  address: null,
                                  latitude: 0,
                                  longitude: 0,
                                  externalPlaceId: null
                              }
                          }
                      ]
                  }
              ]
            : []
    };
});

export default function BoardSelectionLab() {
    const [experience, setExperience] = useState("continue");
    const [scenario, setScenario] = useState("ready");
    const [query, setQuery] = useState("");
    const [notice, setNotice] = useState("");
    const [loadedMore, setLoadedMore] = useState(false);
    const items = fixtures.slice(0, loadedMore ? 8 : 7).map((board) => ({
        boardId: board.boardId,
        title: board.title,
        updatedAt: board.updatedAt,
        coverImageUrl: board.images[0]?.url ?? null,
        status: board.status,
        visibility: board.visibility,
        source: "owned" as const
    }));
    const documents = Object.fromEntries(
        fixtures.flatMap((board, index) => {
            if (scenario === "pending" || scenario === "readonly" || (scenario === "failure" && index === 0)) return [];
            return [[board.boardId, board]];
        })
    );
    const state: BoardSelectionState = {
        items,
        documents,
        documentErrors:
            scenario === "readonly"
                ? Object.fromEntries(items.map((item) => [item.boardId, "Development fixture: editing access denied."]))
                : {},
        pendingIds: [],
        scopes: {
            draft: { page: 1, hasMore: !loadedMore, error: "" },
            published: { page: 1, hasMore: false, error: "" }
        },
        loading: false,
        loadingMore: false,
        sharedLoading: false,
        sharedError: "",
        sharedBoardId: null
    };
    const actions: BoardSelectionStore = {
        getSnapshot: () => state,
        subscribe: () => () => {},
        cancel: () => {},
        load: async () => {},
        loadMore: async () => setLoadedMore(true),
        loadPreview: async () => {},
        loadSharedBoard: async () => setNotice("Shared lookup is unavailable in this presentation-only preview.")
    };
    const drafts: DraftBoardsState = {
        items,
        documents: Object.fromEntries(
            Object.entries(documents)
                .filter(([, board]) => board.boardId < 90006)
                .map(([id, board]) => [id, { ...board, status: "draft" }])
        ),
        failedIds: scenario === "failure" ? [90001] : [],
        featuredIds: items.slice(0, 5).map((board) => board.boardId),
        loading: false,
        loadingFeatured: scenario === "pending",
        loadingMore: false,
        error: "",
        page: 1,
        hasMore: !loadedMore
    };
    return (
        <div
            className="min-w-0 overflow-x-clip"
            onClickCapture={(event) => {
                const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a") : null;
                if (link?.getAttribute("href")?.startsWith("/boards/")) {
                    event.preventDefault();
                    setNotice(`Fixture editor target: ${link.getAttribute("href")}. No Board was opened or saved.`);
                }
            }}
        >
            <div className="border-line flex flex-wrap items-center gap-4 border-b p-5 text-xs">
                <p className="w-full">
                    Development review · illustrative fixtures, not account Boards. No Board requests or persistence.
                    Editor links only report their fixture target.
                </p>
                <label>
                    Experience{" "}
                    <select
                        value={experience}
                        onChange={(event) => {
                            setExperience(event.target.value);
                            setScenario("ready");
                        }}
                        className="bg-background border-line min-h-11 border px-3"
                    >
                        <option value="continue">Continue Board</option>
                        <option value="drafts">Draft selection</option>
                    </select>
                </label>
                <label>
                    Scenario{" "}
                    <select
                        value={scenario}
                        onChange={(event) => {
                            setScenario(event.target.value);
                            setNotice("");
                        }}
                        className="bg-background border-line min-h-11 border px-3"
                    >
                        <option value="ready">Loaded</option>
                        <option value="pending">Summary only / loading</option>
                        <option value="failure" disabled={experience === "continue"}>
                            Draft preview failure
                        </option>
                        <option value="readonly" disabled={experience === "drafts"}>
                            Editing denied
                        </option>
                    </select>
                </label>
                <p role="status">{notice}</p>
            </div>
            {experience === "continue" ? (
                <BoardSelectionContent key={scenario} mode="continue" state={state} actions={actions} />
            ) : (
                <DraftBoardListContent
                    state={drafts}
                    query={query}
                    onQueryChange={setQuery}
                    onRetry={() => setScenario("ready")}
                    onLoadMore={() => setLoadedMore(true)}
                    onRetryFeatured={() => setScenario("ready")}
                />
            )}
        </div>
    );
}
