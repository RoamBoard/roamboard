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
import { getMockProfile, subscribeMockStore } from "@/data/mock-social";

export type ProfileControlProps = {
    href?: string;
    profileHref?: string;
    settingsHref?: string;
    label?: ReactNode;
    userName?: string;
    avatarUrl?: string;
};

export default function ProfileControl({
    href,
    profileHref = "/profile",
    settingsHref = "/settings",
    label = "my profile",
    userName,
    avatarUrl
}: ProfileControlProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync with external mock store without setState inside effect
    const profile = useSyncExternalStore(
        subscribeMockStore,
        getMockProfile,
        getMockProfile
    );

    const displayName = profile.name || userName;
    const displayAvatar = profile.avatarUrl || avatarUrl;

    // Resolve profile URL with backward-compatibility for href prop
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
                            <span className="text-10 tracking-label text-graphite block font-medium uppercase">
                                traveler
                            </span>
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
                    </div>
                </div>
            )}
        </div>
    );
}
