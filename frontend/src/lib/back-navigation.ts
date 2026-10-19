const navigationEvent = "roamboard:back-navigation";
const entryScreens = new Set(["/", "/welcome", "/login", "/signup"]);

function internalHref(href: unknown): string | null {
    if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return null;
    try {
        const url = new URL(href, "https://roamboard.invalid");
        if (url.origin !== "https://roamboard.invalid" || entryScreens.has(url.pathname)) return null;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return null;
    }
}

export function getBackHref(state: unknown): string | null {
    if (!state || typeof state !== "object" || !("roamboardBackHref" in state)) return null;
    return internalHref(state.roamboardBackHref);
}

export function installBackNavigation(
    history: Pick<History, "pushState" | "replaceState" | "state">,
    location: Pick<Location, "href">,
    notify: () => void
) {
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    const push: History["pushState"] = (state, unused, url) => {
        const current = new URL(location.href);
        const backHref = internalHref(`${current.pathname}${current.search}${current.hash}`);
        originalPush.call(history, { ...state, roamboardBackHref: backHref }, unused, url);
        notify();
    };
    const replace: History["replaceState"] = (state, unused, url) => {
        originalReplace.call(history, { ...state, roamboardBackHref: getBackHref(history.state) }, unused, url);
        notify();
    };
    history.pushState = push;
    history.replaceState = replace;
    // Preserve the router's state and any predecessor already saved in this entry.
    replace(history.state, "");
    return () => {
        if (history.pushState === push) history.pushState = originalPush;
        if (history.replaceState === replace) history.replaceState = originalReplace;
    };
}

export function notifyBackNavigation() {
    // Next commits browser history in an insertion effect; notify React after that commit.
    queueMicrotask(() => window.dispatchEvent(new Event(navigationEvent)));
}

export function subscribeBackNavigation(listener: () => void) {
    window.addEventListener(navigationEvent, listener);
    window.addEventListener("popstate", listener);
    return () => {
        window.removeEventListener(navigationEvent, listener);
        window.removeEventListener("popstate", listener);
    };
}

export const getBrowserBackHref = () => getBackHref(window.history.state);
export const getServerBackHref = () => null;
