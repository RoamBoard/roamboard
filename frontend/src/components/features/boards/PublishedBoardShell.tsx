"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";

type Props = {
    children: ReactNode;
};

// Keep the sidebar and account controls around the board content.
export default function PublishedBoardShell({ children }: Props) {
    return (
        <div className="bg-background text-foreground grid min-h-dvh grid-cols-[auto_minmax(0,1fr)]">
            {/* Keyboard users can skip the sidebar and go straight to the board. */}
            <a
                href="#published-board-content"
                className="bg-background fixed top-3 left-3 z-50 -translate-y-24 border px-4 py-2 focus:translate-y-0"
            >
                Skip to board
            </a>
            <Sidebar activeHref="/boards" />
            <main id="published-board-content" tabIndex={-1} className="border-line min-h-dvh min-w-0 outline-none">
                {children}
            </main>
        </div>
    );
}
