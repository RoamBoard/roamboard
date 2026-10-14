"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    useState,
    useEffect,
    useSyncExternalStore,
    type ReactNode
} from "react";
import { getCurrentUser, signOut, type AuthUser } from "@/lib/auth";
import {
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
    label = "my profile",
    userName,
    avatarUrl,
    handle,
    compact = false,
    floating = false
}: ProfileControlProps) {
    const router = useRouter();
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
    const [loaded, setLoaded] = useState(Boolean(user));
    const [signingOut, setSigningOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const [selectedTheme, setSelectedTheme] = useState("light");

    // Sync with external mock store
    const profile = useSyncExternalStore(
        subscribeMockStore,
        getMockProfile,
        getMockProfileServerSnapshot
    );

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
                    setLoaded(true);
                }
            })
            .catch(() => {
                // Silently fallback to unauthenticated state if offline or 401
                if (state.active) {
                    setSessionUser(null);
                    setLoaded(true);
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
            await signOut();
            setSessionUser(null);
            setMockAuthState(false);
            router.replace("/login");
        } catch (cause) {
            setLogoutError(
                cause instanceof Error ? cause.message : "Could not sign out."
            );
        } finally {
            setSigningOut(false);
        }
    }

    // Real account controls tied to backend session; demo user enabled only through explicit user prop
    const isLoggedIn = Boolean(user || sessionUser);

    const displayName =
        user?.name ||
        sessionUser?.displayName ||
        userName ||
        profile.name ||
        "Rowan";
    const displayAvatar = user?.avatarUrl || avatarUrl || profile.avatarUrl;
    const rawHandle = user?.handle || handle || profile.handle;
    const displayHandle = rawHandle
        ? rawHandle.startsWith("@")
            ? rawHandle
            : `@${rawHandle}`
        : null;
    const resolvedProfileHref = href ?? profileHref;

    const containerClasses = compact
        ? "fixed bottom-4 left-4 z-40"
        : floating
          ? "fixed top-6 right-6 z-40 sm:top-8 sm:right-10"
          : "absolute top-6 right-6 z-40 sm:top-8 sm:right-10";

    if (!loaded) return null;

    if (!isLoggedIn) {
        return (
            <div className={containerClasses}>
                <Link
                    href="/login"
                    className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body bg-background/90 hover:bg-background flex cursor-pointer items-center gap-2 rounded-[2px] border px-3 py-1.5 font-medium transition-colors focus-visible:outline-1 focus-visible:outline-offset-4"
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-muted-foreground shrink-0"
                        aria-hidden="true"
                    >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    <span>log in</span>
                </Link>
            </div>
        );
    }

    return (
        <div className={containerClasses}>
            <DropdownMenu
                modal={false}
                onOpenChange={(open) => {
                    if (open) {
                        setSelectedTheme(
                            document.documentElement.classList.contains("dark")
                                ? "dark"
                                : "light"
                        );
                    }
                }}
            >
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="User profile menu"
                        className="border-line text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body bg-background/90 hover:bg-background flex cursor-pointer items-center gap-2.5 rounded-[2px] border px-3 py-1.5 font-medium transition-colors focus-visible:outline-1 focus-visible:outline-offset-4"
                    >
                        {displayAvatar ? (
                            <div className="bg-faint relative h-5 w-5 shrink-0 overflow-hidden rounded-[1px]">
                                <Image
                                    src={displayAvatar}
                                    alt=""
                                    fill
                                    sizes="20px"
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-muted-foreground shrink-0"
                                aria-hidden="true"
                            >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        )}

                        <span className="truncate">{label}</span>

                        <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-muted-foreground"
                            aria-hidden="true"
                        >
                            <path d="m2 3.5 3 3 3-3" />
                        </svg>
                    </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    collisionPadding={8}
                    className="border-line bg-background min-w-[13rem] rounded-[2px] border p-1 shadow-xs"
                >
                    {Boolean(displayName) && (
                        <div className="border-line border-b px-3 py-2">
                            <span className="font-display text-12 text-foreground block font-bold tracking-tight uppercase">
                                {displayName}
                            </span>
                            {Boolean(displayHandle) && (
                                <span className="text-10 text-muted-foreground block font-medium lowercase">
                                    {displayHandle}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col py-0.5">
                        <DropdownMenuItem asChild>
                            <Link
                                href={resolvedProfileHref}
                                className="text-12 text-muted-foreground hover:text-foreground hover:bg-faint focus-visible:text-foreground focus-visible:bg-faint flex cursor-pointer items-center justify-between rounded-[2px] px-3 py-2 font-medium transition-colors"
                            >
                                <span>my profile</span>
                                <span
                                    className="text-10 text-muted-foreground font-normal"
                                    aria-hidden="true"
                                >
                                    →
                                </span>
                            </Link>
                        </DropdownMenuItem>

                        <div
                            className="bg-line my-0.5 h-px"
                            aria-hidden="true"
                        />

                        <DropdownMenuItem asChild>
                            <Link
                                href={settingsHref}
                                className="text-12 text-muted-foreground hover:text-foreground hover:bg-faint focus-visible:text-foreground focus-visible:bg-faint flex cursor-pointer items-center justify-between rounded-[2px] px-3 py-2 font-medium transition-colors"
                            >
                                <span>settings</span>
                                <span
                                    className="text-10 text-muted-foreground font-normal"
                                    aria-hidden="true"
                                >
                                    →
                                </span>
                            </Link>
                        </DropdownMenuItem>

                        <div
                            className="bg-line my-0.5 h-px"
                            aria-hidden="true"
                        />

                        {/* Theme row: completely uniform with other menu items */}
                        <DropdownMenuItem
                            asChild
                            onSelect={(e) => e.preventDefault()}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    selectTheme(
                                        selectedTheme === "light"
                                            ? "dark"
                                            : "light"
                                    )
                                }
                                className="text-12 text-muted-foreground hover:text-foreground hover:bg-faint focus-visible:text-foreground focus-visible:bg-faint flex w-full cursor-pointer items-center justify-between rounded-[2px] px-3 py-2 text-left font-medium transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        aria-hidden="true"
                                        className="size-3.5 shrink-0 bg-current mask-[url('/icons/sun.svg')] mask-contain mask-center mask-no-repeat dark:mask-[url('/icons/moon.svg')]"
                                    />
                                    <span>theme</span>
                                </div>
                                <span className="text-10 text-muted-foreground tracking-label font-normal uppercase">
                                    {selectedTheme}
                                </span>
                            </button>
                        </DropdownMenuItem>

                        <div
                            className="bg-line my-0.5 h-px"
                            aria-hidden="true"
                        />

                        <DropdownMenuItem
                            asChild
                            disabled={Boolean(user) || signingOut}
                        >
                            <button
                                type="button"
                                disabled={Boolean(user) || signingOut}
                                onClick={() => void handleSignOut()}
                                className="text-12 text-muted-foreground hover:text-foreground hover:bg-faint focus-visible:text-foreground focus-visible:bg-faint flex w-full cursor-pointer items-center justify-between rounded-[2px] px-3 py-2 text-left font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
                            >
                                <span>
                                    {signingOut ? "signing out…" : "log out"}
                                </span>
                                <span
                                    className="text-10 text-muted-foreground font-normal"
                                    aria-hidden="true"
                                >
                                    ↳
                                </span>
                            </button>
                        </DropdownMenuItem>
                    </div>

                    {logoutError && (
                        <div className="border-line border-t px-3 py-2">
                            <p
                                role="alert"
                                className="text-11 font-medium text-red-600"
                            >
                                {logoutError}
                            </p>
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
