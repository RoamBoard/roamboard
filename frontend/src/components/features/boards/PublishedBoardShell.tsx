"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import Sidebar from "@/components/layout/Sidebar";
import ProfileControl from "@/components/ui/ProfileControl";
import ThemeSelect from "@/components/ui/ThemeSelect";

type Props = {
    children: ReactNode;
};

// Keep the sidebar and account controls around the board content.
export default function PublishedBoardShell({ children }: Props) {
    const [scrolled, setScrolled] = useState(false);
    const reducedMotion = useReducedMotion();

    // Hide the top controls after scrolling 80 pixels down the page.
    useEffect(() => {
        function handleScroll() {
            setScrolled(window.scrollY > 80);
        }
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        // Remove the listener when we leave this page.
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="bg-background text-foreground min-h-dvh">
            {/* Keyboard users can skip the sidebar and go straight to the board. */}
            <a
                href="#published-board-content"
                className="bg-background fixed top-3 left-3 z-50 -translate-y-24 border px-4 py-2 focus:translate-y-0"
            >
                Skip to board
            </a>
            <div className="pointer-events-none fixed inset-0 z-20 [&_a]:pointer-events-auto">
                <Sidebar activeHref="/boards" />
            </div>
            {/* inert also stops hidden controls from receiving keyboard focus. */}
            <motion.div
                aria-hidden={scrolled}
                inert={scrolled}
                animate={{ opacity: scrolled ? 0 : 1, y: scrolled ? -12 : 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                className="pointer-events-none fixed inset-x-0 top-0 z-30 h-dvh [&_a]:pointer-events-auto [&_button]:pointer-events-auto"
            >
                <ProfileControl />
                <div className="absolute top-5 right-[8.25rem] sm:right-[18%]">
                    <ThemeSelect />
                </div>
            </motion.div>
            <main
                id="published-board-content"
                tabIndex={-1}
                className="border-line ml-[5.5rem] min-h-dvh min-w-0 border-l outline-none sm:ml-[9%]"
            >
                {children}
            </main>
        </div>
    );
}
