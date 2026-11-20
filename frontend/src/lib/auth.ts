export type AuthUser = {
    userId: string;
    username: string;
    displayName: string;
    profilePictureUrl?: string | null;
};

export type GuestAccount = AuthUser;

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ApiError = {
    error?: { code?: string; message?: string };
};

export class AccountDeletionError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = "AccountDeletionError";
    }
}

const accountListeners = new Set<(user: AuthUser | null) => void>();
const accountState = { generation: 0, logoutGeneration: 0, signedOut: false };

export function subscribeToAccountUpdates(listener: (user: AuthUser | null) => void): () => void {
    accountListeners.add(listener);
    return () => {
        accountListeners.delete(listener);
    };
}

export function publishAccountUpdate(user: AuthUser): void {
    if (accountState.signedOut) return;
    accountListeners.forEach((listener) => listener(user));
}

export function captureAccountUpdate(): (user: AuthUser) => void {
    const generation = accountState.generation;
    return (user) => {
        if (generation === accountState.generation) publishAccountUpdate(user);
    };
}

function invalidateAccountUpdates(): void {
    accountState.generation += 1;
    accountState.signedOut = true;
    accountListeners.forEach((listener) => listener(null));
}

export function observeCurrentUser(onChange: (user: AuthUser | null) => void): () => void {
    const state = { active: true, updated: false };
    const unsubscribe = subscribeToAccountUpdates((user) => {
        state.updated = true;
        onChange(user);
    });
    void getCurrentUser()
        .then((user) => {
            if (!state.active || state.updated) return;
            if (user === null) invalidateAccountUpdates();
            else onChange(accountState.signedOut ? null : user);
        })
        .catch(() => {
            if (state.active && !state.updated) onChange(null);
        });
    return () => {
        state.active = false;
        unsubscribe();
    };
}

export async function signInWithGoogle(credential: string): Promise<{ user: AuthUser; isNew: boolean }> {
    // A pending sign-in may overlap an initial /me 401; only explicit logout cancels its account update.
    const logoutGeneration = accountState.logoutGeneration;
    const response = await fetch(`${apiUrl}/api/v1/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential })
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(payload.error?.message ?? "Sign-in failed. Please try again.");
    }

    const payload = (await response.json()) as {
        data: { user: AuthUser; isNew: boolean };
    };
    if (logoutGeneration === accountState.logoutGeneration) {
        accountState.generation += 1;
        accountState.signedOut = false;
        publishAccountUpdate(payload.data.user);
    }
    return payload.data;
}

export async function listGuestAccounts(): Promise<GuestAccount[]> {
    const response = await fetch(`${apiUrl}/api/v1/auth/guests`, { credentials: "include", cache: "no-store" });
    if (!response.ok) throw new Error("Guest list unavailable. Refresh to retry.");
    const payload = (await response.json()) as { data: GuestAccount[] };
    return payload.data;
}

async function guestRequest(path: string, body: object): Promise<{ user: AuthUser; isNew: boolean }> {
    const logoutGeneration = accountState.logoutGeneration;
    const response = await fetch(`${apiUrl}/api/v1/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        throw new Error(payload.error?.message ?? "Guest sign-in failed. Please try again.");
    }
    const payload = (await response.json()) as { data: { user: AuthUser; isNew: boolean } };
    if (logoutGeneration === accountState.logoutGeneration) {
        accountState.generation += 1;
        accountState.signedOut = false;
        publishAccountUpdate(payload.data.user);
    }
    return payload.data;
}

export function createGuestAccount(username: string): Promise<{ user: AuthUser; isNew: boolean }> {
    return guestRequest("guests", { username });
}

export function signInAsGuest(userId: string): Promise<{ user: AuthUser; isNew: boolean }> {
    return guestRequest("guests/sign-in", { userId });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
    const response = await fetch(`${apiUrl}/api/v1/auth/me`, {
        credentials: "include",
        cache: "no-store"
    });

    if (response.status === 401) return null;
    if (!response.ok) throw new Error("Could not load your account.");
    const payload = (await response.json()) as { data: AuthUser };
    return payload.data;
}

export async function signOut(): Promise<void> {
    accountState.logoutGeneration += 1;
    invalidateAccountUpdates();
    const response = await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include"
    });

    if (!response.ok) throw new Error("Could not sign out. Please try again.");
}

export async function deleteAccount(): Promise<void> {
    const response = await fetch(`${apiUrl}/api/v1/users/me`, {
        method: "DELETE",
        credentials: "include"
    });
    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as ApiError;
        if (response.status === 401) {
            accountState.logoutGeneration += 1;
            invalidateAccountUpdates();
        }
        throw new AccountDeletionError(
            payload.error?.message ?? "Account deletion failed. Please try again.",
            response.status
        );
    }
    const payload = (await response.json()) as { data?: { deleted?: boolean } };
    if (payload.data?.deleted !== true)
        throw new Error("The server did not confirm account deletion. Please try again.");
    accountState.logoutGeneration += 1;
    invalidateAccountUpdates();
}
