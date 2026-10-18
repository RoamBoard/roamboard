"use client";

import { useState } from "react";
import BoardPreviewSection from "./BoardPreviewSection";
import type { BoardCreatorPayload } from "@/types/board-creator";

// Development fixtures only. No Board requests, uploads, or persistence.
const sample: BoardCreatorPayload = {
    title: "Postcards from Porto",
    description: "A few days by the river. Long walks, tiled streets, and time to find a favourite café.",
    status: "published",
    visibility: "friends",
    coverImageId: 1,
    tags: ["Architecture", "Coffee", "Walking"],
    images: ["porto", "lofoten", "barcelona"].map((city, index) => ({
        id: `fixture-photo-${index}`,
        uploadedImageId: index + 1,
        publicId: "",
        source: "upload",
        pinId: null,
        url: `/images/board-cards/v4-${city}-frame172.png`,
        thumbnailUrl: `/images/board-cards/v4-${city}-frame172.png`,
        width: 800,
        height: 1000,
        capturedAt: null,
        latitude: null,
        longitude: null,
        order: index,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    })),
    days: [
        {
            id: "fixture-day-1",
            dayNumber: 1,
            date: "2026-06-04",
            pins: [
                {
                    id: "fixture-place",
                    order: 0,
                    title: "A walk by the river",
                    description: "A sample confirmed place.",
                    category: "neighborhood",
                    source: "manual",
                    time: "10:00",
                    location: {
                        name: "Porto",
                        city: "Porto",
                        country: "Portugal",
                        countryCode: "PT",
                        address: "Porto, Portugal",
                        latitude: 41.14,
                        longitude: -8.61,
                        mapboxId: null
                    }
                }
            ]
        },
        { id: "fixture-day-2", dayNumber: 2, date: null, pins: [] }
    ]
};

export default function CreatorPreviewLab() {
    const [scenario, setScenario] = useState("published");
    const [cover, setCover] = useState(1);
    const empty = scenario === "empty";
    const board: BoardCreatorPayload = {
        ...sample,
        status: scenario === "draft" || empty ? "draft" : "published",
        title: empty
            ? ""
            : scenario === "long"
              ? "A very long title for a slow journey through unfamiliar streets, riverside cafés and places we want to remember"
              : sample.title,
        description: empty ? "" : sample.description,
        coverImageId: empty ? null : cover,
        images: empty
            ? []
            : scenario === "failed"
              ? sample.images.map((image) => ({
                    ...image,
                    url: "/missing-preview-photo.jpg",
                    thumbnailUrl: "/missing-preview-photo.jpg"
                }))
              : sample.images,
        days: empty ? [{ id: "empty-day", dayNumber: 1, date: null, pins: [] }] : sample.days,
        tags: empty ? [] : sample.tags
    };
    return (
        <>
            <header className="mx-auto w-full max-w-[110rem] px-5 pt-12 pb-16 sm:px-8 lg:px-12">
                <h1 className="text-xl font-medium">Creator preview · visual fixtures</h1>
                <p className="text-muted-foreground mt-3 max-w-2xl text-sm">
                    Development only. Sample metadata and existing reference images; nothing is requested or saved. Use
                    the actual creator to review editor navigation.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
                    <label>
                        Scenario{" "}
                        <select
                            value={scenario}
                            onChange={(event) => setScenario(event.target.value)}
                            className="border-line bg-background ml-2 border p-2"
                        >
                            <option value="published">Published owner</option>
                            <option value="draft">Incomplete draft</option>
                            <option value="readonly">Read only</option>
                            <option value="empty">Empty draft</option>
                            <option value="long">Long title</option>
                            <option value="failed">Failed images</option>
                        </select>
                    </label>
                    <label>
                        Cover{" "}
                        <select
                            value={cover}
                            onChange={(event) => setCover(Number(event.target.value))}
                            className="border-line bg-background ml-2 border p-2"
                        >
                            <option value={1}>Porto</option>
                            <option value={2}>Lofoten reference</option>
                            <option value={3}>Barcelona reference</option>
                        </select>
                    </label>
                </div>
            </header>
            <div
                onClick={(event) => {
                    // Fixture annotations must never navigate to non-existent editor controls.
                    if ((event.target as Element).closest('a[href^="#"]')) event.preventDefault();
                }}
            >
                <BoardPreviewSection
                    board={board}
                    author={empty ? undefined : "Sample author"}
                    editable={scenario !== "readonly"}
                />
            </div>
        </>
    );
}
