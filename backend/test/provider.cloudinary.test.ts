import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhotoMetadata } from "../src/features/providers/provider.cloudinary.js";

test("photo GPS references apply to numeric, decimal-string and DMS coordinates", () => {
    for (const [latitude, longitude] of [
        [33.86, 151.2],
        ["33.86", "151.2"],
        ["33 51 36", "151 12 0"],
        [-33.86, -151.2],
        ["-33.86", "-151.2"]
    ]) {
        const metadata = normalizePhotoMetadata({
            GPSLatitude: latitude,
            GPSLatitudeRef: "S",
            GPSLongitude: longitude,
            GPSLongitudeRef: "w"
        });
        assert.equal(metadata.latitude, -33.86);
        assert.equal(metadata.longitude, -151.2);
        assert.equal(metadata.hasGps, true);
    }
});

test("photo GPS preserves northern/eastern coordinates and signed values without references", () => {
    for (const value of [33.86, "33.86"]) {
        const metadata = normalizePhotoMetadata({
            GPSLatitude: value,
            GPSLatitudeRef: "N",
            GPSLongitude: value,
            GPSLongitudeRef: "E"
        });
        assert.equal(metadata.latitude, 33.86);
        assert.equal(metadata.longitude, 33.86);
    }
    const signed = normalizePhotoMetadata({ GPSLatitude: -33.86, GPSLongitude: "-151.2" });
    assert.equal(signed.latitude, -33.86);
    assert.equal(signed.longitude, -151.2);
});

test("photo GPS rejects nonfinite and out-of-range coordinates before applying references", () => {
    for (const value of [Infinity, NaN, 181, "181", "181 0 0"]) {
        const metadata = normalizePhotoMetadata({
            GPSLatitude: value,
            GPSLatitudeRef: "S",
            GPSLongitude: value,
            GPSLongitudeRef: "W"
        });
        assert.equal(metadata.latitude, null);
        assert.equal(metadata.longitude, null);
        assert.equal(metadata.hasGps, false);
    }
});
