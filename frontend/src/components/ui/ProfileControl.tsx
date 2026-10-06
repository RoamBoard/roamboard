// This component uses clicks, keyboard events, and React state in the browser.
"use client";

import {
    useEffect,
    useId,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode
} from "react";
import Link from "next/link";
import { getMockProfile, subscribeMockStore } from "@/data/mock-social";

// Export the prop type so AppShell can use it too. This is not actual user data.
// user is optional. A user must have a name, or be null.
export type ProfileControlProps = {
    user?: { name: string; avatarUrl?: string } | null;
    href?: string;
    profileHref?: string;
    settingsHref?: string;
    label?: ReactNode;
    userName?: string;
    avatarUrl?: string;
};

export default function ProfileControl({
    user,
    href,
    profileHref = "/profile",
    settingsHref = "/settings",
    userName,
    avatarUrl
}: ProfileControlProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownId = useId();

    const controlClasses =
        "absolute left-[36%] right-[8%] top-[45%] text-left text-14 leading-tight focus-visible:outline-1 focus-visible:outline-offset-4";

    // Sync with external mock store if available
    const profile = useSyncExternalStore(
        subscribeMockStore,
        getMockProfile,
        getMockProfile
    );

    // Determine effective user:
    // If user is explicitly null, show logged-out view.
    // If user is explicitly provided, use that user.
    // Otherwise, fall back to mock profile user or userName.
    const effectiveUser =
        user === null
            ? null
            : user ?? (profile.name || userName ? {
                  name: profile.name || userName || "ROWAN",
                  avatarUrl: profile.avatarUrl || avatarUrl
              } : null);

    const resolvedProfileHref = href ?? profileHref;

    useEffect(() => {
        if (!isOpen) return;

        function closeOnOutsideClick(event: PointerEvent) {
            if (
                event.target instanceof Node &&
                !containerRef.current?.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("pointerdown", closeOnOutsideClick);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutsideClick);
        };
    }, [isOpen]);

    return (
        <div
            ref={containerRef}
            className="absolute top-0 right-[1.3%] z-10 h-[8.75rem] w-[8.25rem] sm:h-[24%] sm:w-[14.5%]"
            onKeyDown={(event) => {
                if (event.key === "Escape" && isOpen) {
                    setIsOpen(false);
                    buttonRef.current?.focus();
                }
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsOpen(false);
                }
            }}
        >
            {/* These lines are decorative, so screen readers and clicks ignore them. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
            >
                <span className="bg-stone absolute top-[18%] right-[9%] left-0 h-0.5" />
                <span className="bg-stone absolute top-0 right-[17%] h-[39%] w-0.5" />
                <span className="bg-stone absolute top-[25%] bottom-0 left-[32%] w-0.5" />
                <span className="bg-stone absolute top-[66%] right-0 left-[16%] h-0.5" />
            </div>

            {/* A user shows the name button; no user shows the login link below. */}
            {effectiveUser ? (
                <>
                    <button
                        ref={buttonRef}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={dropdownId}
                        className={`${controlClasses} text-obsidian hover:underline cursor-pointer truncate font-medium`}
                        title={effectiveUser.name}
                        onClick={() => setIsOpen((open) => !open)}
                    >
                        {effectiveUser.name}
                    </button>
                    {isOpen && (
                        <nav
                            id={dropdownId}
                            aria-label="Account"
                            className="bg-background text-obsidian border-line text-14 absolute top-[72%] right-[8%] z-50 w-48 border p-3 shadow-xs"
                        >
                            <Link
                                href={resolvedProfileHref}
                                className="block py-1.5 hover:underline focus-visible:outline-1 focus-visible:outline-offset-2"
                                onClick={() => setIsOpen(false)}
                            >
                                My profile
                            </Link>
                            <Link
                                href={settingsHref}
                                className="block py-1.5 hover:underline focus-visible:outline-1 focus-visible:outline-offset-2"
                                onClick={() => setIsOpen(false)}
                            >
                                Settings
                            </Link>
                            <div
                                className="bg-line my-1.5 h-px"
                                aria-hidden="true"
                            />
                            <Link
                                href="/login"
                                className="text-graphite hover:text-obsidian block py-1.5 hover:underline focus-visible:outline-1 focus-visible:outline-offset-2"
                                onClick={() => setIsOpen(false)}
                            >
                                Log out
                            </Link>
                        </nav>
                    )}
                </>
            ) : (
                <Link href="/login" className={controlClasses}>
                    Sign up /
                    <br />
                    Log in
                </Link>
            )}
        </div>
    );
}
