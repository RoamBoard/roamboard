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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compile } from "tailwindcss";
import BoardDayScene from "../src/components/features/boards/BoardDayScene";
import { createDayScenes } from "../src/lib/board-story-scenes";
import type { BoardImage } from "../src/types/board";

const photo = (index: number): BoardImage => ({
    id: `photo-${index}`,
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="${["#c7d5ce", "#dfb68b", "#86a5ad", "#b8adbf", "#a4b38f", "#d1a49b"][index % 6]}"/><path d="M0 650 400 180 740 600 1000 330 1200 700V800H0Z" fill="#36514e" opacity=".5"/><circle cx="920" cy="180" r="80" fill="#fff1c9"/><text x="60" y="730" font-size="54" font-family="sans-serif" fill="white">Saved photograph ${index + 1}</text></svg>`)}`,
    alt: `Saved photograph ${index + 1}`,
    source: "upload",
    width: 1200,
    height: 800
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
    const variants = [1, 3, 6, 18, 60, 121]
        .map((count) => {
            const photos = Array.from({ length: count }, (_, index) => ({
                id: `placement-${index}`,
                image: photo(index)
            }));
            const scene = createDayScenes({ number: 1, title: "A day in the mountains", items: [] }, photos)[0];
            return `<div data-count="${scene.photos.length}" class="variant">${renderToStaticMarkup(createElement(BoardDayScene, { scene, boardId: "layout-fixture", desktop: true, onOpenPhoto() {}, onOpenActivity() {}, onHighlight() {} }))}</div>`;
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
    const classes = [...variants.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/));
    const output = process.env.BOARD_STORY_REVIEW_DIR;
    const directory = output ? resolve(output) : await mkdtemp(join(tmpdir(), "roamboard-story-layout-"));
    await mkdir(directory, { recursive: true });
    try {
        const file = join(directory, "scenes.html");
        await writeFile(
            file,
            `<!doctype html><html><head><style>${compiler.build(classes)}
        body{margin:0;background:#151515;color:#eee;font-family:Arial,sans-serif}.variant{display:none;height:720px;width:var(--story-width)}#fixture{height:720px;width:1100px;--story-width:1100px}.variant:first-child{display:block}
        </style></head><body><main id="fixture">${variants}</main><pre id="results" hidden></pre><script>
        document.fonts.ready.then(()=>{
          const fixture=document.getElementById('fixture'), variants=[...document.querySelectorAll('.variant')], results=[];
          for(const width of [640,900,1280]) for(const variant of variants){
            variants.forEach(item=>item.style.display='none');variant.style.display='block';fixture.style.setProperty('--story-width',width+'px');fixture.style.width=width+'px';
            const section=variant.querySelector('section'), bounds=section.getBoundingClientRect();
            const photos=[...section.querySelectorAll('[data-story-photo] button')].map(button=>{const r=button.getBoundingClientRect();return {left:r.left-bounds.left,top:r.top-bounds.top,width:r.width,height:r.height,fit:getComputedStyle(button.querySelector('img')).objectFit,bg:getComputedStyle(button).backgroundColor}});
            results.push({width,count:Number(variant.dataset.count),height:bounds.height,scrollHeight:section.scrollHeight,photos});
          }
          document.getElementById('results').textContent=JSON.stringify(results);
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
            scrollHeight: number;
            photos: Array<{ left: number; top: number; width: number; height: number; fit: string; bg: string }>;
        }>;
        for (const result of results) {
            assert.equal(result.photos.length, result.count);
            if (result.count > 60)
                assert.ok(
                    result.scrollHeight > result.height,
                    "Very dense scenes retain a reachable inner scroll area"
                );
            for (const bounds of result.photos) {
                assert.ok(
                    bounds.width >= 44 && bounds.height >= 44,
                    `${result.width}px/${result.count} photos: image remains a usable target`
                );
                assert.ok(
                    bounds.left >= 0 && bounds.left + bounds.width <= result.width + 1,
                    "Photo stays inside its scene horizontally"
                );
                assert.ok(
                    bounds.top >= 0 && bounds.top + bounds.height <= result.scrollHeight + 1,
                    "Photo stays inside its scene's reachable vertical content"
                );
                assert.equal(bounds.fit, "cover");
                assert.equal(bounds.bg, "rgba(0, 0, 0, 0)");
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
