import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { type ProfileControlProps } from "@/components/ui/ProfileControl";

type Props = {
    children: ReactNode;
    activeHref: string;
    profile?: ProfileControlProps;
    discover?: { collapsed: boolean };
};

export default function AppShell({ children, activeHref, profile = {}, discover }: Props) {
    return (
        <div
            className={
                discover
                    ? "bg-background text-foreground relative min-h-dvh w-full"
                    : "bg-background text-foreground relative grid h-dvh w-full grid-cols-[4rem_minmax(0,1fr)] overflow-hidden md:grid-cols-[5rem_minmax(0,1fr)]"
            }
        >
            <Sidebar activeHref={activeHref} profile={profile} />
            {!discover && <div aria-hidden="true" />}
            <main className={discover ? "grid min-h-0 min-w-0" : "grid min-h-0 min-w-0 overflow-y-auto"}>
                {children}
            </main>
        </div>
    );
}
