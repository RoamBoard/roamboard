import Link from "next/link";
import type { ReactNode } from "react";
import PublishedBoardShell from "@/components/features/boards/PublishedBoardShell";

// Loading, error, and missing-board pages share this layout and back link.
export default function BoardPageMessage({ title, children }: { title: string; children: ReactNode }) {
    return (
        <PublishedBoardShell>
            <div className="grid min-h-dvh place-content-center gap-5 px-5 text-center">
                <h1 className="font-display text-36 font-bold">{title}</h1>
                <div className="text-muted-foreground text-14 max-w-md">{children}</div>
                <Link
                    href="/boards"
                    className="text-14 mx-auto py-3 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                    Back to boards
                </Link>
            </div>
        </PublishedBoardShell>
    );
}
