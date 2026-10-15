"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { getCurrentUser, signOut, type AuthUser } from "@/lib/auth";
import {
    getMockAuthState,
    getMockAuthStateServerSnapshot,
    getMockProfile,
    getMockProfileServerSnapshot,
    restoreMockStore,
    setMockAuthState,
    subscribeMockStore,
    updateMockSettings
} from "@/data/mock-social";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem
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
    sidebar?: boolean;
    iconOnly?: boolean;
    sidebarAccountOpen?: boolean;
    onSidebarOpenChange?: (open: boolean) => void;
};

export default function ProfileControl({
    user = null,
    href,
    profileHref = "/profile",
    label = "my profile",
    userName,
    handle,
    compact = false,
    floating = false,
    sidebar = false,
    iconOnly = false,
    onSidebarOpenChange,
    sidebarAccountOpen
}: ProfileControlProps) {
    const router = useRouter();
    const [internalOpen, setSidebarOpen] = useState(false);
    const sidebarOpen = sidebarAccountOpen ?? internalOpen;
    const accountPanelId = useId();
    const accountTrigger = useRef<HTMLButtonElement>(null);
    const reducedMotion = useReducedMotion();
    const toggleSidebarAccount = (open: boolean) => {
        setSidebarOpen(open);
        onSidebarOpenChange?.(open);
        if (open) setSelectedTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const [selectedTheme, setSelectedTheme] = useState(() =>
        typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light"
    );

    // Sync with external mock store
    const profile = useSyncExternalStore(subscribeMockStore, getMockProfile, getMockProfileServerSnapshot);
    const mockIsLoggedIn = useSyncExternalStore(subscribeMockStore, getMockAuthState, getMockAuthStateServerSnapshot);

    const selectTheme = (theme: string) => {
        if (theme !== "light" && theme !== "dark") return;
        document.documentElement.classList.toggle("dark", theme === "dark");
        setSelectedTheme(theme);
        updateMockSettings({ theme });
        try {
            localStorage.setItem("roamboard-theme", theme);
        } catch {
            // Theme still switches in memory
        }
    };

    useEffect(() => {
        restoreMockStore();
        if (user) return;
        const state = { active: true };
        getCurrentUser()
            .then((currentUser) => {
                if (state.active) {
                    setSessionUser(currentUser);
                }
            })
            .catch(() => {
                // Silently fallback to unauthenticated state if offline or 401
                if (state.active) {
                    setSessionUser(null);
                }
            });
        return () => {
            state.active = false;
        };
    }, [user]);

    async function handleSignOut() {
        setSigningOut(true);
        setLogoutError("");
        try {
            try {
                await signOut();
            } catch {
                // Proceed if backend session is already invalidated
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

    // Real account controls tied to backend session; demo user enabled through explicit user prop or demo login
    const isLoggedIn = Boolean(user || sessionUser || mockIsLoggedIn);

    const displayName = user?.name || sessionUser?.displayName || profile.name || userName || "Rowan";
    const rawHandle = user?.handle || profile.handle || handle;
    const displayHandle = rawHandle ? (rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`) : null;
    const resolvedProfileHref = href ?? profileHref;

    const containerClasses = sidebar
        ? "relative"
        : compact
          ? "fixed bottom-4 left-20 z-40 md:left-24"
          : floating
            ? "fixed top-6 right-6 z-40 sm:top-8 sm:right-10"
            : "absolute top-6 right-6 z-40 sm:top-8 sm:right-10";

    if (sidebar) {
        return (
            <div
                onKeyDown={(event) => {
                    if (event.key === "Escape" && sidebarOpen) {
                        event.stopPropagation();
                        toggleSidebarAccount(false);
                        accountTrigger.current?.focus();
                    }
                }}
            >
                <AnimatePresence initial={false}>
                    {sidebarOpen && (
                        <motion.div
                            id={accountPanelId}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: reducedMotion ? 0 : 0.2 }}
                            role="region"
                            aria-label="Account options"
                            className="max-h-[min(40dvh,max(3rem,calc(100dvh-12rem)))] overflow-y-auto overscroll-contain"
                        >
                            <div className="font-body text-12 flex flex-col items-start gap-1 py-2 pr-3 pl-12">
                                {isLoggedIn && (
                                    <span className="text-muted-foreground mb-1 break-words">{displayName}</span>
                                )}
                                <Link
                                    href={isLoggedIn ? resolvedProfileHref : "/login"}
                                    className="text-foreground py-2 underline-offset-4 hover:underline"
                                >
                                    {isLoggedIn ? "my profile" : "sign in"} ↗
                                </Link>
                                <button type="button" disabled className="text-muted-foreground py-2 opacity-50">
                                    settings
                                </button>
                                <div role="group" aria-label="Appearance" className="flex gap-3 py-2">
                                    {["light", "dark"].map((theme) => (
                                        <button
                                            key={theme}
                                            type="button"
                                            aria-pressed={selectedTheme === theme}
                                            onClick={() => selectTheme(theme)}
                                            className={`cursor-pointer underline-offset-4 ${selectedTheme === theme ? "text-foreground underline" : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            {theme}
                                        </button>
                                    ))}
                                </div>
                                {isLoggedIn && (
                                    <button
                                        type="button"
                                        disabled={Boolean(user) || signingOut}
                                        onClick={() => void handleSignOut()}
                                        className="cursor-pointer py-2 disabled:opacity-50"
                                    >
                                        {signingOut ? "signing out…" : "log out"}
                                    </button>
                                )}
                                {logoutError && (
                                    <p role="alert" className="text-red-600">
                                        {logoutError}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <button
                    ref={accountTrigger}
                    type="button"
                    aria-label="Account menu"
                    aria-expanded={sidebarOpen}
                    aria-controls={accountPanelId}
                    onClick={() => toggleSidebarAccount(!sidebarOpen)}
                    className="font-body text-12 text-muted-foreground hover:text-foreground flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 font-medium focus-visible:outline-1 focus-visible:outline-offset-4"
                >
                    <UserRound aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0" />
                    {!iconOnly && <span>account</span>}
                    {!iconOnly && (
                        <span aria-hidden="true" className="text-16 ml-auto">
                            {sidebarOpen ? "−" : "+"}
                        </span>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            <DropdownMenu
                modal={false}
                onOpenChange={(open) => {
                    if (open) setSelectedTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
                }}
            >
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="Account menu"
                        className={`font-body text-12 text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer items-center font-medium focus-visible:outline-1 focus-visible:outline-offset-4 ${sidebar ? "w-full gap-3 px-3" : "bg-background/95 border-line gap-5 border px-4 py-2"}`}
                    >
                        {sidebar && <UserRound aria-hidden="true" size={20} strokeWidth={1.5} className="shrink-0" />}
                        {!iconOnly && <span>{isLoggedIn ? label : "account"}</span>}
                        {!iconOnly && (
                            <span aria-hidden="true" className="text-muted-foreground text-16 ml-auto">
                                +
                            </span>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    aria-label="Account options"
                    align="end"
                    side={sidebar ? "right" : compact ? "top" : "bottom"}
                    sideOffset={8}
                    collisionPadding={12}
                    className="border-line bg-background min-w-56 rounded-none border p-0 shadow-none"
                >
                    {isLoggedIn && (
                        <div className="border-line border-b px-5 py-4">
                            <span className="font-display text-14 text-foreground block font-bold uppercase">
                                {displayName}
                            </span>
                            {displayHandle && <span className="text-12 text-muted-foreground">{displayHandle}</span>}
                        </div>
                    )}
                    <div className="px-2 py-2">
                        <DropdownMenuItem asChild className="rounded-none px-3 py-3">
                            <Link
                                href={isLoggedIn ? resolvedProfileHref : "/login"}
                                className="text-14 justify-between"
                            >
                                <span>{isLoggedIn ? "my profile" : "sign in"}</span>
                                <span aria-hidden="true">↗</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="text-14 justify-between rounded-none px-3 py-3">
                            <span>settings</span>
                            <span className="text-10">soon</span>
                        </DropdownMenuItem>
                    </div>
                    <div className="border-line border-t px-5 pt-4 pb-2">
                        <span className="text-10 text-muted-foreground tracking-label uppercase">appearance</span>
                    </div>
                    <DropdownMenuRadioGroup value={selectedTheme} onValueChange={selectTheme} className="px-2 pb-3">
                        {["light", "dark"].map((theme) => (
                            <DropdownMenuRadioItem
                                key={theme}
                                value={theme}
                                className="text-14 rounded-none px-3 py-3 [&>span:first-child]:hidden"
                            >
                                <span
                                    className={
                                        selectedTheme === theme
                                            ? "underline underline-offset-4"
                                            : "text-muted-foreground"
                                    }
                                >
                                    {theme}
                                </span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                    {isLoggedIn && (
                        <div className="border-line border-t p-2">
                            <DropdownMenuItem
                                disabled={Boolean(user) || signingOut}
                                onSelect={() => void handleSignOut()}
                                className="text-14 rounded-none px-3 py-3"
                            >
                                {signingOut ? "signing out…" : "log out"}
                            </DropdownMenuItem>
                        </div>
                    )}
                    {logoutError && (
                        <p role="alert" className="text-12 px-5 py-3 text-red-600">
                            {logoutError}
                        </p>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
