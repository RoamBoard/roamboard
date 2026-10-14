import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ProfileControl from "@/components/ui/ProfileControl";

type Props = {
    children: ReactNode;
};

// Keep the sidebar and account controls around the board content.
export default function PublishedBoardShell({ children }: Props) {
    return (
        <div className="bg-background text-foreground min-h-dvh">
            {/* Keyboard users can skip the sidebar and go straight to the board. */}
            <a
                href="#published-board-content"
                className="bg-background fixed top-3 left-3 z-50 -translate-y-24 border px-4 py-2 focus:translate-y-0"
            >
                Skip to board
            </a>
            <div className="pointer-events-none fixed inset-y-0 left-0 z-20 w-20 sm:w-24 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
                <Sidebar activeHref="/boards" />
            </div>
            <ProfileControl />
            <main
                id="published-board-content"
                tabIndex={-1}
                className="border-line ml-20 min-h-dvh min-w-0 border-l outline-none sm:ml-24"
            >
                {children}
            </main>
        </div>
    );
}
