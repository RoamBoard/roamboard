"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { getCurrentUser, signOut, type AuthUser } from "@/lib/auth";
import {
    getMockAuthState,
    getMockAuthStateServerSnapshot,
    getMockProfile,
    getMockProfileServerSnapshot,
    restoreMockStore,
    setMockAuthState,
    subscribeMockStore
} from "@/data/mock-social";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
} from "@/components/ui/dropdown-menu";

export type ProfileControlProps = {
    user?: { name: string; avatarUrl?: string; handle?: string } | null;
    href?: string;
    profileHref?: string;
    settingsHref?: string;
    label?: ReactNode;
    userName?: string;
    avatarUrl?: string;
    handle?: string;
    compact?: boolean;
    floating?: boolean;
};

export default function ProfileControl({
    user = null,
    href,
    profileHref = "/profile",
    settingsHref = "/settings",
    userName
}: ProfileControlProps) {
    const router = useRouter();
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
    const [loaded, setLoaded] = useState(Boolean(user));
    const [signingOut, setSigningOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const reducedMotion = useReducedMotion();

    const profile = useSyncExternalStore(subscribeMockStore, getMockProfile, getMockProfileServerSnapshot);
    const mockIsLoggedIn = useSyncExternalStore(subscribeMockStore, getMockAuthState, getMockAuthStateServerSnapshot);

    const isAuthed = Boolean(user || sessionUser || mockIsLoggedIn);
    const displayName = user?.name || sessionUser?.displayName || userName || (mockIsLoggedIn ? profile.name : null);
    const displayUser = isAuthed ? { name: displayName || "Rowan" } : null;
    const resolvedProfileHref = href ?? profileHref;

    useEffect(() => {
        function handleScroll() {
            const page = document.querySelector("main");
            const hide = window.scrollY > 80 || (page?.scrollTop ?? 0) > 80;
            setScrolled(hide);
            if (hide) setMenuOpen(false);
        }

        handleScroll();
        // Capture also catches pages that scroll inside their main element.
        document.addEventListener("scroll", handleScroll, {
            capture: true,
            passive: true
        });
        return () => document.removeEventListener("scroll", handleScroll, true);
    }, []);

    useEffect(() => {
        restoreMockStore();
        if (user) return;
        const state = { active: true };
        getCurrentUser()
            .then((currentUser) => {
                if (state.active) setSessionUser(currentUser);
            })
            .catch(() => {
                if (state.active) setSessionUser(null);
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
            if (sessionUser) {
                await signOut();
            }
            setSessionUser(null);
            setMockAuthState(false);
            router.replace("/login");
        } catch (cause) {
            setLogoutError(cause instanceof Error ? cause.message : "Could not sign out.");
        } finally {
            setSigningOut(false);
        }
    }

    const controlClasses =
        "absolute top-[40%] right-[8%] left-[36%] min-h-11 text-left text-12 leading-tight underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4";

    return (
        <motion.div
            aria-busy={!loaded}
            aria-hidden={scrolled}
            inert={scrolled}
            animate={{ opacity: scrolled ? 0 : 1, y: scrolled ? -12 : 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="fixed top-4 right-4 z-30 h-24 w-32"
        >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <span className="bg-decorative-line absolute top-[18%] right-[9%] left-0 h-0.5" />
                <span className="bg-decorative-line absolute top-0 right-[17%] h-[39%] w-0.5" />
                <span className="bg-decorative-line absolute top-[25%] bottom-0 left-[32%] w-0.5" />
                <span className="bg-decorative-line absolute top-[84%] right-0 left-[16%] h-0.5" />
            </div>
            <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={displayUser ? "User profile menu" : "Sign up or log in"}
                        className={`${controlClasses} cursor-pointer truncate`}
                    >
                        {displayUser ? (
                            displayUser.name
                        ) : (
                            <>
                                Sign up /<br />
                                Log in
                            </>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    aria-label="Account"
                    align="end"
                    sideOffset={8}
                    collisionPadding={8}
                    className="w-44"
                    onCloseAutoFocus={(event) => {
                        if (scrolled) event.preventDefault();
                    }}
                >
                    {displayUser ? (
                        <>
                            <DropdownMenuItem asChild>
                                <Link href={resolvedProfileHref}>My profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href={settingsHref}>Settings</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild disabled={Boolean(user) || signingOut}>
                                <button
                                    type="button"
                                    disabled={Boolean(user) || signingOut}
                                    onClick={() => void handleSignOut()}
                                >
                                    {signingOut ? "Signing out…" : "Log out"}
                                </button>
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <DropdownMenuItem asChild>
                            <Link href="/login">Sign up / Log in</Link>
                        </DropdownMenuItem>
                    )}
                    {logoutError ? (
                        <p role="alert" className="text-12 mt-2 px-2 pb-1 text-red-600">
                            {logoutError}
                        </p>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </motion.div>
    );
}
