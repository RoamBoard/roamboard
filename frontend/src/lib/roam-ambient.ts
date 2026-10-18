import { roamLandmarks, type RoamLandmarkId } from "./roam-landmarks";

export type RoamMoment = {
    id: number;
    landmark: RoamLandmarkId;
    region: "northwest" | "northeast" | "southwest" | "southeast";
    lifetimeMs: number;
    drawSeconds: number;
    scale: number;
    framing: "edge" | "inset";
};
type AmbientState = {
    focused: boolean;
    typing: boolean;
    hidden: boolean;
    reducedMotion: boolean;
    mobile: boolean;
    compact: boolean;
    transitioning: boolean;
};

// One admission timer and at most three expiry timers. Randomness happens only when
// scheduling an appearance, never while rendering or on the server.
export function createRoamAmbientScheduler({ random = Math.random }: { random?: () => number } = {}) {
    const state: {
        mode: AmbientState;
        moments: readonly RoamMoment[];
        timer?: ReturnType<typeof setTimeout>;
        recent: RoamLandmarkId[];
        remaining: RoamLandmarkId[];
        lastRegion?: RoamMoment["region"];
        count: number;
    } = {
        mode: {
            focused: false,
            typing: false,
            hidden: false,
            reducedMotion: false,
            mobile: false,
            compact: false,
            transitioning: false
        },
        moments: [],
        recent: [],
        remaining: roamLandmarks.map((item) => item.id),
        count: 0
    };
    const expiry = new Map<number, ReturnType<typeof setTimeout>>();
    const listeners = new Set<() => void>();
    const publish = () => listeners.forEach((listener) => listener());
    const pick = <T>(items: readonly T[]) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
    const enabled = () =>
        state.mode.focused &&
        !state.mode.hidden &&
        !state.mode.reducedMotion &&
        !state.mode.compact &&
        !state.mode.transitioning;
    function clear() {
        clearTimeout(state.timer);
        state.timer = undefined;
        expiry.forEach(clearTimeout);
        expiry.clear();
        if (state.moments.length) {
            state.moments = [];
            publish();
        }
    }
    function schedule(first: boolean) {
        if (!enabled()) return;
        const delay = state.mode.typing
            ? 8000 + random() * 4000
            : first
              ? 700 + random() * 600
              : 1900 + random() * 1500 + (random() > 0.85 ? 1800 : 0);
        state.timer = setTimeout(appear, delay);
    }
    function appear() {
        state.timer = undefined;
        if (!enabled()) return;
        const limit = state.mode.mobile ? (state.mode.typing ? 1 : 2) : state.mode.typing ? 2 : 3;
        if (state.moments.length < limit) {
            if (!state.remaining.length) state.remaining = roamLandmarks.map((item) => item.id);
            const availableLandmarks = state.remaining.filter((id) => !state.recent.includes(id));
            const previousSilhouette = roamLandmarks.find((item) => item.id === state.recent.at(-1))?.silhouette;
            const variedLandmarks = availableLandmarks.filter(
                (id) => roamLandmarks.find((item) => item.id === id)?.silhouette !== previousSilhouette
            );
            const landmark = pick(variedLandmarks.length ? variedLandmarks : availableLandmarks);
            const regions: RoamMoment["region"][] = state.mode.mobile
                ? state.mode.typing
                    ? ["northwest"]
                    : ["northwest", "southeast"]
                : ["northwest", "northeast", "southwest", "southeast"];
            const available = regions.filter((region) => !state.moments.some((moment) => moment.region === region));
            const different = available.filter((region) => region !== state.lastRegion);
            const moment: RoamMoment = {
                id: ++state.count,
                landmark,
                region: pick(different.length ? different : available),
                lifetimeMs: 9000 + random() * 4000,
                drawSeconds: 3.2 + random() * 1.4,
                scale: 0.86 + random() * 0.28,
                framing: random() < 0.55 ? "edge" : "inset"
            };
            state.recent = [...state.recent, landmark].slice(-6);
            state.remaining = state.remaining.filter((id) => id !== landmark);
            state.lastRegion = moment.region;
            state.moments = [...state.moments, moment];
            expiry.set(
                moment.id,
                setTimeout(() => {
                    expiry.delete(moment.id);
                    state.moments = state.moments.filter((item) => item.id !== moment.id);
                    publish();
                }, moment.lifetimeMs)
            );
            publish();
        }
        schedule(false);
    }
    return {
        getSnapshot: () => state.moments,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        setState(patch: Partial<AmbientState>) {
            if (!Object.entries(patch).some(([key, value]) => state.mode[key as keyof AmbientState] !== value)) {
                if (enabled() && !state.timer) schedule(true);
                return;
            }
            const wasEnabled = enabled();
            const changedComposition = patch.mobile !== undefined && patch.mobile !== state.mode.mobile;
            state.mode = { ...state.mode, ...patch };
            clearTimeout(state.timer);
            state.timer = undefined;
            if (!enabled() || changedComposition || state.mode.typing) clear();
            schedule(!wasEnabled);
        },
        dispose() {
            clear();
            state.mode = { ...state.mode, focused: false };
        }
    };
}
