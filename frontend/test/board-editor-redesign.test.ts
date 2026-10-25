import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import NewBoardPage from "../src/app/boards/new/page";
import EditDraftPage from "../src/app/boards/drafts/[boardId]/page";
import EditPublishedBoardPage from "../src/app/boards/[boardId]/edit/page";
import ActivityEditorDialog from "../src/components/features/boards/ActivityEditorDialog";
import ActivityPhotoSuggestions from "../src/components/features/boards/ActivityPhotoSuggestions";
import { activityBatchDefaults, fillActivityFromPhoto } from "../src/lib/activity-photo";
import { fromBoardDocument, toBoardWrite, type BoardDocument } from "../src/lib/board-creator-api";
import type { BoardCreatorPayload, BoardImageDraft, BoardPinDraft } from "../src/types/board-creator";

const freeAfternoon: BoardPinDraft = {
    id: "free-afternoon",
    title: "Free afternoon",
    description: "Leave room to explore",
    order: 0,
    time: "",
    category: "activity",
    source: "manual",
    location: null
};

test("create, draft edit and published edit expose the same five chapters in reading order", async () => {
    const pages = [
        await NewBoardPage({ searchParams: Promise.resolve({}) }),
        await EditDraftPage({ params: Promise.resolve({ boardId: "42" }) }),
        await EditPublishedBoardPage({ params: Promise.resolve({ boardId: "42" }) })
    ];
    for (const [index, page] of pages.entries()) {
        const markup = renderToStaticMarkup(
            createElement(
                AppRouterContext.Provider,
                {
                    value: {
                        bfcacheId: "redesign-test",
                        back() {},
                        forward() {},
                        refresh() {},
                        push() {},
                        replace() {},
                        prefetch() {}
                    }
                },
                page.props.children
            )
        );
        const chapters = ["board-basics", "day-plan", "board-map", "details-discovery", "board-preview"];
        const positions = chapters.map((id) => {
            assert.match(markup, new RegExp(`href="#${id}"`), `Chapter ${id} must be directly accessible`);
            const position = markup.indexOf(`id="${id}"`);
            assert.notEqual(position, -1);
            return position;
        });
        assert.deepEqual(
            positions,
            [...positions].sort((a, b) => a - b)
        );
        assert.doesNotMatch(markup, /href="#publish"/, "Saving belongs inside the final overview chapter");
        if (index > 0) assert.doesNotMatch(markup, /SMART CREATE/, "Reopened boards use activity uploads");
    }
});

type Control = {
    children?: ReactNode;
    onClick?: () => void;
    onChange?: (event: { target: { files: File[]; value: string } }) => void | Promise<void>;
    type?: string;
    disabled?: boolean;
};
function elements(node: ReactNode): Array<{ type: unknown; props: Control }> {
    if (!isValidElement<Control>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function editorControls(props: ComponentProps<typeof ActivityEditorDialog>) {
    const wrapper = ActivityEditorDialog(props);
    // Render the public staging wrapper and its content under the same React probe.
    return typeof wrapper.type === "function"
        ? (wrapper.type as (props: unknown) => ReactNode)(wrapper.props)
        : wrapper;
}

test("an itinerary activity can save without a map pin and retains its entered title", () => {
    const saved: BoardPinDraft[] = [];
    const actions: string[] = [];
    const capture: { controls: ReturnType<typeof elements> } = { controls: [] };
    function Probe() {
        const tree = editorControls({
            pin: freeAfternoon,
            images: [],
            remainingUploads: 30,
            onClose: () => actions.push("close"),
            onSave: (pin) => saved.push(pin),
            onDelete() {},
            onAddImage() {},
            onAssignImage() {},
            onSetCover() {},
            onReorderImage() {}
        });
        capture.controls = elements(tree);
        return tree;
    }
    renderToStaticMarkup(createElement(Probe));
    const save = capture.controls.find(
        (control) => control.type === "button" && control.props.children === "Save activity"
    );
    assert.ok(save, "The named activity must have an explicit save action");
    assert.equal(save.props.disabled, false);
    save.props.onClick?.();
    assert.deepEqual(saved, [{ ...freeAfternoon, coverImageId: undefined }]);
    assert.deepEqual(actions, ["close"]);
});

test("changing only an external cover requires discard confirmation even when both legacy upload covers are null", () => {
    const pin: BoardPinDraft = {
        ...freeAfternoon,
        coverImageId: null,
        coverPhoto: { source: "unsplash", providerImageId: "first" }
    };
    const images: BoardImageDraft[] = ["first", "second"].map((id, index) => ({
        ...photo(index + 1, null),
        id,
        publicId: id,
        uploadedImageId: undefined,
        source: "unsplash",
        pinId: pin.id
    }));
    const actions: string[] = [];
    const progress = { stage: 0 };
    function Probe() {
        const tree = editorControls({
            pin,
            images,
            remainingUploads: 5,
            onClose: () => actions.push("closed"),
            onSave: () => actions.push("saved"),
            onDelete() {},
            onAddImage() {},
            onAssignImage() {},
            onSetCover() {},
            onReorderImage() {}
        });
        const nodes = elements(tree);
        if (progress.stage === 0) {
            progress.stage = 1;
            const cover = nodes.find(
                (node) => node.type === "button" && node.props.children === "Set as activity cover"
            );
            assert.ok(cover);
            cover.props.onClick?.();
        } else if (progress.stage === 1) {
            progress.stage = 2;
            const close = nodes.find(
                (node) =>
                    node.type === "button" &&
                    (node.props as { "aria-label"?: string })["aria-label"] === "Close activity editor"
            );
            assert.ok(close);
            close.props.onClick?.();
        }
        return tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    assert.match(markup, /Discard activity edits\?/);
    assert.deepEqual(actions, [], "Cover-only changes must not silently close or save the activity");
});

test("six-file activity batches are rejected before uploads even when board capacity is larger", async (context) => {
    const requests: string[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        requests.push(String(input));
        throw new Error("An oversized batch must never reach the API");
    });
    const state = { checked: false };
    function Probe() {
        const tree = editorControls({
            pin: freeAfternoon,
            images: [],
            remainingUploads: 30,
            onClose() {},
            onSave() {},
            onDelete() {},
            onAddImage() {},
            onAssignImage() {},
            onSetCover() {},
            onReorderImage() {}
        });
        if (!state.checked) {
            state.checked = true;
            const input = elements(tree).find((control) => control.type === "input" && control.props.type === "file");
            assert.ok(input);
            input.props.onChange?.({
                target: {
                    files: Array.from({ length: 6 }, (_, index) => new File(["image"], `photo-${index}.jpg`)),
                    value: ""
                }
            });
        }
        return tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    assert.match(markup, /five|5 photos per batch/i);
    assert.deepEqual(requests, []);
});

test("photo autofill keeps the user's title when adding GPS to a locationless activity", () => {
    const original = structuredClone(freeAfternoon);
    const result = fillActivityFromPhoto(freeAfternoon, {
        latitude: 61.0,
        longitude: 14.5,
        capturedAt: "2026-07-12T18:45:00+02:00"
    });
    assert.equal(result.title, "Free afternoon");
    assert.equal(result.location?.latitude, 61.0);
    assert.equal(result.location?.longitude, 14.5);
    assert.equal(result.time, "18:45", "Camera wall time must not shift to UTC");
    assert.deepEqual(freeAfternoon, original, "Autofill must not mutate the editor's existing document");
});

test("photo autofill preserves a chosen location, category, time and cover", () => {
    const pin: BoardPinDraft = {
        ...freeAfternoon,
        coverImageId: 42,
        time: "09:15",
        category: "hike",
        location: {
            name: "Our trailhead",
            address: "",
            latitude: 60,
            longitude: 15,
            country: null,
            countryCode: null,
            city: null,
            mapboxId: null
        }
    };
    const result = fillActivityFromPhoto(pin, {
        latitude: 61,
        longitude: 14,
        capturedAt: "2026-07-12T18:45:00Z"
    });
    assert.deepEqual(result, pin);
});

test("a photo without GPS can fill time without manufacturing a pin", () => {
    const result = fillActivityFromPhoto(
        { ...freeAfternoon, title: "" },
        { latitude: null, longitude: null, capturedAt: "2026-07-12T08:10:00Z" }
    );
    assert.equal(result.location, null);
    assert.equal(result.title, "");
    assert.equal(result.time, "08:10");
    assert.equal(result.source, "manual");
});

function photo(id: number, capturedAt: string | null, gps = false): BoardImageDraft {
    return {
        id: `upload-${id}`,
        uploadedImageId: id,
        pinId: null,
        publicId: `upload-${id}`,
        source: "upload",
        url: `/photo/${id}`,
        thumbnailUrl: `/photo/${id}/thumb`,
        width: 1200,
        height: 800,
        capturedAt,
        latitude: gps ? 61 : null,
        longitude: gps ? 14.5 : null,
        order: id,
        credit: null,
        creditUrl: null,
        sourceUrl: null
    };
}

test("batch cover and timestamp use the earliest capture while GPS uses the earliest GPS photo", () => {
    const earlier = photo(20, "2026-07-12T08:10:00+02:00");
    const firstGps = photo(30, "2026-07-12T09:20:00+02:00", true);
    const later = photo(10, "2026-07-12T11:30:00+02:00", true);
    const images = [later, photo(40, null, true), firstGps, earlier];
    const original = structuredClone(images);
    assert.deepEqual(activityBatchDefaults(images), {
        coverImageId: 20,
        locationImage: firstGps,
        time: "08:10"
    });
    assert.deepEqual(images, original, "Selection must preserve attachment order");
});

test("invalid or missing dates follow valid dates, timestamp ties retain selection order", () => {
    const first = photo(10, "2026-07-12T09:20:00Z", true);
    const second = photo(20, "2026-07-12T09:20:00Z", true);
    assert.equal(activityBatchDefaults([photo(30, "bad-date"), first, second]).coverImageId, 10);
    assert.equal(activityBatchDefaults([second, first]).coverImageId, 20);
    const undated = [photo(30, null), photo(20, "bad-date", true), photo(10, null, true)];
    assert.deepEqual(activityBatchDefaults(undated), {
        coverImageId: 30,
        locationImage: undated[1],
        time: ""
    });
    assert.deepEqual(activityBatchDefaults([]), { coverImageId: null, locationImage: null, time: "" });
});

test("external images and invalid GPS cannot supply upload defaults", () => {
    const invalid = { ...photo(10, "2026-07-12T08:10:00Z", true), latitude: 91 };
    const gps = photo(20, null, true);
    const external = { ...photo(30, "2026-07-11T08:10:00Z", true), source: "unsplash" as const };
    assert.deepEqual(activityBatchDefaults([external, invalid, gps]), {
        coverImageId: 10,
        locationImage: gps,
        time: "08:10"
    });
});

test("attached uploads expose named keyboard crop and delete buttons", () => {
    function Probe() {
        return ActivityEditorDialog({
            pin: { ...freeAfternoon, coverImageId: 10 },
            images: [{ ...photo(10, null), pinId: freeAfternoon.id }],
            remainingUploads: 30,
            onClose() {},
            onSave() {},
            onDelete() {},
            onAddImage() {},
            onAssignImage() {},
            onSetCover() {},
            onReorderImage() {}
        });
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    const buttons = markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    const crop = buttons.find((button) => /aria-label="Crop (?:photo|image) /i.test(button));
    const remove = buttons.find((button) => /delete (?:photo|image)|remove (?:photo|image)/i.test(button));
    assert.ok(crop, "Crop must be a named native button, available to keyboard and assistive technology");
    assert.ok(remove, "Photo deletion must be a named native button");
    assert.doesNotMatch(crop, /tabindex="-1"|aria-hidden="true"[^>]*>\s*Crop/i);
    assert.doesNotMatch(remove, /tabindex="-1"/);
});

test("illustrative photo context survives serialization, reopening and a second save", () => {
    const context = { kind: "illustrative", scope: "region", locationLabel: "Dalarna, Sweden" } as const;
    const image: BoardImageDraft = {
        ...photo(10, null),
        uploadedImageId: undefined,
        publicId: "siljan-photo",
        source: "unsplash",
        pinId: freeAfternoon.id,
        credit: "Photographer",
        creditUrl: "https://unsplash.com/@photographer",
        sourceUrl: "https://unsplash.com/photos/siljan-photo",
        url: "https://images.unsplash.com/siljan-photo",
        context
    };
    const payload: BoardCreatorPayload = {
        title: "Summer in Dalarna",
        description: "A lake afternoon",
        status: "draft",
        visibility: "friends",
        coverImageId: null,
        tags: [],
        images: [image],
        days: [{ id: "first-day", dayNumber: 1, date: null, pins: [freeAfternoon] }]
    };
    const write = toBoardWrite(payload, []);
    assert.deepEqual(write.days[0].activities[0].externalImage?.context, context);
    const document: BoardDocument = {
        ...write,
        boardId: 42,
        revision: 1,
        author: { username: "owner", bio: "", photo: null },
        permissions: { canEditContent: true, canManageBoard: true },
        tags: [],
        images: [],
        days: write.days.map((day) => ({
            ...day,
            dayId: 1,
            activities: day.activities.map((activity) => ({ ...activity, activityId: 1 }))
        })),
        createdAt: "2026-07-12T00:00:00Z",
        updatedAt: "2026-07-12T00:00:00Z"
    };
    const restored = fromBoardDocument(document);
    assert.deepEqual(restored.images[0].context, context);
    const secondWrite = toBoardWrite({ ...payload, ...restored }, []);
    assert.deepEqual(secondWrite.days[0].activities[0].externalImage, write.days[0].activities[0].externalImage);
    delete image.context;
    assert.equal(toBoardWrite(payload, []).days[0].activities[0].externalImage?.context, null);
});

test("selecting an illustrative replacement persists it instead of retaining the previous external photo", () => {
    const pin: BoardPinDraft = {
        ...freeAfternoon,
        coverImageId: null,
        location: {
            name: "Siljan",
            address: "",
            latitude: 61,
            longitude: 14.5,
            country: "Sweden",
            countryCode: "SWE",
            city: "Mora",
            mapboxId: null
        }
    };
    const oldPhoto: BoardImageDraft = {
        ...photo(10, null),
        uploadedImageId: undefined,
        source: "unsplash",
        pinId: pin.id,
        publicId: "old-photo",
        credit: "Old Photographer"
    };
    const state: {
        selected: boolean;
        images: BoardImageDraft[];
        pin: BoardPinDraft;
        controls: ReturnType<typeof elements>;
    } = {
        selected: false,
        images: [oldPhoto],
        pin,
        controls: []
    };
    function Probe() {
        const tree = editorControls({
            pin,
            images: [oldPhoto],
            remainingUploads: 5,
            onClose() {},
            onDelete() {},
            onSetCover() {},
            onReorderImage() {},
            onSave: (saved) => {
                state.pin = saved;
            },
            onAddImage: (image) => {
                state.images.push(image);
            },
            onAssignImage: (id, pinId) => {
                state.images = state.images.map((image) => (image.id === id ? { ...image, pinId } : image));
            }
        });
        state.controls = elements(tree);
        if (!state.selected) {
            state.selected = true;
            const suggestions = state.controls.find((node) => node.type === ActivityPhotoSuggestions);
            assert.ok(suggestions);
            (suggestions.props as ComponentProps<typeof ActivityPhotoSuggestions>).onSelect({
                id: "new-photo",
                url: "https://images.unsplash.com/new-photo",
                thumbnailUrl: "https://images.unsplash.com/new-photo?w=400",
                alt: "Lake in Dalarna",
                photographer: "New Photographer",
                photographerUrl: "https://unsplash.com/@new",
                sourceUrl: "https://unsplash.com/photos/new-photo",
                width: 1200,
                height: 800,
                context: { kind: "illustrative", scope: "region", locationLabel: "Dalarna, Sweden" }
            });
        }
        return tree;
    }
    renderToStaticMarkup(createElement(Probe));
    const save = state.controls.find((node) => node.type === "button" && node.props.children === "Save activity");
    assert.ok(save);
    save.props.onClick?.();
    const write = toBoardWrite(
        {
            title: "Lake day",
            description: "",
            status: "draft",
            visibility: "friends",
            coverImageId: null,
            tags: [],
            images: state.images,
            days: [{ id: "day-one", dayNumber: 1, date: null, pins: [state.pin] }]
        },
        []
    );
    assert.equal(write.days[0].activities[0].externalImage?.providerImageId, "new-photo");
});
