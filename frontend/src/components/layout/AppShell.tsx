import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
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
        <div className="relative grid h-dvh w-full overflow-hidden bg-white">
            <Sidebar activeHref={activeHref} />
            <main className="grid min-h-0 min-w-0">{children}</main>
            <ProfileControl {...profile} />
        </div>
    );
}
