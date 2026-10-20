import assert from "node:assert/strict";
import test from "node:test";
import { scrollBoardLibrary } from "../src/lib/board-library-scroll";
import type { CarouselApi } from "../src/components/ui/carousel";

test("library scrollbar moves continuously to intermediate positions and clamps both collection ends", () => {
    const position = { value: 25 };
    const body = {
        useBaseFriction: () => body,
        useDuration: (duration: number) => {
            assert.equal(duration, 0);
            return body;
        }
    };
    const api = {
        internalEngine: () => ({
            limit: { max: 25, length: 1000 },
            target: { get: () => position.value },
            scrollBody: body,
            scrollTo: {
                distance: (delta: number, snap: boolean) => {
                    assert.equal(snap, false);
                    position.value += delta;
                }
            }
        })
    } as unknown as CarouselApi;
    scrollBoardLibrary(api, 0.37);
    assert.equal(position.value, -345);
    scrollBoardLibrary(api, 0.375);
    assert.equal(position.value, -350, "Small thumb movements scroll between card snaps");
    scrollBoardLibrary(api, 2);
    assert.equal(position.value, -975);
    scrollBoardLibrary(api, -1);
    assert.equal(position.value, 25);
});
