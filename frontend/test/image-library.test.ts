import assert from "node:assert/strict";
import test from "node:test";
import {
    findLibraryImage,
    librarySource,
    getLibraryImage,
    getLibraryImages,
    editorialFallback,
    editorialImage,
    type LibraryImage
} from "../src/lib/image-library";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Image, { LibraryImg } from "../src/components/images/LibraryImage";
import { destinationPages } from "../src/data/destination-atlas";
import { roamFlowBoards } from "../src/data/roamflow-boards";
import { discoverPhotos } from "../src/data/discover-preview";
import tagCatalog from "../../shared/roamboard-tags.json";

const original = "https://images.unsplash.com/photo-original?w=400&fit=crop&ixid=original";

test("production editorial fixtures use registered database references with original-source fallbacks", () => {
    const sources = [
        ...destinationPages.flatMap((page) => [
            page.hero.src,
            page.closingImage.src,
            ...page.places.map((place) => place.image.src)
        ]),
        ...roamFlowBoards.map((board) => board.image.src),
        ...Object.values(discoverPhotos).map((photo) => photo.src),
        ...tagCatalog.tags.map((tag) => tag.gridImage.url)
    ];
    for (const source of sources) {
        assert.match(source, /^library:[a-z0-9._-]+$/);
        assert.ok(editorialFallback(source), `${source} must retain its migration fallback`);
    }
    assert.equal(editorialImage("/images/create/desert.jpg"), "library:frontend.images.create.desert");
    assert.throws(() => editorialImage("/images/unregistered-image.jpg"), /not registered/);
    const markup = renderToStaticMarkup(
        createElement(Image, { src: "library:frontend.images.create.desert", alt: "Desert", width: 400, height: 300 })
    );
    assert.match(markup, /desert.jpg/);
    assert.doesNotMatch(markup, /src="library:/);
});
const image: LibraryImage = {
    assetKey: "kyoto.cover",
    revision: 1,
    aliases: [original],
    usages: ["frontend/src/data/example.ts"],
    asset: {
        provider: "unsplash",
        url: "https://images.unsplash.com/photo-replacement?w=1080&ixid=replacement",
        thumbnailUrl: "https://images.unsplash.com/photo-replacement?w=200",
        alt: "Kyoto",
        credit: "Photographer",
        sourceUrl: "https://unsplash.com/photos/example",
        photographerUrl: "https://unsplash.com/@photographer",
        cloudinaryAssetId: null,
        cloudinaryPublicId: null,
        unsplashPhotoId: "example",
        checksum: null,
        width: 1000,
        height: 800
    }
};

test("targeted API helpers unwrap saved records, encode keys and reject missing references", async () => {
    const previous = globalThis.fetch;
    const paths: string[] = [];
    globalThis.fetch = async (input, init) => {
        const url = new URL(String(input));
        paths.push(`${url.pathname}${url.search}`);
        assert.equal(init?.credentials, "include");
        if (url.pathname.endsWith("/missing"))
            return Response.json({ error: { message: "Image reference was not found" } }, { status: 404 });
        return Response.json({ data: url.search ? [image] : image });
    };
    try {
        assert.deepEqual(await getLibraryImages([]), []);
        assert.equal(paths.length, 0);
        assert.equal((await getLibraryImage("kyoto.cover")).assetKey, "kyoto.cover");
        assert.equal((await getLibraryImages(["kyoto.cover", "missing"])).length, 1);
        assert.equal(paths[0], "/api/v1/image-library/kyoto.cover");
        assert.equal(paths[1], "/api/v1/image-library?keys=kyoto.cover%2Cmissing");
        await assert.rejects(getLibraryImage("missing"), /Image reference was not found/);
    } finally {
        globalThis.fetch = previous;
    }
});

test("original images remain usable without a catalog and protected images never map to editorial images", () => {
    assert.equal(librarySource(undefined, original), original);
    for (const src of ["blob:upload", "/api/v1/images/12", "https://api.test/api/v1/images/12", "/icons/map.svg"]) {
        assert.equal(findLibraryImage([image], src), undefined);
        assert.equal(librarySource(undefined, src), src);
    }
});

test("stable references and resized legacy aliases resolve replacements without losing crop or provider tracking", () => {
    assert.equal(findLibraryImage([image], "library:kyoto.cover"), image);
    assert.equal(findLibraryImage([image], original.replace("w=400", "w=1200")), image);
    const resolved = new URL(librarySource(image, original));
    assert.equal(resolved.pathname, "/photo-replacement");
    assert.equal(resolved.searchParams.get("w"), "400");
    assert.equal(resolved.searchParams.get("fit"), "crop");
    assert.equal(resolved.searchParams.get("ixid"), "replacement");
    assert.equal(findLibraryImage([image], "library:missing"), undefined);
});

test("images render their working original sources before the catalog arrives, with accessible missing-key placeholders", () => {
    const native = renderToStaticMarkup(
        createElement(LibraryImg, { src: "/api/v1/images/5/content", alt: "Protected photo" })
    );
    assert.match(native, /src="\/api\/v1\/images\/5\/content"/);
    assert.match(native, /alt="Protected photo"/);
    const photo = renderToStaticMarkup(
        createElement(Image, { src: "/images/create/desert.jpg", alt: "Desert", width: 400, height: 300 })
    );
    assert.match(photo, /desert.jpg/);
    const missing = renderToStaticMarkup(
        createElement(Image, { src: "library:missing", alt: "Mountain", width: 400, height: 300 })
    );
    assert.match(missing, /role="img"/);
    assert.match(missing, /Mountain — image unavailable/);
    assert.doesNotMatch(missing, /<img/);
});
