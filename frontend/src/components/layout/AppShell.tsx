import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import ThemeSelect from "@/components/ui/ThemeSelect";
import ProfileControl, {
    type ProfileControlProps
} from "@/components/ui/ProfileControl";

type Props = {
    children: ReactNode;
    activeHref: string;
    profile?: ProfileControlProps;
};

export default function AppShell({ children, activeHref, profile }: Props) {
    return (
        <div className="bg-background text-foreground relative grid h-dvh w-full grid-cols-[5rem_minmax(0,1fr)] overflow-hidden sm:grid-cols-[6rem_minmax(0,1fr)]">
            <Sidebar activeHref={activeHref} />
            <main className="grid min-h-0 min-w-0 overflow-y-auto">
                {children}
            </main>
            <ProfileControl {...profile} />
            <div className="absolute top-5 right-[8.25rem] z-10 sm:right-[18%]">
                <ThemeSelect />
            </div>
        </div>
    );
}
