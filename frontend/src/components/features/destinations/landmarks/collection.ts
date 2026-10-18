import { roamLandmarks, type RoamLandmarkId } from "@/lib/roam-landmarks";
import type { Study } from "./Drawing";

const collections = {
    vertical: () => import("./vertical"),
    east: () => import("./east"),
    domes: () => import("./domes"),
    streets: () => import("./streets"),
    spans: () => import("./spans")
};

export async function loadLandmark(id: RoamLandmarkId): Promise<Study> {
    const reference = roamLandmarks.find((item) => item.id === id);
    if (!reference) throw new Error("Unknown architectural study.");
    const collection = await collections[reference.collection]();
    const study = collection.studies[id];
    if (!study) throw new Error("Architectural study unavailable.");
    return study;
}
