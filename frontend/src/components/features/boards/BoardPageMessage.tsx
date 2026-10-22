import type { ReactNode } from "react";
import PublishedBoardShell from "@/components/features/boards/PublishedBoardShell";
import BackLink from "@/components/ui/BackLink";

// Loading, error, and missing-board pages share this layout and back link.
export default function BoardPageMessage({ title, children }: { title: string; children: ReactNode }) {
    return (
        <PublishedBoardShell>
            <div className="relative grid min-h-[calc(100dvh-var(--app-header-height,0px))] place-content-center gap-5 px-5 text-center">
                <BackLink fallbackHref="/boards" className="absolute top-6 left-4 sm:left-8" />
                <h1 className="font-display text-36 font-bold">{title}</h1>
                <div className="text-muted-foreground text-14 max-w-md">{children}</div>
            </div>
        </PublishedBoardShell>
    );
}
