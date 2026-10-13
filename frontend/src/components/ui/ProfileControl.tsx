"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { getCurrentUser, signOut, type AuthUser } from "@/lib/auth";
import {
    getMockAuthState,
    getMockProfile,
    setMockAuthState,
    subscribeMockStore
} from "@/data/mock-social";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
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
    label,
    userName,
    avatarUrl,
    compact = false,
    floating = false
}: ProfileControlProps) {
    const router = useRouter();
    const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
    const [loaded, setLoaded] = useState(Boolean(user));
    const [signingOut, setSigningOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");

    // Sync with external mock store
    const profile = useSyncExternalStore(
        subscribeMockStore,
        getMockProfile,
        getMockProfile
    );
    const mockIsLoggedIn = useSyncExternalStore(
        subscribeMockStore,
        getMockAuthState,
        () => true
    );

    const [selectedTheme, setSelectedTheme] = useState("light");

    const selectTheme = (theme: string) => {
        if (theme !== "light" && theme !== "dark") return;
        document.documentElement.classList.toggle("dark", theme === "dark");
        setSelectedTheme(theme);
        try {
            localStorage.setItem("roamboard-theme", theme);
        } catch {
            // Theme still switches in memory
        }
    };

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

    // Determine login status and display info
    const isLoggedIn =
        user === null && !sessionUser
            ? mockIsLoggedIn
            : Boolean(user || sessionUser || mockIsLoggedIn);

    const displayName =
        user?.name || sessionUser?.displayName || userName || profile.name || (typeof label === "string" ? label : "my profile");
    const displayAvatar = user?.avatarUrl || avatarUrl || profile.avatarUrl;
    const resolvedProfileHref = href ?? profileHref;

    const controlClasses = compact
        ? "absolute inset-x-1 top-[46%] min-h-11 text-center text-10 leading-tight underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 flex flex-col items-center justify-center gap-1 cursor-pointer"
        : "absolute left-[36%] right-[8%] top-[45%] text-left text-14 leading-tight underline-offset-2 outline-none hover:underline focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 flex items-center gap-2 cursor-pointer";

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

            {isLoggedIn ? (
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
                            className={`${controlClasses} truncate`}
                        >
                            {displayAvatar && !compact ? (
                                <div className="bg-porcelain relative h-5 w-5 shrink-0 overflow-hidden rounded-[1px]">
                                    <Image
                                        src={displayAvatar}
                                        alt=""
                                        fill
                                        sizes="20px"
                                        className="object-cover"
                                    />
                                </div>
                            ) : null}
                            <span className="truncate">{displayName}</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        aria-label="Account"
                        align="end"
                        sideOffset={8}
                        collisionPadding={8}
                        className="w-48"
                    >
                        <div className="border-line border-b px-2 py-1.5 mb-1">
                            <p className="text-12 font-bold text-foreground truncate">
                                {displayName}
                            </p>
                            {profile?.handle ? (
                                <p className="text-10 text-muted-foreground font-mono truncate">
                                    @{profile.handle}
                                </p>
                            ) : null}
                        </div>

                        <DropdownMenuItem asChild>
                            <Link href={resolvedProfileHref}>my profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={settingsHref}>settings</Link>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-12 text-muted-foreground font-medium">
                                theme
                            </span>
                            <div
                                role="radiogroup"
                                aria-label="Color theme"
                                className="border-line bg-faint flex items-center rounded border p-0.5 text-11"
                            >
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={selectedTheme === "light"}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectTheme("light");
                                    }}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors cursor-pointer ${
                                        selectedTheme === "light"
                                            ? "bg-background text-foreground font-semibold shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="size-3.5 bg-current mask-[url('/icons/sun.svg')] mask-contain mask-center mask-no-repeat"
                                    />
                                    <span>light</span>
                                </button>
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked={selectedTheme === "dark"}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        selectTheme("dark");
                                    }}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 transition-colors cursor-pointer ${
                                        selectedTheme === "dark"
                                            ? "bg-background text-foreground font-semibold shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="size-3.5 bg-current mask-[url('/icons/moon.svg')] mask-contain mask-center mask-no-repeat"
                                    />
                                    <span>dark</span>
                                </button>
                            </div>
                        </div>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            asChild
                            disabled={signingOut}
                        >
                            <button
                                type="button"
                                disabled={signingOut}
                                onClick={() => void handleSignOut()}
                                className="w-full text-left cursor-pointer"
                            >
                                {signingOut ? "Signing out…" : "log out"}
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
