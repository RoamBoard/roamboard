export type DestinationLoadingState = {
    id: number;
    name: string;
    href: string | null;
    phase: "loading" | "revealing" | "error";
    introComplete: boolean;
    pageReady: boolean;
    error: string;
};

// Two independent gates: the designed introduction and the actual route payload.
// This store belongs to the transition provider, not to a global data cache.
export function createDestinationLoadingStore({ introMs = 3000, timeoutMs = 25000 } = {}) {
    const current: {
        snapshot: DestinationLoadingState | null;
        sequence: number;
        controller?: AbortController;
        intro?: ReturnType<typeof setTimeout>;
        timeout?: ReturnType<typeof setTimeout>;
    } = { snapshot: null, sequence: 0 };
    const listeners = new Set<() => void>();

    function update(patch: Partial<DestinationLoadingState>) {
        if (!current.snapshot) return;
        current.snapshot = { ...current.snapshot, ...patch };
        if (current.snapshot.phase === "loading" && current.snapshot.introComplete && current.snapshot.pageReady) {
            current.snapshot = { ...current.snapshot, phase: "revealing" };
            clearTimeout(current.timeout);
        }
        listeners.forEach((listener) => listener());
    }

    function stop() {
        clearTimeout(current.intro);
        clearTimeout(current.timeout);
        current.controller?.abort();
    }

    function fail(message = "This destination couldn’t be opened. Please try again.") {
        if (!current.snapshot || current.snapshot.phase !== "loading") return;
        stop();
        update({ phase: "error", error: message });
    }

    return {
        getSnapshot: () => current.snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        async begin(name: string, resolveHref: (signal: AbortSignal) => Promise<string>) {
            stop();
            const controller = new AbortController();
            current.controller = controller;
            current.snapshot = {
                id: ++current.sequence,
                name,
                href: null,
                phase: "loading",
                introComplete: introMs === 0,
                pageReady: false,
                error: ""
            };
            listeners.forEach((listener) => listener());
            current.intro = setTimeout(() => update({ introComplete: true }), introMs);
            current.timeout = setTimeout(
                () => fail("This is taking longer than expected. Try again or return to search."),
                timeoutMs
            );
            // Also settle cancellation when a transport ignores AbortSignal.
            const cancelled = new Promise<undefined>((resolve) => {
                controller.signal.addEventListener("abort", () => resolve(undefined), { once: true });
            });
            try {
                const href = await Promise.race([resolveHref(controller.signal), cancelled]);
                if (controller.signal.aborted || !href) return;
                update({ href });
                return href;
            } catch {
                if (!controller.signal.aborted) fail();
            }
        },
        ready(href: string) {
            if (current.snapshot?.href === href && current.snapshot.phase === "loading") update({ pageReady: true });
        },
        finishIntro() {
            clearTimeout(current.intro);
            update({ introComplete: true });
        },
        fail,
        cancel() {
            stop();
            current.snapshot = null;
            listeners.forEach((listener) => listener());
        },
        dispose: stop
    };
}

export type DestinationLoadingStore = ReturnType<typeof createDestinationLoadingStore>;
