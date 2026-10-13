"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import WelcomeScreen from "@/components/features/welcome/WelcomeScreen";

export default function AuthenticatedWelcome() {
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const state = { active: true };
        getCurrentUser()
            .then((currentUser) => {
                if (!state.active) return;
                if (currentUser) setUser(currentUser);
                else router.replace("/login");
            })
            .catch(() => {
                if (state.active) setError(true);
            });
        return () => {
            state.active = false;
        };
    }, [router]);

    if (user) return <WelcomeScreen username={user.username} />;

    return (
        <main className="bg-background text-foreground grid h-dvh place-items-center px-6 text-center">
            {error ? (
                <div role="alert">
                    <p>Could not load your account.</p>
                    <Link href="/login" className="mt-4 inline-block underline">
                        Go to login
                    </Link>
                </div>
            ) : (
                <p role="status">Loading your welcome…</p>
            )}
        </main>
    );
}
