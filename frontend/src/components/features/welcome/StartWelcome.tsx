"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import WelcomeScreen from "@/components/features/welcome/WelcomeScreen";

export default function StartWelcome() {
    const router = useRouter();
    const [signedOut, setSignedOut] = useState(false);

    useEffect(() => {
        const state = { active: true };
        getCurrentUser()
            .then((currentUser) => {
                if (!state.active) return;
                if (currentUser) router.replace("/welcome");
                else setSignedOut(true);
            })
            .catch(() => {
                if (state.active) setSignedOut(true);
            });
        return () => {
            state.active = false;
        };
    }, [router]);

    if (signedOut) return <WelcomeScreen variant="start" />;

    return (
        <main className="bg-background text-foreground grid h-dvh place-items-center px-6 text-center">
            <p role="status">Loading your welcome…</p>
        </main>
    );
}
