"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUser, signOut, type AuthUser } from "@/lib/auth";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
} from "@/components/ui/dropdown-menu";

export type ProfileControlProps = {
    user?: { name: string } | null;
    compact?: boolean;
    floating?: boolean;
};

export default function ProfileControl({
    user = null,
    compact = false,
    floating = false
}: ProfileControlProps) {
    const router = useRouter();
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
    const [loaded, setLoaded] = useState(Boolean(user));
    const [signingOut, setSigningOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const displayUser =
        user ?? (sessionUser ? { name: sessionUser.displayName } : null);

    useEffect(() => {
        if (user) return;
        const state = { active: true };
        getCurrentUser()
            .then((currentUser) => {
                if (state.active) setSessionUser(currentUser);
            })
            .catch(() => {
                if (state.active)
                    setLogoutError("Account status is unavailable.");
            })
            .finally(() => {
                if (state.active) setLoaded(true);
            });
        return () => {
            state.active = false;
        };
    }, [user]);

    async function handleSignOut() {
        setSigningOut(true);
        setLogoutError("");
        try {
            await signOut();
            setSessionUser(null);
            router.replace("/login");
        } catch (cause) {
            setLogoutError(
                cause instanceof Error ? cause.message : "Could not sign out."
            );
        } finally {
            setSigningOut(false);
        }
    }

    const controlClasses = compact
        ? "absolute inset-x-1 top-[46%] min-h-11 text-center text-10 leading-tight underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        : "absolute left-[36%] right-[8%] top-[45%] text-left text-14 leading-tight underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4";

    return (
        <div
            aria-busy={!loaded}
            className={
                compact
                    ? "bg-background fixed bottom-0 left-0 z-40 h-28 w-16 md:w-20"
                    : floating
                      ? "bg-background/90 fixed top-0 right-16 z-30 h-28 w-32 md:h-40 md:w-44"
                      : "absolute top-0 right-[1.3%] z-10 h-[8.75rem] w-[8.25rem] sm:h-[24%] sm:w-[14.5%]"
            }
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
            >
                <span className="bg-decorative-line absolute top-[18%] right-[9%] left-0 h-0.5" />
                <span className="bg-decorative-line absolute top-0 right-[17%] h-[39%] w-0.5" />
                <span className="bg-decorative-line absolute top-[25%] bottom-0 left-[32%] w-0.5" />
                <span className="bg-decorative-line absolute top-[66%] right-0 left-[16%] h-0.5" />
            </div>
            {displayUser ? (
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={`${controlClasses} cursor-pointer truncate`}
                        >
                            {displayUser.name}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        aria-label="Account"
                        align="end"
                        sideOffset={8}
                        collisionPadding={8}
                        className="w-44"
                    >
                        <DropdownMenuItem asChild>
                            <Link href="/profile">My profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            asChild
                            disabled={Boolean(user) || signingOut}
                        >
                            <button
                                type="button"
                                disabled={Boolean(user) || signingOut}
                                onClick={() => void handleSignOut()}
                            >
                                {signingOut ? "Signing out…" : "Log out"}
                            </button>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : loaded ? (
                <Link href="/login" className={controlClasses}>
                    Sign up /
                    <br />
                    Log in
                </Link>
            ) : null}
            {logoutError ? (
                <p
                    role="alert"
                    className={
                        compact
                            ? "bg-background border-line text-12 absolute bottom-2 left-full ml-2 w-40 border p-2"
                            : floating
                              ? "bg-background text-12 absolute top-full right-0 max-w-48 p-2"
                              : "text-14 absolute top-full right-0 max-w-48"
                    }
                >
                    {logoutError}
                </p>
            ) : null}
        </div>
    );
}
