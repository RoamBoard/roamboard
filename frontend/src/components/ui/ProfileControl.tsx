"use client";

import {
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    getMockAuthState,
    getMockProfile,
    setMockAuthState,
    subscribeMockStore
} from "@/data/mock-social";

export type ProfileControlProps = {
    user?: { name: string; avatarUrl?: string; handle?: string } | null;
    href?: string;
    profileHref?: string;
    settingsHref?: string;
    label?: ReactNode;
    userName?: string;
    avatarUrl?: string;
    handle?: string;
};

export default function ProfileControl({
    user,
    href,
    profileHref = "/profile",
    settingsHref = "/settings",
    label = "my profile",
    userName,
    avatarUrl,
    handle
}: ProfileControlProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Determine login status and display info
    // If user prop is explicitly null, user is not logged in.
    // If user prop is explicitly provided, user is logged in.
    // Otherwise, fall back to mock auth state.
    const isLoggedIn = user === null ? false : user !== undefined ? true : mockIsLoggedIn;

    const displayName = user?.name || profile.name || userName;
    const displayAvatar = user?.avatarUrl || profile.avatarUrl || avatarUrl;
    const rawHandle = user?.handle || handle || profile.handle;
    const displayHandle = rawHandle
        ? rawHandle.startsWith("@")
            ? rawHandle
            : `@${rawHandle}`
        : null;
    const resolvedProfileHref = href ?? profileHref;

    // Close dropdown on click outside or escape key
    useEffect(() => {
        if (!isOpen) return;

        function handleClickOutside(event: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    function handleLogout() {
        setIsOpen(false);
        setMockAuthState(false);
        router.push("/login");
    }

    // When not logged in, render a clean "log in" button
    if (!isLoggedIn) {
        return (
            <div className="absolute top-6 right-6 z-40 sm:top-8 sm:right-10">
                <Link
                    href="/login"
                    className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian font-body bg-background/90 hover:bg-background flex cursor-pointer items-center gap-2 rounded-[2px] border px-3 py-1.5 font-medium transition-colors focus-visible:outline-1 focus-visible:outline-offset-4"
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
                        className="text-graphite shrink-0"
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

    // When logged in, render the previous dropdown with log out option
    return (
        <div
            ref={containerRef}
            className="absolute top-6 right-6 z-40 sm:top-8 sm:right-10"
        >
            {/* Trigger Button */}
            <button
                id="profile-dropdown-button"
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                aria-controls="profile-dropdown-menu"
                className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian font-body bg-background/90 hover:bg-background flex cursor-pointer items-center gap-2.5 rounded-[2px] border px-3 py-1.5 font-medium transition-colors focus-visible:outline-1 focus-visible:outline-offset-4"
            >
                {displayAvatar ? (
                    <div className="bg-porcelain relative h-5 w-5 shrink-0 overflow-hidden rounded-[1px]">
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
                        className="text-graphite shrink-0"
                        aria-hidden="true"
                    >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                )}

                <span>{label}</span>

                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-graphite transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                >
                    <path d="m2 3.5 3 3 3-3" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    id="profile-dropdown-menu"
                    role="menu"
                    aria-labelledby="profile-dropdown-button"
                    aria-orientation="vertical"
                    className="border-line bg-background shadow-xs absolute right-0 mt-2 min-w-[12rem] rounded-[2px] border p-1"
                >
                    {Boolean(displayName) && (
                        <div className="border-line border-b px-3 py-2">
                            <span className="font-display text-12 text-obsidian block font-bold uppercase tracking-tight">
                                {displayName}
                            </span>
                            {Boolean(displayHandle) && (
                                <span className="text-10 text-graphite block font-medium lowercase">
                                    {displayHandle}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col py-0.5">
                        <Link
                            href={resolvedProfileHref}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="text-12 text-graphite hover:text-obsidian hover:bg-porcelain focus-visible:text-obsidian focus-visible:bg-porcelain flex items-center justify-between rounded-[2px] px-3 py-2 font-medium transition-colors"
                        >
                            <span>my profile</span>
                            <span
                                className="text-10 text-graphite font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </Link>

                        <div
                            className="bg-line my-0.5 h-px"
                            aria-hidden="true"
                        />

                        <Link
                            href={settingsHref}
                            role="menuitem"
                            onClick={() => setIsOpen(false)}
                            className="text-12 text-graphite hover:text-obsidian hover:bg-porcelain focus-visible:text-obsidian focus-visible:bg-porcelain flex items-center justify-between rounded-[2px] px-3 py-2 font-medium transition-colors"
                        >
                            <span>settings</span>
                            <span
                                className="text-10 text-graphite font-normal"
                                aria-hidden="true"
                            >
                                →
                            </span>
                        </Link>

                        <div
                            className="bg-line my-0.5 h-px"
                            aria-hidden="true"
                        />

                        <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            className="text-12 text-graphite hover:text-obsidian hover:bg-porcelain focus-visible:text-obsidian focus-visible:bg-porcelain flex w-full cursor-pointer items-center justify-between rounded-[2px] px-3 py-2 font-medium transition-colors text-left"
                        >
                            <span>log out</span>
                            <span
                                className="text-10 text-graphite font-normal"
                                aria-hidden="true"
                            >
                                ↳
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
