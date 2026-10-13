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
    discover?: { collapsed: boolean };
};

export default function AppShell({
    children,
    activeHref,
    profile = {},
    discover
}: Props) {
    return (
        <div
            className={
                discover
                    ? "bg-background text-foreground relative min-h-dvh w-full"
                    : "bg-background text-foreground relative grid h-dvh w-full overflow-hidden"
            }
        >
            <Sidebar activeHref={activeHref} discover={discover} />
            <main className="grid min-h-0 min-w-0">{children}</main>
            <ProfileControl
                {...profile}
                compact={discover?.collapsed}
                floating={Boolean(discover)}
            />
            <div
                className={
                    discover
                        ? "bg-background/90 fixed top-4 right-4 z-30 rounded-full p-2"
                        : "absolute top-5 right-[8.25rem] z-10 sm:right-[18%]"
                }
            >
                <ThemeSelect />
            </div>
        </div>
    );
}
