import assert from "node:assert/strict";
import test from "node:test";
import { toBoardWrite, fromBoardDocument, type BoardDocument } from "../src/lib/board-creator-api";
import { createBoardPreview } from "../src/lib/board-creation-preview";
import { boardEditorFingerprint } from "../src/lib/board-editor-safety";
import type { BoardCreatorPayload } from "../src/types/board-creator";
const draft: BoardCreatorPayload = {
    title: "Bali trip",
    description: "",
    status: "draft",
    visibility: "collaborators",
    tags: [],
    days: [],
    images: [],
    coverImageId: null,
    destination: {
        name: "Bali",
        address: "Bali, Indonesia",
        latitude: -8.409518,
        longitude: 115.188919,
        city: null,
        country: "Indonesia",
        countryCode: "IDN",
        mapboxId: "geoapify:bali",
        kind: "region"
    }
};
test("an explicit region survives API serialization and reopening without activities or dirty-state changes", () => {
    const write = toBoardWrite(draft, []);
    assert.equal(write.destination?.country, "IDN");
    assert.equal(write.destination?.externalPlaceId, "geoapify:bali");
    assert.equal(write.destination?.kind, "region");
    const document: BoardDocument = {
        ...write,
        boardId: 42,
        savedByMe: false,
        revision: 1,
        author: { username: "owner", bio: "", photo: null },
        tags: [],
        images: [],
        days: [],
        createdAt: "2026-10-18T12:00:00Z",
        updatedAt: "2026-10-18T12:00:00Z",
        permissions: { canEditContent: true, canManageBoard: true }
    };
    const restored = fromBoardDocument(document);
    assert.deepEqual(restored.destination, draft.destination);
    assert.equal(
        boardEditorFingerprint({ ...draft, destination: restored.destination }),
        boardEditorFingerprint(draft)
    );
    const preview = createBoardPreview(draft);
    assert.equal(preview.destination, "Bali, Indonesia");
    assert.equal(preview.countryLabel, "IDN");
    assert.equal(toBoardWrite({ ...draft, destination: null }, []).destination, null);
});
