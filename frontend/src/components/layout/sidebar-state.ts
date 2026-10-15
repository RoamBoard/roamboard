const storageKey = "roamboard-sidebar-expanded";
const changeEvent = "roamboard-sidebar-change";
const memory: { expanded: boolean | null } = { expanded: null };

export function subscribeSidebar(callback: () => void) {
    function onStorage(event: StorageEvent) {
        if (event.key === storageKey || event.key === null) {
            memory.expanded = null;
            callback();
        }
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(changeEvent, callback);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(changeEvent, callback);
    };
}

export function getSidebarExpanded() {
    if (memory.expanded !== null) return memory.expanded;
    try {
        return localStorage.getItem(storageKey) === "true";
    } catch {
        return false;
    }
}

export function getSidebarServerSnapshot() {
    return false;
}

export function setSidebarExpanded(expanded: boolean) {
    memory.expanded = expanded;
    try {
        localStorage.setItem(storageKey, String(expanded));
    } catch {
        // The choice still lasts for this visit when storage is unavailable.
    }
    window.dispatchEvent(new Event(changeEvent));
}
