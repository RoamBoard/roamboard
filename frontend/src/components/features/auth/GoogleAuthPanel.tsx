"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { setMockAuthState } from "@/data/mock-social";
import GuestAuthPanel from "./GuestAuthPanel";

type Props = {
    mode: "login" | "signup";
};

export default function GoogleAuthPanel({ mode }: Props) {
    const router = useRouter();
    const isSignup = mode === "signup";
    const buttonRef = useRef<HTMLDivElement>(null);
    const signingIn = useRef(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    async function handleCredential(response: GoogleCredentialResponse) {
        if (signingIn.current) return;
        if (!response.credential) {
            setError("Google did not return a sign-in credential. Please try again.");
            return;
        }

        signingIn.current = true;
        setError("");
        setStatus("Signing in…");
        try {
            const result = await signInWithGoogle(response.credential);
            setMockAuthState(true);
            router.replace(result.isNew ? "/home" : "/welcome");
        } catch (cause) {
            setStatus("");
            setError(
                cause instanceof TypeError
                    ? "Could not reach Roamboard. Please try again shortly."
                    : cause instanceof Error
                      ? cause.message
                      : "Sign-in failed. Please try again."
            );
        } finally {
            signingIn.current = false;
        }
    }

    function renderGoogleButton() {
        if (!clientId || !buttonRef.current || !window.google) {
            setError("Google sign-in is not configured. Please try again later.");
            return;
        }

        buttonRef.current.replaceChildren();
        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => void handleCredential(response),
            ux_mode: "popup"
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            text: isSignup ? "signup_with" : "signin_with",
            width: Math.min(320, buttonRef.current.clientWidth)
        });
    }

    return (
        <section aria-labelledby="auth-title" className="text-foreground mx-auto w-full max-w-sm">
            <h1 id="auth-title" className="font-display text-36">
                {isSignup ? "Create account" : "Log in"}
            </h1>
            <p className="text-14 mt-3 mb-8">
                {isSignup
                    ? "Use your Google account to join Roamboard."
                    : "Use your Google account to log in to Roamboard."}
            </p>

            {clientId ? (
                <Script
                    src="https://accounts.google.com/gsi/client"
                    strategy="afterInteractive"
                    onReady={renderGoogleButton}
                    onError={() => setError("Google sign-in could not load. Please refresh.")}
                />
            ) : null}
            <div ref={buttonRef} className="w-full" aria-label="Sign in with Google" />
            {status ? (
                <p role="status" className="text-muted-foreground text-14 mt-4">
                    {status}
                </p>
            ) : null}
            {error ? (
                <p role="alert" className="text-foreground text-14 mt-4">
                    {error}
                </p>
            ) : null}
            {!clientId && !error ? (
                <p className="text-muted-foreground text-13">Google sign-in is not configured.</p>
            ) : null}
            {!isSignup && process.env.NODE_ENV !== "production" ? <GuestAuthPanel /> : null}

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
