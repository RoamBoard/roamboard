import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import PublishedBoard from "../src/components/features/boards/PublishedBoard";
import BoardDayScene from "../src/components/features/boards/BoardDayScene";
import BoardStoryEnding from "../src/components/features/boards/BoardStoryEnding";
import ActivityDetailsDialog from "../src/components/features/boards/ActivityDetailsDialog";
import StoryGallery from "../src/components/features/boards/StoryGallery";
import StoryPhoto from "../src/components/features/boards/StoryPhoto";
import StoryMap from "../src/components/features/boards/StoryMap";
import StoryMapControls from "../src/components/features/boards/StoryMapControls";
import type { BoardActivity, BoardImage } from "../src/types/board";
import type { PublishedBoardData } from "../src/types/published-board";

type Props = { children?: ReactNode; [key: string]: unknown };
type Node = { type: unknown; props: Props };
type SceneProps = ComponentProps<typeof BoardDayScene>;
type EndingProps = ComponentProps<typeof BoardStoryEnding>;

function descendants(node: ReactNode): Node[] {
    return Children.toArray(node).flatMap((child) => {
        if (!isValidElement<Props>(child)) return [];
        return [{ type: child.type, props: child.props }, ...descendants(child.props.children)];
    });
}

const router = {
    bfcacheId: "story-revision-test",
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {}
};

function capture(render: () => ReactNode, onRender?: (nodes: Node[]) => void) {
    const holder: { nodes: Node[] } = { nodes: [] };
    function Probe() {
        const tree = render();
        holder.nodes = descendants(tree);
        onRender?.(holder.nodes);
        return tree;
    }
    const markup = renderToStaticMarkup(
        createElement(AppRouterContext.Provider, { value: router }, createElement(Probe))
    );
    return { markup, nodes: holder.nodes };
}

function image(id: string): BoardImage {
    return {
        id,
        url: `https://photos.example.test/${id}?variant=display`,
        largeUrl: `https://photos.example.test/${id}?variant=large`,
        alt: `Saved photo ${id}`,
        source: "upload",
        width: 2400,
        height: 1600
    };
}

function activity(id: string, time: string | undefined, photoIds: string[]): BoardActivity {
    return {
        id,
        type: "activity",
        title: `${id} activity`,
        time,
        description: `Saved note for ${id}.`,
        dayNumber: 1,
        location: { id: `location-${id}`, source: "manual", name: `${id} location`, latitude: 59.3, longitude: 18.1 },
        images: photoIds.map(image)
    };
}

function fixture(): PublishedBoardData {
    return {
        board: {
            id: "718",
            ownerId: "story_author",
            title: "A day from morning to evening",
            description: "The saved trip",
            visibility: "public",
            isCompleted: true,
            tags: [],
            destinations: [],
            dayNumbers: [1],
            dayDates: { 1: "2026-10-21" },
            coverImage: image("cover"),
            items: [
                activity("evening", "18:00", ["evening-b", "evening-a", "evening-c"]),
                activity("untimed-first", undefined, []),
                activity("morning", "08:00", ["morning-b", "morning-a"]),
                activity("untimed-second", undefined, ["untimed-photo"]),
                activity("lunch", "12:30", ["lunch-photo"])
            ],
            createdAt: "2026-10-21T09:00:00.000Z",
            updatedAt: "2026-10-21T10:00:00.000Z"
        },
        author: {
            id: "story_author",
            name: "story_author",
            bio: "The person who recorded this journey.",
            photo: {
                ...image("author"),
                url: "http://localhost:3001/api/v1/images/900/content?variant=display&boardId=718"
            }
        },
        canEditContent: false,
        canManageBoard: false,
        savedByMe: false,
        savedCount: 27,
        commentCount: 9
    };
}

function storyParts(data = fixture()) {
    const result = capture(() => PublishedBoard(data));
    const scenes = result.nodes.filter((node) => node.type === BoardDayScene).map((node) => node.props as SceneProps);
    const ending = result.nodes.find((node) => node.type === BoardStoryEnding)?.props as EndingProps | undefined;
    assert.ok(ending);
    return { ...result, scenes, ending };
}

const displayedPhotos = [
    "morning-b",
    "morning-a",
    "lunch-photo",
    "untimed-photo",
    "evening-b",
    "evening-a",
    "evening-c"
];
const displayedActivities = [
    "morning activity",
    "untimed-first activity",
    "lunch activity",
    "untimed-second activity",
    "evening activity"
];

test("timed stops progress chronologically around fixed untimed slots, retaining every activity's saved photo order", () => {
    const source = fixture();
    const before = structuredClone(source);
    const { scenes, ending } = storyParts(source);
    const photos = scenes.flatMap((props) => props.scene.photos.map((photo) => photo.image.id));
    assert.deepEqual(photos, displayedPhotos);
    const endingMarkup = capture(() => BoardStoryEnding(ending)).markup;
    const titlePositions = displayedActivities.map((title) => endingMarkup.lastIndexOf(title));
    assert.ok(titlePositions.every((position) => position >= 0));
    assert.deepEqual(
        titlePositions,
        [...titlePositions].sort((a, b) => a - b)
    );
    assert.deepEqual(source, before, "Sorting the viewer must not reorder the saved document");
});

function visibleText(node: ReactNode): string {
    return Children.toArray(node)
        .map((child) => {
            if (typeof child === "string" || typeof child === "number") return String(child);
            return isValidElement<Props>(child) ? visibleText(child.props.children) : "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

test("each scene timeline shows only its own chronological activities, while Summary keeps the full day", () => {
    const data = fixture();
    const stops = Array.from({ length: 8 }, (_, index) =>
        activity(`stop-${index}`, `${String(index + 8).padStart(2, "0")}:00`, [`photo-${index}`])
    );
    data.board.items = stops;
    const initial = storyParts(data);
    const selected: BoardActivity[] = [];
    assert.equal(initial.scenes.length, 2);
    for (const [index, props] of initial.scenes.entries()) {
        const rendered = capture(() =>
            BoardDayScene({ ...props, desktop: true, onOpenActivity: (activity) => selected.push(activity) })
        );
        const timeline = rendered.nodes.find((node) => node.type === "ol");
        assert.ok(timeline, "The day heading must have a semantic ordered activity timeline");
        const buttons = descendants(timeline.props.children).filter((node) => node.type === "button");
        assert.deepEqual(
            buttons.map((node) => visibleText(node.props.children)),
            stops.slice(index * 4, (index + 1) * 4).map((stop) => `${stop.time} ${stop.title}`)
        );
        for (const button of buttons) (button.props.onClick as () => void)();
        assert.doesNotMatch(rendered.markup, />The journey<\/p>/i);
        assert.ok(rendered.markup.indexOf("Day 01</h2>") < rendered.markup.indexOf("<ol"));
    }
    assert.deepEqual(
        selected.map((stop) => stop.id),
        stops.map((stop) => stop.id)
    );
    const summary = capture(() => BoardStoryEnding(initial.ending)).markup;
    for (const stop of stops) assert.ok(summary.includes(stop.title));
});

test("activities without photographs remain reachable once across scene timelines and in the full Summary", () => {
    const data = fixture();
    const photographed = Array.from({ length: 8 }, (_, index) =>
        activity(`pictured-${index}`, "10:00", [`image-${index}`])
    );
    const textOnly = Array.from({ length: 5 }, (_, index) => activity(`text-${index}`, undefined, []));
    data.board.items = [...photographed, ...textOnly];
    const parts = storyParts(data);
    const titles: string[] = [];
    for (const props of parts.scenes) {
        const scene = capture(() => BoardDayScene({ ...props, desktop: true }));
        const timeline = scene.nodes.find((node) => node.type === "ol");
        assert.ok(timeline);
        const buttons = descendants(timeline.props.children).filter((node) => node.type === "button");
        const visibleTitles = buttons.map((button) => visibleText(button.props.children));
        titles.push(...visibleTitles);
        for (const stop of photographed) {
            assert.equal(
                visibleTitles.some((title) => title.endsWith(stop.title)),
                props.scene.photos.some((photo) => photo.activityId === stop.id),
                "A photographed activity belongs only to scenes that display its saved images"
            );
        }
    }
    for (const stop of [...photographed, ...textOnly])
        assert.equal(
            titles.filter((title) => title.endsWith(stop.title)).length,
            1,
            `${stop.title} remains available exactly once`
        );
    const summary = capture(() => BoardStoryEnding(parts.ending)).markup;
    for (const stop of textOnly) assert.ok(summary.includes(stop.title));
});

test("the comment total is plain information while Comments remains a chapter link", () => {
    const result = storyParts();
    const stats = capture(() => result.ending.stats);
    const commentGroup = stats.nodes.find(
        (node) =>
            node.type === "div" &&
            descendants(node.props.children).some(
                (child) => child.type === "dt" && visibleText(child.props.children) === "comments"
            )
    );
    assert.ok(commentGroup);
    const children = descendants(commentGroup.props.children);
    assert.ok(children.some((node) => node.type === "dd" && visibleText(node.props.children) === "9"));
    assert.ok(children.every((node) => node.type !== "a" && node.type !== "button"));
    assert.match(result.markup, /href="#comments"[^>]*>Comments<\/a>/);
});

test("equal-time activities retain their saved relative order and untimed stops keep their positions", () => {
    const data = fixture();
    data.board.items = [
        activity("last", "21:00", ["last"]),
        activity("free-time", undefined, ["free"]),
        activity("equal-first", "09:00", ["equal-first"]),
        activity("equal-second", "09:00", ["equal-second"])
    ];
    const { scenes } = storyParts(data);
    assert.deepEqual(
        scenes.flatMap((props) => props.scene.photos.map((photo) => photo.image.id)),
        ["equal-first", "free", "equal-second", "last"]
    );
});

test("photo pagination retains every saved photo in balanced scenes of at most six images", () => {
    for (const count of [0, 1, 6, 7, 8, 12, 13, 40]) {
        const data = fixture();
        const ids = Array.from({ length: count }, (_, index) => `saved-${count}-${index}`);
        data.board.items = [activity("photo-stop", "10:00", ids)];
        const { scenes } = storyParts(data);
        assert.equal(scenes.length, Math.max(1, Math.ceil(count / 6)));
        const sizes = scenes.map((props) => props.scene.photos.length);
        assert.ok(sizes.every((size) => size <= 6));
        assert.ok(
            Math.max(...sizes) - Math.min(...sizes) <= 1,
            "Balance the photos across scenes without a sparse final remainder"
        );
        if (count === 7) assert.deepEqual(sizes, [4, 3]);
        if (count === 8) assert.deepEqual(sizes, [4, 4]);
        if (count === 13) assert.deepEqual(sizes, [5, 4, 4]);
        assert.deepEqual(
            scenes.map((props) => props.scene.id),
            scenes.map((_, index) => (index === 0 ? "day-1" : `day-1-part-${index + 1}`))
        );
        assert.deepEqual(
            scenes.flatMap((props) => props.scene.photos.map((photo) => photo.image.id)),
            ids
        );
        for (const props of scenes) {
            const rendered = capture(() => BoardDayScene({ ...props, desktop: true }));
            for (const photo of props.scene.photos) assert.ok(rendered.markup.includes(`Enlarge ${photo.image.alt}`));
        }
    }
});

test("each desktop scene keeps its day heading and a single integrated map, without an additional sidebar", () => {
    const { scenes } = storyParts();
    for (const props of scenes) {
        assert.ok(props.journeyMap, "The production scene must receive its journey map");
        const rendered = capture(() => BoardDayScene({ ...props, desktop: true }));
        assert.equal((rendered.markup.match(/aria-label="Journey map"/g) ?? []).length, 1);
        assert.match(rendered.markup, /<h2\b[^>]*>Day 01<\/h2>/);
        assert.doesNotMatch(rendered.markup, /<aside\b/);
        assert.match(rendered.markup, /Enlarge(?: journey)? map|Expand map|Open larger map/);
        assert.doesNotMatch(rendered.markup, /<select\b|Follow story|The whole journey|Day \d+ map/);
    }
});

test("activity names, time and note stay attached to their photographs and open the same activity details", () => {
    const data = fixture();
    const stop = activity("museum", "09:15", ["museum-first", "museum-second"]);
    data.board.items = [stop];
    const initial = storyParts(data);
    const rendered = capture(() => BoardDayScene({ ...initial.scenes[0], desktop: true }));
    const group = rendered.nodes.find((node) => node.props["data-story-photo"] === `activity-${stop.id}-0`);
    assert.ok(group);
    const grouped = descendants(group.props.children);
    assert.ok(
        grouped.some((node) => node.type === StoryPhoto && (node.props.image as BoardImage).id === "museum-first")
    );
    assert.ok(
        grouped.some((node) => (node.props.activity as BoardActivity | undefined)?.id === "museum"),
        "The photo's own group must carry its activity caption"
    );
    assert.match(rendered.markup, /museum activity/);
    assert.match(rendered.markup, /09:15/);
    assert.match(rendered.markup, /Saved note for museum/);
    const progress: { opened: boolean; detail?: ComponentProps<typeof ActivityDetailsDialog> } = { opened: false };
    capture(
        () => PublishedBoard(data),
        (nodes) => {
            const scene = nodes.find((node) => node.type === BoardDayScene)?.props as SceneProps | undefined;
            assert.ok(scene);
            if (!progress.opened) {
                progress.opened = true;
                scene.onOpenActivity(stop);
            }
            const details = nodes.find((node) => node.type === ActivityDetailsDialog);
            if (details) progress.detail = details.props as ComponentProps<typeof ActivityDetailsDialog>;
        }
    );
    assert.equal(progress.detail?.activity.id, stop.id);
    assert.equal(progress.detail?.activity.description, stop.description);
});

test("short activity notes remain complete and longer notes use a 150-code-point excerpt", () => {
    for (const note of [
        "x".repeat(121),
        "x".repeat(150),
        "x".repeat(151),
        "\u{1f30d}".repeat(150),
        "\u{1f30d}".repeat(151)
    ]) {
        const data = fixture();
        const stop = { ...activity("notes", "09:00", ["note-photo"]), description: note };
        data.board.items = [stop];
        const source = storyParts(data);
        const rendered = capture(() => BoardDayScene({ ...source.scenes[0], desktop: true }));
        const paragraphs = Array.from(rendered.markup.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)).map((match) =>
            match[1].replace(/<[^>]*>/g, "").trim()
        );
        const expected = Array.from(note).slice(0, 150).join("") + (Array.from(note).length > 150 ? "\u2026" : "");
        assert.ok(
            paragraphs.includes(expected),
            "The visible caption must preserve every short-note character and never truncate before 150 code points"
        );
    }
});

class MapSurface {
    children: MapSurface[] = [];
    parent: MapSurface | null = null;
    inert = false;
    focused = false;
    dataset: Record<string, string> = {};
    styleValues: Record<string, string> = {};
    style = {
        setProperty: (name: string, value: string) => {
            this.styleValues[name] = value;
        }
    };
    classList = { add() {} };
    constructor(
        public rect: { left: number; top: number; right: number; bottom: number; width: number; height: number },
        public scene = false
    ) {}
    append(child: MapSurface) {
        child.parent = this;
        this.children.push(child);
    }
    closest(): MapSurface | null {
        return this.scene ? this : (this.parent?.closest() ?? null);
    }
    contains(node: MapSurface): boolean {
        return this === node || this.children.some((child) => child.contains(node));
    }
    getBoundingClientRect() {
        return this.rect;
    }
    focus() {
        this.focused = true;
    }
}

function mountMapExpansion(context: TestContext) {
    const scene = new MapSurface({ left: 0, top: 52, right: 1200, bottom: 852, width: 1200, height: 800 }, true);
    const anchor = new MapSurface({ left: 80, top: 600, right: 320, bottom: 840, width: 240, height: 240 });
    const header = new MapSurface(scene.rect),
        photos = new MapSurface(scene.rect),
        preexisting = new MapSurface(scene.rect),
        slot = new MapSurface(scene.rect);
    const uncovered = new MapSurface({ left: 1000, top: 100, right: 1200, bottom: 200, width: 200, height: 100 });
    preexisting.inert = true;
    scene.append(header);
    scene.append(photos);
    scene.append(preexisting);
    scene.append(slot);
    scene.append(uncovered);
    slot.append(anchor);
    const button = new MapSurface(anchor.rect);
    const listeners = new Map<string, (event: { key: string; preventDefault: () => void }) => void>();
    const previous = ["window", "HTMLElement", "ResizeObserver"].map((key) => ({
        key,
        descriptor: Object.getOwnPropertyDescriptor(globalThis, key)
    }));
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            innerWidth: 1200,
            addEventListener: (key: string, callback: (event: { key: string; preventDefault: () => void }) => void) =>
                listeners.set(key, callback),
            removeEventListener: (key: string) => listeners.delete(key)
        }
    });
    Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: MapSurface });
    Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: class {
            observe() {}
            disconnect() {}
        }
    });
    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const effect: { dependencies?: readonly unknown[]; cleanup?: () => void; mounted?: boolean } = {};
    const map = createElement("div", { "data-map-identity": "retained-map" }, "Interactive map");
    const holder: { nodes: Node[] } = { nodes: [] };
    context.after(() => {
        effect.cleanup?.();
        for (const { key, descriptor } of previous) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        }
    });
    function render() {
        const cursor = { state: 0, ref: 0 };
        const pending: Array<() => void> = [];
        const hooks = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect };
        React.useState = ((initial: unknown) => {
            const index = cursor.state++;
            if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
            return [
                states[index],
                (next: unknown) => {
                    states[index] = typeof next === "function" ? next(states[index]) : next;
                }
            ];
        }) as typeof React.useState;
        React.useRef = ((initial: unknown) => (refs[cursor.ref++] ??= { current: initial })) as typeof React.useRef;
        React.useEffect = (create, dependencies) => {
            if (
                !effect.mounted ||
                !dependencies ||
                dependencies.some((value, index) => !Object.is(value, effect.dependencies?.[index]))
            )
                pending.push(() => {
                    effect.cleanup?.();
                    effect.dependencies = dependencies;
                    effect.cleanup = create() || undefined;
                    effect.mounted = true;
                });
        };
        try {
            holder.nodes = descendants(StoryMapControls({ map }));
            refs[0].current = anchor;
            refs[1].current = button;
        } finally {
            Object.assign(React, hooks);
        }
        pending.forEach((callback) => callback());
    }
    render();
    return {
        scene,
        anchor,
        header,
        photos,
        preexisting,
        uncovered,
        button,
        render: () => {
            render();
            render();
        },
        get nodes() {
            return holder.nodes;
        },
        escape: () => {
            const event = {
                key: "Escape",
                prevented: false,
                preventDefault() {
                    this.prevented = true;
                }
            };
            listeners.get("keydown")?.(event);
            return event;
        }
    };
}

test("corner map expansion stays in place, obscures and inerts covered content, then collapses with Escape or its same control", (context) => {
    const map = mountMapExpansion(context);
    const toggle = () => {
        const control = map.nodes.find((node) => node.type === "button");
        assert.ok(control);
        (control.props.onClick as () => void)();
        map.render();
    };
    assert.equal(map.nodes.find((node) => node.type === "button")?.props["aria-expanded"], false);
    toggle();
    const control = map.nodes.find((node) => node.type === "button");
    assert.equal(control?.props["aria-label"], "Collapse journey map");
    assert.equal(control?.props["aria-expanded"], true);
    const expanded = map.nodes.find((node) => node.props["data-story-map-expanded"] === true);
    assert.ok(expanded);
    const size = expanded.props.style as { width: number; height: number };
    assert.ok(size.width > map.anchor.rect.width && size.height > map.anchor.rect.height);
    assert.ok(size.width <= map.scene.rect.width * 0.65 && size.height <= map.scene.rect.height * 0.85);
    assert.match(String(expanded.props.className), /absolute/);
    assert.match(String(expanded.props.className), /bottom-0/);
    assert.match(String(expanded.props.className), /left-0/);
    assert.ok(map.nodes.every((node) => node.type !== "dialog" && node.props.role !== "dialog"));
    assert.equal(map.nodes.filter((node) => node.props["data-map-identity"] === "retained-map").length, 1);
    for (const content of [map.header, map.photos]) {
        assert.equal(content.dataset.storyMapObscured, "true");
        assert.equal(content.inert, true);
    }
    assert.equal(map.uncovered.dataset.storyMapObscured, undefined, "Uncovered scene content remains visible");
    assert.equal(map.uncovered.inert, false);
    assert.equal(map.escape().prevented, true);
    map.render();
    assert.equal(map.button.focused, true);
    for (const content of [map.header, map.photos]) {
        assert.equal(content.dataset.storyMapObscured, undefined);
        assert.equal(content.inert, false);
    }
    assert.equal(map.preexisting.inert, true, "Collapsing must restore preexisting inert state");
    toggle();
    toggle();
    assert.equal(map.nodes.find((node) => node.type === "button")?.props["aria-label"], "Enlarge journey map");
    assert.equal(map.nodes.find((node) => node.props["data-story-map-expanded"] === false)?.props.style, undefined);
});

test("the gallery follows the displayed chronological scene order and starts at the clicked saved photo", () => {
    const data = fixture();
    const progress: { opened: boolean; gallery?: ComponentProps<typeof StoryGallery> } = { opened: false };
    capture(
        () => PublishedBoard(data),
        (nodes) => {
            if (!progress.opened) {
                const scenes = nodes
                    .filter((node) => node.type === BoardDayScene)
                    .map((node) => node.props as SceneProps);
                const selected = scenes.find((props) =>
                    props.scene.photos.some((photo) => photo.image.id === "evening-a")
                );
                assert.ok(selected);
                const photo = selected.scene.photos.find((photo) => photo.image.id === "evening-a");
                assert.ok(photo);
                progress.opened = true;
                selected.onOpenPhoto(photo.id);
            }
            const gallery = nodes.find((node) => node.type === StoryGallery);
            if (gallery) progress.gallery = gallery.props as ComponentProps<typeof StoryGallery>;
        }
    );
    assert.ok(progress.gallery);
    assert.deepEqual(
        progress.gallery.placements.map((placement) => placement.image.id),
        ["cover", ...displayedPhotos]
    );
    assert.equal(progress.gallery.initialIndex, 6);
    assert.equal(progress.gallery.placements[6].image.id, "evening-a");
});

test("the ending keeps visitor saving, owner editing and the current author's protected portrait and biography", () => {
    const visitor = storyParts();
    const visitorMarkup = capture(() => BoardStoryEnding(visitor.ending)).markup;
    assert.match(visitorMarkup, /aria-label="Save Board"/);
    assert.match(visitorMarkup, /Remix/i);
    assert.match(visitor.markup, /href="#ending"[^>]*>Summary<\/a>/);
    assert.match(visitorMarkup, />Summary<\/p>/);
    assert.match(visitorMarkup, new RegExp(`<h2\\b[^>]*>\\s*${fixture().board.title}\\s*<\\/h2>`));
    assert.doesNotMatch(visitorMarkup, /Every day\. Every memory\.|The journey, at a glance/);
    const firstDay = visitorMarkup.indexOf('href="#day-1"');
    assert.ok(visitorMarkup.indexOf('aria-label="Save Board"') < firstDay);
    assert.ok(
        visitorMarkup.indexOf("Remix") < firstDay,
        "Save and Remix belong beneath the title before the itinerary"
    );
    assert.doesNotMatch(visitorMarkup, /href="\/boards\/718\/edit"/);
    assert.match(visitorMarkup, /aria-label="About the Board author"/);
    assert.match(visitorMarkup, /href="\/profile\/story_author"/);
    assert.match(
        visitorMarkup,
        /src="http:\/\/localhost:3001\/api\/v1\/images\/900\/content\?variant=display&amp;boardId=718"/
    );
    assert.match(visitorMarkup, /The person who recorded this journey/);
    const ownerData = { ...fixture(), canManageBoard: true, canEditContent: true };
    const owner = storyParts(ownerData);
    const ownerMarkup = capture(() => BoardStoryEnding(owner.ending)).markup;
    assert.doesNotMatch(ownerMarkup, /aria-label="(?:Save|Unsave) Board"/);
    assert.doesNotMatch(ownerMarkup, /Remix/i);
    assert.match(ownerMarkup, /href="\/boards\/718\/edit"/);
});

test("overview actions share the author row and access visibility shares the tag row", () => {
    for (const owner of [false, true]) {
        const view = mountStory(
            { ...fixture(), tagLabels: ["Architecture", "Food"], canManageBoard: owner, canEditContent: owner },
            true
        );
        const overview = view.nodes.find((node) => node.type === "header" && node.props.id === "overview");
        assert.ok(overview);
        const groups = descendants(overview.props.children).filter(
            (node) => node.type === "div" && !descendants(node.props.children).some((child) => child.type === "h1")
        );
        const authorRow = groups.find((node) => {
            const children = descendants(node.props.children);
            return (
                children.some((child) => child.props.href === "/profile/story_author") &&
                children.some((child) =>
                    owner ? child.props.href === "/boards/718/edit" : child.props["aria-label"] === "Save Board"
                )
            );
        });
        assert.ok(authorRow, "The author identity and appropriate Save/Edit action must share one row above the title");
        const tagRow = groups.find((node) => {
            const children = descendants(node.props.children);
            return (
                children.some(
                    (child) => child.type === "ul" && visibleText(child.props.children).includes("Architecture")
                ) &&
                children.some(
                    (child) =>
                        ["p", "span"].includes(String(child.type)) &&
                        visibleText(child.props.children).startsWith("Access:")
                )
            );
        });
        assert.ok(tagRow, "The access description belongs inline with tags");
    }
});

function sceneMap(scene: SceneProps) {
    assert.ok(isValidElement<{ map: ReactNode }>(scene.journeyMap));
    const map = scene.journeyMap.props.map;
    assert.ok(isValidElement<ComponentProps<typeof StoryMap>>(map));
    assert.equal(map.type, StoryMap);
    return map.props;
}

test("corner maps automatically scope each day and photo hover or timeline focus selects the matching pin", () => {
    const data = fixture();
    data.board.dayNumbers = [1, 2];
    const otherDay = { ...activity("next-day", "10:00", ["next-day-photo"]), dayNumber: 2 };
    data.board.items.push(otherDay);
    const view = mountStory(data);
    const scenes = () =>
        view.nodes.filter((node) => node.type === BoardDayScene).map((node) => node.props as SceneProps);
    for (const scene of scenes()) assert.equal(sceneMap(scene).filter, scene.scene.day.number);
    const day = scenes().find((scene) => scene.scene.day.number === 1);
    assert.ok(day);
    const rendered = capture(() => BoardDayScene({ ...day, desktop: true }));
    const photo = rendered.nodes.find((node) => node.props["data-story-photo"] === "activity-morning-0");
    assert.ok(photo);
    (photo.props.onMouseEnter as () => void)();
    view.render();
    assert.equal(sceneMap(scenes()[0]).activeId, "morning");
    (photo.props.onMouseLeave as () => void)();
    view.render();
    assert.equal(sceneMap(scenes()[0]).activeId, "morning", "Leaving the photo retains the last selected located pin");
    (photo.props.onFocus as () => void)();
    view.render();
    assert.equal(sceneMap(scenes()[0]).activeId, "morning");
    const timeline = rendered.nodes.find((node) => node.type === "ol");
    assert.ok(timeline);
    const lunch = descendants(timeline.props.children).find(
        (node) => node.type === "button" && visibleText(node.props.children).endsWith("lunch activity")
    );
    assert.ok(lunch);
    const lunchStop = descendants(timeline.props.children).find(
        (node) => node.type === "li" && visibleText(node.props.children).endsWith("lunch activity")
    );
    assert.ok(lunchStop);
    (lunchStop.props.onMouseEnter as () => void)();
    view.render();
    assert.equal(sceneMap(scenes()[0]).activeId, "lunch");
    (lunch.props.onFocus as () => void)();
    view.render();
    assert.equal(sceneMap(scenes()[0]).activeId, "lunch");
    for (const scene of scenes())
        assert.equal(
            sceneMap(scene).filter,
            scene.scene.day.number,
            "Selecting a pin never switches other days into that day's scope"
        );
});

test("the Summary includes an interactive all-pins map after the day list and before the author", () => {
    const data = fixture();
    data.board.dayNumbers = [1, 2];
    const otherDay = { ...activity("next-day", "10:00", ["next-day-photo"]), dayNumber: 2 };
    data.board.items.push(otherDay);
    const view = mountStory(data);
    const fullMap = view.ending.journeyMap;
    assert.ok(isValidElement<ComponentProps<typeof StoryMap>>(fullMap));
    assert.equal(fullMap.type, StoryMap);
    assert.equal(fullMap.props.filter, "all");
    assert.deepEqual(
        fullMap.props.days.map((day) => day.number),
        [1, 2]
    );
    const pins = fullMap.props.days.flatMap((day) =>
        day.items.filter((item) => item.type === "activity" && item.location).map((item) => item.id)
    );
    assert.equal(pins.length, 6);
    assert.ok(pins.includes("next-day"));
    const ending = capture(() => BoardStoryEnding(view.ending)).markup;
    const position = ending.indexOf('aria-label="All Board locations"');
    assert.ok(position > ending.lastIndexOf('href="#day-2"'));
    assert.ok(position < ending.indexOf('aria-label="About the Board author"'));
    fullMap.props.onOpen(otherDay);
    view.render();
    const details = view.nodes.find((node) => node.type === ActivityDetailsDialog)?.props as
        ComponentProps<typeof ActivityDetailsDialog> | undefined;
    assert.equal(details?.activity.id, "next-day");
});

test("clearly portrait photos keep a stable mix of tall and square frames, never landscape frames", () => {
    const data = fixture();
    const stop = activity(
        "portraits",
        "10:00",
        Array.from({ length: 8 }, (_, index) => `portrait-${index}`)
    );
    stop.images = stop.images.map((photo) => ({ ...photo, width: 800, height: 1600 }));
    data.board.items = [stop];
    const frames = () =>
        storyParts(data).scenes.flatMap((props) => {
            const scene = capture(() => BoardDayScene({ ...props, desktop: true }));
            return scene.nodes
                .filter((node) => node.type === StoryPhoto)
                .map((node) => {
                    const photo = node.props as ComponentProps<typeof StoryPhoto>;
                    const rendered = capture(() => StoryPhoto(photo));
                    const trigger = rendered.nodes.find((child) => child.type === "button");
                    assert.ok(trigger);
                    return { props: photo, ratio: (trigger.props.style as { aspectRatio: number }).aspectRatio };
                });
        });
    const first = frames();
    const second = frames();
    assert.equal(first.length, 8);
    assert.ok(first.every((frame) => frame.ratio === 0.5 || frame.ratio === 1));
    assert.deepEqual(new Set(first.map((frame) => frame.ratio)), new Set([0.5, 1]));
    assert.deepEqual(
        second.map((frame) => frame.ratio),
        first.map((frame) => frame.ratio)
    );
    const tall = first.find((frame) => frame.ratio === 0.5);
    assert.ok(tall);
    const legacyPhoto = { ...tall.props, image: { ...tall.props.image, width: undefined, height: undefined } };
    const progress = { loaded: false };
    const learned = capture(
        () => StoryPhoto(legacyPhoto),
        (nodes) => {
            if (progress.loaded) return;
            progress.loaded = true;
            const photo = nodes.find((node) => node.props.src === legacyPhoto.image.url);
            assert.ok(photo);
            (photo.props.onLoad as (event: { currentTarget: { naturalWidth: number; naturalHeight: number } }) => void)(
                { currentTarget: { naturalWidth: 800, naturalHeight: 1600 } }
            );
        }
    );
    const learnedTrigger = learned.nodes.find((node) => node.type === "button");
    assert.equal((learnedTrigger?.props.style as { aspectRatio: number }).aspectRatio, 0.5);
});

function mountStory(data = fixture(), desktop = false) {
    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const navigation: string[] = [];
    const holder: { nodes: Node[] } = { nodes: [] };
    function render() {
        const cursor = { state: 0, ref: 0 };
        const hooks = {
            useState: React.useState,
            useRef: React.useRef,
            useMemo: React.useMemo,
            useCallback: React.useCallback,
            useEffect: React.useEffect,
            useSyncExternalStore: React.useSyncExternalStore
        };
        React.useState = ((initial: unknown) => {
            const index = cursor.state++;
            if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
            return [
                states[index],
                (next: unknown) => {
                    states[index] = typeof next === "function" ? next(states[index]) : next;
                }
            ];
        }) as typeof React.useState;
        React.useRef = ((initial: unknown) => (refs[cursor.ref++] ??= { current: initial })) as typeof React.useRef;
        React.useMemo = ((create: () => unknown) => create()) as typeof React.useMemo;
        React.useCallback = ((callback: unknown) => callback) as typeof React.useCallback;
        React.useEffect = () => {};
        React.useSyncExternalStore = ((_subscribe: unknown, _getSnapshot: unknown, getServerSnapshot: () => unknown) =>
            desktop || getServerSnapshot()) as typeof React.useSyncExternalStore;
        function Probe() {
            holder.nodes = descendants(PublishedBoard(data));
            return null;
        }
        try {
            renderToStaticMarkup(
                createElement(
                    AppRouterContext.Provider,
                    {
                        value: {
                            ...router,
                            push: (destination: string) => {
                                navigation.push(destination);
                            }
                        }
                    },
                    createElement(Probe)
                )
            );
        } finally {
            Object.assign(React, hooks);
        }
    }
    render();
    return {
        navigation,
        render,
        get ending() {
            const ending = holder.nodes.find((node) => node.type === BoardStoryEnding);
            assert.ok(ending);
            return ending.props as EndingProps;
        },
        get nodes() {
            return holder.nodes;
        }
    };
}

function remixButton(ending: EndingProps) {
    const button = descendants(ending.remixAction).find((node) => node.type === "button");
    assert.ok(button, "Visitors must receive a real Remix action");
    return button;
}

test("Remix auto-saves with session credentials before navigating and guards duplicate activation while pending", async (context) => {
    const requests: Array<{ method: string; path: string }> = [];
    const pending: { resolve?: (response: Response) => void } = {};
    context.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
        assert.equal(init?.credentials, "include");
        const method = init?.method ?? "GET";
        requests.push({ method, path: new URL(String(input)).pathname });
        if (method === "PUT")
            return new Promise<Response>((resolve) => {
                pending.resolve = resolve;
            });
        return Promise.resolve(Response.json({ data: { savedCount: 28, savedByMe: true } }));
    });
    const view = mountStory();
    const action = remixButton(view.ending).props.onClick as () => Promise<void>;
    const first = action();
    const second = action();
    const save = descendants(view.ending.saveAction).find((node) => node.type === "button");
    assert.ok(save);
    const competingSave = (save.props.onClick as () => Promise<void>)();
    view.render();
    assert.equal(remixButton(view.ending).props.disabled, true);
    assert.deepEqual(view.navigation, []);
    assert.deepEqual(requests, [{ method: "PUT", path: "/api/v1/boards/718/save" }]);
    assert.ok(pending.resolve);
    pending.resolve(Response.json({ data: { boardId: 718, saved: true } }));
    await Promise.all([first, second, competingSave]);
    view.render();
    assert.deepEqual(view.navigation, ["/boards/new?remix=718"]);
    assert.equal(requests.filter((request) => request.method === "PUT").length, 1);
});

test("already-saved Remix navigates directly without mutating bookmarks", async (context) => {
    const calls: string[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        calls.push(String(input));
        throw new Error("Saved Remix must not issue a request");
    });
    const view = mountStory({ ...fixture(), savedByMe: true });
    await (remixButton(view.ending).props.onClick as () => Promise<void>)();
    assert.deepEqual(view.navigation, ["/boards/new?remix=718"]);
    assert.deepEqual(calls, []);
});

for (const status of [401, 503]) {
    test(`a failed HTTP ${status} Remix save keeps the reader on the Board and reports feedback beneath the summary actions`, async (context) => {
        const requests: string[] = [];
        context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
            assert.equal(init?.credentials, "include");
            requests.push(`${init?.method} ${new URL(String(input)).pathname}`);
            return Response.json(
                {
                    error: {
                        code: status === 401 ? "UNAUTHENTICATED" : "UNAVAILABLE",
                        message: "The Board could not be saved for remix."
                    }
                },
                { status }
            );
        });
        const view = mountStory();
        await (remixButton(view.ending).props.onClick as () => Promise<void>)();
        view.render();
        assert.deepEqual(view.navigation, []);
        assert.deepEqual(requests, ["PUT /api/v1/boards/718/save"]);
        assert.equal(remixButton(view.ending).props.disabled, false);
        const ending = capture(() => BoardStoryEnding(view.ending)).markup;
        assert.match(ending, /The Board could not be saved for remix\./);
        assert.ok(ending.indexOf("The Board could not be saved for remix.") > ending.indexOf("Remix"));
        assert.ok(ending.indexOf("The Board could not be saved for remix.") < ending.indexOf('href="#day-1"'));
        if (status === 401) {
            assert.match(ending, /href="\/login(?:\?|&)/);
            assert.match(ending, /returnTo=%2Fboards%2F718%23ending/);
        }
    });
}
