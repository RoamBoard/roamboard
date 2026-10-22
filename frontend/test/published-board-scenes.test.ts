import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import PublishedBoard from "../src/components/features/boards/PublishedBoard";
import type { BoardImage } from "../src/types/board";
import type { PublishedBoardData } from "../src/types/published-board";
import { createDayScenes } from "../src/lib/board-story-scenes";
import { getBoardDays } from "../src/lib/board-presentation";
import BoardDayScene from "../src/components/features/boards/BoardDayScene";

function image(id: string, width = 1200, height = 800): BoardImage {
    return {
        id,
        url: `https://media.example.test/${id}.jpg`,
        largeUrl: `https://media.example.test/${id}-large.jpg`,
        alt: `Saved photograph ${id}`,
        source: "upload",
        width,
        height
    };
}

function story(): PublishedBoardData {
    return {
        board: {
            id: "512",
            ownerId: "night_trains",
            title: "Cities by night train",
            description: "Three very different days.",
            visibility: "public",
            isCompleted: true,
            tags: [],
            destinations: [],
            dayNumbers: [1, 3, 8],
            dayTitles: { 1: "A day to rest", 3: "Into the city", 8: "At the coast" },
            coverImage: image("city-1"),
            items: [
                {
                    id: "city-walk",
                    type: "activity",
                    dayNumber: 3,
                    title: "Evening city walk",
                    description: "Follow the river after sunset.",
                    time: "18:30",
                    images: Array.from({ length: 9 }, (_, index) =>
                        image(`city-${index + 1}`, index % 2 ? 900 : 1600, index % 2 ? 1200 : 900)
                    )
                },
                {
                    id: "late-supper",
                    type: "activity",
                    dayNumber: 3,
                    title: "A late supper",
                    description: "A text-only activity still belongs in the itinerary.",
                    time: "21:00",
                    images: []
                },
                {
                    id: "coastal-walk",
                    type: "activity",
                    dayNumber: 8,
                    title: "Coastal walk",
                    description: "Take the path to the lighthouse.",
                    images: [image("coast", 1600, 900)]
                }
            ],
            createdAt: "2026-10-20T12:00:00Z",
            updatedAt: "2026-10-20T12:00:00Z"
        },
        author: {
            id: "night_trains",
            name: "night_trains",
            bio: "I travel slowly and photograph the quiet hours.",
            photo: {
                ...image("author-portrait", 400, 400),
                url: "https://api.example.test/api/v1/images/99/content?variant=display&boardId=512",
                alt: "night_trains"
            }
        },
        savedCount: 0,
        commentCount: 0
    };
}

function render(node: ReactNode) {
    return renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            {
                value: {
                    bfcacheId: "story-scenes-test",
                    back() {},
                    forward() {},
                    refresh() {},
                    push() {},
                    replace() {},
                    prefetch() {}
                }
            },
            node
        )
    );
}

function ending(data: PublishedBoardData) {
    const markup = render(createElement(PublishedBoard, data));
    const start = markup.indexOf('id="ending"');
    const finish = markup.indexOf('id="comments"');
    assert.ok(start >= 0 && finish > start, "The summary must remain before the comments");
    return markup.slice(start, finish);
}

test("the ending summarizes photographed days with their saved imagery and retains every day jump", () => {
    const summary = ending(story());
    for (const day of [1, 3, 8]) assert.match(summary, new RegExp(`href="#day-${day}"`));
    assert.match(summary, /<img\b[^>]*src="https:\/\/media\.example\.test\/city-\d+\.jpg"/);
    assert.match(summary, /<img\b[^>]*src="https:\/\/media\.example\.test\/coast\.jpg"/);
    assert.match(summary, /Evening city walk/);
    assert.match(summary, /A late supper/);
    assert.match(summary, /Coastal walk/);
    assert.match(summary, /No recorded activities/);
});

test("the ending includes the Board owner's linked profile, saved portrait and biography", () => {
    const summary = ending(story());
    assert.match(summary, /href="\/profile\/night_trains"/);
    assert.match(summary, /I travel slowly and photograph the quiet hours\./);
    assert.match(
        summary,
        /<img\b[^>]*src="https:\/\/api\.example\.test\/api\/v1\/images\/99\/content\?variant=display&amp;boardId=512"/
    );
});

test("a photo-free Board retains its day summaries and author identity without inventing photographs", () => {
    const data = story();
    data.board.coverImage = undefined;
    data.board.items = data.board.items.map((item) => (item.type === "activity" ? { ...item, images: [] } : item));
    data.author.photo = undefined;
    data.author.bio = "";
    const summary = ending(data);
    for (const day of [1, 3, 8]) assert.match(summary, new RegExp(`href="#day-${day}"`));
    assert.match(summary, /Evening city walk/);
    assert.match(summary, /href="\/profile\/night_trains"/);
    assert.doesNotMatch(summary, /<img\b/);
});

test("short, empty and photo-heavy days balance scenes around six photos without dropping or reordering photos", () => {
    const day = getBoardDays(story().board).find((day) => day.number === 3)!;
    for (const count of [0, 1, 6, 7, 31, 60]) {
        const photos = Array.from({ length: count }, (_, index) => ({
            id: `placement-${index}`,
            image: image(`photo-${index}`),
            activityId: "city-walk"
        }));
        const scenes = createDayScenes(day, photos);
        assert.equal(scenes.length, Math.max(1, Math.ceil(count / 6)));
        assert.ok(scenes.every((scene) => scene.photos.length <= 6));
        assert.ok(
            Math.max(...scenes.map((scene) => scene.photos.length)) -
                Math.min(...scenes.map((scene) => scene.photos.length)) <=
                1
        );
        assert.equal(scenes[0].id, "day-3");
        assert.deepEqual(
            scenes.flatMap((scene) => scene.photos),
            photos
        );
        assert.equal(new Set(scenes.flatMap((scene) => scene.photos.map((photo) => photo.id))).size, count);
        const html = scenes
            .map((scene) =>
                render(
                    createElement(BoardDayScene, {
                        scene,
                        boardId: "512",
                        desktop: true,
                        onOpenPhoto() {},
                        onOpenActivity() {},
                        onHighlight() {}
                    })
                )
            )
            .join("");
        for (const photo of photos) assert.match(html, new RegExp(`data-story-photo="${photo.id}"`));
        assert.doesNotMatch(html, /bg-faint\/30|h-\[48vh\]/);
    }
});

test("text-only activities stay with the neighboring photo story before scenes are split", () => {
    const day = {
        number: 1,
        title: "A timed day",
        items: [
            { id: "early", type: "activity" as const, title: "Early", description: "", time: "08:00", images: [] },
            { id: "mid", type: "activity" as const, title: "Midday", description: "", time: "09:00", images: [] },
            {
                id: "late",
                type: "activity" as const,
                title: "Late",
                description: "",
                time: "10:00",
                images: Array.from({ length: 8 }, (_, index) => image(`late-${index}`))
            }
        ]
    };
    const photos = day.items[2].images.map((photo, index) => ({
        id: `late-placement-${index}`,
        image: photo,
        activityId: "late"
    }));
    const scenes = createDayScenes(day, photos);
    assert.deepEqual(
        scenes.map((scene) => scene.textActivities.map((activity) => activity.id)),
        [["early", "mid"], []]
    );
});

test("scene layout is stable across renders, varied in shape, and leaves the full saved image for zoom", () => {
    const day = getBoardDays(story().board).find((day) => day.number === 3)!;
    const photos = day.items.flatMap((item) =>
        item.type === "activity" ? item.images.map((image, index) => ({ id: `${item.id}-${index}`, image })) : []
    );
    const props = {
        scene: createDayScenes(day, photos)[0],
        boardId: "512",
        desktop: true,
        onOpenPhoto() {},
        onOpenActivity() {},
        onHighlight() {}
    };
    const first = render(createElement(BoardDayScene, props));
    assert.equal(render(createElement(BoardDayScene, props)), first);
    assert.match(first, /object-cover/);
    assert.ok(new Set([...first.matchAll(/aspect-ratio:([^";]+)/g)].map((match) => match[1])).size > 1);
    for (const photo of props.scene.photos) assert.ok(first.includes(photo.image.url));
    assert.ok(
        props.scene.photos.every((photo) => !first.includes(photo.image.largeUrl!)),
        "Browsing should not fetch large delivery"
    );
});
