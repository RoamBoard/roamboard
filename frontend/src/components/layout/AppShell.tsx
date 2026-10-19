import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import BackLink from "@/components/ui/BackLink";
import { type ProfileControlProps } from "@/components/ui/ProfileControl";

type Props = {
    children: ReactNode;
    activeHref: string;
    profile?: ProfileControlProps;
    discover?: { collapsed: boolean };
    backHref?: string;
};

export default function AppShell({ children, activeHref, profile = {}, discover, backHref }: Props) {
    return (
        <div
            className={
                discover
                    ? "bg-background text-foreground relative grid min-h-dvh w-full grid-cols-[auto_minmax(0,1fr)] [overflow-anchor:none]"
                    : "bg-background text-foreground relative grid h-dvh w-full grid-cols-[auto_minmax(0,1fr)] overflow-hidden"
            }
        >
            <Sidebar activeHref={activeHref} profile={profile} />
            <main className={discover ? "grid min-h-0 min-w-0" : "grid min-h-0 min-w-0 overflow-y-auto"}>
                {backHref ? (
                    <div className="relative min-h-full pt-20">
                        <BackLink fallbackHref={backHref} className="absolute top-6 left-4 sm:left-8" />
                        {children}
                    </div>
                ) : (
                    children
                )}
            </main>
        </div>
    );
}
