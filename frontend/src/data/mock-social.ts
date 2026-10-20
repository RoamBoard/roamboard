import type { UserSettings } from "@/types/social";

export const defaultUserSettings: UserSettings = {
    theme: "light",
    defaultBoardVisibility: "friends",
    emailNotifications: true
};

const SETTINGS_STORAGE_KEY = "roamboard_mock_settings";

const listeners = new Set<() => void>();

function notify() {
    listeners.forEach((listener) => listener());
}

export function subscribeMockStore(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const store: {
    settings: UserSettings;
} = {
    settings: { ...defaultUserSettings }
};

const storeMeta = {
    isRestored: false
};

export function restoreMockStore(): void {
    if (storeMeta.isRestored) return;
    if (typeof window === "undefined") return;
    storeMeta.isRestored = true;

    try {
        const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (storedSettings) {
            store.settings = {
                ...store.settings,
                ...JSON.parse(storedSettings)
            };
        }
        const storedRoamTheme = localStorage.getItem("roamboard-theme");
        if (storedRoamTheme === "dark" || storedRoamTheme === "light") {
            store.settings.theme = storedRoamTheme;
        }
        // Clean up legacy mock storage keys if present in browser
        localStorage.removeItem("roamboard_mock_auth");
        localStorage.removeItem("roamboard_mock_profile");
        notify();
    } catch {
        // Ignore parse errors in local storage
    }
}

export function getMockSettings(): UserSettings {
    return store.settings;
}

export function updateMockSettings(patch: Partial<UserSettings>): UserSettings {
    storeMeta.isRestored = true;
    store.settings = { ...store.settings, ...patch };

    if (typeof window !== "undefined") {
        try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(store.settings));
            if (patch.theme) {
                if (patch.theme === "dark") {
                    document.documentElement.classList.add("dark");
                } else {
                    document.documentElement.classList.remove("dark");
                }
            }
        } catch {
            // Ignore storage errors
        }
    }
    notify();
    return store.settings;
}
