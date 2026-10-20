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
        const timeout = setTimeout(() => {
            state.active = false;
            setSignedOut(true);
        }, 3000);
        getCurrentUser()
            .then((currentUser) => {
                if (!state.active) return;
                clearTimeout(timeout);
                if (currentUser) router.replace("/welcome");
                else setSignedOut(true);
            })
            .catch(() => {
                if (!state.active) return;
                clearTimeout(timeout);
                setSignedOut(true);
            });
        return () => {
            state.active = false;
            clearTimeout(timeout);
        };
    }, [router]);

    if (signedOut) return <WelcomeScreen variant="start" />;

    return (
        <main className="bg-background text-foreground grid h-dvh place-items-center px-6 text-center">
            <p role="status">Loading your welcome…</p>
        </main>
    );
}
