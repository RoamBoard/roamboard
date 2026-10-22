import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import React, { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { compile } from "tailwindcss";
import BoardDayScene from "../src/components/features/boards/BoardDayScene";
import StoryMapControls from "../src/components/features/boards/StoryMapControls";
import PublishedBoard from "../src/components/features/boards/PublishedBoard";
import BoardStoryEnding from "../src/components/features/boards/BoardStoryEnding";
import { createDayScenes } from "../src/lib/board-story-scenes";
import type { BoardActivity, BoardImage } from "../src/types/board";
import type { PublishedBoardData } from "../src/types/published-board";

function descendants(
    node: ReactNode
): Array<{ type: unknown; props: { children?: ReactNode; stats?: ReactNode; id?: string } }> {
    return Children.toArray(node).flatMap((child) => {
        if (!isValidElement<{ children?: ReactNode; stats?: ReactNode }>(child)) return [];
        return [{ type: child.type, props: child.props }, ...descendants(child.props.children)];
    });
}

function productionStats(part: "stats" | "overview" | "day" = "stats") {
    const data: PublishedBoardData = {
        board: {
            id: "718",
            ownerId: "author",
            title: "Stats fixture",
            description: "A saved description that uses the available space beside its photograph. ".repeat(3),
            visibility: "public",
            isCompleted: false,
            tags: [],
            destinations: [],
            dayNumbers: [1],
            items: [],
            coverImage: photo(0),
            createdAt: "2026-10-21T10:00:00Z",
            updatedAt: "2026-10-21T10:00:00Z"
        },
        author: { id: "author", name: "Author", bio: "" },
        savedCount: 27,
        commentCount: 9,
        tagLabels: ["Architecture", "Food"]
    };
    function Probe() {
        const previous = React.useSyncExternalStore;
        const holder: { tree?: ReactNode } = {};
        try {
            React.useSyncExternalStore = (() => true) as typeof React.useSyncExternalStore;
            holder.tree = PublishedBoard(data);
        } finally {
            React.useSyncExternalStore = previous;
        }
        const nodes = descendants(holder.tree);
        if (part === "overview") {
            const overview = nodes.find((node) => node.type === "header" && node.props.id === "overview");
            assert.ok(overview);
            return createElement("header", overview.props);
        }
        if (part === "day") {
            const day = nodes.find((node) => node.type === BoardDayScene);
            assert.ok(day);
            return createElement(BoardDayScene, day.props as ComponentProps<typeof BoardDayScene>);
        }
        const ending = nodes.find((node) => node.type === BoardStoryEnding);
        assert.ok(ending);
        return ending.props.stats;
    }
    return renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            {
                value: {
                    bfcacheId: "stats-layout",
                    back() {},
                    forward() {},
                    refresh() {},
                    push() {},
                    replace() {},
                    prefetch() {}
                }
            },
            createElement(Probe)
        )
    );
}

const photo = (index: number): BoardImage => ({
    id: `photo-${index}`,
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="${["#c7d5ce", "#dfb68b", "#86a5ad", "#b8adbf", "#a4b38f", "#d1a49b"][index % 6]}"/><path d="M0 650 400 180 740 600 1000 330 1200 700V800H0Z" fill="#36514e" opacity=".5"/><circle cx="920" cy="180" r="80" fill="#fff1c9"/><text x="60" y="730" font-size="54" font-family="sans-serif" fill="white">Saved photograph ${index + 1}</text></svg>`)}`,
    alt: `Saved photograph ${index + 1}`,
    source: "upload",
    width: index % 3 === 1 ? 900 : 1200,
    height: index % 3 === 1 ? 1200 : 800
});

test("Overview keeps four desktop statistics in its information area and omits Back", () => {
    const overview = productionStats("overview");
    assert.doesNotMatch(overview, />\s*back\s*</i);
    assert.match(overview, /@min-\[30rem\]:grid-cols-4/);
    assert.ok(overview.indexOf("<dl") > overview.indexOf("A saved description"));
    assert.ok(overview.indexOf("<dl") < overview.indexOf('aria-label="Journey map"'));
});

test("desktop collages keep every photo visible, separated and inside the scene across narrow and wide layouts", async (context) => {
    const chrome = [
        process.env.CHROME_BIN,
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome"
    ].find((path): path is string => Boolean(path && existsSync(path)));
    assert.ok(chrome, "Set CHROME_BIN to run the Board scene CSS regression");
    const variants = [1, 2, 3, 6, 7, 8, 13, 18, 60, 121]
        .flatMap((count) => {
            const photos = Array.from({ length: count }, (_, index) => ({
                id: `placement-${index}`,
                image: photo(index),
                activityId: `activity-${Math.floor(index / 3)}`
            }));
            const items: BoardActivity[] = Array.from({ length: Math.ceil(count / 3) }, (_, index) => ({
                id: `activity-${index}`,
                type: "activity",
                title: "Walk among the mountains before lunch",
                description: "Take the quiet path through the valley and stop for a moment to enjoy the view.",
                time: "09:00",
                images: photos.filter((photo) => photo.activityId === `activity-${index}`).map((photo) => photo.image)
            }));
            const day = { number: 1, title: "A day in the mountains", items };
            const journeyMap = createElement(StoryMapControls, {
                map: createElement(
                    "div",
                    { style: { aspectRatio: "1", width: "100%", background: "#86a5ad" } },
                    "Map fixture"
                )
            });
            return createDayScenes(day, photos).map(
                (scene) =>
                    `<div data-count="${scene.photos.length}" class="variant">${renderToStaticMarkup(createElement(BoardDayScene, { scene, boardId: "layout-fixture", desktop: true, journeyMap, onOpenPhoto() {}, onOpenActivity() {}, onHighlight() {} }))}</div>`
            );
        })
        .join("");
    const stylesheet = new URL("../src/app/globals.css", import.meta.url);
    const require = createRequire(import.meta.url);
    const compiler = await compile(await readFile(stylesheet, "utf8"), {
        base: dirname(fileURLToPath(stylesheet)),
        loadStylesheet: async (id, base) => {
            const path = id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : resolve(base, id);
            return { path, base: dirname(path), content: await readFile(path, "utf8") };
        }
    });
    const statsMarkup = `<div id="stats-fixture" class="@container">${productionStats()}</div>`;
    const alignmentMarkup = ["overview", "day"]
        .map(
            (part) =>
                `<div data-alignment="${part}" class="alignment-variant">${productionStats(part as "overview" | "day")}</div>`
        )
        .join("");
    const classes = [...(variants + statsMarkup + alignmentMarkup).matchAll(/class="([^"]+)"/g)].flatMap((match) =>
        match[1].split(/\s+/)
    );
    const output = process.env.BOARD_STORY_REVIEW_DIR;
    const directory = output ? resolve(output) : await mkdtemp(join(tmpdir(), "roamboard-story-layout-"));
    await mkdir(directory, { recursive: true });
    try {
        const file = join(directory, "scenes.html");
        await writeFile(
            file,
            `<!doctype html><html><head><style>${compiler.build(classes)}
        body{margin:0;background:#151515;color:#eee;font-family:Arial,sans-serif}.variant,.alignment-variant{display:none;height:720px;width:var(--story-width)}#fixture{height:720px;width:1100px;--story-width:1100px}.variant:first-child{display:block}
        </style></head><body><main id="fixture">${variants}</main>${statsMarkup}${alignmentMarkup}<pre id="results" hidden></pre><pre id="stats-results" hidden></pre><pre id="alignment-results" hidden></pre><pre id="motion-results" hidden></pre><script>
        document.fonts.ready.then(()=>{
          const fixture=document.getElementById('fixture'), variants=[...document.querySelectorAll('.variant')], results=[];
          for(const width of [640,900,1280]) for(const variant of variants){
            variants.forEach(item=>item.style.display='none');variant.style.display='block';fixture.style.setProperty('--story-width',width+'px');fixture.style.width=width+'px';
            const section=variant.querySelector('section'), bounds=section.getBoundingClientRect();
            const gallery=section.querySelector('[data-story-gallery]'), map=section.querySelector('[data-story-map]').getBoundingClientRect(), heading=section.querySelector('header').getBoundingClientRect();
            const timeline=section.querySelector('ol[aria-label$="activity timeline"]'), timelineStyle=timeline&&getComputedStyle(timeline);
            const captionNotes=[...section.querySelectorAll('[data-story-caption] p')].map(note=>({length:Array.from(note.textContent).length,height:note.clientHeight,scrollHeight:note.scrollHeight}));
            const countLabel=[...section.querySelectorAll('header p')].find(label=>/activities/.test(label.textContent));
            const photos=[...section.querySelectorAll('[data-story-photo] button[aria-label^="Enlarge "]')].map(button=>{const r=button.getBoundingClientRect(), parent=gallery||section, area=parent.getBoundingClientRect(),border=button.querySelector('[aria-hidden="true"]'),outline=border&&getComputedStyle(border),caption=button.closest('[data-story-photo]').querySelector('[data-story-caption]'),captionRect=caption&&caption.getBoundingClientRect();return {left:r.left-bounds.left,top:r.top-bounds.top,width:r.width,height:r.height,reachable:r.top-area.top+parent.scrollTop>=0&&r.bottom-area.top+parent.scrollTop<=parent.scrollHeight+1,fit:getComputedStyle(button.querySelector('img')).objectFit,bg:getComputedStyle(button).backgroundColor,cursor:getComputedStyle(button).cursor,borderWidth:outline?parseFloat(outline.borderTopWidth):0,borderColor:outline?.borderTopColor,captionBelow:captionRect&&captionRect.top>=r.bottom-1,captionAlign:caption&&getComputedStyle(caption).textAlign,captionRight:captionRect&&captionRect.left>=r.right-1,captionGap:parseFloat(getComputedStyle(button.closest("[data-story-photo]")).gap)}});
            results.push({width,count:Number(variant.dataset.count),height:bounds.height,shellOverscroll:getComputedStyle(section).overscrollBehaviorY,scrollHeight:gallery?.scrollHeight||section.scrollHeight,scrollClient:gallery?.clientHeight||section.clientHeight,map:{left:map.left-bounds.left,top:map.top-bounds.top,right:map.right-bounds.left,bottom:map.bottom-bounds.top},heading:{left:heading.left-bounds.left,right:heading.right-bounds.left,top:heading.top-bounds.top,bottom:heading.bottom-bounds.top},countSize:countLabel?parseFloat(getComputedStyle(countLabel).fontSize):0,captionNotes,timelineColumns:timelineStyle?.gridTemplateColumns.split(' ').length,photos});
          }
          document.getElementById('results').textContent=JSON.stringify(results);
          const statsFixture=document.getElementById('stats-fixture'), statsResults=[];
          for(const width of [360,640,900]) {statsFixture.style.width=width+'px';for(const group of statsFixture.querySelectorAll('dl>div')){const count=group.querySelector('dd'),label=group.querySelector('dt'),countStyle=getComputedStyle(count);statsResults.push({width,labelAlign:getComputedStyle(label).textAlign,countAlign:countStyle.textAlign,countDisplay:countStyle.display,countJustify:countStyle.justifyContent,countGap:parseFloat(countStyle.columnGap)});}}
          document.getElementById('stats-results').textContent=JSON.stringify(statsResults);
          const motionNode=variants.find(element=>element.style.display==='block').querySelector('header');motionNode.classList.add('story-map-obscurable');motionNode.style.transition='none';motionNode.dataset.storyMapObscured='true';const coveredStyle=getComputedStyle(motionNode),coveredOpacity=Number(coveredStyle.opacity),coveredTransform=coveredStyle.transform;delete motionNode.dataset.storyMapObscured;const restoredStyle=getComputedStyle(motionNode);document.getElementById('motion-results').textContent=JSON.stringify({coveredOpacity,coveredTransform,restoredOpacity:Number(restoredStyle.opacity),restoredTransform:restoredStyle.transform,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
          const alignmentResults=[];
          for(const width of [1024,1280,1600]) for(const panel of document.querySelectorAll('.alignment-variant')) {panel.style.display='block';panel.style.width=width+'px';panel.style.setProperty('--story-width',width+'px');const scene=panel.firstElementChild.getBoundingClientRect(),map=panel.querySelector('[aria-label="Journey map"]').getBoundingClientRect(),description=[...panel.querySelectorAll('p')].find(element=>element.textContent.startsWith('A saved description')),cover=panel.querySelector('button[aria-label^="Enlarge Saved photograph"]');alignmentResults.push({width,part:panel.dataset.alignment,snapAlign:getComputedStyle(panel.firstElementChild).scrollSnapAlign,left:map.left-scene.left,top:map.top-scene.top,mapWidth:map.width,mapHeight:map.height,descriptionWidth:description?.getBoundingClientRect().width,coverWidth:cover?.getBoundingClientRect().width});panel.style.display='none';}
          document.getElementById('alignment-results').textContent=JSON.stringify(alignmentResults);
          variants.forEach(item=>item.style.display='none');variants[2].style.display='block';fixture.style.setProperty('--story-width','1100px');fixture.style.width='1100px';
        });</script></body></html>`
        );
        const exec = promisify(execFile);
        const { stdout } = await exec(
            chrome,
            [
                "--headless",
                "--disable-gpu",
                "--no-first-run",
                "--virtual-time-budget=2000",
                `--user-data-dir=${join(directory, "chrome")}`,
                "--dump-dom",
                pathToFileURL(file).href
            ],
            { timeout: 30000, maxBuffer: 4 * 1024 * 1024 }
        );
        const match = stdout.match(/<pre id="results" hidden="">([^<]+)<\/pre>/);
        assert.ok(match, "Chromium must return computed production-scene geometry");
        const results = JSON.parse(match[1]) as Array<{
            width: number;
            count: number;
            height: number;
            shellOverscroll: string;
            scrollHeight: number;
            scrollClient: number;
            map: { left: number; top: number; right: number; bottom: number };
            heading: { left: number; right: number; top: number; bottom: number };
            countSize: number;
            captionNotes: Array<{ length: number; height: number; scrollHeight: number }>;
            timelineColumns?: number;
            photos: Array<{
                left: number;
                top: number;
                width: number;
                height: number;
                reachable: boolean;
                fit: string;
                bg: string;
                cursor: string;
                borderWidth: number;
                borderColor: string;
                captionBelow: boolean;
                captionAlign: string;
                captionRight: boolean;
                captionGap: number;
            }>;
        }>;
        const statsMatch = stdout.match(/<pre id="stats-results" hidden="">([^<]+)<\/pre>/);
        assert.ok(statsMatch);
        const motionMatch = stdout.match(/<pre id="motion-results" hidden="">([^<]+)<\/pre>/);
        assert.ok(motionMatch);
        const motion = JSON.parse(motionMatch[1]) as {
            coveredOpacity: number;
            coveredTransform: string;
            restoredOpacity: number;
            restoredTransform: string;
            reduced: boolean;
        };
        assert.ok(motion.coveredOpacity < 1);
        assert.equal(motion.restoredOpacity, 1);
        if (!motion.reduced)
            assert.notEqual(
                motion.coveredTransform,
                motion.restoredTransform,
                "Map-covered content moves outward and returns to its original position"
            );
        const statsResults = JSON.parse(statsMatch[1]) as Array<{
            width: number;
            labelAlign: string;
            countAlign: string;
            countDisplay: string;
            countJustify: string;
            countGap: number;
        }>;
        assert.equal(statsResults.length, 12);
        const alignmentMatch = stdout.match(/<pre id="alignment-results" hidden="">([^<]+)<\/pre>/);
        assert.ok(alignmentMatch);
        const alignment = JSON.parse(alignmentMatch[1]) as Array<{
            width: number;
            part: string;
            snapAlign: string;
            left: number;
            top: number;
            mapWidth: number;
            mapHeight: number;
            descriptionWidth?: number;
            coverWidth?: number;
        }>;
        for (const width of [1024, 1280, 1600]) {
            const overview = alignment.find((item) => item.width === width && item.part === "overview");
            const day = alignment.find((item) => item.width === width && item.part === "day");
            assert.ok(overview && day);
            assert.equal(
                overview.snapAlign,
                "start",
                "Overview must remain a native horizontal snap target at index zero"
            );
            assert.equal(day.snapAlign, "start", "Day scenes share the Overview's native snap alignment");
            if (width === 1600)
                assert.ok(
                    overview.descriptionWidth! > 512 && overview.descriptionWidth! > overview.coverWidth!,
                    "Overview descriptions use the wider text column beside the cover"
                );
            for (const dimension of ["left", "top", "mapWidth", "mapHeight"] as const)
                assert.ok(
                    Math.abs(overview[dimension] - day[dimension]) < 2,
                    `${width}px overview and day maps share the same ${dimension}: ${JSON.stringify({ overview, day })}`
                );
        }
        for (const stats of statsResults) {
            assert.equal(stats.labelAlign, "center", `${stats.width}px statistics labels remain centered`);
            assert.ok(
                stats.countAlign === "center" && (stats.countDisplay !== "flex" || stats.countJustify === "center"),
                "Statistics counts and icons remain centered together"
            );
            if (stats.countDisplay === "flex")
                assert.ok(stats.countGap < 12, "Save icons stay close to their centered count");
        }
        for (const result of results) {
            assert.equal(
                result.shellOverscroll,
                "auto",
                "The final day scene must chain native vertical scrolling to the Summary"
            );
            assert.equal(result.photos.length, result.count);
            assert.ok(result.count <= 6, "Every rendered scene stays within the six-photo limit");
            assert.ok(result.countSize >= 16, "The activity count and scene label use readable enlarged text");
            for (const note of result.captionNotes.filter((note) => note.length <= 150)) {
                assert.ok(
                    note.height > 0 && note.scrollHeight <= note.height + 1,
                    "Short activity notes are fully visible instead of line-clipped"
                );
            }
            assert.ok(result.heading.left < result.width / 3 && result.heading.top < 60, "Day heading stays top left");
            assert.ok(
                result.map.left < result.width / 3 && result.map.bottom > result.height - 50,
                "Map stays bottom left"
            );
            assert.ok(
                Math.abs(result.map.right - result.map.left - (result.map.bottom - result.map.top)) <= 1,
                "The corner map remains square without a separate heading or filter row consuming its canvas"
            );
            if (result.timelineColumns) assert.equal(result.timelineColumns, 2, "The scene timeline uses two columns");
            for (const bounds of result.photos) {
                assert.ok(
                    bounds.width >= 44 && bounds.height >= 44,
                    `${result.width}px/${result.count} photos: image remains a usable target`
                );
                assert.ok(
                    bounds.left >= 0 && bounds.left + bounds.width <= result.width + 1,
                    "Photo stays inside its scene horizontally"
                );
                assert.ok(bounds.reachable, "Photo stays inside its scene's reachable vertical content");
                assert.equal(bounds.fit, "cover");
                assert.equal(bounds.bg, "rgba(0, 0, 0, 0)");
                assert.equal(bounds.cursor, "pointer", "Photo hover keeps the ordinary interactive pointer");
                assert.ok(bounds.borderWidth > 0 && bounds.borderWidth <= 1, "Photographs have a superthin outline");
                assert.notEqual(bounds.borderColor, "rgba(0, 0, 0, 0)");
                if (bounds.captionBelow !== null) {
                    assert.ok(
                        bounds.captionBelow || bounds.captionRight,
                        "Captions stay below or to the right of their photo"
                    );
                    assert.ok(bounds.captionGap <= 12, "Image and activity caption gap stays within 12px");
                }
                if (bounds.captionBelow)
                    assert.equal(bounds.captionAlign, "center", "Captions beneath photographs stay centered");
                assert.ok(
                    bounds.left >= result.map.right - 1 ||
                        bounds.top + bounds.height <= result.map.top + 1 ||
                        bounds.top >= result.map.bottom - 1,
                    "Photo must not obscure the map"
                );
                assert.ok(
                    bounds.left >= result.heading.right - 1 || bounds.top >= result.heading.bottom - 1,
                    "Photo must not obscure the day heading"
                );
            }
            for (const [index, a] of result.photos.entries())
                for (const b of result.photos.slice(index + 1))
                    assert.ok(
                        Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left) <= 1 ||
                            Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top) <= 1,
                        "Image frames must not obscure each other"
                    );
        }
        if (output) {
            const screenshot = join(directory, "scene-review.png");
            await exec(
                chrome,
                [
                    "--headless",
                    "--disable-gpu",
                    "--no-first-run",
                    "--virtual-time-budget=2000",
                    "--window-size=1200,800",
                    `--user-data-dir=${join(directory, "chrome")}`,
                    `--screenshot=${screenshot}`,
                    pathToFileURL(file).href
                ],
                { timeout: 30000, maxBuffer: 1024 * 1024 }
            );
            context.diagnostic(`Static production-scene review: ${screenshot}`);
        }
    } finally {
        if (!output) await rm(directory, { recursive: true, force: true });
    }
});
