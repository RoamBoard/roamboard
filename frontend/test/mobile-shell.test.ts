import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { compile } from "tailwindcss";
import AppShell from "../src/components/layout/AppShell";
import PublishedBoardShell from "../src/components/features/boards/PublishedBoardShell";
import ProfileControl from "../src/components/ui/ProfileControl";
import NotificationControl from "../src/components/ui/NotificationControl";
import MobileSheet from "../src/components/ui/MobileSheet";

const router = {
    bfcacheId: "mobile-shell-test",
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {}
};

function markup(node: ReactNode) {
    return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, node));
}

type Props = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

test("mobile sheets use modal focus containment, close controls and restore the previous focus and scrolling", (context) => {
    const events: string[] = [];
    class FocusTarget {
        isConnected = true;
        focus() {
            events.push("restore focus");
        }
    }
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const previousHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
    const documentStub = { activeElement: new FocusTarget(), body: { style: { overflow: "auto" } } };
    Object.defineProperty(globalThis, "document", { configurable: true, value: documentStub });
    Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: FocusTarget });
    context.after(() => {
        if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
        else Reflect.deleteProperty(globalThis, "document");
        if (previousHTMLElement) Object.defineProperty(globalThis, "HTMLElement", previousHTMLElement);
        else Reflect.deleteProperty(globalThis, "HTMLElement");
    });

    const state: { closing: boolean; tree: ReactNode; effect?: () => void | (() => void) } = {
        closing: false,
        tree: null
    };
    const dialog = { showModal: () => events.push("modal"), close: () => events.push("close") };
    function Probe() {
        const original = { useEffect: React.useEffect, useRef: React.useRef, useState: React.useState };
        React.useEffect = (effect) => {
            state.effect = effect;
        };
        React.useRef = (() => ({ current: dialog })) as typeof React.useRef;
        React.useState = (() => [
            state.closing,
            (next: boolean) => {
                state.closing = next;
            }
        ]) as typeof React.useState;
        try {
            state.tree = MobileSheet({
                id: "account",
                title: "Account",
                onClose: () => events.push("dismiss"),
                children: "Settings"
            });
            return state.tree;
        } finally {
            Object.assign(React, original);
        }
    }
    markup(createElement(Probe));
    const cleanup = state.effect?.();
    assert.deepEqual(events, ["modal"], "showModal makes the background inert and provides native focus containment");
    assert.equal(documentStub.body.style.overflow, "hidden");
    const close = elements(state.tree).find((node) => node.props["aria-label"] === "Close account");
    assert.ok(close);
    (close.props.onClick as () => void)();
    markup(createElement(Probe));
    const animation = elements(state.tree).find((node) => typeof node.props.onAnimationComplete === "function");
    assert.ok(animation);
    (animation.props.onAnimationComplete as () => void)();
    assert.deepEqual(events, ["modal", "dismiss"]);
    assert.equal(typeof cleanup, "function");
    if (typeof cleanup === "function") cleanup();
    assert.equal(documentStub.body.style.overflow, "auto");
    assert.deepEqual(events, ["modal", "dismiss", "close", "restore focus"]);
});

test("production shells leave the full phone width available and account/notification sheets overlay it", async (context) => {
    const chrome = [
        process.env.CHROME_BIN,
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome"
    ].find((path): path is string => Boolean(path && existsSync(path)));
    assert.ok(chrome, "Set CHROME_BIN to run the mobile shell geometry regression");
    const content = createElement("div", null, "Your boards");
    const shells = [
        ["app", markup(AppShell({ activeHref: "/boards", children: content }))],
        ["discover", markup(AppShell({ activeHref: "/discover", discover: { collapsed: false }, children: content }))],
        ["published", markup(PublishedBoardShell({ children: content }))]
    ];
    const panels = markup(
        createElement(
            React.Fragment,
            null,
            createElement(ProfileControl, {
                sidebar: true,
                mobile: true,
                sidebarAccountOpen: true,
                user: { name: "Traveler", handle: "traveler" }
            }),
            createElement(NotificationControl, {
                sidebar: true,
                mobile: true,
                open: true,
                initialRequests: [],
                initialUserId: "traveler"
            })
        )
    );
    assert.match(panels, /aria-label="Close account"/);
    assert.match(panels, /aria-label="Close notifications"/);
    const stylesheet = new URL("../src/app/globals.css", import.meta.url);
    const require = createRequire(import.meta.url);
    const compiler = await compile(await readFile(stylesheet, "utf8"), {
        base: dirname(fileURLToPath(stylesheet)),
        loadStylesheet: async (id, base) => {
            const path = id === "tailwindcss" ? require.resolve("tailwindcss/index.css") : resolve(base, id);
            return { path, base: dirname(path), content: await readFile(path, "utf8") };
        }
    });
    const classes = [...(shells.map(([, html]) => html).join("") + panels).matchAll(/class="([^"]+)"/g)].flatMap(
        (match) => match[1].split(/\s+/)
    );
    const css = compiler.build(classes);
    const fixtures = [320, 375, 767, 768, 1280].flatMap((width) =>
        shells.map(([kind, html]) => ({ width, kind, html }))
    );
    const directory = await mkdtemp(join(tmpdir(), "roamboard-mobile-shell-"));
    context.after(() => rm(directory, { recursive: true, force: true }));
    const file = join(directory, "shells.html");
    await writeFile(
        file,
        `<!doctype html><html><body><pre id="results" hidden></pre><script>
      const fixtures=${JSON.stringify(fixtures)}, css=${JSON.stringify(css)}, panels=${JSON.stringify(panels)};
      Promise.all(fixtures.map(fixture=>new Promise(resolve=>{
        const frame=document.createElement('iframe');frame.width=fixture.width;frame.height=740;frame.style.border='0';
        frame.onload=()=>{
          const doc=frame.contentDocument, win=frame.contentWindow, main=doc.querySelector('main'), aside=doc.querySelector('aside');
          const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};
          const before=rect(main), bar=rect(aside), actions=[...aside.querySelectorAll('button')].filter(node=>node.getBoundingClientRect().width>0).map(rect);
          const sheets=[...doc.querySelectorAll('dialog')].map(dialog=>{
            dialog.showModal();const panel=dialog.firstElementChild;panel.style.opacity='1';panel.style.transform='none';
            const close=dialog.querySelector('button[aria-label^="Close "]'), result={main:rect(main), panel:rect(panel), close:rect(close), modal:dialog.matches(':modal')};dialog.close();return result;
          });
          resolve({width:fixture.width,kind:fixture.kind,viewport:win.innerWidth,before,bar,actions,sheets,overflow:doc.documentElement.scrollWidth>win.innerWidth});
        };
        frame.srcdoc='<!doctype html><html><head><style>'+css+'</style></head><body>'+fixture.html+'<div style="position:fixed;left:0;top:0">'+panels+'</div></body></html>';document.body.append(frame);
      }))).then(results=>document.getElementById('results').textContent=JSON.stringify(results));
      </script></body></html>`
    );
    const { stdout } = await promisify(execFile)(
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
    assert.ok(match, "Chromium must return computed shell geometry");
    type Rect = { x: number; y: number; width: number; height: number; bottom: number };
    const results = JSON.parse(match[1]) as Array<{
        width: number;
        kind: string;
        viewport: number;
        before: Rect;
        bar: Rect;
        actions: Rect[];
        sheets: Array<{ main: Rect; panel: Rect; close: Rect; modal: boolean }>;
        overflow: boolean;
    }>;
    assert.equal(results.length, fixtures.length);
    for (const result of results) {
        const description = `${result.width}px ${result.kind}`;
        assert.equal(result.overflow, false, `${description} has no horizontal page overflow`);
        if (result.width < 768) {
            assert.equal(result.bar.width, result.viewport, `${description} navigation spans the screen`);
            assert.ok(result.bar.height <= 64, `${description} navigation remains compact`);
            assert.equal(result.before.x, 0, `${description} has no reserved sidebar column`);
            assert.equal(result.before.width, result.viewport, `${description} content uses the full width`);
            assert.ok(result.before.y >= result.bar.bottom, `${description} content starts below navigation`);
            for (const action of result.actions)
                assert.ok(
                    action.width >= 44 && action.height >= 44,
                    `${description} navigation actions have usable touch targets`
                );
            assert.equal(result.sheets.length, 2);
            for (const sheet of result.sheets) {
                assert.equal(sheet.modal, true);
                assert.deepEqual(
                    sheet.main,
                    result.before,
                    `${description} opening a sheet does not resize or shift content`
                );
                assert.equal(sheet.panel.width, result.viewport);
                assert.ok(Math.abs(sheet.panel.bottom - 740) <= 1, `${description} sheet is anchored to the bottom`);
                assert.ok(sheet.close.width >= 44 && sheet.close.height >= 44);
            }
        } else {
            assert.ok(result.bar.width < result.viewport / 2, `${description} keeps the desktop rail`);
            assert.equal(result.before.x, result.bar.width, `${description} content sits beside the desktop rail`);
        }
    }
});
