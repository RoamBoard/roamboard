import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import PersonalDetailsForm from "../src/components/features/settings/PersonalDetailsForm";
import SettingsSaveBar from "../src/components/features/settings/SettingsSaveBar";
import SettingsContent from "../src/components/features/settings/SettingsContent";
import HandleProfileContent from "../src/components/features/profile/HandleProfileContent";
import { ProfileApiError, type UserProfile } from "../src/lib/profile";
import { profileSaveError, validateProfileSettings } from "../src/lib/profile-settings";

type Props = { children?: ReactNode; [name: string]: unknown };

function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function capture(render: () => ReactNode) {
    const holder: { tree: ReactNode } = { tree: null };
    function Probe() {
        holder.tree = render();
        return holder.tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    return { markup, nodes: elements(holder.tree) };
}

const noop = () => {};

const initialProfile: UserProfile = {
    id: "profile-owner",
    username: "traveler",
    displayName: "Traveler",
    description: "I like walking around cities.",
    location: null,
    occupation: null,
    languages: ["English"],
    interests: ["Hiking"],
    profilePicture: null,
    defaultBoardVisibility: "friends",
    revision: 4,
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-18T10:00:00Z"
};

const languageChoices = ["English", "Swedish"];
const tagChoices = ["Hiking", "Museums"];

test("profile validation accepts backend username and text limits after trimming", () => {
    for (const username of ["a", "A_B.1", "a".repeat(64), " traveler "]) {
        const errors = validateProfileSettings(
            {
                ...initialProfile,
                username,
                displayName: ` ${"A".repeat(500)} `,
                description: " ",
                location: null,
                occupation: ""
            },
            languageChoices,
            tagChoices
        );
        assert.deepEqual(errors, {}, `Backend accepts username ${username}`);
    }
});

test("profile validation explains all invalid fields together before sending", () => {
    const invalid = {
        ...initialProfile,
        username: "has spaces",
        displayName: " ",
        description: "a".repeat(501),
        location: "a".repeat(501),
        occupation: "a".repeat(501),
        languages: ["not a language"],
        interests: ["not a tag"],
        defaultBoardVisibility: "secret" as UserProfile["defaultBoardVisibility"]
    };
    const errors = validateProfileSettings(invalid, languageChoices, tagChoices);
    assert.deepEqual(Object.keys(errors).sort(), [
        "defaultBoardVisibility",
        "description",
        "displayName",
        "interests",
        "languages",
        "location",
        "occupation",
        "username"
    ]);
    for (const message of Object.values(errors)) {
        assert.equal(typeof message, "string");
        assert.ok(message.length > 12, "Each error must tell the user how to correct the value");
    }
    assert.match(errors.description ?? "", /500/);
    assert.match(errors.displayName ?? "", /(?:enter|required|name)/i);
    assert.match(errors.languages ?? "", /(?:choose|select|list)/i);
    assert.match(errors.interests ?? "", /(?:choose|select|list|tag)/i);
});

test("profile validation rejects usernames beyond backend syntax and length", () => {
    for (const username of ["", " ", "_traveler", "traveler.", "has-hyphen", "a".repeat(65)]) {
        assert.ok(validateProfileSettings({ ...initialProfile, username }, languageChoices, tagChoices).username);
    }
});

test("profile validation rejects duplicate and excessive language or interest selections", () => {
    for (const field of ["languages", "interests"] as const) {
        const validChoice = field === "languages" ? "English" : "Hiking";
        for (const selected of [[validChoice, validChoice], Array.from({ length: 11 }, () => validChoice)]) {
            assert.ok(
                validateProfileSettings({ ...initialProfile, [field]: selected }, languageChoices, tagChoices)[field]
            );
        }
    }
});

test("save errors give actionable guidance for conflicting usernames and stale profiles", () => {
    const taken = profileSaveError(new ProfileApiError(409, "USERNAME_TAKEN", "Username already exists"));
    assert.match(taken.fields?.username ?? "", /(?:another|different|available)/i);
    const stale = profileSaveError(new ProfileApiError(409, "STALE_PROFILE", "Stale revision"));
    assert.equal(stale.action, "reload");
    assert.match(stale.message, /(?:reload|refresh|newer|changed|another)/i);
});

test("authorization and missing-profile failures explain the available next action", () => {
    const expired = profileSaveError(new ProfileApiError(401, "UNAUTHORIZED", "Unauthorized"));
    assert.equal(expired.action, "sign-in");
    assert.match(expired.message, /sign in/i);
    const forbidden = profileSaveError(new ProfileApiError(403, "FORBIDDEN", "Forbidden"));
    assert.match(forbidden.message, /(?:sign in|permission|allowed|reload|refresh)/i);
    const removed = profileSaveError(new ProfileApiError(404, "USER_NOT_FOUND", "Not found"));
    assert.equal(removed.action, "reload");
});

test("validation and service failures do not expose raw backend diagnostics", () => {
    for (const caught of [
        new ProfileApiError(400, "INVALID_REQUEST", "Internal schema failure"),
        new ProfileApiError(500, "INTERNAL_ERROR", "SQL connection details"),
        new Error("The Roamboard API is unavailable. Start the backend and try again."),
        new TypeError("Failed to fetch"),
        null
    ]) {
        const result = profileSaveError(caught);
        assert.match(result.message, /(?:try|check|review|retry|save|connection)/i);
        assert.doesNotMatch(result.message, /SQL|schema|Start the backend|TypeError/);
    }
});

test("invalid personal details identify each input and explain its correction", () => {
    const props = {
        name: "",
        onChangeName: noop,
        handle: "@invalid handle",
        onChangeHandle: noop,
        occupation: "",
        onChangeOccupation: noop,
        location: "",
        onChangeLocation: noop,
        bio: "",
        onChangeBio: noop,
        errors: {
            displayName: "Enter a display name.",
            username: "Remove spaces from your username."
        }
    };
    const { markup, nodes } = capture(() => PersonalDetailsForm(props));
    for (const [id, message] of [
        ["name-input", props.errors.displayName],
        ["handle-input", props.errors.username]
    ]) {
        const input = nodes.find((node) => node.props.id === id);
        assert.ok(input);
        assert.equal(input.props["aria-invalid"], true);
        const description = input.props["aria-describedby"];
        assert.equal(typeof description, "string");
        assert.ok(
            nodes.some(
                (node) =>
                    String(description).split(" ").includes(String(node.props.id)) && node.props.children === message
            )
        );
    }
    assert.match(markup, /Enter a display name\./);
    assert.match(markup, /Remove spaces from your username\./);
});

test("the username error replaces its normal hint until the value is corrected", () => {
    const props = {
        name: "Traveler",
        onChangeName: noop,
        handle: "@invalid handle",
        onChangeHandle: noop,
        occupation: "",
        onChangeOccupation: noop,
        location: "",
        onChangeLocation: noop,
        bio: "",
        onChangeBio: noop
    };
    const error = "Remove spaces from your username.";
    const invalid = capture(() => PersonalDetailsForm({ ...props, errors: { username: error } }));
    const invalidInput = invalid.nodes.find((node) => node.props.id === "handle-input");
    assert.ok(invalidInput);
    assert.equal(invalidInput.props.value, "@invalid handle");
    assert.equal(
        invalid.nodes.some((node) => node.props.id === "handle-input-hint"),
        false
    );
    const descriptions = String(invalidInput.props["aria-describedby"]).split(/\s+/);
    assert.equal(descriptions.length, 1, "The username must describe only the visible correction message");
    const message = invalid.nodes.find((node) => node.props.id === descriptions[0]);
    assert.equal(message?.props.children, error);
    assert.match(String(message?.props.className), /(?:feedback-error|red|rose)/);
    assert.match(String(message?.props.className), /(?:\bborder\b|\bbg-)/);

    const corrected = capture(() => PersonalDetailsForm({ ...props, handle: "@traveler", errors: {} }));
    const correctedInput = corrected.nodes.find((node) => node.props.id === "handle-input");
    assert.equal(correctedInput?.props["aria-invalid"], false);
    assert.equal(correctedInput?.props["aria-describedby"], "handle-input-hint");
    assert.ok(corrected.nodes.some((node) => node.props.id === "handle-input-hint"));
    assert.doesNotMatch(corrected.markup, /Remove spaces from your username\./);
});

test("the biography error replaces its character count and restores it after correction", () => {
    const props = {
        name: "Traveler",
        onChangeName: noop,
        handle: "@traveler",
        onChangeHandle: noop,
        occupation: "",
        onChangeOccupation: noop,
        location: "",
        onChangeLocation: noop,
        bio: "a".repeat(501),
        onChangeBio: noop
    };
    const error = "Shorten your biography to 500 characters or fewer.";
    const invalid = capture(() => PersonalDetailsForm({ ...props, errors: { description: error } }));
    const invalidInput = invalid.nodes.find((node) => node.props.id === "bio-input");
    assert.ok(invalidInput);
    assert.equal(invalidInput.props.value, props.bio);
    assert.equal(
        invalid.nodes.some((node) => node.props.id === "bio-input-count"),
        false
    );
    const descriptions = String(invalidInput.props["aria-describedby"]).split(/\s+/);
    assert.equal(descriptions.length, 1, "The biography must describe only the visible correction message");
    const message = invalid.nodes.find((node) => node.props.id === descriptions[0]);
    assert.equal(message?.props.children, error);
    assert.match(String(message?.props.className), /(?:feedback-error|red|rose)/);
    assert.match(String(message?.props.className), /(?:\bborder\b|\bbg-)/);

    const corrected = capture(() => PersonalDetailsForm({ ...props, bio: "Hello", errors: {} }));
    const correctedInput = corrected.nodes.find((node) => node.props.id === "bio-input");
    assert.equal(correctedInput?.props["aria-invalid"], false);
    assert.equal(correctedInput?.props["aria-describedby"], "bio-input-count");
    assert.ok(corrected.nodes.some((node) => node.props.id === "bio-input-count"));
    assert.match(corrected.markup, /5\/500 characters/);
    assert.doesNotMatch(corrected.markup, /Shorten your biography/);
});

test("the save error is a red alert above the submit control with a correction link", () => {
    const focused: string[] = [];
    const props = {
        isDirty: true,
        onReset: noop,
        saving: false,
        error: { message: "Your changes could not be saved.", fields: { username: "Choose another username." } },
        onFocusField: (field: string) => focused.push(field),
        onReload: noop
    };
    const { markup, nodes } = capture(() => SettingsSaveBar(props));
    const alert = nodes.find((node) => node.props.role === "alert");
    assert.ok(alert, "Save failure must be announced above the actions");
    assert.match(String(alert.props.className), /(?:red|rose|destructive|feedback-error)/);
    const alertPosition = markup.indexOf('role="alert"');
    const savePosition = markup.indexOf('type="submit"');
    assert.ok(alertPosition < savePosition);
    assert.match(markup, /Choose another username\./);
    const correction = elements(createElement("div", null, alert.props.children)).find(
        (node) => node.type === "button" && typeof node.props.onClick === "function"
    );
    assert.ok(correction);
    (correction.props.onClick as () => void)();
    assert.deepEqual(focused, ["username"]);
});

test("saving disables repeat saves and reset while announcing progress", () => {
    const props = {
        isDirty: true,
        onReset: noop,
        saving: true,
        error: null,
        onFocusField: noop,
        onReload: noop
    };
    const { markup, nodes } = capture(() => SettingsSaveBar(props));
    const submit = nodes.find((node) => node.type === "button" && node.props.type === "submit");
    const reset = nodes.find((node) => node.type === "button" && node.props.children === "Reset");
    assert.ok(submit);
    assert.ok(reset);
    assert.equal(submit.props.disabled, true);
    assert.equal(reset.props.disabled, true);
    assert.match(markup, /Saving/);
    assert.ok(nodes.some((node) => node.props.role === "status" || node.props["aria-live"] === "polite"));
});

// Capture only this page's hooks; rendered child components retain React's real hooks.
// This runs the production page handlers and API clients without a browser or a new test dependency.
function mountPage(context: TestContext, page: () => ReactNode) {
    const documentBefore = Object.getOwnPropertyDescriptor(globalThis, "document");
    const windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
            documentElement: { classList: { contains: () => false } },
            getElementById: () => null,
            hidden: false,
            hasFocus: () => true,
            addEventListener: noop,
            removeEventListener: noop
        }
    });
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
            addEventListener: noop,
            removeEventListener: noop
        }
    });
    context.after(() => {
        if (documentBefore) Object.defineProperty(globalThis, "document", documentBefore);
        else Reflect.deleteProperty(globalThis, "document");
        if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore);
        else Reflect.deleteProperty(globalThis, "window");
    });
    const destinations: string[] = [];
    const router = {
        bfcacheId: "settings-test",
        back: noop,
        forward: noop,
        refresh: noop,
        push: (url: string) => destinations.push(url),
        replace: (url: string) => destinations.push(url),
        prefetch: noop
    };
    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const effects: Array<() => void | (() => void)> = [];
    const cleanups: Array<() => void> = [];
    const mounted = { value: false };
    const render = () => {
        const cursor = { state: 0, ref: 0 };
        const original = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect };
        const holder: { tree: ReactNode } = { tree: null };
        function Probe() {
            React.useState = ((initial: unknown) => {
                const index = cursor.state++;
                if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
                return [
                    states[index],
                    (next: unknown) => {
                        states[index] = typeof next === "function" ? next(states[index]) : next;
                    }
                ];
            }) as typeof React.useState;
            React.useRef = ((initial: unknown) => {
                const index = cursor.ref++;
                return (refs[index] ??= { current: initial });
            }) as typeof React.useRef;
            React.useEffect = (effect) => {
                if (!mounted.value) effects.push(effect);
            };
            try {
                holder.tree = page();
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }
        const markup = renderToStaticMarkup(
            createElement(AppRouterContext.Provider, { value: router }, createElement(Probe))
        );
        if (!mounted.value) {
            mounted.value = true;
            for (const effect of effects) {
                const cleanup = effect();
                if (cleanup) cleanups.push(cleanup);
            }
        }
        return { markup, nodes: elements(holder.tree) };
    };
    render();
    const unmount = () => cleanups.splice(0).forEach((cleanup) => cleanup());
    context.after(unmount);
    return { render, destinations, unmount };
}

type SaveBarProps = Parameters<typeof SettingsSaveBar>[0];

function mountSaveBar(
    context: TestContext,
    initialProps: SaveBarProps,
    environment: { documentHidden?: boolean; windowFocused?: boolean } = {}
) {
    context.mock.timers.enable({ apis: ["setTimeout", "Date"] });

    const docListeners = new Map<string, Set<(e: unknown) => void>>();
    const winListeners = new Map<string, Set<(e: unknown) => void>>();

    const docState = {
        hidden: Boolean(environment.documentHidden),
        hasFocus: () => (environment.windowFocused !== undefined ? environment.windowFocused : true),
        addEventListener: (type: string, listener: (e: unknown) => void) => {
            if (!docListeners.has(type)) docListeners.set(type, new Set());
            docListeners.get(type)!.add(listener);
        },
        removeEventListener: (type: string, listener: (e: unknown) => void) => {
            docListeners.get(type)?.delete(listener);
        },
        documentElement: { classList: { contains: () => false } },
        getElementById: () => null
    };

    const winState = {
        addEventListener: (type: string, listener: (e: unknown) => void) => {
            if (!winListeners.has(type)) winListeners.set(type, new Set());
            winListeners.get(type)!.add(listener);
        },
        removeEventListener: (type: string, listener: (e: unknown) => void) => {
            winListeners.get(type)?.delete(listener);
        }
    };

    const originalDoc = Object.getOwnPropertyDescriptor(globalThis, "document");
    const originalWin = Object.getOwnPropertyDescriptor(globalThis, "window");

    Object.defineProperty(globalThis, "document", { configurable: true, value: docState });
    Object.defineProperty(globalThis, "window", { configurable: true, value: winState });

    context.after(() => {
        if (originalDoc) Object.defineProperty(globalThis, "document", originalDoc);
        else Reflect.deleteProperty(globalThis, "document");
        if (originalWin) Object.defineProperty(globalThis, "window", originalWin);
        else Reflect.deleteProperty(globalThis, "window");
    });

    const propsHolder = { current: { ...initialProps } };
    const refs: Array<{ current: unknown }> = [];
    const effectRecords: Array<{
        effect: () => void | (() => void);
        deps: unknown[] | undefined;
        cleanup?: void | (() => void);
    }> = [];

    const mockProgressBar = {
        style: {
            animationPlayState: "running"
        }
    };

    function attachRefs(node: ReactNode) {
        if (!isValidElement(node)) return;
        const props = node.props as { ref?: unknown; className?: unknown; children?: ReactNode } | undefined;
        const ref = props?.ref;
        if (ref && typeof ref === "object" && "current" in ref) {
            const className = String(props?.className ?? "");
            if (className.includes("animate-toast-progress")) {
                (ref as { current: unknown }).current = mockProgressBar;
            }
        }
        Children.toArray(props?.children).forEach(attachRefs);
    }

    const renderHolder: { current: { result: ReactNode; nodes: ReturnType<typeof elements> } } = {
        current: { result: null, nodes: [] }
    };

    function runRender() {
        const cursor = { ref: 0, effect: 0 };
        const originalHooks = {
            useRef: React.useRef,
            useCallback: React.useCallback,
            useEffect: React.useEffect
        };

        React.useRef = ((initial: unknown) => {
            const index = cursor.ref++;
            return (refs[index] ??= { current: initial });
        }) as typeof React.useRef;

        React.useCallback = ((fn: (...args: unknown[]) => unknown) => {
            return fn;
        }) as typeof React.useCallback;

        React.useEffect = (effect, deps) => {
            const index = cursor.effect++;
            const prev = effectRecords[index];
            const hasChanged = !prev || !deps || !prev.deps || deps.some((dep, i) => !Object.is(dep, prev.deps![i]));
            if (hasChanged) {
                if (prev?.cleanup && typeof prev.cleanup === "function") {
                    prev.cleanup();
                }
                effectRecords[index] = {
                    effect,
                    deps: deps ? [...deps] : undefined,
                    cleanup: undefined
                };
            }
        };

        const holder: { tree: ReactNode } = { tree: null };
        try {
            holder.tree = SettingsSaveBar(propsHolder.current);
        } finally {
            Object.assign(React, originalHooks);
        }

        attachRefs(holder.tree);

        for (const record of effectRecords) {
            if (record.cleanup === undefined) {
                record.cleanup = record.effect() ?? undefined;
            }
        }

        const nodes = elements(holder.tree);
        return { result: holder.tree, nodes };
    }

    renderHolder.current = runRender();

    const setProps = (nextProps: Partial<SaveBarProps>) => {
        propsHolder.current = { ...propsHolder.current, ...nextProps };
        renderHolder.current = runRender();
        return renderHolder.current;
    };

    const unmount = () => {
        for (const record of effectRecords) {
            if (record.cleanup && typeof record.cleanup === "function") {
                record.cleanup();
                record.cleanup = undefined;
            }
        }
    };
    context.after(unmount);

    return {
        get nodes() {
            return renderHolder.current.nodes;
        },
        get progressBar() {
            return mockProgressBar;
        },
        setProps,
        unmount,
        emitWindowBlur: () => {
            const ev = typeof Event !== "undefined" ? new Event("blur") : { type: "blur" };
            winListeners.get("blur")?.forEach((cb) => cb(ev));
        },
        emitWindowFocus: () => {
            const ev = typeof Event !== "undefined" ? new Event("focus") : { type: "focus" };
            winListeners.get("focus")?.forEach((cb) => cb(ev));
        },
        emitVisibilityChange: (hidden: boolean) => {
            docState.hidden = hidden;
            const ev = typeof Event !== "undefined" ? new Event("visibilitychange") : { type: "visibilitychange" };
            docListeners.get("visibilitychange")?.forEach((cb) => cb(ev));
        },
        setDocumentFocus: (focused: boolean) => {
            docState.hasFocus = () => focused;
        },
        setDocumentHidden: (hidden: boolean) => {
            docState.hidden = hidden;
        },
        getToastElement: () =>
            renderHolder.current.nodes.find((n) => n.props.role === "status" && n.props["aria-live"] === "polite"),
        getUndoButton: () =>
            renderHolder.current.nodes.find(
                (n) =>
                    n.type === "button" &&
                    (n.props.children === "Undo" ||
                        n.props.children === "Undoing…" ||
                        n.props.children === "Restoring…")
            ),
        getDismissButton: () =>
            renderHolder.current.nodes.find(
                (n) => n.type === "button" && n.props["aria-label"] === "Dismiss notification"
            )
    };
}

const flushRequests = () => new Promise<void>((resolve) => setImmediate(resolve));

function settingsFetch(context: TestContext, save: (init: RequestInit) => Promise<Response>) {
    // Materialize Node 20's lazy fetch export before node:test wraps the property.
    void globalThis.fetch;
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path === "/api/v1/users/me" && init?.method === "PATCH") return save(init);
        if (path === "/api/v1/users/me") return Response.json({ data: initialProfile });
        if (path === "/api/v1/languages") return Response.json({ data: languageChoices });
        if (path === "/api/v1/tags")
            return Response.json({
                data: [
                    { tagId: 1, name: "Hiking" },
                    { tagId: 2, name: "Museums" }
                ]
            });
        throw new Error(`Unexpected settings request: ${path}`);
    });
}

function changeName(page: ReturnType<typeof mountPage>, name: string) {
    const details = page.render().nodes.find((node) => node.type === PersonalDetailsForm);
    assert.ok(details, "Profile editor must load before changing its display name");
    (details.props.onChangeName as (value: string) => void)(name);
}

function submit(page: ReturnType<typeof mountPage>) {
    const form = page.render().nodes.find((node) => node.type === "form");
    assert.ok(form);
    (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault: noop });
}

test("invalid edits remain visible with feedback and never send a save request", async (context) => {
    const requests: RequestInit[] = [];
    settingsFetch(context, async (init) => {
        requests.push(init);
        return Response.json({ data: initialProfile });
    });
    const page = mountPage(context, SettingsContent);
    await flushRequests();
    changeName(page, " ");
    submit(page);
    await flushRequests();
    const result = page.render();
    assert.equal(requests.length, 0);
    assert.deepEqual(page.destinations, []);
    const form = result.nodes.find((node) => node.type === "form");
    assert.equal(form?.props.noValidate, true, "The browser must allow the page to show its actionable error summary");
    const details = result.nodes.find((node) => node.type === PersonalDetailsForm);
    assert.equal(details?.props.name, " ");
    assert.match(result.markup, /role="alert"/);
    assert.match(result.markup, /(?:enter|required).*name/i);
});

test("a pending save blocks duplicates, shows the undo toast, and stays in settings for continued editing", async (context) => {
    const requests: RequestInit[] = [];
    const response: { resolve?: (value: Response) => void } = {};
    settingsFetch(context, (init) => {
        requests.push(init);
        return new Promise<Response>((resolve) => {
            response.resolve = resolve;
        });
    });
    const page = mountPage(context, SettingsContent);
    await flushRequests();
    changeName(page, "New name");
    submit(page);
    submit(page);
    assert.equal(requests.length, 1);
    assert.deepEqual(page.destinations, []);
    const pending = page.render();
    const saveBar = pending.nodes.find((node) => node.type === SettingsSaveBar);
    assert.equal(saveBar?.props.saving, true);
    assert.ok(pending.nodes.some((node) => node.type === "fieldset" && node.props.disabled === true));
    const payload = JSON.parse(String(requests[0].body));
    assert.equal(payload.displayName, "New name");
    assert.equal(payload.revision, 4);
    assert.equal(requests[0].credentials, "include");
    assert.ok(response.resolve);
    response.resolve(
        Response.json({ data: { ...initialProfile, displayName: "New name", username: "canonical_name", revision: 5 } })
    );
    await flushRequests();
    const completed = page.render();
    const completedBar = completed.nodes.find((node) => node.type === SettingsSaveBar);
    assert.equal(completedBar?.props.showToast, true);
    assert.equal(completedBar?.props.canUndo, true);
    assert.match(completed.markup, /Changes saved/);
    assert.match(completed.markup, /Undo/);
    (completedBar?.props.onDismissToast as () => void)();
    const dismissed = page.render();
    const dismissedBar = dismissed.nodes.find((node) => node.type === SettingsSaveBar);
    assert.equal(dismissedBar?.props.showToast, false);
    assert.deepEqual(page.destinations, []);
    assert.ok(dismissed.nodes.some((node) => node.type === "fieldset" && node.props.disabled === false));
});

test("clicking undo performs a version-checked restore without redirecting", async (context) => {
    const requests: RequestInit[] = [];
    settingsFetch(context, (init) => {
        requests.push(init);
        if (requests.length === 1) {
            return Promise.resolve(
                Response.json({
                    data: { ...initialProfile, displayName: "New name", username: "canonical_name", revision: 5 }
                })
            );
        }
        return Promise.resolve(
            Response.json({
                data: { ...initialProfile, displayName: "Traveler", username: "canonical_name", revision: 6 }
            })
        );
    });
    const page = mountPage(context, SettingsContent);
    await flushRequests();
    changeName(page, "New name");
    submit(page);
    await flushRequests();
    const rendered = page.render();
    const saveBar = rendered.nodes.find((node) => node.type === SettingsSaveBar);
    assert.ok(saveBar);
    assert.equal(saveBar.props.showToast, true);
    assert.equal(saveBar.props.canUndo, true);

    const { nodes: saveBarNodes } = capture(() => SettingsSaveBar(saveBar.props as SaveBarProps));
    const undoButton = saveBarNodes.find((node) => node.type === "button" && node.props.children === "Undo");
    assert.ok(undoButton, "The toast must render the real Undo button");
    (undoButton.props.onClick as () => void)();

    await flushRequests();
    assert.equal(requests.length, 2);
    const undoPayload = JSON.parse(String(requests[1].body));
    assert.equal(undoPayload.displayName, "Traveler");
    assert.equal(undoPayload.revision, 5);
    const restored = page.render();
    const details = restored.nodes.find((node) => node.type === PersonalDetailsForm);
    assert.equal(details?.props.name, "Traveler");
    assert.deepEqual(page.destinations, []);
});

test("a failed undo preserves the snapshot and allows retry until successful", async (context) => {
    const requests: RequestInit[] = [];
    const flags = { shouldFailUndo: true };
    settingsFetch(context, (init) => {
        requests.push(init);
        if (requests.length === 1) {
            return Promise.resolve(
                Response.json({
                    data: { ...initialProfile, displayName: "New name", username: "canonical_name", revision: 5 }
                })
            );
        }
        if (flags.shouldFailUndo) {
            flags.shouldFailUndo = false;
            return Promise.resolve(
                new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Server error" } }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                })
            );
        }
        return Promise.resolve(
            Response.json({
                data: { ...initialProfile, displayName: "Traveler", username: "canonical_name", revision: 6 }
            })
        );
    });
    const page = mountPage(context, SettingsContent);
    await flushRequests();
    changeName(page, "New name");
    submit(page);
    await flushRequests();

    const saved = page.render();
    const saveBar = saved.nodes.find((node) => node.type === SettingsSaveBar);
    assert.ok(saveBar);
    assert.equal(saveBar.props.showToast, true);
    assert.equal(saveBar.props.canUndo, true);

    // Click the real Undo button from the toast
    const { nodes: toastNodes } = capture(() => SettingsSaveBar(saveBar.props as SaveBarProps));
    const undoBtn = toastNodes.find((node) => node.type === "button" && node.props.children === "Undo");
    assert.ok(undoBtn, "Toast must render the real Undo button");
    (undoBtn.props.onClick as () => void)();
    await flushRequests();

    // The undo failed: error is shown, snapshot is preserved, toast is dismissed
    const failed = page.render();
    const failedBar = failed.nodes.find((node) => node.type === SettingsSaveBar);
    assert.ok(failedBar);
    assert.ok(failedBar.props.error, "An error must be reported after undo failure");
    assert.equal(failedBar.props.canUndo, true, "canUndo must remain true so snapshot is not lost");
    assert.equal(failedBar.props.showToast, false, "Toast is dismissed so error alert can take precedence");

    // The error alert must offer a retry button
    const { nodes: failedNodes } = capture(() => SettingsSaveBar(failedBar.props as SaveBarProps));
    const retryBtn = failedNodes.find((node) => node.type === "button" && node.props.children === "Retry undo");
    assert.ok(retryBtn, "Error alert must offer a 'Retry undo' button");

    // Click 'Retry undo'
    (retryBtn.props.onClick as () => void)();
    await flushRequests();

    // Succeeded on retry
    assert.equal(requests.length, 3);
    const restored = page.render();
    const restoredBar = restored.nodes.find((node) => node.type === SettingsSaveBar);
    assert.equal(restoredBar?.props.error, null);
    assert.equal(restoredBar?.props.canUndo, false);
    const details = restored.nodes.find((node) => node.type === PersonalDetailsForm);
    assert.equal(details?.props.name, "Traveler");
    assert.deepEqual(page.destinations, []);
});

test("mounted toast automatically dismisses after six seconds", (context) => {
    const dismissed: boolean[] = [];
    const harness = mountSaveBar(context, {
        isDirty: false,
        onReset: noop,
        saving: false,
        error: null,
        showToast: true,
        canUndo: true,
        onUndo: noop,
        onDismissToast: () => dismissed.push(true),
        toastKey: 1
    });

    assert.equal(harness.progressBar.style.animationPlayState, "running");
    context.mock.timers.tick(5999);
    assert.equal(dismissed.length, 0);

    context.mock.timers.tick(1);
    assert.equal(dismissed.length, 1);
});

test("hovering the mounted toast pauses both dismissal timer and progress bar animation", (context) => {
    const dismissed: boolean[] = [];
    const harness = mountSaveBar(context, {
        isDirty: false,
        onReset: noop,
        saving: false,
        error: null,
        showToast: true,
        canUndo: true,
        onUndo: noop,
        onDismissToast: () => dismissed.push(true),
        toastKey: 1
    });

    context.mock.timers.tick(2000);
    assert.equal(harness.progressBar.style.animationPlayState, "running");

    const toast = harness.getToastElement();
    assert.ok(toast);
    (toast.props.onMouseEnter as () => void)();
    assert.equal(harness.progressBar.style.animationPlayState, "paused");

    context.mock.timers.tick(10000);
    assert.equal(dismissed.length, 0);

    (toast.props.onMouseLeave as () => void)();
    assert.equal(harness.progressBar.style.animationPlayState, "running");

    context.mock.timers.tick(3999);
    assert.equal(dismissed.length, 0);

    context.mock.timers.tick(1);
    assert.equal(dismissed.length, 1);
});

test("focusing within the mounted toast pauses both dismissal timer and progress bar animation", (context) => {
    const dismissed: boolean[] = [];
    const harness = mountSaveBar(context, {
        isDirty: false,
        onReset: noop,
        saving: false,
        error: null,
        showToast: true,
        canUndo: true,
        onUndo: noop,
        onDismissToast: () => dismissed.push(true),
        toastKey: 1
    });

    context.mock.timers.tick(1500);
    const toast = harness.getToastElement();
    assert.ok(toast);
    (toast.props.onFocus as () => void)();
    assert.equal(harness.progressBar.style.animationPlayState, "paused");

    context.mock.timers.tick(10000);
    assert.equal(dismissed.length, 0);

    (toast.props.onBlur as (e: { currentTarget: { contains: () => boolean }; relatedTarget: null }) => void)({
        currentTarget: { contains: () => false },
        relatedTarget: null
    });
    assert.equal(harness.progressBar.style.animationPlayState, "running");

    context.mock.timers.tick(4499);
    assert.equal(dismissed.length, 0);

    context.mock.timers.tick(1);
    assert.equal(dismissed.length, 1);
});

test("window blur pauses both dismissal timer and progress bar, and focus resumes them", (context) => {
    const dismissed: boolean[] = [];
    const harness = mountSaveBar(context, {
        isDirty: false,
        onReset: noop,
        saving: false,
        error: null,
        showToast: true,
        canUndo: true,
        onUndo: noop,
        onDismissToast: () => dismissed.push(true),
        toastKey: 1
    });

    context.mock.timers.tick(2500);
    harness.emitWindowBlur();
    assert.equal(harness.progressBar.style.animationPlayState, "paused", "Progress bar must pause on window blur");

    context.mock.timers.tick(10000);
    assert.equal(dismissed.length, 0, "Dismissal timer must pause on window blur");

    harness.emitWindowFocus();
    assert.equal(harness.progressBar.style.animationPlayState, "running", "Progress bar must resume on window focus");

    context.mock.timers.tick(3499);
    assert.equal(dismissed.length, 0);

    context.mock.timers.tick(1);
    assert.equal(dismissed.length, 1);
});

test("document visibility change pauses dismissal timer and progress bar", (context) => {
    const dismissed: boolean[] = [];
    const harness = mountSaveBar(context, {
        isDirty: false,
        onReset: noop,
        saving: false,
        error: null,
        showToast: true,
        canUndo: true,
        onUndo: noop,
        onDismissToast: () => dismissed.push(true),
        toastKey: 1
    });

    context.mock.timers.tick(2000);
    harness.emitVisibilityChange(true);
    assert.equal(harness.progressBar.style.animationPlayState, "paused");

    context.mock.timers.tick(10000);
    assert.equal(dismissed.length, 0);

    harness.emitVisibilityChange(false);
    assert.equal(harness.progressBar.style.animationPlayState, "running");

    context.mock.timers.tick(3999);
    assert.equal(dismissed.length, 0);

    context.mock.timers.tick(1);
    assert.equal(dismissed.length, 1);
});

test("toast mounted while page is hidden or window is unfocused starts paused", (context) => {
    const dismissed: boolean[] = [];
    const harness = mountSaveBar(
        context,
        {
            isDirty: false,
            onReset: noop,
            saving: false,
            error: null,
            showToast: true,
            canUndo: true,
            onUndo: noop,
            onDismissToast: () => dismissed.push(true),
            toastKey: 1
        },
        { documentHidden: true, windowFocused: false }
    );

    assert.equal(harness.progressBar.style.animationPlayState, "paused");

    context.mock.timers.tick(10000);
    assert.equal(dismissed.length, 0, "Timer must not advance while page started hidden");

    harness.setDocumentHidden(false);
    harness.setDocumentFocus(true);
    harness.emitWindowFocus();

    assert.equal(harness.progressBar.style.animationPlayState, "running");

    context.mock.timers.tick(5999);
    assert.equal(dismissed.length, 0);

    context.mock.timers.tick(1);
    assert.equal(dismissed.length, 1);
});

test("pressing escape or clicking close dismisses the toast immediately", (context) => {
    const counts = { dismiss: 0 };
    const harness = mountSaveBar(context, {
        isDirty: false,
        onReset: noop,
        saving: false,
        error: null,
        showToast: true,
        canUndo: true,
        onUndo: noop,
        onDismissToast: () => {
            counts.dismiss++;
        },
        toastKey: 1
    });

    const toast = harness.getToastElement();
    assert.ok(toast);
    (toast.props.onKeyDown as (e: { key: string }) => void)({ key: "Escape" });
    assert.equal(counts.dismiss, 1);

    const dismissBtn = harness.getDismissButton();
    assert.ok(dismissBtn);
    (dismissBtn.props.onClick as () => void)();
    assert.equal(counts.dismiss, 2);
});

test("toast pauses while undoing is in progress", (context) => {
    const dismissed: boolean[] = [];
    const harness = mountSaveBar(context, {
        isDirty: false,
        onReset: noop,
        saving: false,
        error: null,
        showToast: true,
        canUndo: true,
        onUndo: noop,
        onDismissToast: () => dismissed.push(true),
        toastKey: 1
    });

    context.mock.timers.tick(2000);
    assert.equal(harness.progressBar.style.animationPlayState, "running");

    harness.setProps({ undoing: true });
    assert.equal(harness.progressBar.style.animationPlayState, "paused");

    context.mock.timers.tick(10000);
    assert.equal(dismissed.length, 0, "Dismissal must not trigger while undo is in flight");

    const undoBtn = harness.getUndoButton();
    assert.ok(undoBtn);
    assert.equal(undoBtn.props.disabled, true);
    assert.match(String(undoBtn.props.children), /Undoing|Restoring/);
});

test("a save that finishes after leaving settings does not redirect the user", async (context) => {
    const response: { resolve?: (value: Response) => void } = {};
    settingsFetch(
        context,
        () =>
            new Promise<Response>((resolve) => {
                response.resolve = resolve;
            })
    );
    const page = mountPage(context, SettingsContent);
    await flushRequests();
    changeName(page, "Saved after leaving");
    submit(page);
    assert.ok(response.resolve, "The save must be in progress before leaving settings");
    page.unmount();
    response.resolve(Response.json({ data: { ...initialProfile, displayName: "Saved after leaving", revision: 5 } }));
    await flushRequests();
    assert.deepEqual(page.destinations, []);
});

for (const [status, code] of [
    [409, "USERNAME_TAKEN"],
    [409, "STALE_PROFILE"],
    [401, "UNAUTHORIZED"],
    [500, "INTERNAL_ERROR"]
] as const) {
    test(`save failure ${code} preserves edits and stays in the editor`, async (context) => {
        settingsFetch(context, async () =>
            Response.json({ error: { code, message: "Server rejected save" } }, { status })
        );
        const page = mountPage(context, SettingsContent);
        await flushRequests();
        changeName(page, "Keep this name");
        submit(page);
        await flushRequests();
        const result = page.render();
        assert.deepEqual(page.destinations, []);
        const details = result.nodes.find((node) => node.type === PersonalDetailsForm);
        assert.equal(details?.props.name, "Keep this name");
        const bar = result.nodes.find((node) => node.type === SettingsSaveBar);
        assert.equal(bar?.props.saving, false);
        assert.ok(bar?.props.error);
        assert.match(result.markup, /role="alert"/);
        assert.doesNotMatch(result.markup, /Server rejected save/);
    });
}

test("a username conflict stays visible until the username is corrected", async (context) => {
    settingsFetch(context, async () =>
        Response.json({ error: { code: "USERNAME_TAKEN", message: "Username already exists" } }, { status: 409 })
    );
    const page = mountPage(context, SettingsContent);
    await flushRequests();
    changeName(page, "Changed display name");
    submit(page);
    await flushRequests();
    changeName(page, "Another display name");
    const unchanged = page.render();
    const existingBar = unchanged.nodes.find((node) => node.type === SettingsSaveBar);
    assert.ok((existingBar?.props.error as { fields?: { username?: string } })?.fields?.username);
    const details = unchanged.nodes.find((node) => node.type === PersonalDetailsForm);
    assert.ok(details);
    (details.props.onChangeHandle as (value: string) => void)("@corrected_username");
    const corrected = page.render();
    const correctedBar = corrected.nodes.find((node) => node.type === SettingsSaveBar);
    assert.equal(correctedBar?.props.error, null);
    assert.doesNotMatch(corrected.markup, /already taken/);
    assert.deepEqual(page.destinations, []);
});

for (const isOwner of [true, false]) {
    test(`the profile ${isOwner ? "confirms an owner's save" : "does not show a save confirmation to visitors"}`, async (context) => {
        void globalThis.fetch;
        context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
            const path = new URL(String(input)).pathname;
            assert.equal(path, "/api/v1/users/by-handle/traveler");
            return Response.json({
                data: {
                    profile: initialProfile,
                    isOwner,
                    friendshipStatus: "none",
                    stats: {
                        countriesVisited: 0,
                        citiesExplored: 0,
                        continentsCovered: 0,
                        photosUploaded: 0,
                        boardsCreated: 0,
                        friends: 0,
                        activitiesSaved: 0,
                        boardsSaved: 0
                    },
                    boards: [],
                    destinations: []
                }
            });
        });
        const props = { handle: "traveler", profileSaved: true };
        const page = mountPage(context, () => HandleProfileContent(props));
        await flushRequests();
        const result = page.render();
        if (isOwner) {
            assert.ok(result.nodes.some((node) => node.props.role === "status"));
            assert.match(result.markup, /Profile changes saved\./);
        } else assert.doesNotMatch(result.markup, /Profile changes saved\./);
    });
}
