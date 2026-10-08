"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { setMockAuthState } from "@/data/mock-social";

type Props = {
    mode: "login" | "signup";
};

export default function GoogleAuthPanel({ mode }: Props) {
    const router = useRouter();
    const isSignup = mode === "signup";

    function handleDemoLogin() {
        setMockAuthState(true);
        router.push("/home");
    }

    return (
        <section
            aria-labelledby="auth-title"
            className="text-foreground mx-auto w-full max-w-sm"
        >
            <h1 id="auth-title" className="font-display text-36">
                {isSignup ? "Create account" : "Log in"}
            </h1>
            <p className="text-14 mt-3 mb-8">
                {isSignup
                    ? "Use your Google account to join Roamboard."
                    : "Use your Google account to log in to Roamboard."}
            </p>

            <button
                type="button"
                onClick={handleDemoLogin}
                className="border-obsidian bg-obsidian text-background hover:bg-obsidian/90 text-13 w-full cursor-pointer rounded-[2px] border px-4 py-3 text-center font-bold tracking-wider uppercase transition-colors"
            >
                {isSignup ? "Sign up (Demo)" : "Log in as Rowan (Demo)"}
            </button>

            <button
                type="button"
                disabled
                aria-describedby="auth-preview"
                className="border-line text-graphite text-13 mt-2.5 w-full cursor-not-allowed rounded-[2px] border px-4 py-2.5 text-center opacity-60"
            >
                Continue with Google
            </button>
            <p id="auth-preview" className="text-11 text-stone mt-2 text-center">
                Layout preview. Google sign-in is not connected yet.
            </p>

            <p className="text-14 mt-8">
                {isSignup ? "Already have an account? " : "New to Roamboard? "}
                <Link
                    href={isSignup ? "/login" : "/signup"}
                    className="underline underline-offset-4 focus-visible:outline-1 focus-visible:outline-offset-4"
                >
                    {isSignup ? "Log in" : "Create account"}
                </Link>
            </p>
        </section>
    );
}
