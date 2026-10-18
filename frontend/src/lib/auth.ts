export type AuthUser = {
    userId: string;
    username: string;
    displayName: string;
    profilePictureUrl?: string | null;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ApiError = {
    error?: { code?: string; message?: string };
};

export async function signInWithGoogle(credential: string): Promise<{ user: AuthUser; isNew: boolean }> {
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
    return payload.data;
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
    const response = await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include"
    });

    if (!response.ok) throw new Error("Could not sign out. Please try again.");
}
