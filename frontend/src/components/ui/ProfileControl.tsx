// This component uses clicks, keyboard events, and React state in the browser.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

// Export the prop type so AppShell can use it too. This is not actual user data.
// user is optional. A user must have a name, or be null.
export type ProfileControlProps = {
    user?: { name: string } | null;
};

export default function ProfileControl({ user = null }: ProfileControlProps) {
    // With no user prop, show the logged-out view. This does not check a session.
    // React remembers isOpen between renders; false means the dropdown is closed.
    const [isOpen, setIsOpen] = useState(false);
    // Refs give us access to the HTML elements without storing them in state.
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    // Connect the button to its dropdown with an ID for screen readers.
    const dropdownId = useId();
    const controlClasses =
        "absolute left-[36%] right-[8%] top-[45%] text-left text-14 leading-tight focus-visible:outline-1 focus-visible:outline-offset-4";

    useEffect(() => {
        // Only listen for outside clicks while the dropdown is open.
        if (!isOpen) return;

        function closeOnOutsideClick(event: PointerEvent) {
            if (
                // Check that the clicked element is outside our outer div.
                event.target instanceof Node &&
                !containerRef.current?.contains(event.target)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("pointerdown", closeOnOutsideClick);
        return () => {
            // Remove the listener when the dropdown closes or the component unmounts.
            document.removeEventListener("pointerdown", closeOnOutsideClick);
        };
        // Run this effect again whenever isOpen changes.
    }, [isOpen]);

    return (
        <div
            ref={containerRef}
            className="absolute top-0 right-[1.3%] z-10 h-[8.75rem] w-[8.25rem] sm:h-[24%] sm:w-[14.5%]"
            onKeyDown={(event) => {
                if (event.key === "Escape" && isOpen) {
                    setIsOpen(false);
                    // Return keyboard focus to the name button after closing.
                    buttonRef.current?.focus();
                }
            }}
            onBlur={(event) => {
                // relatedTarget is the next focused element. Keep the dropdown
                // open when tabbing within it, but close it when focus leaves.
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
            {user ? (
                <>
                    <button
                        ref={buttonRef}
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={dropdownId}
                        className={`${controlClasses} cursor-pointer truncate`}
                        title={user.name}
                        // !open flips the previous state: closed to open, or open to closed.
                        onClick={() => setIsOpen((open) => !open)}
                    >
                        {user.name}
                    </button>
                    {/* && renders the dropdown only when isOpen is true. */}
                    {isOpen && (
                        <nav
                            id={dropdownId}
                            aria-label="Account"
                            className="bg-background text-foreground border-line text-14 absolute top-[72%] right-[8%] w-44 border p-3"
                        >
                            <Link
                                href="/profile"
                                className="block py-2 hover:underline focus-visible:outline-1 focus-visible:outline-offset-2"
                                onClick={() => setIsOpen(false)}
                            >
                                My profile
                            </Link>
                            {/* Logout no fixed yet */}
                            <button
                                type="button"
                                disabled
                                /* for accessibility */
                                aria-describedby={`${dropdownId}-notice`}
                                
                            >
                                Log out
                            </button>
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
