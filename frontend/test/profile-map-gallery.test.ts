import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BoardLibrary from "../src/components/features/boards/BoardLibrary";
import { loadMapBoardGallery, mapBoardGallery, selectedMapBoards } from "../src/lib/profile-map";
import type { MapDestination } from "../src/lib/profile";
import type { BoardDocument } from "../src/lib/board-creator-api";
import { loadProfileLibraryBoards } from "../src/lib/profile-board-library";

test("profile libraries resolve real author metadata, bookmark state and owner edit permissions", async (context) => {
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        assert.equal(init?.credentials, "include");
        assert.equal(init?.cache, "no-store");
        const id = Number(String(input).split("/").at(-1));
        const document = fullBoard(id);
        document.permissions = { canManageBoard: id === 41, canEditContent: id === 41 };
        document.savedByMe = id === 52;
        document.savedCount = 7;
        return Response.json({ data: document });
    });
    const summaries = mapBoardGallery([destination(41, "VNM", 106), destination(52, "VNM", 106)]);
    const result = await loadProfileLibraryBoards(summaries, new AbortController().signal);
    assert.equal(result.failed, false);
    assert.equal(result.boards[0].ownership, "owner");
    assert.equal(result.boards[0].editHref, "/boards/41/edit");
    assert.equal(result.boards[1].ownership, "other");
    assert.equal(result.boards[1].editHref, undefined);
    assert.equal(result.boards[1].savedByMe, true);
    assert.equal(result.boards[1].photo?.author, "linh_travels");
    assert.equal(result.boards[1].photo?.savedCount, 7);
    assert.equal(result.boards[1].photo?.durationDays, 2);
});

test("profile metadata failures retain summaries for retry and remove inaccessible Boards", async (context) => {
    const summaries = mapBoardGallery([destination(41, "VNM", 106), destination(52, "VNM", 106)]);
    const failures = { active: true };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const id = Number(String(input).split("/").at(-1));
        if (id === 41) return Response.json({ error: { message: "Forbidden" } }, { status: 403 });
        if (failures.active) throw new Error("Connection failed");
        return Response.json({ data: fullBoard(id) });
    });
    const first = await loadProfileLibraryBoards(summaries, new AbortController().signal);
    assert.equal(first.failed, true);
    assert.deepEqual(
        first.boards.map((board) => board.compact.id),
        ["52"]
    );
    assert.equal(first.boards[0].photo?.title, summaries[1].photo?.title);
    failures.active = false;
    const retry = await loadProfileLibraryBoards(summaries, new AbortController().signal);
    assert.equal(retry.failed, false);
    assert.equal(retry.boards[0].photo?.title, "Saigon after the rain");
});

function destination(
    boardId: number,
    countryCode: string,
    longitude: number,
    collection: "published" | "saved" = "published"
): MapDestination {
    return {
        id: `${boardId}:${countryCode}:${longitude}`,
        boardId,
        boardTitle: `Journey ${boardId}`,
        coverImageUrl: `/api/v1/images/${boardId}/content?variant=thumbnail`,
        country: countryCode,
        countryCode,
        city: "Shared city",
        latitude: 10,
        longitude,
        collection
    };
}

const places = [
    destination(41, "VNM", 106),
    destination(41, "VNM", 107),
    destination(41, "IDN", 115),
    destination(52, "VNM", 106, "saved"),
    destination(63, "JPN", 139)
];

test("country selection includes each Board once across its activity locations and collection overlap", () => {
    const vietnam = selectedMapBoards([...places, { ...places[0], collection: "saved" }], {
        kind: "country",
        key: "VNM"
    });
    assert.deepEqual(
        vietnam.map((place) => place.boardId),
        [41, 52]
    );
    assert.deepEqual(
        selectedMapBoards(places, { kind: "country", key: "IDN" }).map((place) => place.boardId),
        [41]
    );
    assert.deepEqual(selectedMapBoards(places, { kind: "country", key: "SWE" }), []);
    assert.deepEqual(selectedMapBoards(places, null), []);
});

test("location selection uses coordinates and selections respect the active collection data", () => {
    assert.deepEqual(
        selectedMapBoards(places, { kind: "location", key: "106:10" }).map((place) => place.boardId),
        [41, 52]
    );
    const published = places.filter((place) => place.collection === "published");
    const saved = places.filter((place) => place.collection === "saved");
    assert.deepEqual(
        selectedMapBoards(published, { kind: "country", key: "VNM" }).map((place) => place.boardId),
        [41]
    );
    assert.deepEqual(
        selectedMapBoards(saved, { kind: "country", key: "VNM" }).map((place) => place.boardId),
        [52]
    );
    assert.deepEqual(selectedMapBoards([], { kind: "country", key: "VNM" }), []);
    assert.deepEqual(
        selectedMapBoards([...places, { ...places[0], boardId: undefined }], { kind: "country", key: "VNM" }).map(
            (place) => place.boardId
        ),
        [41, 52]
    );
});

test("country gallery reuses real Board links, titles and cover metadata without extra requests", (context) => {
    const fetch = context.mock.method(globalThis, "fetch", async () => {
        throw new Error("No map gallery metadata requests");
    });
    const gallery = mapBoardGallery(selectedMapBoards(places, { kind: "country", key: "VNM" }));
    assert.equal(gallery.length, 2);
    assert.deepEqual(
        gallery.map((board) => board.href),
        ["/boards/41", "/boards/52"]
    );
    assert.equal(gallery[0].photo?.title, "Journey 41");
    assert.equal(
        gallery[0].photo?.image?.src,
        new URL(
            "/api/v1/images/41/content?variant=thumbnail",
            process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
        ).toString()
    );
    assert.ok(gallery.every((board) => board.ownership === "unknown"));
    const html = renderToStaticMarkup(
        createElement(BoardLibrary, { boards: gallery, embedded: true, title: "Vietnam Boards" })
    );
    assert.match(html, /href="\/boards\/41"/);
    assert.match(html, /href="\/boards\/52"/);
    assert.match(html, /Journey 41/);
    assert.match(html, /Journey 52/);
    assert.equal(fetch.mock.callCount(), 0);
    const missingCover = mapBoardGallery([{ ...places[0], coverImageUrl: null }]);
    assert.equal(missingCover[0].photo?.image, undefined);
});

type SlideProps = {
    children?: ReactNode;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onFocusCapture?: () => void;
    onBlurCapture?: (event: { currentTarget: { contains(target: unknown): boolean }; relatedTarget: unknown }) => void;
};

function slideProps(node: ReactNode): SlideProps[] {
    if (!isValidElement<SlideProps>(node)) return [];
    return [
        ...(node.props.onMouseEnter ? [node.props] : []),
        ...Children.toArray(node.props.children).flatMap(slideProps)
    ];
}

test("production gallery hover and focus handlers highlight Boards and preserve remaining pointer or keyboard selection", () => {
    const highlights: Array<string | null> = [];
    const captured: { slides: SlideProps[] } = { slides: [] };
    function Probe() {
        const tree = BoardLibrary({
            boards: mapBoardGallery(selectedMapBoards(places, { kind: "country", key: "VNM" })),
            embedded: true,
            onBoardHighlight: (boardId) => highlights.push(boardId)
        });
        captured.slides = slideProps(tree);
        return tree;
    }
    renderToStaticMarkup(createElement(Probe));
    assert.equal(captured.slides.length, 2);
    const [first, second] = captured.slides;
    const outside = { currentTarget: { contains: () => false }, relatedTarget: null };
    first.onMouseEnter?.();
    first.onMouseLeave?.();
    assert.deepEqual(highlights, ["41", null]);
    first.onFocusCapture?.();
    first.onBlurCapture?.({ currentTarget: { contains: () => true }, relatedTarget: {} });
    assert.deepEqual(highlights, ["41", null, "41"], "moving focus inside a card retains its map highlight");
    second.onMouseEnter?.();
    second.onMouseLeave?.();
    assert.deepEqual(highlights.slice(-2), ["52", "41"], "pointer exit restores the keyboard focused Board");
    second.onMouseEnter?.();
    first.onBlurCapture?.(outside);
    assert.equal(highlights.at(-1), "52", "keyboard exit retains the hovered Board");
    second.onMouseLeave?.();
    assert.equal(highlights.at(-1), null);
    second.onFocusCapture?.();
    second.onBlurCapture?.(outside);
    assert.deepEqual(highlights.slice(-2), ["52", null]);
});

function fullBoard(boardId: number): BoardDocument {
    return {
        boardId,
        title: "Saigon after the rain",
        description: "Markets, architecture and a riverside evening.",
        author: { username: "linh_travels", bio: "", photo: null },
        status: "published",
        visibility: "public",
        revision: 7,
        destination: {
            name: "Ho Chi Minh City",
            address: null,
            city: "Ho Chi Minh City",
            country: "VNM",
            externalPlaceId: "geoapify:saigon",
            latitude: 10.77,
            longitude: 106.7,
            kind: "city"
        },
        coverImageId: 902,
        imageIds: [901, 902],
        images: [901, 902].map((imageId, position) => ({
            imageId,
            position,
            url: `/api/v1/images/${imageId}/content?variant=display`,
            thumbnailUrl: `/api/v1/images/${imageId}/content?variant=thumbnail`,
            capturedAt: null
        })),
        tagIds: [3, 8],
        tags: [
            { tagId: 3, name: "Architecture" },
            { tagId: 8, name: "Foodie" }
        ],
        days: [
            { dayId: 11, dayNumber: 1, date: null, activities: [] },
            { dayId: 12, dayNumber: 2, date: null, activities: [] }
        ],
        permissions: { canEditContent: false, canManageBoard: false },
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-19T00:00:00Z"
    };
}

test("map gallery loads each unique Board once and supplies real hover metadata through the production API", async (context) => {
    const requests: Array<{ url: string; credentials?: RequestCredentials; cache?: RequestCache }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(input), credentials: init?.credentials, cache: init?.cache });
        return Response.json({ data: fullBoard(Number(String(input).split("/").at(-1))) });
    });
    const result = await loadMapBoardGallery([places[0], places[1], places[2], places[3]]);
    assert.equal(result.failed, false);
    assert.deepEqual(requests.map((request) => new URL(request.url).pathname).sort(), [
        "/api/v1/boards/41",
        "/api/v1/boards/52"
    ]);
    assert.ok(requests.every((request) => request.credentials === "include" && request.cache === "no-store"));
    assert.equal(result.boards.length, 2);
    const photo = result.boards[0].photo;
    assert.equal(photo?.title, "Saigon after the rain");
    assert.equal(photo?.author, "linh_travels");
    assert.equal(photo?.description, "Markets, architecture and a riverside evening.");
    assert.deepEqual(photo?.tags, ["Architecture", "Foodie"]);
    assert.equal(photo?.durationDays, 2);
    assert.match(photo?.destination ?? "", /Ho Chi Minh City/);
    assert.equal(photo?.destinationLabel, "VNM");
    assert.ok(
        photo?.image?.src.endsWith("/api/v1/images/902/content?variant=display"),
        "use the current Board's selected cover, not its stale map thumbnail"
    );
    const html = renderToStaticMarkup(createElement(BoardLibrary, { boards: result.boards, embedded: true }));
    assert.match(html, /Saigon after the rain/);
    assert.match(html, /Markets, architecture/);
    assert.match(html, /Architecture/);
    assert.match(html, /href="\/boards\/41"/);
});

test("inaccessible map Boards disappear while network and server failures retain honest summary previews", async (context) => {
    const statuses: Record<number, number> = { 41: 401, 52: 403, 63: 404, 74: 500 };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const boardId = Number(String(input).split("/").at(-1));
        if (boardId === 85) throw new Error("Connection interrupted");
        if (boardId === 96) return Response.json({ data: fullBoard(boardId) });
        return Response.json(
            { error: { code: "DENIED_OR_UNAVAILABLE", message: "Board unavailable" } },
            { status: statuses[boardId] }
        );
    });
    const selected = [41, 52, 63, 74, 85, 96].map((id) => destination(id, "VNM", 106));
    const result = await loadMapBoardGallery(selected);
    assert.equal(result.failed, true);
    assert.deepEqual(
        result.boards.map((board) => board.photo?.id),
        ["74", "85", "96"]
    );
    for (const fallback of result.boards.slice(0, 2)) {
        assert.equal(fallback.photo?.title, `Journey ${fallback.photo?.id}`);
        assert.equal(fallback.photo?.description, undefined);
        assert.equal(fallback.photo?.tags, undefined);
        assert.equal(fallback.photo?.durationDays, undefined);
        assert.ok(fallback.photo?.image?.src.includes(`/images/${fallback.photo.id}/`));
    }
    assert.equal(result.boards[2].photo?.title, "Saigon after the rain");
});

test("a stalled Board times out while successful details survive and the fallback can be retried", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const signals: AbortSignal[] = [];
    const attempts = { stalled: true };
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const boardId = Number(String(input).split("/").at(-1));
        assert.ok(init?.signal);
        signals.push(init.signal);
        if (boardId === 52 && attempts.stalled) {
            return new Promise<Response>((_resolve, reject) => {
                init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
            });
        }
        return Response.json({ data: fullBoard(boardId) });
    });
    const pending = loadMapBoardGallery([places[0], places[3]]);
    // Let the successful response finish, including reading its JSON body.
    await new Promise<void>((resolve) => setImmediate(resolve));
    context.mock.timers.tick(10_000);
    const result = await pending;
    assert.equal(signals[0].aborted, false, "completed requests clear their deadline");
    assert.equal(signals[1].aborted, true, "the stalled request is cancelled at the deadline");
    assert.equal(result.failed, true, "the component can now offer Retry");
    assert.equal(result.boards[0].photo?.title, "Saigon after the rain");
    assert.equal(result.boards[1].photo?.title, "Journey 52");
    attempts.stalled = false;
    const retry = await loadMapBoardGallery([places[3]]);
    assert.equal(retry.failed, false);
    assert.equal(retry.boards[0].photo?.title, "Saigon after the rain");
    context.mock.timers.tick(10_000);
    assert.equal(signals[2].aborted, false);
});

test("an empty map selection makes no Board requests and a retry replaces summary metadata", async (context) => {
    const attempts = { count: 0 };
    const fetch = context.mock.method(globalThis, "fetch", async () => {
        attempts.count += 1;
        if (attempts.count === 1) throw new Error("Offline");
        return Response.json({ data: fullBoard(41) });
    });
    assert.deepEqual(await loadMapBoardGallery([]), { boards: [], failed: false });
    assert.equal(fetch.mock.callCount(), 0);
    const first = await loadMapBoardGallery([places[0]]);
    assert.equal(first.failed, true);
    assert.equal(first.boards[0].photo?.title, "Journey 41");
    const retry = await loadMapBoardGallery([places[0]]);
    assert.equal(retry.failed, false);
    assert.equal(retry.boards[0].photo?.title, "Saigon after the rain");
});
