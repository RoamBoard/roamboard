import assert from "node:assert/strict";
import test from "node:test";

import { createBoardsService } from "../src/features/boards/boards.service.js";
import type { BoardWrite } from "../src/features/boards/boards.schemas.js";
import type {
    BoardAccess,
    BoardDocument,
    BoardRepository,
    FillerPool,
    FillerProvider
} from "../src/features/boards/boards.types.js";

function fixture() {
    const input: BoardWrite = {
        status: "published",
        title: "Kyoto weekend",
        description: null,
        visibility: "public",
        fillerImagesEnabled: true,
        destination: {
            kind: "city",
            name: "Kyoto",
            country: "JPN",
            externalPlaceId: "geoapify:kyoto",
            latitude: 35.01,
            longitude: 135.76,
            address: null,
            city: "Kyoto"
        },
        imageIds: [],
        tagIds: [],
        days: [
            {
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        position: 0,
                        title: "Walk",
                        activityTime: null,
                        category: "other",
                        note: null,
                        source: "manual",
                        location: {
                            name: "Walk",
                            latitude: 35.01,
                            longitude: 135.76,
                            address: null,
                            city: "Kyoto",
                            country: "JPN",
                            externalPlaceId: null
                        },
                        locationConfirmed: true,
                        uploadedImageIds: [],
                        externalImage: null
                    }
                ]
            }
        ]
    };
    const current: BoardDocument = {
        ...input,
        boardId: 42,
        revision: 4,
        fillerImagesEnabled: true,
        fillerImages: [],
        fillerImageStatus: "unavailable",
        commentCount: 27,
        savedByMe: false,
        savedCount: 2,
        isCompleted: false,
        author: { username: "owner", bio: "", photo: null },
        coverImageId: null,
        tags: [],
        images: [],
        permissions: { canEditContent: true, canManageBoard: true },
        createdAt: "2026-10-21T10:00:00.000Z",
        updatedAt: "2026-10-21T10:00:00.000Z"
    };
    const access: BoardAccess = {
        boardId: 42,
        ownerUserId: "owner",
        status: "published",
        visibility: "public",
        revision: 4,
        memberRole: null,
        isFriend: false
    };
    const calls = { searches: 0, selections: 0, poolReads: 0 };
    const saves: Array<{ input: BoardWrite; expectedRevision: number | null; pool: FillerPool | undefined }> = [];
    const failures = { search: false, save: false };
    const repository: Pick<
        BoardRepository,
        "getAccess" | "getBoard" | "getFillerPool" | "listTags" | "listCategories" | "saveBoard"
    > = {
        async getAccess() {
            return access;
        },
        async getBoard() {
            return current;
        },
        async getFillerPool() {
            calls.poolReads++;
            return null;
        },
        async listTags() {
            return [];
        },
        async listCategories() {
            return ["other"];
        },
        async saveBoard(_userId, _boardId, expectedRevision, document, pool) {
            if (failures.save) throw new Error("Database transaction failed");
            saves.push({ input: document, expectedRevision, pool });
            return {
                ...current,
                ...document,
                fillerImagesEnabled: document.fillerImagesEnabled ?? current.fillerImagesEnabled,
                revision: (expectedRevision ?? 0) + 1
            };
        }
    };
    const provider: FillerProvider = {
        async search() {
            calls.searches++;
            if (failures.search) throw new Error("Provider unavailable");
            return [{ id: "one" }];
        },
        async select(id) {
            calls.selections++;
            return {
                provider: "unsplash",
                providerImageId: id,
                url: `https://images.unsplash.com/${id}`,
                thumbnailUrl: `https://images.unsplash.com/${id}?w=320`,
                largeUrl: `https://images.unsplash.com/${id}?w=4096`,
                width: 6000,
                height: 4000,
                alt: "Kyoto",
                photographer: "Photographer",
                photographerUrl: "https://unsplash.com/@photographer",
                sourceUrl: `https://unsplash.com/photos/${id}`
            };
        }
    };
    return {
        input,
        current,
        access,
        calls,
        saves,
        failures,
        service: createBoardsService(repository as BoardRepository, undefined, undefined, provider)
    };
}

test("complete replacement preserves an omitted illustration preference and explicit false disables without provider work", async () => {
    const { service, input, saves, calls } = fixture();
    await service.replace("owner", 42, 4, { ...input, fillerImagesEnabled: undefined });
    assert.equal(saves[0]?.input.fillerImagesEnabled, true);
    assert.equal(calls.searches, 1);
    await service.replace("owner", 42, 4, { ...input, fillerImagesEnabled: false });
    assert.equal(saves[1]?.input.fillerImagesEnabled, false);
    assert.equal(saves[1]?.pool, undefined, "Disabling must preserve persisted selections rather than clear them");
    assert.equal(calls.searches, 1);
});

test("draft opt-in is stored without provider work and zero-upload publication can select illustrations", async () => {
    const { service, input, calls, saves } = fixture();
    await service.create("owner", { ...input, status: "draft" });
    assert.equal(saves[0]?.input.fillerImagesEnabled, true);
    assert.equal(saves[0]?.pool, undefined);
    assert.equal(calls.searches, 0);
    await service.create("owner", input);
    assert.equal(saves[1]?.pool?.images.length, 1);
    assert.equal(calls.searches, 1);
});

test("collaborator editors can opt in, while viewers and strangers fail before optional provider work", async () => {
    const allowed = fixture();
    allowed.access.memberRole = "editor";
    await allowed.service.replace("collaborator", 42, 4, allowed.input);
    assert.equal(allowed.saves.length, 1);
    assert.equal(allowed.saves[0]?.expectedRevision, 4);
    for (const role of [null, "viewer"] as const) {
        const denied = fixture();
        denied.access.memberRole = role;
        await assert.rejects(denied.service.replace("reader", 42, 4, denied.input), {
            statusCode: 403,
            code: "FORBIDDEN"
        });
        assert.equal(denied.saves.length, 0);
        assert.deepEqual(denied.calls, { searches: 0, selections: 0, poolReads: 0 });
    }
});

test("stale content revisions cannot start optional provider work or replace a newer pool", async () => {
    const { service, access, input, calls, saves } = fixture();
    access.revision = 5;
    await assert.rejects(service.replace("owner", 42, 4, input), { statusCode: 409, code: "STALE_BOARD_REVISION" });
    assert.deepEqual(calls, { searches: 0, selections: 0, poolReads: 0 });
    assert.deepEqual(saves, []);
});

test("provider failure permits the normal save but database failure is still reported as a failed save", async () => {
    const { service, input, failures, saves } = fixture();
    failures.search = true;
    await service.replace("owner", 42, 4, input);
    assert.equal(saves.length, 1);
    assert.deepEqual(saves[0]?.pool?.images, []);
    failures.save = true;
    await assert.rejects(service.replace("owner", 42, 4, input), /Database transaction failed/);
    assert.equal(saves.length, 1);
});
