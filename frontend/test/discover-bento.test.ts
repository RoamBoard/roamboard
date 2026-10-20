import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { DiscoverFeed } from "../src/components/features/discover/DiscoverContent";

type Props = { children?: ReactNode; [key: string]: unknown };

function nodes(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(nodes)];
}

function textContent(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textContent).join("");
    return isValidElement<Props>(node) ? textContent(node.props.children) : "";
}

test("refined Discover tiles retain complete destination identity, sample-count disclosure and navigation", () => {
    const feed = nodes(DiscoverFeed());
    const indonesia = feed.find((node) => node.props["aria-label"] === "Explore Indonesia");
    assert.ok(indonesia);
    assert.equal(indonesia.props.href, "/discover/destinations/indonesia");
    assert.equal(nodes(indonesia.props.children).find((node) => node.type === "h3")?.props.children, "Indonesia");
    assert.match(textContent(indonesia.props.children), /68 boards \(sample count\)/);
    assert.equal(nodes(indonesia.props.children).filter((node) => typeof node.props.href === "string").length, 0);
});

test("By the Water keeps its accessible collection title, full supporting copy and photographic cover", () => {
    const feed = nodes(DiscoverFeed());
    const water = feed.find((node) => node.props.href === "/discover/collections/by-the-water");
    assert.ok(water);
    const children = nodes(water.props.children);
    const heading = children.find((node) => node.type === "h3");
    assert.equal(heading?.props["aria-label"], "By the Water");
    assert.equal(textContent(heading?.props.children), "BY THEWATER");
    assert.match(textContent(water.props.children), /Sea air, slow walks, and places to sit for a while\./);
    const photo = children.find((node) => typeof node.props.photo === "object");
    assert.ok(photo, "The photographic cover remains inside the collection link");
    assert.equal(photo.props.position, "center");
});

// Keep the production sections, links and typography; omit unrelated client/photo components.
function layoutMarkup(node: ReactNode): ReactNode {
    if (Array.isArray(node)) return node.map(layoutMarkup);
    if (!isValidElement<Props>(node)) return node;
    if (typeof node.type !== "string" && typeof node.props.href !== "string") return null;
    const { children, ...props } = node.props;
    return createElement(
        typeof node.type === "string" ? node.type : "a",
        { ...props, key: node.key },
        ...Children.toArray(children).map(layoutMarkup)
    );
}

type Measurement = {
    width: number;
    collections: number[];
    destinations: number[];
    indonesia: { width: number; font: number };
    water: { width: number; font: number; height: number; copyWidth: number };
    nightlifeHeight: number;
};

test("Discover bento keeps readable narrow/tablet tiles and the asymmetric wide composition", async () => {
    const chrome = [
        process.env.CHROME_BIN,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser"
    ].find((path): path is string => !!path && existsSync(path));
    assert.ok(chrome, "Set CHROME_BIN to Chromium to run Discover's CSS layout regression");
    const sections = nodes(DiscoverFeed()).filter(
        (node) =>
            node.type === "section" &&
            ["discover-feed", "trending-title"].includes(String(node.props["aria-labelledby"]))
    );
    assert.equal(sections.length, 2);
    const classes = sections.flatMap((section) =>
        nodes(section.props.children)
            .concat(section)
            .flatMap((node) => String(node.props.className ?? "").split(/\s+/))
    );
    const stylesheet = new URL("../src/app/globals.css", import.meta.url);
    const require = createRequire(import.meta.url);
    const compiler = await compile(await readFile(stylesheet, "utf8"), {
        base: dirname(stylesheet.pathname),
        loadStylesheet: async (id, base) => {
            const path = id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : resolve(base, id);
            return { path, base: dirname(path), content: await readFile(path, "utf8") };
        }
    });
    const markup = renderToStaticMarkup(
        createElement("div", null, ...sections.map((section) => layoutMarkup(createElement("section", section.props))))
    );
    const font = (await readFile(new URL("../src/fonts/Satoshi-Variable.woff2", import.meta.url))).toString("base64");
    const directory = await mkdtemp(join(tmpdir(), "roamboard-bento-layout-"));
    try {
        const file = join(directory, "layout.html");
        await writeFile(
            file,
            `<!doctype html><html><head><style>${compiler.build(classes)}
            @font-face{font-family:Satoshi;src:url(data:font/woff2;base64,${font});font-weight:100 900}
            </style></head><body style="--font-body:Satoshi"><main id="fixture">${markup}</main>
            <pre id="result"></pre><script>
            document.fonts.ready.then(() => {
                const fixture = document.getElementById('fixture');
                const measurements = [216, 256, 286, 352, 512, 608, 944, 1200].map(width => {
                    fixture.style.width = width + 'px';
                    const collections = fixture.querySelector('[aria-labelledby="discover-feed"] > div');
                    const destinations = fixture.querySelector('[aria-labelledby="trending-title"] > div');
                    const indonesia = fixture.querySelector('[aria-label="Explore Indonesia"]');
                    const water = fixture.querySelector('[href="/discover/collections/by-the-water"]');
                    const measure = tile => ({width: tile.getBoundingClientRect().width,
                        height: tile.getBoundingClientRect().height,
                        font: parseFloat(getComputedStyle(tile.querySelector('h3')).fontSize)});
                    const columns = grid => getComputedStyle(grid).gridTemplateColumns.split(' ').map(parseFloat);
                    return {width, collections: columns(collections), destinations: columns(destinations),
                        indonesia: measure(indonesia), water: {...measure(water),
                            copyWidth: water.querySelector('p').getBoundingClientRect().width},
                        nightlifeHeight: collections.firstElementChild.getBoundingClientRect().height};
                });
                document.getElementById('result').textContent = JSON.stringify(measurements);
            });
            </script></body></html>`
        );
        const { stdout } = await promisify(execFile)(
            chrome,
            [
                "--headless",
                "--disable-gpu",
                "--no-first-run",
                "--virtual-time-budget=1500",
                `--user-data-dir=${join(directory, "chrome")}`,
                "--dump-dom",
                pathToFileURL(file).href
            ],
            { timeout: 30000, maxBuffer: 2 * 1024 * 1024 }
        );
        const result = stdout.match(/<pre id="result">([^<]+)<\/pre>/);
        assert.ok(result, "Chromium must return computed layout measurements");
        const measurements: Measurement[] = JSON.parse(result[1]);
        const near = (actual: number, expected: number, label: string) =>
            assert.ok(Math.abs(actual - expected) < 0.2, `${label}: expected ${expected}px, got ${actual}px`);
        for (const layout of measurements) {
            const wide = layout.width >= 1088;
            const collectionColumns = wide ? 12 : layout.width >= 416 ? 2 : 1;
            const destinationColumns = wide ? 12 : layout.width >= 272 ? 2 : 1;
            assert.equal(layout.collections.length, collectionColumns, `${layout.width}px collection columns`);
            assert.equal(layout.destinations.length, destinationColumns, `${layout.width}px destination columns`);
            const expectedWater = wide
                ? ((layout.width - 88) / 12) * 2 + 8
                : (layout.width - (collectionColumns - 1) * 8) / collectionColumns;
            const expectedIndonesia = wide
                ? ((layout.width - 88) / 12) * 2 + 8
                : (layout.width - (destinationColumns - 1) * 8) / destinationColumns;
            near(layout.water.width, expectedWater, `${layout.width}px By the Water width`);
            near(layout.indonesia.width, expectedIndonesia, `${layout.width}px Indonesia width`);
            near(
                layout.water.font,
                Math.max(20, Math.min(36, layout.water.width * 0.1)),
                `${layout.width}px collection title scales with its tile`
            );
            near(
                layout.indonesia.font,
                Math.max(16, Math.min(40, layout.indonesia.width * 0.12)),
                `${layout.width}px destination title scales with its tile`
            );
            assert.ok(layout.water.copyWidth >= 144, "Supporting copy needs a readable measure");
            if (layout.width >= 416)
                assert.ok(
                    layout.nightlifeHeight > layout.water.height * 1.8,
                    "Nightlife retains its larger asymmetric cover on tablet and desktop"
                );
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
