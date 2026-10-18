export const ROAM_PROMPT = "so, where is it you wish to go?";

// Presentation only: this store never reads or writes the search query.
export function createRoamPromptStore({ text = ROAM_PROMPT }: { text?: string } = {}) {
    const state: { text: string; timer?: ReturnType<typeof setTimeout>; finished: boolean } = {
        text: "",
        finished: false
    };
    const listeners = new Set<() => void>();
    const publish = () => listeners.forEach((listener) => listener());
    function finish() {
        if (state.finished) return;
        clearTimeout(state.timer);
        state.timer = undefined;
        state.finished = true;
        state.text = text;
        publish();
    }
    function advance() {
        state.timer = undefined;
        if (state.finished) return;
        state.text = text.slice(0, state.text.length + 1);
        publish();
        if (state.text.length === text.length) {
            state.finished = true;
            return;
        }
        const index = state.text.length;
        const pause = text[index - 1] === "," ? 110 : text[index - 1] === " " ? 12 : 0;
        state.timer = setTimeout(advance, 35 + ((index * 17) % 31) + pause);
    }
    return {
        getSnapshot: () => state.text,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        start({ reducedMotion = false }: { reducedMotion?: boolean } = {}) {
            if (reducedMotion || !text.length) finish();
            else if (!state.finished && !state.timer) state.timer = setTimeout(advance, 180);
        },
        yield: finish,
        dispose() {
            clearTimeout(state.timer);
            state.timer = undefined;
        }
    };
}
