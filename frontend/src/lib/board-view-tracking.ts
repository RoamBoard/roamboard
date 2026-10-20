import { discoveryRequest } from "./boards-discovery";

// A fresh server challenge is needed after every visibility interruption. No preview/card calls this helper.
export function trackBoardView(boardId: number, visibility: Document = document) {
    const control = { generation: 0, stopped: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
    async function start() {
        const generation = ++control.generation;
        clearTimeout(control.timer);
        if (visibility.visibilityState !== "visible" || control.stopped) return;
        try {
            const result = await discoveryRequest<{ token: string | null }>(`/boards/${boardId}/views`, {
                method: "POST",
                body: "{}"
            });
            if (
                !result.token ||
                generation !== control.generation ||
                control.stopped ||
                visibility.visibilityState !== "visible"
            )
                return;
            control.timer = setTimeout(() => {
                if (generation !== control.generation || control.stopped || visibility.visibilityState !== "visible")
                    return;
                void discoveryRequest(`/boards/${boardId}/views`, {
                    method: "POST",
                    body: JSON.stringify({ token: result.token })
                }).catch(() => {
                    /* View telemetry must never prevent reading a Board. */
                });
            }, 3000);
        } catch {
            /* Reading remains available when tracking is unavailable. */
        }
    }
    const changed = () => {
        void start();
    };
    visibility.addEventListener("visibilitychange", changed);
    void start();
    return () => {
        control.stopped = true;
        control.generation += 1;
        clearTimeout(control.timer);
        visibility.removeEventListener("visibilitychange", changed);
    };
}
