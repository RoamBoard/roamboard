import { searchDestinations, type Destination } from "./destinations";

export type DestinationSearchState = {
    query: string;
    results: Destination[];
    active: number;
    open: boolean;
    loading: boolean;
    searched: boolean;
    error: string;
};

// Shared by the production page and its presenter/API interaction tests, like My Boards.
export function createDestinationSearchStore(searcher = searchDestinations, initialQuery = "") {
    const state: {
        snapshot: DestinationSearchState;
        timer?: ReturnType<typeof setTimeout>;
        controller?: AbortController;
    } = {
        snapshot: {
            query: initialQuery,
            results: [],
            active: -1,
            open: false,
            loading: false,
            searched: false,
            error: ""
        }
    };
    const listeners = new Set<() => void>();

    function update(patch: Partial<DestinationSearchState>) {
        state.snapshot = { ...state.snapshot, ...patch };
        listeners.forEach((listener) => listener());
    }

    function cancel() {
        clearTimeout(state.timer);
        state.controller?.abort();
    }

    function search() {
        cancel();
        const query = state.snapshot.query.trim();
        if (query.length < 2) return;
        const controller = new AbortController();
        state.controller = controller;
        update({ loading: true, searched: false, error: "" });
        state.timer = setTimeout(() => {
            void searcher(query, controller.signal)
                .then((places) => {
                    if (controller.signal.aborted) return;
                    const results = places.slice(0, 3);
                    update({ results, active: results.length ? 0 : -1, searched: true });
                })
                .catch((caught: unknown) => {
                    if (!controller.signal.aborted)
                        update({
                            error: caught instanceof Error ? caught.message : "Search is unavailable. Please try again."
                        });
                })
                .finally(() => {
                    if (!controller.signal.aborted) update({ loading: false });
                });
        }, 300);
    }

    return {
        getSnapshot: () => state.snapshot,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        select(destination: Destination) {
            cancel();
            update({
                query: destination.name,
                results: [],
                active: -1,
                open: false,
                loading: false,
                searched: false,
                error: ""
            });
        },
        setQuery(query: string) {
            cancel();
            update({
                query,
                results: [],
                active: -1,
                open: true,
                loading: query.trim().length >= 2,
                searched: false,
                error: ""
            });
            search();
        },
        setOpen(open: boolean) {
            update({ open });
        },
        moveSelection(direction: 1 | -1) {
            const { active, results } = state.snapshot;
            const next = active < 0 ? (direction === 1 ? 0 : results.length - 1) : active + direction;
            update({ open: true, active: results.length ? (next + results.length) % results.length : -1 });
        },
        submit() {
            const { query, results, active, loading, error } = state.snapshot;
            if (loading) return;
            if (results[active]) return results[active];
            update({ open: true });
            if (query.trim().length < 2) update({ error: "Enter a destination name." });
            else if (error) search();
        },
        // React can reconnect a preserved page after running effect cleanup.
        resume() {
            if (state.snapshot.loading && state.controller?.signal.aborted) search();
        },
        dispose: cancel
    };
}

export type DestinationSearchStore = ReturnType<typeof createDestinationSearchStore>;
