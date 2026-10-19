"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createGuestAccount, listGuestAccounts, signInAsGuest, type GuestAccount } from "@/lib/auth";
import { loginDestinationAfterBoardComment } from "@/lib/board-comment-return";
import { setMockAuthState } from "@/data/mock-social";

export default function GuestAuthPanel() {
    const router = useRouter();
    const [guests, setGuests] = useState<GuestAccount[]>([]);
    const [username, setUsername] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const state = { active: true };
        void listGuestAccounts()
            .then((accounts) => {
                if (state.active) setGuests(accounts);
            })
            .catch((cause) => {
                if (state.active) setError(cause instanceof Error ? cause.message : "Guest list unavailable.");
            })
            .finally(() => {
                if (state.active) setLoading(false);
            });
        return () => {
            state.active = false;
        };
    }, []);

    async function handleCreate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            await createGuestAccount(username.trim().toLowerCase());
            setMockAuthState(true);
            router.replace(loginDestinationAfterBoardComment("/home"));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not create the guest account.");
            setBusy(false);
        }
    }

    async function handleSignIn(userId: string) {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            await signInAsGuest(userId);
            setMockAuthState(true);
            router.replace(loginDestinationAfterBoardComment("/welcome"));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not sign in to the guest account.");
            setBusy(false);
        }
    }

    return (
        <div className="border-foreground/20 mt-4 border-t pt-4">
            <button
                type="button"
                onClick={() => setShowCreate((current) => !current)}
                aria-expanded={showCreate}
                aria-controls="create-guest-form"
                className="border-foreground bg-foreground text-background hover:bg-foreground/90 text-12 w-full cursor-pointer rounded-[2px] border px-3 py-2 text-center font-bold tracking-wider uppercase transition-colors"
            >
                Create guest account
            </button>
            {showCreate ? (
                <form id="create-guest-form" onSubmit={(event) => void handleCreate(event)} className="mt-3 space-y-2">
                    <label htmlFor="guest-username" className="text-13 block font-medium">
                        Username
                    </label>
                    <input
                        id="guest-username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                        minLength={3}
                        maxLength={30}
                        pattern="[A-Za-z][A-Za-z0-9_]{2,29}"
                        autoComplete="off"
                        aria-describedby="guest-username-hint"
                        className="border-foreground/40 text-14 w-full rounded-[2px] border px-3 py-2"
                    />
                    <p id="guest-username-hint" className="text-muted-foreground text-12">
                        3–30 letters, numbers, or underscores. Start with a letter.
                    </p>
                    <button
                        type="submit"
                        disabled={busy}
                        className="text-13 cursor-pointer underline disabled:opacity-50"
                    >
                        {busy ? "Creating…" : "Create and log in"}
                    </button>
                </form>
            ) : null}
            <details className="border-foreground/30 mt-2 rounded-[2px] border">
                <summary className="text-12 cursor-pointer px-3 py-2 font-bold tracking-wider uppercase">
                    Choose guest account {guests.length ? `(${guests.length})` : ""}
                </summary>
                <div className="border-foreground/20 max-h-40 overflow-y-auto border-t p-1">
                    {loading ? (
                        <p role="status" className="text-13 px-2 py-1">
                            Loading guest accounts…
                        </p>
                    ) : null}
                    {!loading && !error && guests.length === 0 ? (
                        <p className="text-muted-foreground text-13 px-2 py-1">No guest accounts yet.</p>
                    ) : null}
                    {guests.map((guest) => (
                        <button
                            key={guest.userId}
                            type="button"
                            disabled={busy}
                            onClick={() => void handleSignIn(guest.userId)}
                            className="text-13 hover:bg-foreground/10 w-full cursor-pointer rounded-[2px] px-2 py-1.5 text-left disabled:opacity-50"
                        >
                            @{guest.username}
                        </button>
                    ))}
                </div>
            </details>
            {error ? (
                <p role="alert" className="text-12 mt-2">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
